/**
 * InReach Background Service Worker
 * Orchestrates the automation: manages state, enforces limits,
 * coordinates between popup and content script, handles tab management.
 */

// ── Imports ──
importScripts("../utils/constants.js");
importScripts("../utils/storage.js");
importScripts("../utils/sync-layer.js");

const { getSettings, getTemplates, addActivityEntry, getDailyStats, canSendMore, getEffectiveDailyLimit } = self.Storage;

// ── State ──

let automationState = {
  status: "idle", // "idle" | "running" | "paused"
  currentSearchUrl: null,
  currentTemplateId: null,
  currentTemplate: null,
  currentPage: 1,
  tabId: null,
  dryRun: false,
  campaignId: null, // Dashboard campaign ID (if connected)
};

// ── Tab Management ──

async function findOrCreateLinkedInTab(url) {
  // Look for an existing LinkedIn tab
  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });

  if (tabs.length > 0) {
    const tab = tabs[0];
    // Navigate to our search URL if it's different
    if (!tab.url.startsWith(url.split("?")[0])) {
      await chrome.tabs.update(tab.id, { url, active: true });
    } else {
      await chrome.tabs.update(tab.id, { active: true });
    }
    return tab.id;
  }

  // Create a new tab
  const tab = await chrome.tabs.create({ url, active: true });
  return tab.id;
}

async function ensureContentScriptInjected(tabId) {
  try {
    // Try pinging the content script
    const response = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return response?.status === "alive";
  } catch {
    // Content script not loaded — inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "src/utils/constants.js",
          "src/utils/dom-selectors.js",
          "src/utils/human-simulator.js",
          "src/utils/storage.js",
          "src/scripts/content.js",
        ],
      });
      // Wait a moment for scripts to initialize
      await new Promise((r) => setTimeout(r, 500));
      return true;
    } catch (e) {
      console.error("[InReach BG] Failed to inject content script:", e);
      return false;
    }
  }
}

// ── Automation Control ──

async function startAutomation(searchUrl, templateId) {
  // Pre-flight checks
  const limitCheck = await canSendMore();
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason };
  }

  // Get template
  const templates = await getTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return { success: false, error: "template_not_found" };
  }

  const settings = await getSettings();

  // Navigate to LinkedIn
  const tabId = await findOrCreateLinkedInTab(searchUrl);

  // Wait for page to load
  await new Promise((r) => setTimeout(r, 3000));

  // Inject content script
  const injected = await ensureContentScriptInjected(tabId);
  if (!injected) {
    return { success: false, error: "content_script_injection_failed" };
  }

  // Update state
  automationState = {
    status: "running",
    currentSearchUrl: searchUrl,
    currentTemplateId: templateId,
    currentTemplate: template.body,
    currentPage: 1,
    tabId,
    dryRun: settings.dryRun,
  };

  await chrome.storage.local.set({ automationState: { ...automationState } });
  await addActivityEntry({
    type: "automation_started",
    searchUrl,
    template: template.name,
  });

  // Tell content script to begin
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "BEGIN_SCRAPE_AND_SEND",
      payload: {
        template: template.body,
        dryRun: settings.dryRun,
      },
    });
  } catch (e) {
    automationState.status = "idle";
    return { success: false, error: "failed_to_start_content_script" };
  }

  return { success: true };
}

async function stopAutomation() {
  if (automationState.tabId) {
    try {
      await chrome.tabs.sendMessage(automationState.tabId, { type: "STOP" });
    } catch (e) { console.warn("[InReach BG] Failed to send stop message:", e); }
  }

  automationState.status = "idle";
  await chrome.storage.local.set({ automationState: { status: "idle" } });
  await addActivityEntry({ type: "automation_stopped" });
}

async function handlePageComplete(payload) {
  if (automationState.status !== "running") return;

  await addActivityEntry({
    type: "page_complete",
    page: automationState.currentPage,
    ...payload,
  });

  // Sync page complete to dashboard
  if (globalThis.InReachSync && automationState.campaignId) {
    globalThis.InReachSync.syncToServer(
      `/campaign/${automationState.campaignId}/status`,
      { currentPage: automationState.currentPage }
    );
    // Flush activity buffer
    globalThis.InReachSync.syncToServer("/activity", [
      {
        campaignId: automationState.campaignId,
        type: "page_complete",
        data: { page: automationState.currentPage, ...payload },
      },
    ]);
  }

  // Check if we should continue to next page
  if (payload.noResults) {
    automationState.status = "idle";
    await chrome.storage.local.set({ automationState: { status: "idle" } });
    await addActivityEntry({ type: "automation_complete", reason: "no_more_results" });
    return;
  }

  // Check limits before proceeding
  const limitCheck = await canSendMore();
  if (!limitCheck.allowed) {
    automationState.status = "idle";
    await chrome.storage.local.set({ automationState: { status: "idle" } });
    await addActivityEntry({ type: "automation_paused", reason: limitCheck.reason });
    return;
  }

  // Go to next page
  automationState.currentPage++;

  try {
    const response = await chrome.tabs.sendMessage(automationState.tabId, {
      type: "NEXT_PAGE",
    });

    if (response?.success) {
      // Wait for page load, then process
      await new Promise((r) => setTimeout(r, 3000));

      await ensureContentScriptInjected(automationState.tabId);

      await chrome.tabs.sendMessage(automationState.tabId, {
        type: "BEGIN_SCRAPE_AND_SEND",
        payload: {
          template: automationState.currentTemplate,
          dryRun: automationState.dryRun,
        },
      });
    } else {
      // No more pages
      automationState.status = "idle";
      await chrome.storage.local.set({ automationState: { status: "idle" } });
      await addActivityEntry({ type: "automation_complete", reason: "no_more_pages" });
    }
  } catch (e) {
    console.error("[InReach BG] Error navigating to next page:", e);
    automationState.status = "idle";
    await chrome.storage.local.set({ automationState: { status: "idle" } });
  }
}

async function handleActionComplete(payload) {
  const { contact, status, message, reason, error } = payload;

  await addActivityEntry({
    type: "action",
    contactName: contact.name,
    contactHeadline: contact.headline,
    status,
    message: message || null,
    reason: reason || null,
    error: error || null,
  });

  // Sync to dashboard
  if (globalThis.InReachSync && automationState.campaignId) {
    globalThis.InReachSync.syncToServer("/actions", {
      campaignId: automationState.campaignId,
      profileUrl: contact.profileUrl || "",
      name: contact.name || null,
      headline: contact.headline || null,
      company: contact.company || null,
      status: status === "dry_run" ? "sent" : status,
      messageSent: message || null,
    });
  }
}

async function handleWarning(payload) {
  automationState.status = "paused";
  await chrome.storage.local.set({ automationState: { status: "paused" } });
  await addActivityEntry({
    type: "warning",
    warningType: payload.type,
    message: payload.message || null,
  });

  // Stop the content script
  if (automationState.tabId) {
    try {
      await chrome.tabs.sendMessage(automationState.tabId, { type: "STOP" });
    } catch (e) { console.warn("[InReach BG] Failed to send stop message:", e); }
  }
}

// ── Message Listener ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      // From popup
      case "START_AUTOMATION": {
        const { searchUrl, templateId } = message.payload;
        const result = await startAutomation(searchUrl, templateId);
        sendResponse(result);
        break;
      }

      case "STOP_AUTOMATION": {
        await stopAutomation();
        sendResponse({ success: true });
        break;
      }

      case "GET_STATUS": {
        const daily = await getDailyStats();
        const settings = await getSettings();
        const effectiveLimit = getEffectiveDailyLimit(settings);
        sendResponse({
          status: automationState.status,
          currentPage: automationState.currentPage,
          dailySent: daily.sent,
          dailyLimit: effectiveLimit,
          dailySkipped: daily.skipped,
          dailyErrors: daily.errors,
          dryRun: automationState.dryRun,
        });
        break;
      }

      case "GET_STATS": {
        const stats = await getDailyStats();
        const log = await (async () => {
          const { activityLog } = await chrome.storage.local.get("activityLog");
          return (activityLog || []).slice(0, 50);
        })();
        sendResponse({ stats, activityLog: log });
        break;
      }

      // From content script
      case "ACTION_COMPLETE": {
        await handleActionComplete(message.payload);
        sendResponse({ ok: true });
        break;
      }

      case "PAGE_COMPLETE": {
        await handlePageComplete(message.payload);
        sendResponse({ ok: true });
        break;
      }

      case "WARNING_DETECTED": {
        await handleWarning(message.payload);
        sendResponse({ ok: true });
        break;
      }

      case "LIMIT_REACHED": {
        automationState.status = "idle";
        await chrome.storage.local.set({ automationState: { status: "idle" } });
        await addActivityEntry({
          type: "limit_reached",
          reason: message.payload.reason,
        });
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ error: "unknown_message_type" });
    }
  };

  handler();
  return true; // Keep message channel open for async response
});

// ── Tab Update Listener ──
// Re-inject content script when LinkedIn tab navigates to a new search page

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    automationState.status === "running" &&
    tabId === automationState.tabId &&
    changeInfo.status === "complete" &&
    tab.url?.includes("linkedin.com/search")
  ) {
    await ensureContentScriptInjected(tabId);
  }
});

// ── Alarm: Daily Warmup Advancement ──
// Advance warmup day at midnight

chrome.alarms.create("warmup-advance", {
  periodInMinutes: 60, // Check every hour
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "warmup-advance") {
    const settings = await getSettings();
    if (!settings.warmupEnabled) return;

    const { lastWarmupDate } = await chrome.storage.local.get("lastWarmupDate");
    const today = new Date().toISOString().split("T")[0];

    if (lastWarmupDate !== today) {
      const newDay = Math.min(
        settings.warmupDay + 1,
        Math.ceil(settings.dailyLimit / 5)
      );
      await chrome.storage.local.set({
        settings: { ...settings, warmupDay: newDay },
        lastWarmupDate: today,
      });
    }
  }
});

// ── Dashboard Sync on Startup ──

async function syncWithDashboard() {
  if (!globalThis.InReachSync) return;
  try {
    const result = await globalThis.InReachSync.verifyAndSync();
    if (result) {
      console.log("[InReach] Dashboard sync successful:", result.user?.email);
    }
  } catch (e) {
    console.warn("[InReach] Dashboard sync failed:", e);
  }
}

// Sync on startup
syncWithDashboard();

// Retry pending syncs periodically
chrome.alarms.create("sync-retry", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "sync-retry" && globalThis.InReachSync) {
    await globalThis.InReachSync.retryPendingSyncs();
  }
});

// Handle messages from popup for dashboard connection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "VERIFY_DASHBOARD") {
    (async () => {
      const result = await globalThis.InReachSync?.verifyAndSync();
      sendResponse(result ? { success: true, user: result.user } : { success: false });
    })();
    return true;
  }
});

console.log("[InReach] Background service worker loaded.");
