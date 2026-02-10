/**
 * InReach Content Script
 * Runs on linkedin.com/search/* pages.
 * Handles: scraping profile cards, generating personalized messages,
 * sending connection requests, and communicating with the background worker.
 */

(() => {
  "use strict";

  const S = window.SELECTORS;
  const H = window.HumanSimulator;
  const Store = window.Storage;

  let isRunning = false;
  let shouldStop = false;

  // ── Scraping ──

  /**
   * Wait for search results to appear in the DOM.
   * @param {number} timeoutMs - Max wait time
   * @returns {Promise<boolean>} true if results found
   */
  async function waitForResults(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const cards = document.querySelectorAll(S.searchResultCard);
      if (cards.length > 0) return true;

      // Check for no-results page
      if (document.querySelector(S.noResults)) return false;

      await H.randomDelay(500, 1000);
    }
    return false;
  }

  /**
   * Extract profile data from a single search result card.
   * @param {HTMLElement} card - The result card element
   * @returns {object|null} Profile data or null if extraction failed
   */
  function scrapeProfileCard(card) {
    try {
      const nameEl = card.querySelector(S.profileName);
      const headlineEl = card.querySelector(S.profileHeadline);
      const companyEl = card.querySelector(S.profileCompany);
      const linkEl = card.querySelector(S.profileLink);

      const name = nameEl?.textContent?.trim() || null;
      const headline = headlineEl?.textContent?.trim() || "";
      const company = companyEl?.textContent?.trim() || "";
      const profileUrl = linkEl?.href || null;

      if (!name) return null;

      return { name, headline, company, profileUrl };
    } catch (e) {
      console.error("[InReach] Error scraping card:", e);
      return null;
    }
  }

  /**
   * Scrape all visible profile cards on the current search page.
   * @returns {Array<{card: HTMLElement, profile: object}>}
   */
  function scrapeSearchResults() {
    const cards = document.querySelectorAll(S.searchResultCard);
    const results = [];

    for (const card of cards) {
      const profile = scrapeProfileCard(card);
      if (profile) {
        results.push({ card, profile });
      }
    }

    return results;
  }

  // ── Template Engine ──

  /**
   * Replace placeholders in a message template with scraped profile data.
   * Supported: {{name}}, {{firstName}}, {{job}}, {{headline}}, {{company}}
   * @param {string} template - Message template with placeholders
   * @param {object} data - Profile data
   * @returns {string} Personalized message
   */
  function generateMessage(template, data) {
    const firstName = data.name ? data.name.split(" ")[0] : "";

    return template
      .replace(/\{\{name\}\}/gi, data.name || "there")
      .replace(/\{\{firstName\}\}/gi, firstName || "there")
      .replace(/\{\{job\}\}/gi, data.headline || "your role")
      .replace(/\{\{headline\}\}/gi, data.headline || "your role")
      .replace(/\{\{company\}\}/gi, data.company || "your company");
  }

  // ── Skip Detection ──

  /**
   * Check if a profile card should be skipped.
   * @param {HTMLElement} card - The result card
   * @param {object} profile - Scraped profile data
   * @returns {Promise<{skip: boolean, reason: string|null}>}
   */
  async function shouldSkip(card, profile) {
    // Already connected
    if (card.querySelector(S.alreadyConnected)) {
      return { skip: true, reason: "already_connected" };
    }

    // Pending invitation
    const pendingEl = card.querySelector(S.pendingLabel);
    if (pendingEl && pendingEl.textContent?.toLowerCase().includes("pending")) {
      return { skip: true, reason: "pending_invitation" };
    }

    // No connect button available
    const connectBtn = card.querySelector(S.connectButton);
    if (!connectBtn) {
      return { skip: true, reason: "no_connect_button" };
    }

    // Already in our contact log
    if (profile.profileUrl) {
      const processed = await Store.isContactProcessed(profile.profileUrl);
      if (processed) {
        return { skip: true, reason: "already_processed" };
      }
    }

    return { skip: false, reason: null };
  }

  // ── Warning Detection ──

  /**
   * Check for LinkedIn warnings, captchas, or rate-limit messages.
   * @returns {object|null} Warning info or null if safe
   */
  function detectWarnings() {
    if (document.querySelector(S.captchaFrame)) {
      return { type: "captcha" };
    }
    if (document.querySelector(S.rateLimitMessage)) {
      return { type: "rate_limit" };
    }
    const warning = document.querySelector(S.warningBanner);
    if (warning) {
      return { type: "warning", message: warning.textContent?.trim() };
    }
    return null;
  }

  // ── Connection Request Sequence ──

  /**
   * Send a connection request to a single profile.
   * This is the core DOM interaction sequence.
   *
   * @param {HTMLElement} card - The search result card element
   * @param {object} profile - Scraped profile data
   * @param {string} message - Personalized message to send
   * @param {boolean} dryRun - If true, log but don't click Send
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function sendConnectionRequest(card, profile, message, dryRun = false) {
    try {
      // Step 1: Find the Connect button
      const connectBtn = card.querySelector(S.connectButton);
      if (!connectBtn) {
        return { success: false, error: "connect_button_not_found" };
      }

      // Step 2: Scroll card into view
      await H.humanScroll(card);
      await H.randomDelay(500, 1500);

      // Step 3: Click Connect
      await H.humanClick(connectBtn);
      await H.randomDelay(2000, 4000);

      // Step 4: Wait for modal and find "Add a note" button
      const addNoteBtn = await waitForElement(S.addNoteButton, 5000);
      if (!addNoteBtn) {
        // Some profiles go directly to send — try to find the textarea
        const textarea = document.querySelector(S.noteTextarea);
        if (!textarea) {
          return { success: false, error: "add_note_button_not_found" };
        }
      } else {
        // Click "Add a note"
        await H.humanClick(addNoteBtn);
        await H.randomDelay(1000, 2000);
      }

      // Step 5: Find and fill the message textarea
      const textarea = await waitForElement(S.noteTextarea, 3000);
      if (!textarea) {
        return { success: false, error: "textarea_not_found" };
      }

      // Step 6: Type the personalized message
      await H.simulateTyping(textarea, message);
      await H.randomDelay(2000, 5000);

      // Step 7: Send or dry-run
      if (dryRun) {
        console.log(`[InReach DRY RUN] Would send to ${profile.name}: "${message}"`);
        // Close the modal
        const cancelBtn = document.querySelector(S.cancelButton);
        if (cancelBtn) await H.humanClick(cancelBtn);
        return { success: true, dryRun: true };
      }

      // Click Send
      const sendBtn = document.querySelector(S.sendButton);
      if (!sendBtn) {
        return { success: false, error: "send_button_not_found" };
      }

      await H.humanClick(sendBtn);
      await H.randomDelay(300, 600);

      return { success: true };
    } catch (error) {
      console.error("[InReach] Error sending connection request:", error);
      // Try to close any open modal
      try {
        const cancelBtn = document.querySelector(S.cancelButton);
        if (cancelBtn) cancelBtn.click();
      } catch (_) {}
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for an element to appear in the DOM.
   * @param {string} selector - CSS selector
   * @param {number} timeoutMs - Max wait time
   * @returns {Promise<HTMLElement|null>}
   */
  async function waitForElement(selector, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  // ── Main Automation Loop ──

  /**
   * Process all profiles on the current search results page.
   * @param {string} template - Message template
   * @param {boolean} dryRun - Dry run mode
   */
  async function processCurrentPage(template, dryRun) {
    const results = scrapeSearchResults();
    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const { card, profile } of results) {
      // Check stop signal
      if (shouldStop) {
        console.log("[InReach] Stop signal received, halting.");
        break;
      }

      // Check warnings
      const warning = detectWarnings();
      if (warning) {
        chrome.runtime.sendMessage({
          type: "WARNING_DETECTED",
          payload: warning,
        });
        shouldStop = true;
        break;
      }

      // Check if we can still send
      const limitCheck = await Store.canSendMore();
      if (!limitCheck.allowed) {
        chrome.runtime.sendMessage({
          type: "LIMIT_REACHED",
          payload: limitCheck,
        });
        shouldStop = true;
        break;
      }

      // Skip check
      const skipResult = await shouldSkip(card, profile);
      if (skipResult.skip) {
        console.log(`[InReach] Skipping ${profile.name}: ${skipResult.reason}`);
        chrome.runtime.sendMessage({
          type: "ACTION_COMPLETE",
          payload: { contact: profile, status: "skipped", reason: skipResult.reason },
        });
        skipped++;
        processed++;
        continue;
      }

      // Generate personalized message
      const message = generateMessage(template, profile);

      // Send connection request
      const result = await sendConnectionRequest(card, profile, message, dryRun);

      if (result.success) {
        // Log to storage
        await Store.logContact(profile.profileUrl || profile.name, {
          name: profile.name,
          headline: profile.headline,
          company: profile.company,
          messageSent: message,
        }, "sent");

        await Store.incrementDailyCount("sent");
        await Store.incrementWeeklyCount();

        chrome.runtime.sendMessage({
          type: "ACTION_COMPLETE",
          payload: {
            contact: profile,
            status: dryRun ? "dry_run" : "sent",
            message,
          },
        });
        sent++;
      } else {
        await Store.incrementDailyCount("errors");
        chrome.runtime.sendMessage({
          type: "ACTION_COMPLETE",
          payload: { contact: profile, status: "error", error: result.error },
        });
      }

      processed++;

      // Cooldown between profiles
      if (!shouldStop) {
        const settings = await Store.getSettings();
        await H.gaussianDelay(settings.cooldownMin, settings.cooldownMax);
      }
    }

    // Page complete
    chrome.runtime.sendMessage({
      type: "PAGE_COMPLETE",
      payload: { processed, sent, skipped },
    });
  }

  /**
   * Navigate to the next page of search results.
   * @returns {Promise<boolean>} true if navigation succeeded
   */
  async function goToNextPage() {
    const nextBtn = document.querySelector(S.nextPageButton);
    if (!nextBtn || nextBtn.disabled) {
      return false;
    }

    await H.humanScroll(nextBtn);
    await H.randomDelay(500, 1000);
    await H.humanClick(nextBtn);

    // Wait for new page to load
    await H.randomDelay(2000, 4000);
    const loaded = await waitForResults(10000);
    return loaded;
  }

  // ── Message Listener ──

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "BEGIN_SCRAPE_AND_SEND") {
      const { template, dryRun } = message.payload;

      if (isRunning) {
        sendResponse({ status: "already_running" });
        return;
      }

      isRunning = true;
      shouldStop = false;

      (async () => {
        try {
          const hasResults = await waitForResults();
          if (!hasResults) {
            chrome.runtime.sendMessage({
              type: "PAGE_COMPLETE",
              payload: { processed: 0, sent: 0, skipped: 0, noResults: true },
            });
            return;
          }
          await processCurrentPage(template, dryRun);
        } catch (error) {
          console.error("[InReach] Automation error:", error);
          chrome.runtime.sendMessage({
            type: "WARNING_DETECTED",
            payload: { type: "error", message: error.message },
          });
        } finally {
          isRunning = false;
        }
      })();

      sendResponse({ status: "started" });
      return true; // Keep message channel open for async
    }

    if (message.type === "STOP") {
      shouldStop = true;
      isRunning = false;
      sendResponse({ status: "stopping" });
      return;
    }

    if (message.type === "NEXT_PAGE") {
      (async () => {
        const success = await goToNextPage();
        sendResponse({ success });
      })();
      return true;
    }

    if (message.type === "PING") {
      sendResponse({ status: "alive" });
      return;
    }
  });

  console.log("[InReach] Content script loaded on:", window.location.href);
})();
