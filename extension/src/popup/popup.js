/**
 * InReach Popup Script
 * Handles all popup UI interactions: tabs, campaign controls, template management,
 * settings, activity log display, and communication with the background worker.
 */

document.addEventListener("DOMContentLoaded", init);

// ── State ──
let currentStatus = "idle";

// ── Initialization ──

async function init() {
  setupTabs();
  setupTemplateForm();
  setupPlaceholderButtons();
  setupStartStop();
  setupSettings();
  setupDataManagement();
  setupWarningBanner();
  setupDashboardConnection();

  await loadTemplateSelect();
  await loadSettings();
  await loadTemplateList();
  await refreshStatus();
  await refreshActivityLog();
  await refreshDashboardStatus();

  // Dry run toggle — update card visual on change
  document.getElementById("dry-run-toggle").addEventListener("change", (e) => {
    const card = document.getElementById("dry-run-card");
    if (e.target.checked) {
      card.className = "rounded-xl p-3.5 border-2 border-brand-200 bg-brand-50 flex items-center justify-between";
    } else {
      card.className = "rounded-xl p-3.5 border-2 border-dashed border-gray-200 bg-white flex items-center justify-between";
    }
  });

  // Poll status every 3 seconds while popup is open
  setInterval(refreshStatus, 3000);
}

// ── Tab Navigation ──

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;

      // Update button styles — active tab gets white bg
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("active", "bg-white/20", "text-white");
        b.classList.add("text-white/70");
      });
      btn.classList.add("active", "bg-white/20", "text-white");
      btn.classList.remove("text-white/70");

      // Show/hide content
      document.querySelectorAll(".tab-content").forEach((section) => section.classList.add("hidden"));
      document.getElementById(`tab-${tabName}`).classList.remove("hidden");

      // Refresh data when switching tabs
      if (tabName === "dashboard") refreshActivityLog();
      if (tabName === "templates") loadTemplateList();
      if (tabName === "campaign") loadTemplateSelect();
    });
  });
}

// ── Status Refresh ──

async function refreshStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (!response) return;

    currentStatus = response.status;

    // Update status dot and text
    const dot = document.getElementById("status-dot");
    const text = document.getElementById("status-text");

    const statusConfig = {
      idle: { color: "bg-gray-300", label: "Idle" },
      running: { color: "bg-green-400", label: "Running" },
      paused: { color: "bg-yellow-400", label: "Paused" },
    };

    const config = statusConfig[response.status] || statusConfig.idle;
    dot.className = `w-2 h-2 rounded-full ${config.color}`;
    if (response.status === "running") dot.classList.add("animate-pulse-dot");
    text.textContent = config.label;
    if (response.dryRun && response.status === "running") {
      text.textContent += " (Dry Run)";
    }

    // Update header status badge color
    const headerStatus = document.getElementById("header-status");
    if (response.status === "running") {
      headerStatus.className = "flex items-center gap-1.5 bg-green-500/20 rounded-full px-2.5 py-1";
    } else if (response.status === "paused") {
      headerStatus.className = "flex items-center gap-1.5 bg-yellow-500/20 rounded-full px-2.5 py-1";
    } else {
      headerStatus.className = "flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1";
    }

    // Update dry run card visual state
    const dryRunCard = document.getElementById("dry-run-card");
    if (dryRunCard) {
      if (document.getElementById("dry-run-toggle").checked) {
        dryRunCard.className = "rounded-xl p-3.5 border-2 border-brand-200 bg-brand-50 flex items-center justify-between";
      } else {
        dryRunCard.className = "rounded-xl p-3.5 border-2 border-dashed border-gray-200 bg-white flex items-center justify-between";
      }
    }

    // Update daily counter
    document.getElementById("daily-counter").textContent =
      `${response.dailySent} of ${response.dailyLimit} connection requests sent today`;

    // Update stats cards
    document.getElementById("stat-sent").textContent = response.dailySent;
    document.getElementById("stat-skipped").textContent = response.dailySkipped;
    document.getElementById("stat-errors").textContent = response.dailyErrors;

    // Update progress bar
    const pct = response.dailyLimit > 0
      ? Math.min(100, (response.dailySent / response.dailyLimit) * 100)
      : 0;
    document.getElementById("progress-bar").style.width = `${pct}%`;
    document.getElementById("progress-label").textContent =
      `${response.dailySent}/${response.dailyLimit}`;

    // Update start/stop button
    updateStartStopButton(response.status);
  } catch (e) {
    console.error("Failed to get status:", e);
  }
}

// ── Start / Stop ──

function setupStartStop() {
  document.getElementById("start-stop-btn").addEventListener("click", async () => {
    if (currentStatus === "running") {
      await chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
      await refreshStatus();
      return;
    }

    const searchUrl = document.getElementById("search-url").value.trim();
    const templateId = document.getElementById("template-select").value;

    if (!searchUrl) {
      showWarning("Please enter a LinkedIn search URL");
      return;
    }
    if (!searchUrl.includes("linkedin.com/search")) {
      showWarning("URL must be a LinkedIn search page");
      return;
    }
    if (!templateId) {
      showWarning("Please select a message template");
      return;
    }

    // Update dry run setting before starting
    const dryRun = document.getElementById("dry-run-toggle").checked;
    await chrome.storage.local.get("settings").then(({ settings }) => {
      chrome.storage.local.set({ settings: { ...settings, dryRun } });
    });

    const result = await chrome.runtime.sendMessage({
      type: "START_AUTOMATION",
      payload: { searchUrl, templateId },
    });

    if (result.success) {
      // Switch to dashboard tab to see progress
      document.querySelector('[data-tab="dashboard"]').click();
    } else {
      const errorMessages = {
        daily_limit: "Daily limit reached. Try again tomorrow.",
        weekly_limit: "Weekly limit reached. Try again next week.",
        outside_business_hours: "Outside business hours. Adjust in settings.",
        template_not_found: "Selected template not found.",
        content_script_injection_failed: "Could not connect to LinkedIn page. Make sure you're logged in.",
      };
      showWarning(errorMessages[result.error] || `Error: ${result.error}`);
    }

    await refreshStatus();
  });
}

function updateStartStopButton(status) {
  const btn = document.getElementById("start-stop-btn");
  if (status === "running") {
    btn.textContent = "STOP OUTREACH";
    btn.className =
      "w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-sm text-sm tracking-wide";
  } else {
    btn.textContent = "START OUTREACH";
    btn.className =
      "w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 bg-green-500 hover:bg-green-600 active:bg-green-700 shadow-sm text-sm tracking-wide";
  }
}

// ── Template Select (Campaign tab) ──

async function loadTemplateSelect() {
  const { templates } = await chrome.storage.local.get("templates");
  const select = document.getElementById("template-select");
  const currentValue = select.value;

  select.innerHTML = '<option value="">Select a template...</option>';
  (templates || []).forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });

  if (currentValue) select.value = currentValue;

  // Preview on change
  select.addEventListener("change", () => {
    const selected = (templates || []).find((t) => t.id === select.value);
    const container = document.getElementById("template-preview-container");
    const preview = document.getElementById("template-preview");

    if (selected) {
      preview.textContent = selected.body;
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });
}

// ── Template Management ──

async function loadTemplateList() {
  const { templates } = await chrome.storage.local.get("templates");
  const list = document.getElementById("template-list");

  if (!templates || templates.length === 0) {
    list.innerHTML = '<div class="text-sm text-gray-400 text-center py-4">No templates yet</div>';
    return;
  }

  list.innerHTML = templates
    .map(
      (t) => `
    <div class="bg-white rounded-lg border border-gray-200 p-3" data-template-id="${t.id}">
      <div class="flex items-center justify-between mb-1">
        <h4 class="text-sm font-medium text-gray-800">${escapeHtml(t.name)}</h4>
        <div class="flex gap-1">
          <button class="edit-template-btn text-xs text-brand-600 hover:text-brand-700 px-1" data-id="${t.id}">Edit</button>
          <button class="delete-template-btn text-xs text-red-500 hover:text-red-700 px-1" data-id="${t.id}">Delete</button>
        </div>
      </div>
      <p class="text-xs text-gray-500 line-clamp-2">${escapeHtml(t.body)}</p>
      <div class="flex gap-3 mt-2 text-xs text-gray-400">
        <span>Sent: ${t.stats?.sent || 0}</span>
        <span>Accepted: ${t.stats?.accepted || 0}</span>
      </div>
    </div>
  `
    )
    .join("");

  // Edit handlers
  list.querySelectorAll(".edit-template-btn").forEach((btn) => {
    btn.addEventListener("click", () => editTemplate(btn.dataset.id, templates));
  });

  // Delete handlers
  list.querySelectorAll(".delete-template-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteTemplate(btn.dataset.id));
  });
}

function editTemplate(id, templates) {
  const template = templates.find((t) => t.id === id);
  if (!template) return;

  document.getElementById("edit-template-id").value = template.id;
  document.getElementById("template-name").value = template.name;
  document.getElementById("template-body").value = template.body;
  document.getElementById("template-form-title").textContent = "Edit Template";
}

async function deleteTemplate(id) {
  const { templates } = await chrome.storage.local.get("templates");
  const filtered = (templates || []).filter((t) => t.id !== id);
  await chrome.storage.local.set({ templates: filtered });
  await loadTemplateList();
  await loadTemplateSelect();
}

function setupTemplateForm() {
  document.getElementById("save-template-btn").addEventListener("click", async () => {
    const id = document.getElementById("edit-template-id").value || `tpl_${Date.now()}`;
    const name = document.getElementById("template-name").value.trim();
    const body = document.getElementById("template-body").value.trim();

    if (!name || !body) {
      showWarning("Template name and body are required");
      return;
    }

    if (body.length > 300) {
      showWarning(`Message is ${body.length} chars. LinkedIn limit is 300.`);
      return;
    }

    const { templates } = await chrome.storage.local.get("templates");
    const list = templates || [];
    const existingIdx = list.findIndex((t) => t.id === id);

    const template = {
      id,
      name,
      body,
      createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString(),
      stats: existingIdx >= 0 ? list[existingIdx].stats : { sent: 0, accepted: 0 },
    };

    if (existingIdx >= 0) {
      list[existingIdx] = template;
    } else {
      list.push(template);
    }

    await chrome.storage.local.set({ templates: list });

    // Reset form
    document.getElementById("edit-template-id").value = "";
    document.getElementById("template-name").value = "";
    document.getElementById("template-body").value = "";
    document.getElementById("template-form-title").textContent = "New Template";

    await loadTemplateList();
    await loadTemplateSelect();
  });

  document.getElementById("cancel-template-btn").addEventListener("click", () => {
    document.getElementById("edit-template-id").value = "";
    document.getElementById("template-name").value = "";
    document.getElementById("template-body").value = "";
    document.getElementById("template-form-title").textContent = "New Template";
  });
}

function setupPlaceholderButtons() {
  document.querySelectorAll(".placeholder-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const textarea = document.getElementById("template-body");
      const placeholder = btn.dataset.placeholder;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      textarea.value = text.substring(0, start) + placeholder + text.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
    });
  });
}

// ── Settings ──

async function loadSettings() {
  const s = await window.Storage.getSettings();

  document.getElementById("setting-daily-limit").value = s.dailyLimit;
  document.getElementById("setting-weekly-limit").value = s.weeklyLimit;
  document.getElementById("setting-cooldown-min").value = Math.round(s.cooldownMin / 1000);
  document.getElementById("setting-cooldown-max").value = Math.round(s.cooldownMax / 1000);
  document.getElementById("setting-business-hours").checked = s.businessHoursOnly;
  document.getElementById("setting-hours-start").value = s.businessHoursStart;
  document.getElementById("setting-hours-end").value = s.businessHoursEnd;
  document.getElementById("setting-warmup").checked = s.warmupEnabled;
  document.getElementById("dry-run-toggle").checked = s.dryRun;

  // Warmup status
  if (s.warmupEnabled) {
    const effectiveLimit = window.Storage.getEffectiveDailyLimit(s);
    document.getElementById("warmup-status").textContent =
      `Day ${s.warmupDay}: Effective limit is ${effectiveLimit}/day (max ${s.dailyLimit})`;
  } else {
    document.getElementById("warmup-status").textContent = "Disabled — using full daily limit";
  }
}

function setupSettings() {
  document.getElementById("save-settings-btn").addEventListener("click", async () => {
    const settings = {
      dailyLimit: clamp(parseInt(document.getElementById("setting-daily-limit").value) || 25, 1, 40),
      weeklyLimit: clamp(parseInt(document.getElementById("setting-weekly-limit").value) || 100, 1, 150),
      cooldownMin: clamp(parseInt(document.getElementById("setting-cooldown-min").value) || 30, 10, 300) * 1000,
      cooldownMax: clamp(parseInt(document.getElementById("setting-cooldown-max").value) || 90, 30, 600) * 1000,
      businessHoursOnly: document.getElementById("setting-business-hours").checked,
      businessHoursStart: clamp(parseInt(document.getElementById("setting-hours-start").value) || 9, 0, 23),
      businessHoursEnd: clamp(parseInt(document.getElementById("setting-hours-end").value) || 18, 0, 23),
      warmupEnabled: document.getElementById("setting-warmup").checked,
    };

    // Ensure cooldownMax > cooldownMin
    if (settings.cooldownMax <= settings.cooldownMin) {
      settings.cooldownMax = settings.cooldownMin + 10000;
    }

    // Merge with existing (preserve warmupDay)
    const { settings: existing } = await chrome.storage.local.get("settings");
    await chrome.storage.local.set({ settings: { ...existing, ...settings } });

    showWarning("Settings saved!", "success");
    await loadSettings();
  });
}

// ── Activity Log ──

async function refreshActivityLog() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATS" });
    if (!response) return;

    const logContainer = document.getElementById("activity-log");
    const entries = response.activityLog || [];

    if (entries.length === 0) {
      logContainer.innerHTML = '<div class="px-3 py-4 text-sm text-gray-400 text-center">No activity yet</div>';
      return;
    }

    logContainer.innerHTML = entries
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const { icon, text } = formatLogEntry(entry);
        return `
          <div class="px-3 py-2 flex items-start gap-2">
            <span class="text-sm mt-0.5">${icon}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-700 truncate">${escapeHtml(text)}</p>
              <p class="text-xs text-gray-400">${time}</p>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    console.error("Failed to load activity log:", e);
  }
}

function formatLogEntry(entry) {
  switch (entry.type) {
    case "action":
      if (entry.status === "sent" || entry.status === "dry_run") {
        const prefix = entry.status === "dry_run" ? "[DRY] " : "";
        return {
          icon: entry.status === "dry_run" ? "🔵" : "✅",
          text: `${prefix}Sent to ${entry.contactName} — ${entry.contactHeadline || ""}`,
        };
      }
      if (entry.status === "skipped") {
        return { icon: "⏭️", text: `Skipped ${entry.contactName}: ${entry.reason}` };
      }
      if (entry.status === "error") {
        return { icon: "❌", text: `Error for ${entry.contactName}: ${entry.error}` };
      }
      return { icon: "📋", text: `${entry.contactName}: ${entry.status}` };

    case "automation_started":
      return { icon: "🚀", text: `Started campaign with "${entry.template}"` };
    case "automation_stopped":
      return { icon: "🛑", text: "Automation stopped" };
    case "automation_complete":
      return { icon: "✔️", text: `Complete: ${entry.reason}` };
    case "automation_paused":
      return { icon: "⏸️", text: `Paused: ${entry.reason}` };
    case "page_complete":
      return { icon: "📄", text: `Page ${entry.page}: ${entry.sent} sent, ${entry.skipped} skipped` };
    case "warning":
      return { icon: "⚠️", text: `Warning: ${entry.warningType} — ${entry.message || ""}` };
    case "limit_reached":
      return { icon: "🔒", text: `Limit reached: ${entry.reason}` };
    default:
      return { icon: "📝", text: JSON.stringify(entry) };
  }
}

document.getElementById("refresh-log")?.addEventListener("click", refreshActivityLog);

// ── Data Management ──

function setupDataManagement() {
  document.getElementById("export-contacts-btn").addEventListener("click", async () => {
    const { contacts } = await chrome.storage.local.get("contacts");
    if (!contacts || Object.keys(contacts).length === 0) {
      showWarning("No contacts to export");
      return;
    }

    const rows = [["Name", "Headline", "Company", "Status", "Message Sent", "Date", "Profile URL"]];
    for (const [url, data] of Object.entries(contacts)) {
      rows.push([
        data.name || "",
        data.headline || "",
        data.company || "",
        data.status || "",
        (data.messageSent || "").replace(/"/g, '""'),
        data.sentAt || "",
        url,
      ]);
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `inreach-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("clear-log-btn").addEventListener("click", async () => {
    if (confirm("Clear all activity logs? This cannot be undone.")) {
      await chrome.storage.local.set({ activityLog: [] });
      await refreshActivityLog();
    }
  });
}

// ── Warning Banner ──

function setupWarningBanner() {
  document.getElementById("dismiss-warning").addEventListener("click", () => {
    document.getElementById("warning-banner").classList.add("hidden");
  });
}

function showWarning(message, type = "error") {
  const banner = document.getElementById("warning-banner");
  const text = document.getElementById("warning-text");
  text.textContent = message;

  if (type === "success") {
    banner.className = "px-4 py-2 bg-green-50 border-b border-green-200 text-green-700 text-sm flex items-center gap-2";
  } else {
    banner.className = "px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center gap-2";
  }

  banner.classList.remove("hidden");

  // Auto-dismiss success messages
  if (type === "success") {
    setTimeout(() => banner.classList.add("hidden"), 3000);
  }
}

// ── Helpers ──

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ── Dashboard Connection ──

function setupDashboardConnection() {
  document.getElementById("connect-dashboard-btn").addEventListener("click", async () => {
    const apiKey = document.getElementById("dashboard-api-key").value.trim();
    if (!apiKey) {
      showWarning("Please enter an API key");
      return;
    }
    if (!apiKey.startsWith("ir_")) {
      showWarning("API key should start with 'ir_'");
      return;
    }

    await chrome.storage.local.set({ dashboardApiKey: apiKey });

    // Verify the key
    const result = await chrome.runtime.sendMessage({ type: "VERIFY_DASHBOARD" });
    if (result?.success) {
      showWarning("Connected to dashboard!", "success");
      await refreshDashboardStatus();
    } else {
      showWarning("Invalid API key or dashboard unreachable");
      await chrome.storage.local.remove("dashboardApiKey");
    }
  });

  document.getElementById("disconnect-dashboard-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove([
      "dashboardApiKey",
      "dashboardConnected",
      "dashboardUser",
      "dashboardLastSync",
    ]);
    document.getElementById("dashboard-api-key").value = "";
    await refreshDashboardStatus();
    showWarning("Disconnected from dashboard", "success");
  });
}

async function refreshDashboardStatus() {
  const { dashboardConnected, dashboardUser, dashboardLastSync, dashboardApiKey } =
    await chrome.storage.local.get([
      "dashboardConnected",
      "dashboardUser",
      "dashboardLastSync",
      "dashboardApiKey",
    ]);

  const statusEl = document.getElementById("dashboard-status");
  const keyInput = document.getElementById("dashboard-api-key");

  if (dashboardConnected && dashboardUser) {
    statusEl.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span> Connected as <strong>${escapeHtml(dashboardUser.email || dashboardUser.name)}</strong>`;
    if (dashboardLastSync) {
      const ago = new Date(dashboardLastSync).toLocaleTimeString();
      statusEl.innerHTML += ` <span class="text-gray-300">· Last sync: ${ago}</span>`;
    }
    keyInput.value = dashboardApiKey ? "••••••••••••••••" : "";
  } else {
    statusEl.textContent = "Not connected";
    keyInput.value = "";
  }
}
