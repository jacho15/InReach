/**
 * Shared constants for the InReach extension.
 * Timing values, safety limits, and magic numbers centralized here.
 */

const CONSTANTS = {
  TIMING: {
    PAGE_LOAD_WAIT: 3000,
    CONTENT_SCRIPT_INIT: 500,
    RESULTS_TIMEOUT: 10000,
    ELEMENT_WAIT_TIMEOUT: 5000,
    NOTE_BUTTON_TIMEOUT: 5000,
    TEXTAREA_TIMEOUT: 3000,
    STATUS_POLL_INTERVAL: 3000,
    SUCCESS_BANNER_DURATION: 3000,
    WARMUP_CHECK_INTERVAL: 60, // minutes
    SYNC_RETRY_INTERVAL: 5, // minutes
  },

  LIMITS: {
    MAX_DAILY: 40,
    MAX_WEEKLY: 150,
    DEFAULT_DAILY: 25,
    DEFAULT_WEEKLY: 100,
    DEFAULT_COOLDOWN_MIN: 30000,
    DEFAULT_COOLDOWN_MAX: 90000,
    COOLDOWN_MIN_SECONDS: 10,
    COOLDOWN_MAX_SECONDS: 600,
    WARMUP_STEP: 5,
    ACTIVITY_LOG_MAX: 500,
    ACTIVITY_LOG_DISPLAY: 50,
    MESSAGE_MAX_LENGTH: 300,
  },
};

if (typeof window !== "undefined") {
  window.CONSTANTS = CONSTANTS;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.CONSTANTS = CONSTANTS;
}
