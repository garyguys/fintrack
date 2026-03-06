# PersonalHQ - Personal Command Center

## Overview
PersonalHQ (formerly PFlux, originally FinTrack) is a personal desktop productivity app built as a single-page HTML app wrapped in Electron. It started as a finance tracker and has evolved into a broader personal command center with two top-level sections: **Tasks & Ideas** (to-do list + idea capture) and **Finances** (budget/expense tracking). Designed for personal use and shared with a small group of friends.

**Repo:** https://github.com/garyguys/fintrack
**Current version:** 1.4.0

## Architecture

### Tech Stack
- **Frontend:** Single `index.html` file with vanilla HTML/CSS/JS (no framework, no build step for the UI)
- **Charts:** Chart.js 4.4.1 via CDN
- **Desktop wrapper:** Electron 33.x
- **Storage:** File-based (`%APPDATA%/FinTrack/data.json`) when running in Electron, localStorage fallback when opened in a browser
- **Auto-updates:** electron-updater via GitHub Releases
- **Build tool:** electron-builder (NSIS installer for Windows x64)

### File Structure
```
├── index.html        # Entire app UI, styles, and logic (single file ~3200+ lines)
├── main.js           # Electron main process: window creation, file I/O (IPC), auto-updater, restart-for-update IPC
├── preload.js        # Context bridge: exposes fileStorage API + restartForUpdate to renderer
├── package.json      # Dependencies, version, electron-builder config, GitHub publish config
├── CLAUDE.md         # This file — project context for AI agents
├── .gitignore        # Ignores node_modules/ and dist/
└── dist/             # Build output (gitignored)
    ├── PersonalHQ-Setup-X.X.X.exe
    ├── PersonalHQ-Setup-X.X.X.exe.blockmap
    ├── latest.yml
    └── win-unpacked/
```

### Key Design Decisions
- **Single HTML file:** All UI, CSS, and JS live in `index.html`. This was intentional for simplicity — no bundler, no framework overhead. When editing, be aware the file is large (~3200+ lines).
- **Dual storage mode:** The app detects `window.fileStorage` (injected by Electron's preload) to decide between file-based and localStorage. This means the app still works if you just open `index.html` in a browser for quick testing.
- **Atomic file writes:** `main.js` writes to a `.tmp` file then renames to prevent data corruption on crash.
- **Debounced saves:** The renderer batches rapid `saveAll()` calls — writes to localStorage immediately (cache) and debounces the IPC file write by 300ms.
- **No code signing:** The build skips code signing (`signAndEditExecutable: false`, `signingHashAlgorithms: null` in package.json). Windows SmartScreen will warn on first install — users click "More info" > "Run anyway".
- **Rebrand continuity:** The app was renamed FinTrack → PFlux (v1.1.0) → PersonalHQ (v1.4.0). The `appId` remains `com.fintrack.app` for update compatibility, and the data directory remains `%APPDATA%/FinTrack/` to preserve existing user data. The npm package name in package.json is also still `fintrack`.

## App Structure — Sections & Navigation

The sidebar has two top-level sections separated by a visual divider:

### Tasks & Ideas Section
- **Tasks & Ideas** — The default landing page. Contains a pill-style sub-tab toggle (`switchSubTab()`) to switch between Tasks and Ideas views. Both views share identical functionality (inline editing, priority badges, filtering, pagination) but store data separately (`todos` vs `ideas` arrays). The `activeSubTab` variable tracks which view is shown.

### Finances Section (collapsible)
- **Dashboard** — Month-navigable stats cards, doughnut chart, bar chart, recent transactions, budget alerts
- **Transactions** — Full CRUD table with search, filters, sortable columns, pagination (25/page), selectable rows with bulk delete, CSV import/export
- **Budgets** — Monthly limits per expense category with progress bars
- **Savings Goals** — CRUD with progress bars and "Add Funds" modal
- **Recurring** — Auto-generating transactions on schedule
- **Reports** — Period selector, daily spending line chart, category breakdown

### Bottom
- **Settings** — Theme toggle (dark/light), accent color picker, currency, category management, data import/export
- **Version info** — Displays current app version

Navigation uses `selectSection('tasks'|'finances')` for top-level switching and `navigateTo(page)` for individual pages. The Finances section is collapsible with a chevron toggle. `lastFinancePage` tracks which finance sub-page was last viewed.

## Data Model

All data is stored in a single JSON object (either in `data.json` or across localStorage keys):

- **`transactions`** — Array of `{ id, type, amount, description, category, date, notes, recurringId? }`
  - `type` is `"expense"` or `"income"`
  - `date` is `"YYYY-MM-DD"` string
  - `recurringId` links auto-generated transactions back to their recurring source
- **`budgets`** — Object `{ categoryName: limitAmount }` — monthly spending limits per category
- **`goals`** — Array of `{ id, name, target, saved, date? }` — savings goals with progress tracking
- **`recurring`** — Array of `{ id, type, amount, description, category, frequency, nextDate }` — auto-generates transactions when `nextDate <= today`
  - `frequency`: `"weekly"`, `"biweekly"`, `"monthly"`, `"quarterly"`, `"yearly"`
- **`todos`** — Array of `{ id, name, estTime, dueDate, priority, description, completed }`
  - `priority`: `"most-important"`, `"high"`, `"medium"`, `"low"`
  - `estTime`: estimated minutes (nullable number)
  - `dueDate`: `"YYYY-MM-DD"` string (nullable)
  - Sorted by priority (most-important first), then due date ascending
- **`ideas`** — Array with identical structure to `todos`: `{ id, name, estTime, dueDate, priority, description, completed }`
  - Separate data store from tasks, same schema
  - Used for brainstorming/idea capture vs. actionable to-dos
- **`categories`** — Array of `{ name, type }` where type is `"expense"`, `"income"`, or `"both"`
  - Categories are type-aware: expense categories show in budget settings, income categories show when logging income, "both" shows everywhere
  - Default expense categories: Food, Transport, Housing, Utilities, Entertainment, Healthcare, Shopping
  - Default income categories: Paycheque, Freelance, Investments
  - Default both: Gifts, Other
  - All categories (including defaults) can be deleted by the user
  - **Migration:** Old string-based categories auto-migrate on load; "Salary" category auto-removed on load
- **`settings`** — `{ currency, theme, accent }`
  - `currency`: supports $, €, £, ¥, ₹, C$, A$
  - `theme`: `"dark"` (default) or `"light"`
  - `accent`: hex color string (default `"#6c63ff"`)

## Tasks & Ideas Feature Details

- **Sub-tab toggle:** Pill-style toggle bar (`.subtab-bar`) at top of page switches between Tasks and Ideas views via `switchSubTab('tasks'|'ideas')`. Each view has its own filter bar, table, and pagination. Filter state is preserved when switching.
- **Ideas:** Functionally identical to Tasks — same data schema, inline editing, priority badges, context menu, checkboxes, pagination. Separate JS functions prefixed with `idea`/`Idea` (e.g., `renderIdeas()`, `openIdeaModal()`, `inlineEditIdea()`). Data stored in separate `ideas` array.
- **Ctrl+N shortcut:** Context-aware — opens task modal on tasks sub-tab, idea modal on ideas sub-tab, transaction modal on finances pages.
- **Inline editing:** All columns are click-to-edit (name, estTime, dueDate, priority, description). No right-click-to-edit required.
  - Priority shows a dropdown selector inline
  - Due dates display in long format ("January 1st, 2026") via `formatDateLong()`
  - Enter saves, Escape cancels
- **Right-click context menu:** Edit and Delete options on any task row
- **Checkboxes:** Custom styled using hidden `<input>` + visible `<span class="task-check-mark">` wrapped in `<label class="task-check-wrap">`. This pattern is used app-wide (tasks, transactions, filters) because Electron's Chromium doesn't reliably respect `appearance: none` on native checkboxes.
- **Completed tasks:** Full row gets strikethrough (`text-decoration: line-through` on all `td` elements) + dimmed opacity
- **Overdue tasks:** Due date shown in red if past due and not completed
- **Filtering:** Search input, priority filter dropdown, "Show Completed" toggle
- **Pagination:** 25 tasks per page
- **Priority badges:** Color-coded with CSS classes:
  - `.badge-most-important` — purple (`rgba(139,92,246,0.15)`)
  - `.badge-high` — rose/red (`rgba(248,113,113,0.15)`)
  - `.badge-medium` — amber (`rgba(245,158,11,0.15)`)
  - `.badge-low` — green (`rgba(34,197,94,0.15)`)

## Transactions Feature Details

- **Selectable rows:** Each transaction has a checkbox for multi-select. Header has select-all.
- **Bulk delete:** "Delete Selected" button appears when transactions are selected, with count badge.
- **Same checkbox pattern** as tasks (hidden input + styled span wrapper).

## Theming & Customization

- **Dark/Light themes:** Toggle in Settings. Uses `data-theme` attribute on `<html>`.
  - Dark: `--bg: #0f1117`, deep navy surfaces
  - Light: Warm cream/eggshell tones (`--bg: #f3efe6`, `--surface: #faf6ee`) — intentionally NOT stark white, inspired by Claude's UI
- **Accent colors:** 8 preset swatches in Settings (purple default, blue, cyan, green, amber, orange, rose, pink). Applied via `document.documentElement.style.setProperty('--accent', color)`.
- **CSS custom properties:** All colors defined in `:root` / `[data-theme]` selectors. Accent color and hover variant are set dynamically.

## Auto-Update System

- **Provider:** GitHub Releases on `garyguys/fintrack`
- **How it works:** On app launch (packaged builds only), `autoUpdater.checkForUpdatesAndNotify()` runs. It compares the app version against `latest.yml` on the latest GitHub Release. If newer, it auto-downloads in the background.
- **User feedback:** A full-screen overlay (`#update-overlay`) shows:
  - Version info and download progress bar with percentage
  - **"Skip for now"** button — dismisses the overlay, download continues in background
  - **"Restart Now"** button — appears when download completes, calls `autoUpdater.quitAndInstall()` via IPC
  - Overlay re-appears when download completes even if previously skipped
- **IPC channels for updates:**
  - `update-status` (main→renderer): sends `{ status, info }` with status values: `checking`, `available`, `downloading`, `ready`, `error`
  - `restart-for-update` (renderer→main): triggers `autoUpdater.quitAndInstall()`
- **Required release artifacts:** The `.exe`, `.blockmap`, and `latest.yml` must all be uploaded to each GitHub Release.
- **IMPORTANT — Filename format:** The `artifactName` in package.json is set to `${productName}-Setup-${version}.${ext}` which produces filenames with **hyphens** (e.g., `PersonalHQ-Setup-1.4.0.exe`). This is critical because GitHub converts spaces in uploaded filenames to dots, which would break the match with `latest.yml`. Never change this to use spaces.

## Release Workflow

```bash
# 1. Make changes
# 2. Bump version in package.json
# 3. Build
npm run build
# 4. Commit and push
git add -A && git commit -m "v1.x.x: description" && git push
# 5. Create GitHub Release (upload all 3 artifacts — note hyphenated filenames)
gh release create v1.x.x "dist/PersonalHQ-Setup-1.x.x.exe" "dist/PersonalHQ-Setup-1.x.x.exe.blockmap" "dist/latest.yml" --title "PersonalHQ v1.x.x" --notes "What changed"
```

## Git Config (repo-local)
- **User:** garyguys
- **Email:** garyguys@users.noreply.github.com
- **Branch:** main

## Known Limitations
- No code signing — SmartScreen warning on first install
- Electron app icon is the default Electron icon (no custom icon set)
- No multi-device sync (local-only storage)
- Chart.js loaded via CDN — requires internet on first load (cached after)

## Version History (key milestones)
- **1.0.0** — Initial release as FinTrack
- **1.0.2** — Removed Salary category, allow deleting default categories
- **1.0.3** — Bulk delete CSV imports
- **1.0.4** — Full-screen update overlay
- **1.0.5** — Added Tasks/To-Do list feature
- **1.1.0** — Rebranded to PFlux, restructured sidebar with Tasks/Finances sections
- **1.1.1** — Inline editing for task columns
- **1.2.0** — Swapped priority colors, added Settings page (theme/accent), selectable transactions with bulk delete
- **1.2.1** — Warm cream light theme
- **1.2.2** — Fixed auto-updater (hyphenated filenames), "Skip" button on overlay, fixed "FinTrack" → "PFlux" in overlay
- **1.2.3** — Strikethrough entire row on completed tasks, removed sidebar task count badge
- **1.2.4** — "Restart Now" button on update overlay
- **1.2.5** — Fixed checkbox rendering (hidden input + styled span pattern)
- **1.2.6** — Applied styled checkboxes to transactions and show-completed filter
- **1.3.0** — Added Ideas sub-tab alongside Tasks with pill-style toggle, context-aware Ctrl+N
- **1.4.0** — Rebranded to PersonalHQ
