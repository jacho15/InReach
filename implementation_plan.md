# Implementation Plan - InReach: LinkedIn Marketing Platform

## Product Vision
InReach is a **multi-user marketing SaaS product** that helps professionals automate LinkedIn outreach, manage conversations in a unified dashboard, and get notified on follow-ups. Users sign up, install the Chrome extension, and manage everything from a web dashboard.

### Product Phases
- **Phase 1 (MVP)**: Chrome Extension — automated connection requests with personalized messages
- **Phase 2**: Backend + Dashboard — campaign management, unified inbox, contact pipeline
- **Phase 3**: Notifications + Replies — real-time alerts, reply from dashboard, analytics

> This document covers **Phase 1 (Extension MVP)** in full detail, with architectural notes for Phases 2-3 to ensure the MVP is built with future expansion in mind.

---

## Phase 1: Chrome Extension MVP

### Goal
A Chrome Extension that automates personalized LinkedIn connection requests. The user provides a search URL and a message template, and the extension handles scraping, personalization, and sending — with safety limits to protect the account.

### Key Requirements
- **Auto-Navigation**: Opens LinkedIn search results and pages through them
- **Scraping**: Extracts Name, Headline/Job Title, and Company from each search result card
- **Templating**: Fills placeholders in a user-written message (`{{name}}`, `{{job}}`, `{{company}}`)
- **Automation**: Sends connection requests with personalized notes automatically
- **Safety**: Randomized delays, daily/weekly limits, dry-run mode, instant stop

### Safety & Account Protection

> [!WARNING]
> **Account Safety Risk**: LinkedIn aggressively monitors for automation.
> To prevent account bans, we MUST implement ALL of the following:

| Protection | Implementation |
|-----------|---------------|
| **Randomized Delays** | Never fixed intervals. Use `baseDelay + Math.random() * variance` |
| **Per-Session Limits** | Max 15-20 connection requests per session |
| **Daily Limits** | Max 25-30 per day (user-configurable, hard cap at 40) |
| **Weekly Limits** | Max 100 per week (LinkedIn's known threshold) |
| **Warmup Ramp** | New users start at 5/day, increase by 5 each day up to their limit |
| **Business Hours** | Only operate during 9am-6pm (user's local time) |
| **Human Simulation** | Scroll jitter, random mouse movements, variable typing speed |
| **Captcha/Warning Detection** | If LinkedIn shows any warning or captcha, STOP immediately and alert user |
| **Cooldown Between Actions** | 30-90 seconds between each connection request |

> [!IMPORTANT]
> **Selectors Fragility**: LinkedIn changes their CSS class names frequently. We use a centralized selector config file (`dom-selectors.js`) with fallback strategies:
> 1. Prefer `aria-label`, `data-*` attributes, and text content selectors over CSS classes
> 2. Use XPath as fallback for complex queries
> 3. Selector config can be updated remotely in Phase 2 (without new extension version)

---

### Architecture (Manifest V3)

```
┌─────────────────────────────────────────────────┐
│                Chrome Extension                  │
│                                                  │
│  ┌──────────┐   messages    ┌────────────────┐  │
│  │  Popup   │◄────────────►│  Background     │  │
│  │  (UI)    │               │  Service Worker │  │
│  └──────────┘               └───────┬────────┘  │
│                                     │            │
│                              inject/message      │
│                                     │            │
│                             ┌───────▼────────┐  │
│                             │ Content Script  │  │
│                             │ (linkedin.com)  │  │
│                             └────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │         chrome.storage.local              │   │
│  │  - templates, config, daily stats,        │   │
│  │    contact log, session state             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Components

#### 1. Popup (UI) — `src/popup/`
The user-facing control panel that opens when clicking the extension icon.

**Pages/Views:**
- **Dashboard View**: Current session stats (sent today, remaining, accept rate)
- **Campaign Setup View**: Input target search URL + select message template
- **Template Editor View**: Create/edit message templates with placeholder buttons
- **Settings View**: Daily limits, business hours, warmup toggle
- **Activity Log View**: Scrollable log of actions taken ("Sent to John Doe - CTO at Acme")

**UI Framework**: Tailwind CSS (loaded locally, bundled — no CDN in extensions)

**Key UI Elements:**
- Start/Stop toggle (prominent, color-coded green/red)
- Progress bar showing daily limit usage (e.g., "12/30 sent today")
- Template preview with live placeholder rendering
- Status indicator: "Running", "Paused", "Stopped", "Warning: Captcha Detected"

#### 2. Background Service Worker — `src/scripts/background.js`
The orchestrator. Manages state, enforces limits, coordinates content script.

**Responsibilities:**
- Listens for START/STOP commands from popup
- Tracks automation state: `{ status: "idle" | "running" | "paused" | "stopped", currentCampaign, progress }`
- Enforces daily/weekly limits by checking `chrome.storage.local` counters
- Handles tab management (ensure LinkedIn tab exists, detect navigation)
- Listens to `chrome.tabs.onUpdated` to re-inject content script on page changes
- Stores activity log entries
- Manages the warmup ramp schedule

**Message Protocol:**
```js
// Popup → Background
{ type: "START_AUTOMATION", payload: { searchUrl, templateId } }
{ type: "STOP_AUTOMATION" }
{ type: "GET_STATUS" }
{ type: "GET_STATS" }

// Background → Content Script
{ type: "BEGIN_SCRAPE_AND_SEND", payload: { template, limits } }
{ type: "STOP" }
{ type: "NEXT_PAGE" }

// Content Script → Background
{ type: "ACTION_COMPLETE", payload: { contact: { name, headline, company }, status: "sent" | "skipped" | "error" } }
{ type: "PAGE_COMPLETE", payload: { processed: 8, sent: 6, skipped: 2 } }
{ type: "WARNING_DETECTED", payload: { type: "captcha" | "rate_limit" | "unknown" } }
{ type: "REQUEST_NEXT_PAGE" }
```

#### 3. Content Script — `src/scripts/content.js`
The heavy lifter. Runs in the LinkedIn page context, interacts with the DOM.

**Core Functions:**

```js
// Scrapes all visible profile cards on a search results page
function scrapeSearchResults()
// Returns: [{ name, headline, company, profileUrl, connectButton }]

// Scrapes a single profile card element
function scrapeProfileCard(cardElement)
// Returns: { name, headline, company, profileUrl }

// Fills template placeholders with scraped data
function generateMessage(template, profileData)
// Input: "Hi {{name}}, love your work as {{job}} at {{company}}!"
// Output: "Hi Sarah Chen, love your work as VP of Engineering at Stripe!"

// The main action sequence for one profile
async function sendConnectionRequest(profileData, message)
// Steps: scroll into view → click Connect → wait → click Add Note → wait → type message → wait → click Send

// Checks if a profile should be skipped
function shouldSkip(cardElement)
// Returns true if: already connected, pending, or in the sent log

// Detects LinkedIn warnings, captchas, or unusual prompts
function detectWarnings()
// Returns: null | { type: "captcha" | "rate_limit" | "restriction" }
```

**DOM Interaction Sequence (for each profile):**
1. Scroll profile card into viewport (smooth scroll, not instant jump)
2. Random pause 500-1500ms (simulating "reading" the card)
3. Call `scrapeProfileCard()` — extract name, headline, company
4. Call `shouldSkip()` — check if already processed
5. If skip → log and move to next
6. Click the "Connect" button on the card
7. Wait 2000-4000ms (random)
8. LinkedIn shows modal → Click "Add a note" button
9. Wait 1000-2000ms (random)
10. Call `generateMessage()` with template + scraped data
11. Focus the note textarea
12. Simulate typing: character by character, 30-80ms per character (random per char)
13. Wait 2000-5000ms (random, simulating "reviewing" the message)
14. Click "Send" button (or log-only in dry-run mode)
15. Wait 300-600ms for UI to close
16. **Cooldown**: Wait 30,000-90,000ms before next profile (random)

#### 4. Utilities — `src/utils/`

**`dom-selectors.js`** — Centralized selector definitions
```js
// All LinkedIn DOM selectors in one place for easy maintenance
export const SELECTORS = {
  searchResultCard: '[data-view-name="search-entity-result-universal-template"]',
  profileName: '.entity-result__title-text a span[aria-hidden="true"]',
  profileHeadline: '.entity-result__primary-subtitle',
  profileCompany: '.entity-result__secondary-subtitle',
  connectButton: 'button[aria-label*="Invite"][aria-label*="to connect"]',
  addNoteButton: 'button[aria-label="Add a note"]',
  noteTextarea: 'textarea[name="message"]',
  sendButton: 'button[aria-label="Send invitation"]',
  nextPageButton: 'button[aria-label="Next"]',
  warningBanner: '.artdeco-inline-feedback--error',
  captchaFrame: 'iframe[src*="captcha"]',
  pendingLabel: 'span:contains("Pending")',
}
```

**`human-simulator.js`** — Anti-detection helpers
```js
// Random delay within a range
async function randomDelay(minMs, maxMs)

// Simulate human-like typing (variable speed per character)
async function simulateTyping(element, text, minCharDelay, maxCharDelay)

// Smooth scroll to element with slight offset randomization
async function humanScroll(element)

// Random mouse movement to approximate area (optional, advanced)
async function simulateMouseApproach(element)

// Gaussian-distributed random number (more natural than uniform)
function gaussianRandom(mean, stddev)
```

**`storage.js`** — Chrome storage helpers
```js
// Get/set daily counters (resets at midnight)
async function getDailyCount()
async function incrementDailyCount()
async function getWeeklyCount()

// Contact log (track who we've already contacted)
async function isContactProcessed(profileUrl)
async function logContact(profileUrl, contactData, status)
async function getContactLog()

// Settings
async function getSettings()
async function saveSettings(settings)
```

---

### File Structure

```
InReach/
├── extension/                    # Chrome Extension (Phase 1)
│   ├── manifest.json
│   ├── src/
│   │   ├── popup/
│   │   │   ├── index.html        # Extension popup UI
│   │   │   ├── popup.js          # Popup logic & event handlers
│   │   │   └── popup.css         # Tailwind-compiled styles
│   │   ├── scripts/
│   │   │   ├── background.js     # Service worker — orchestration
│   │   │   └── content.js        # Content script — DOM interaction
│   │   └── utils/
│   │       ├── dom-selectors.js  # Centralized LinkedIn selectors
│   │       ├── human-simulator.js # Delay, typing, scroll simulation
│   │       └── storage.js        # chrome.storage.local wrappers
│   ├── assets/
│   │   └── icons/
│   │       ├── icon16.png
│   │       ├── icon48.png
│   │       └── icon128.png
│   ├── tailwind.config.js
│   └── package.json              # For Tailwind build step only
│
├── dashboard/                    # Next.js Web App (Phase 2 — placeholder)
│   └── .gitkeep
│
├── implementation_plan.md
├── LICENSE
└── README.md
```

---

### manifest.json — Detailed

```json
{
  "manifest_version": 3,
  "name": "InReach — LinkedIn Outreach",
  "version": "0.1.0",
  "description": "Automate personalized LinkedIn connection requests",
  "permissions": [
    "storage",
    "tabs",
    "scripting",
    "activeTab",
    "alarms"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*"
  ],
  "background": {
    "service_worker": "src/scripts/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/search/*"],
      "js": ["src/scripts/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  }
}
```

---

### Workflow Logic (Detailed State Machine)

```
                    ┌───────┐
          ┌────────►│ IDLE  │◄──── User clicks Stop
          │         └───┬───┘      or daily limit hit
          │             │
          │     User clicks Start
          │             │
          │         ┌───▼────┐
          │    ┌───►│RUNNING │
          │    │    └───┬────┘
          │    │        │
          │    │   For each profile card:
          │    │    1. Scrape
          │    │    2. Skip check
          │    │    3. Send connection
          │    │    4. Log result
          │    │    5. Cooldown delay
          │    │        │
          │    │   Page complete?
          │    │    ├── No → next card
          │    │    └── Yes ──┐
          │    │              │
          │    │         ┌────▼──────┐
          │    │         │PAGINATING │
          │    │         └────┬──────┘
          │    │              │
          │    │     Click "Next" page
          │    │     Wait for page load
          │    │              │
          │    └──────────────┘
          │
          │   Warning detected?
          │         │
          │    ┌────▼────┐
          └────│ PAUSED  │──── Alert user, wait for manual resume
               └─────────┘
```

**Detailed Step-by-Step:**

1. **IDLE → RUNNING**: User enters search URL + selects template in popup, clicks "Start"
   - Background validates daily limit not reached
   - Background opens/navigates LinkedIn tab to the search URL
   - Background injects content script (or messages already-injected script)

2. **RUNNING — Enumerate**: Content script waits for search results to load (poll for result cards, timeout after 10s)
   - Finds all profile cards on current page
   - Filters out already-processed contacts (checked against `storage.js` log)

3. **RUNNING — Process Loop**: For each unprocessed card:
   - Scroll card into view with `humanScroll()`
   - Pause 500-1500ms
   - Scrape: `scrapeProfileCard(card)` → `{ name, headline, company, profileUrl }`
   - Skip check: `shouldSkip(card)` — pending, already connected, or in log
   - If not skipped:
     - Click "Connect" button
     - Wait 2-4s (random)
     - Detect if modal appeared → Click "Add a note"
     - Wait 1-2s (random)
     - Generate personalized message from template
     - `simulateTyping()` into the textarea
     - Wait 2-5s (random)
     - Click "Send" (or log in dry-run mode)
     - Report: `{ type: "ACTION_COMPLETE", contact, status: "sent" }`
   - If skipped: Report: `{ type: "ACTION_COMPLETE", contact, status: "skipped" }`
   - **Cooldown**: 30-90s before next card
   - **Check limits**: If daily count reached → transition to IDLE

4. **RUNNING → PAGINATING**: All cards on page processed
   - Content script sends `{ type: "REQUEST_NEXT_PAGE" }`
   - Click "Next" button
   - Wait for new page to load (detect URL change or new DOM content)
   - Resume processing from step 2

5. **Any State → PAUSED**: Warning detected
   - Content script calls `detectWarnings()` periodically
   - On detection: immediate stop, send `{ type: "WARNING_DETECTED" }`
   - Background updates state to PAUSED
   - Popup shows alert with warning details
   - User must manually resume or stop

---

### Storage Schema (chrome.storage.local)

```js
{
  // User settings
  settings: {
    dailyLimit: 25,          // Max connection requests per day
    weeklyLimit: 100,        // Max per week
    cooldownMin: 30000,      // Min ms between actions
    cooldownMax: 90000,      // Max ms between actions
    businessHoursOnly: true, // Only run 9am-6pm
    businessHoursStart: 9,   // Start hour
    businessHoursEnd: 18,    // End hour
    warmupEnabled: true,     // Gradually increase daily limit
    warmupDay: 1,            // Current warmup day (1 = first day)
    dryRun: false,           // Log only, don't actually send
  },

  // Templates
  templates: [
    {
      id: "tpl_1",
      name: "Default Intro",
      body: "Hi {{name}}, I came across your profile and I'm impressed by your work as {{job}} at {{company}}. I'd love to connect and exchange ideas!",
      createdAt: "2025-01-15T...",
      stats: { sent: 0, accepted: 0 }
    }
  ],

  // Daily tracking (resets at midnight)
  dailyStats: {
    date: "2025-01-15",      // Current date string
    sent: 12,                // Connections sent today
    skipped: 3,              // Profiles skipped
    errors: 0                // Failed attempts
  },

  // Weekly tracking
  weeklyStats: {
    weekStart: "2025-01-13", // Monday of current week
    sent: 45
  },

  // Contact log (persistent)
  contacts: {
    "linkedin.com/in/john-doe": {
      name: "John Doe",
      headline: "CTO at Acme Corp",
      company: "Acme Corp",
      status: "sent",          // "sent" | "skipped" | "error"
      messageSent: "Hi John...",
      sentAt: "2025-01-15T14:32:00Z",
      campaignUrl: "https://linkedin.com/search/results/people?..."
    }
  },

  // Current automation state
  automationState: {
    status: "idle",          // "idle" | "running" | "paused"
    currentSearchUrl: null,
    currentTemplateId: null,
    currentPage: 1,
    processedOnPage: 0
  }
}
```

---

### Verification Plan

#### Automated Tests
- **Template Engine**: Unit test `generateMessage()` — placeholder replacement, edge cases (missing fields, special characters, empty values)
- **Storage Helpers**: Unit test counter logic, midnight reset, weekly rollover
- **Limit Enforcement**: Unit test daily/weekly limit checks, warmup ramp calculation

#### Manual Verification
1. **Dry Run Mode**: Toggle `dryRun: true` — extension does everything except click "Send". Logs what it *would* have sent. This is the primary testing mode.
2. **Selector Validation**: Before each release, manually verify all selectors in `dom-selectors.js` against current LinkedIn HTML.
3. **Timing Verification**: Monitor the console to ensure delays are random and within expected ranges.
4. **Limit Testing**: Set daily limit to 2, verify it stops after 2 sends.
5. **Warning Detection**: Test with known captcha/warning scenarios if possible.

---

## Phase 2: Backend + Dashboard (Future — Architecture Notes)

> Not built in Phase 1, but the extension MVP is designed to support this upgrade path.

### Tech Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend + API | **Next.js 14+ (App Router)** | Full-stack React, API routes, server components |
| Database | **PostgreSQL** (via Supabase or Neon) | Relational — contacts, messages, campaigns have relationships |
| Auth | **Clerk** or **NextAuth** | Multi-user SaaS auth with social login |
| Notifications | **Web Push** + **Resend** (email) | Real-time browser + email alerts |
| Hosting | **Vercel** (app) + **Supabase** (db) | Fast deployment, generous free tiers |

### Data Model (Relational)

```
users
  ├── id, email, name, plan, createdAt
  │
  ├── campaigns[]
  │     ├── id, userId, name, searchUrl, templateId
  │     ├── status: "active" | "paused" | "completed"
  │     ├── dailyLimit, schedule (JSON: hours, days)
  │     └── stats: { sent, accepted, replied }
  │
  ├── contacts[]
  │     ├── id, userId, linkedinUrl, name, headline, company
  │     ├── status: "scraped" | "request_sent" | "connected" | "replied" | "converted"
  │     ├── campaignId
  │     └── messages[]
  │           ├── id, contactId, direction: "outbound" | "inbound"
  │           ├── content, timestamp, read: boolean
  │           └── source: "extension" | "dashboard"
  │
  └── templates[]
        ├── id, userId, name, body
        └── stats: { sent, accepted, replied }
```

### Dashboard Pages
| Page | Purpose |
|------|---------|
| **Overview** | Active campaigns, today's stats, daily limit usage, recent activity |
| **Campaigns** | Create/edit/pause campaigns — search URL, template, schedule, limits |
| **Contacts** | Filterable pipeline view — all contacts with status tracking |
| **Inbox** | Unified threaded conversations, sorted by most recent. Reply from dashboard |
| **Templates** | Manage templates with A/B performance comparison |
| **Settings** | Account, limits, notification preferences, extension connection status |

### Extension ↔ Backend Sync Protocol

```
Extension boots up
  → GET /api/sync
  ← { pendingTasks: [...], updatedSelectors: {...}, settings: {...} }

Extension completes action
  → POST /api/actions
  ← { ok: true }

Extension detects new LinkedIn message from tracked contact
  → POST /api/messages/inbound
  ← Backend sends push notification + email to user
```

---

## Phase 3: Notifications + Reply-from-Dashboard (Future)

### Reply Flow
1. User types reply in dashboard inbox
2. Backend queues: `POST /api/replies` → stored with `status: "queued"`
3. Extension polls: `GET /api/replies/pending`
4. Extension navigates to LinkedIn conversation, types and sends the reply
5. Extension confirms: `POST /api/replies/:id/confirm`
6. Dashboard updates message status to "delivered"

### Notification System
1. Extension polls LinkedIn messaging every ~5 minutes (while browser open)
2. For tracked contacts, detects new inbound messages
3. Sends to backend: `POST /api/messages/inbound`
4. Backend triggers:
   - Web Push notification (if dashboard open)
   - Email notification (configurable: instant, hourly digest, daily digest)
   - Updates contact status to "replied"
   - Dashboard shows notification badge + conversation update

---

## Implementation Order (Phase 1 MVP)

### Step 1: Project Setup
- Initialize `extension/` directory
- Create `manifest.json`
- Set up Tailwind CSS build pipeline
- Create placeholder icon files

### Step 2: Utility Layer
- `dom-selectors.js` — all LinkedIn selectors
- `human-simulator.js` — delay, typing, scroll functions
- `storage.js` — chrome.storage.local wrappers

### Step 3: Content Script Core
- `scrapeSearchResults()` and `scrapeProfileCard()`
- `generateMessage()` template engine
- `shouldSkip()` duplicate detection
- `sendConnectionRequest()` full DOM interaction sequence
- `detectWarnings()` safety detection
- Message listener for background communication

### Step 4: Background Service Worker
- State machine (idle/running/paused)
- Message handlers for popup and content script communication
- Daily/weekly limit enforcement
- Tab management and content script injection
- Activity logging

### Step 5: Popup UI
- Dashboard view with stats
- Campaign setup (search URL + template)
- Template editor with placeholders
- Settings panel
- Activity log viewer
- Start/Stop controls

### Step 6: Testing & Hardening
- Unit tests for template engine and storage logic
- Dry-run mode end-to-end testing
- Selector validation against live LinkedIn
- Edge case handling (network errors, DOM changes, session expiry)
