/**
 * Centralized LinkedIn DOM selectors.
 * All selectors in one place for easy maintenance when LinkedIn changes their markup.
 *
 * Strategy priority:
 *   1. aria-label / data-* attributes (most stable)
 *   2. Semantic HTML structure
 *   3. CSS class names (least stable — LinkedIn changes these often)
 */
const SELECTORS = {
  // Search results page
  searchResultsList: ".search-results-container",
  searchResultCard:
    'li.reusable-search__result-container, [data-view-name="search-entity-result-universal-template"]',

  // Profile info within a search result card
  profileName:
    '.entity-result__title-text a span[aria-hidden="true"], .entity-result__title-text .t-16',
  profileHeadline:
    ".entity-result__primary-subtitle, .entity-result__summary",
  profileCompany: ".entity-result__secondary-subtitle",
  profileLink: ".entity-result__title-text a[href*='/in/']",

  // Action buttons
  connectButton:
    'button[aria-label*="Invite"][aria-label*="to connect"], button[aria-label*="Connect"]',
  moreActionsButton: 'button[aria-label*="more actions"], button.artdeco-dropdown__trigger',

  // Connection request modal
  addNoteButton: 'button[aria-label="Add a note"]',
  noteTextarea: 'textarea[name="message"], textarea#custom-message',
  sendButton:
    'button[aria-label="Send invitation"], button[aria-label="Send now"]',
  cancelButton: 'button[aria-label="Dismiss"], button[aria-label="Cancel"]',

  // Pagination
  nextPageButton: 'button[aria-label="Next"]',
  paginationContainer: ".artdeco-pagination",

  // Status indicators
  pendingLabel: ".invitation-card__action-btn--pending, span.artdeco-button__text",
  alreadyConnected: '.entity-result__badge-text, [data-test-badge-text="1st"]',

  // Warning / safety detection
  warningBanner: ".artdeco-inline-feedback--error, .artdeco-toast-item--error",
  captchaFrame: 'iframe[src*="captcha"], iframe[src*="challenge"]',
  rateLimitMessage: ".ip-fencing-login__content",

  // General page state
  loadingIndicator: ".search-results__cluster-loading",
  noResults: ".search-reusable-search-no-results",
};

// Make available in both content script and module contexts
if (typeof window !== "undefined") {
  window.SELECTORS = SELECTORS;
}
