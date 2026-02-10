/**
 * InReach Sync Layer
 * Handles communication between the Chrome extension and the InReach Dashboard.
 * Queues failed requests for retry.
 */

const DASHBOARD_BASE_URL = "http://localhost:3000";

async function getDashboardConfig() {
  const { dashboardApiKey, dashboardUrl } = await chrome.storage.local.get([
    "dashboardApiKey",
    "dashboardUrl",
  ]);
  return {
    apiKey: dashboardApiKey || null,
    baseUrl: dashboardUrl || DASHBOARD_BASE_URL,
  };
}

/**
 * Send data to the dashboard API.
 * On failure, queues the request for later retry.
 */
async function syncToServer(endpoint, data, method = "POST") {
  const config = await getDashboardConfig();
  if (!config.apiKey) return null;

  const url = `${config.baseUrl}/api/ext${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: method !== "GET" ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[InReach Sync] Failed to sync ${endpoint}:`, error.message);
    await queueForRetry(endpoint, data, method);
    return null;
  }
}

/**
 * Fetch data from the dashboard API (GET request).
 */
async function fetchFromServer(endpoint) {
  const config = await getDashboardConfig();
  if (!config.apiKey) return null;

  const url = `${config.baseUrl}/api/ext${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(
      `[InReach Sync] Failed to fetch ${endpoint}:`,
      error.message
    );
    return null;
  }
}

/**
 * Queue a failed request for later retry.
 */
async function queueForRetry(endpoint, data, method) {
  const { pendingSyncs } = await chrome.storage.local.get("pendingSyncs");
  const queue = pendingSyncs || [];
  queue.push({
    endpoint,
    data,
    method,
    queuedAt: new Date().toISOString(),
  });
  // Keep queue reasonable
  if (queue.length > 100) queue.splice(0, queue.length - 100);
  await chrome.storage.local.set({ pendingSyncs: queue });
}

/**
 * Retry all pending sync requests.
 * Removes successful ones from the queue.
 */
async function retryPendingSyncs() {
  const config = await getDashboardConfig();
  if (!config.apiKey) return;

  const { pendingSyncs } = await chrome.storage.local.get("pendingSyncs");
  if (!pendingSyncs || pendingSyncs.length === 0) return;

  const remaining = [];

  for (const item of pendingSyncs) {
    const url = `${config.baseUrl}/api/ext${item.endpoint}`;
    try {
      const response = await fetch(url, {
        method: item.method || "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: item.method !== "GET" ? JSON.stringify(item.data) : undefined,
      });
      if (!response.ok) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await chrome.storage.local.set({ pendingSyncs: remaining });
  if (remaining.length < pendingSyncs.length) {
    console.log(
      `[InReach Sync] Retried ${pendingSyncs.length - remaining.length} pending syncs`
    );
  }
}

/**
 * Verify API key and pull settings/templates/campaigns from the dashboard.
 */
async function verifyAndSync() {
  const result = await syncToServer("/auth", {});
  if (!result) return null;

  // Store the synced data
  await chrome.storage.local.set({
    dashboardUser: result.user,
    dashboardConnected: true,
    dashboardLastSync: new Date().toISOString(),
  });

  return result;
}

// Export for use in background.js (ES module)
if (typeof globalThis !== "undefined") {
  globalThis.InReachSync = {
    syncToServer,
    fetchFromServer,
    retryPendingSyncs,
    verifyAndSync,
    getDashboardConfig,
  };
}
