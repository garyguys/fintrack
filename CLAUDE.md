# FinTrack - Budget & Expense Tracker

## Overview
FinTrack is a personal desktop finance app built as a single-page HTML app wrapped in Electron. It tracks expenses, income, budgets, savings goals, and recurring transactions with interactive charts. Designed for personal use and shared with a small group of friends.

**Repo:** https://github.com/garyguys/fintrack
**Current version:** 1.0.1

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
├── index.html        # Entire app UI, styles, and logic (single file ~2100 lines)
├── main.js           # Electron main process: window creation, file I/O (IPC), auto-updater
├── preload.js        # Context bridge: exposes fileStorage API to renderer securely
├── package.json      # Dependencies, version, electron-builder config, GitHub publish config
├── .gitignore        # Ignores node_modules/ and dist/
├── claude.MD.txt     # Original project brief (can be ignored)
└── dist/             # Build output (gitignored)
    ├── FinTrack Setup X.X.X.exe
    ├── FinTrack Setup X.X.X.exe.blockmap
    ├── latest.yml
    └── win-unpacked/
```

### Key Design Decisions
- **Single HTML file:** All UI, CSS, and JS live in `index.html`. This was intentional for simplicity — no bundler, no framework overhead. When editing, be aware the file is large (~2100 lines).
- **Dual storage mode:** The app detects `window.fileStorage` (injected by Electron's preload) to decide between file-based and localStorage. This means the app still works if you just open `index.html` in a browser for quick testing.
- **Atomic file writes:** `main.js` writes to a `.tmp` file then renames to prevent data corruption on crash.
- **Debounced saves:** The renderer batches rapid `saveAll()` calls — writes to localStorage immediately (cache) and debounces the IPC file write by 300ms.
- **No code signing:** The build skips code signing (`signAndEditExecutable: false`, `signingHashAlgorithms: null` in package.json). Windows SmartScreen will warn on first install — users click "More info" > "Run anyway".

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
- **`categories`** — Array of `{ name, type }` where type is `"expense"`, `"income"`, or `"both"`
  - Categories are type-aware: expense categories show in budget settings, income categories show when logging income, "both" shows everywhere
  - Default expense categories: Food, Transport, Housing, Utilities, Entertainment, Healthcare, Shopping
  - Default income categories: Paycheque, Salary, Freelance, Investments
  - Default both: Gifts, Other
  - **Migration:** Old string-based categories (pre-type system) auto-migrate on load
- **`settings`** — `{ currency }` — supports $, €, £, ¥, ₹, C$, A$

## App Pages / Features

1. **Dashboard** — Month-navigable (prev/next arrows) stats cards (income, expenses, net savings, budget used %), doughnut chart (spending by category), bar chart (6-month income vs expenses trend), recent transactions, budget progress bars, overspend alerts (80%+ warning, 100%+ red alert)
2. **Transactions** — Full CRUD table with search, category/type/date filters, sortable columns, pagination (25/page), duplicate button, CSV import/export
3. **Budgets** — Set monthly limits per expense category, progress bars with color coding (green/orange/red)
4. **Savings Goals** — CRUD with progress bars, "Add Funds" via styled prompt modal, target dates
5. **Recurring** — CRUD for auto-generating transactions on schedule, processes on every page load
6. **Reports** — Period selector (month/quarter/year/all), daily spending line chart, horizontal bar category breakdown, top 5 categories list, summary stats
7. **Settings** — Currency selector, category management (add with type, remove custom ones), data export/import (JSON), clear all data, shows data file path in Electron

## UI Notes
- Dark theme only (CSS custom properties in `:root`)
- Responsive with collapsible sidebar on mobile (<900px)
- All delete/destructive actions use custom styled confirm modals (not native `confirm()`)
- "Add Funds" on goals uses a custom styled prompt modal (not native `prompt()`)
- Keyboard shortcut: `Ctrl+N` opens quick-add transaction from anywhere, `Escape` closes modals
- Toast notifications for all actions (bottom-right, auto-dismiss 2.5s)
- Empty chart states show a friendly icon + message instead of blank canvases

## Auto-Update System

- **Provider:** GitHub Releases on `garyguys/fintrack`
- **How it works:** On app launch (packaged builds only), `autoUpdater.checkForUpdatesAndNotify()` runs. It compares the app version against `latest.yml` on the latest GitHub Release. If newer, it downloads in the background and installs on next app quit.
- **User feedback:** The sidebar shows a banner with download progress and "ready to install" status.
- **Required release artifacts:** The `.exe`, `.blockmap`, and `latest.yml` must all be uploaded to each GitHub Release.

## Release Workflow

```bash
# 1. Make changes
# 2. Bump version in package.json
# 3. Build
npm run build
# 4. Commit and push
git add -A && git commit -m "v1.x.x: description" && git push
# 5. Create GitHub Release (upload all 3 artifacts)
gh release create v1.x.x "dist/FinTrack Setup 1.x.x.exe" "dist/FinTrack Setup 1.x.x.exe.blockmap" "dist/latest.yml" --title "FinTrack v1.x.x" --notes "What changed"
```

## Git Config (repo-local)
- **User:** garyguys
- **Email:** garyguys@users.noreply.github.com
- **Branch:** main

## Known Limitations
- No code signing — SmartScreen warning on first install
- Electron app icon is the default Electron icon (no custom icon set)
- No light theme toggle
- No multi-device sync (local-only storage)
- Chart.js loaded via CDN — requires internet on first load (cached after)
