/**
 * Chrome storage helpers.
 * Wraps chrome.storage.local with typed accessors for settings, stats, contacts, and templates.
 */

const DEFAULT_SETTINGS = {
  dailyLimit: 25,
  weeklyLimit: 100,
  cooldownMin: 30000,
  cooldownMax: 90000,
  businessHoursOnly: true,
  businessHoursStart: 9,
  businessHoursEnd: 18,
  warmupEnabled: true,
  warmupDay: 1,
  dryRun: false,
};

const DEFAULT_TEMPLATES = [
  {
    id: "tpl_default",
    name: "Default Intro",
    body: "Hi {{firstName}}, I came across your profile and I'm impressed by your work as {{job}} at {{company}}. I'd love to connect and exchange ideas!",
    createdAt: new Date().toISOString(),
    stats: { sent: 0, accepted: 0 },
  },
  {
    id: "tpl_google_swe_casual",
    name: "Google SWE Intern - Casual",
    body: "Hey {{firstName}}! Saw you're interning at Google as a SWE - that's awesome. I'm building in the same space and would love to hear about your experience. Let's connect!",
    createdAt: new Date().toISOString(),
    stats: { sent: 0, accepted: 0 },
  },
  {
    id: "tpl_google_swe_referral",
    name: "Google SWE Intern - Referral Ask",
    body: "Hi {{firstName}}, congrats on the SWE role at Google! I'm exploring opportunities there and would love to connect. Always great to know people doing cool work at {{company}}.",
    createdAt: new Date().toISOString(),
    stats: { sent: 0, accepted: 0 },
  },
  {
    id: "tpl_google_swe_network",
    name: "Google SWE Intern - Networking",
    body: "Hi {{firstName}}, fellow engineer here! Noticed your work at {{company}} and I'd love to connect. Always looking to grow my network with people in tech. Hope to chat sometime!",
    createdAt: new Date().toISOString(),
    stats: { sent: 0, accepted: 0 },
  },
  {
    id: "tpl_google_swe_specific",
    name: "Google SWE Intern - Project Interest",
    body: "Hey {{firstName}}! Really cool to see your path to {{company}}. I'm interested in what teams are working on there. Would love to connect and maybe swap notes on the industry!",
    createdAt: new Date().toISOString(),
    stats: { sent: 0, accepted: 0 },
  },
];

// ── Generic helpers ──

async function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

async function storageSet(data) {
  return chrome.storage.local.set(data);
}

// ── Settings ──

async function getSettings() {
  const { settings } = await storageGet("settings");
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function saveSettings(updates) {
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await storageSet({ settings: merged });
  return merged;
}

// ── Templates ──

async function getTemplates() {
  const { templates } = await storageGet("templates");
  if (!templates || templates.length === 0) {
    await storageSet({ templates: DEFAULT_TEMPLATES });
    return DEFAULT_TEMPLATES;
  }
  return templates;
}

async function saveTemplate(template) {
  const templates = await getTemplates();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.push(template);
  }
  await storageSet({ templates });
  return templates;
}

async function deleteTemplate(templateId) {
  const templates = await getTemplates();
  const filtered = templates.filter((t) => t.id !== templateId);
  await storageSet({ templates: filtered });
  return filtered;
}

// ── Daily Stats ──

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function getWeekStartString() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split("T")[0];
}

async function getDailyStats() {
  const { dailyStats } = await storageGet("dailyStats");
  const today = getTodayString();

  // Reset if it's a new day
  if (!dailyStats || dailyStats.date !== today) {
    const fresh = { date: today, sent: 0, skipped: 0, errors: 0 };
    await storageSet({ dailyStats: fresh });
    return fresh;
  }
  return dailyStats;
}

async function incrementDailyCount(field = "sent") {
  const stats = await getDailyStats();
  stats[field] = (stats[field] || 0) + 1;
  await storageSet({ dailyStats: stats });
  return stats;
}

async function getWeeklyStats() {
  const { weeklyStats } = await storageGet("weeklyStats");
  const weekStart = getWeekStartString();

  if (!weeklyStats || weeklyStats.weekStart !== weekStart) {
    const fresh = { weekStart, sent: 0 };
    await storageSet({ weeklyStats: fresh });
    return fresh;
  }
  return weeklyStats;
}

async function incrementWeeklyCount() {
  const stats = await getWeeklyStats();
  stats.sent += 1;
  await storageSet({ weeklyStats: stats });
  return stats;
}

// ── Limit Checks ──

async function canSendMore() {
  const settings = await getSettings();
  const daily = await getDailyStats();
  const weekly = await getWeeklyStats();

  // Calculate effective daily limit (with warmup)
  let effectiveLimit = settings.dailyLimit;
  if (settings.warmupEnabled) {
    effectiveLimit = Math.min(settings.dailyLimit, settings.warmupDay * 5);
  }

  if (daily.sent >= effectiveLimit) {
    return { allowed: false, reason: "daily_limit", sent: daily.sent, limit: effectiveLimit };
  }
  if (weekly.sent >= settings.weeklyLimit) {
    return { allowed: false, reason: "weekly_limit", sent: weekly.sent, limit: settings.weeklyLimit };
  }

  // Business hours check
  if (settings.businessHoursOnly) {
    const hour = new Date().getHours();
    if (hour < settings.businessHoursStart || hour >= settings.businessHoursEnd) {
      return { allowed: false, reason: "outside_business_hours" };
    }
  }

  return { allowed: true, dailySent: daily.sent, dailyLimit: effectiveLimit };
}

// ── Contact Log ──

async function getContacts() {
  const { contacts } = await storageGet("contacts");
  return contacts || {};
}

async function isContactProcessed(profileUrl) {
  const contacts = await getContacts();
  // Normalize URL — strip query params and trailing slash
  const normalized = profileUrl.split("?")[0].replace(/\/$/, "");
  return !!contacts[normalized];
}

async function logContact(profileUrl, contactData, status) {
  const contacts = await getContacts();
  const normalized = profileUrl.split("?")[0].replace(/\/$/, "");
  contacts[normalized] = {
    ...contactData,
    status,
    sentAt: new Date().toISOString(),
  };
  await storageSet({ contacts });
}

async function getContactLog() {
  const contacts = await getContacts();
  return Object.entries(contacts)
    .map(([url, data]) => ({ url, ...data }))
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

// ── Automation State ──

const DEFAULT_STATE = {
  status: "idle",
  currentSearchUrl: null,
  currentTemplateId: null,
  currentPage: 1,
  processedOnPage: 0,
};

async function getAutomationState() {
  const { automationState } = await storageGet("automationState");
  return { ...DEFAULT_STATE, ...automationState };
}

async function setAutomationState(updates) {
  const current = await getAutomationState();
  const merged = { ...current, ...updates };
  await storageSet({ automationState: merged });
  return merged;
}

// ── Activity Log ──

async function getActivityLog() {
  const { activityLog } = await storageGet("activityLog");
  return activityLog || [];
}

async function addActivityEntry(entry) {
  const log = await getActivityLog();
  log.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  // Keep last 500 entries
  if (log.length > 500) log.length = 500;
  await storageSet({ activityLog: log });
}

// ── Warmup ──

async function advanceWarmupDay() {
  const settings = await getSettings();
  if (settings.warmupEnabled && settings.warmupDay * 5 < settings.dailyLimit) {
    await saveSettings({ warmupDay: settings.warmupDay + 1 });
  }
}

// Make available in content script context
if (typeof window !== "undefined") {
  window.Storage = {
    getSettings,
    saveSettings,
    getTemplates,
    saveTemplate,
    deleteTemplate,
    getDailyStats,
    incrementDailyCount,
    getWeeklyStats,
    incrementWeeklyCount,
    canSendMore,
    getContacts,
    isContactProcessed,
    logContact,
    getContactLog,
    getAutomationState,
    setAutomationState,
    getActivityLog,
    addActivityEntry,
    advanceWarmupDay,
  };
}
