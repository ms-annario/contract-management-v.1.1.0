# Contract Management – tender workspace prototype

A clickable prototype of the tender preparation workspace. It has no back end or build step: plain HTML, CSS and JavaScript that runs in the browser and keeps its data in `localStorage`.

It started as a single HTML file and was split into the files below, with the code unchanged.

## Running it

Serve this folder with any static web server and open `index.html`, for example:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` straight from disk also works in most browsers.

- **Switching role:** the **Viewing as** menu in the header changes who you're signed in as (Project lead, IC, SME, System admin and so on).
- **Starting over:** **Reset demo** clears saved changes and restores the sample data.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page shell (header, sidebar, main view, toast area, modal) and the script tags |
| `css/styles.css` | All styles: design tokens, light/dark theme, layout, components |
| `js/data.js` | Constants and statuses, sample data (`seed`), load/save, migrations of saved data, lookups (`T`, `D`, `PR`, `projOf`…), roles and permissions, tender stages and progress |
| `js/core.js` | Formatting and HTML helpers (`esc`, `fmtDT`, `badge`…), modal, toasts, hash router, sidebar navigation, delegated event handling |
| `js/tasks-admin.js` | My Tasks, Users (admin), Projects page, invites, document catalogue |
| `js/home-search.js` | Home: universal search, the Project → Tender → Document filters, and the project, tender and document panels |
| `js/projects-tenders.js` | Creating, editing and deleting projects and tenders; deleting documents |
| `js/library.js` | Document library: upload, list, status pipeline, document category and type configuration |
| `js/tender-pages.js` | Tender pages (Overview, Team, Documents, Success metrics) and AI document recommendations |
| `js/documents.js` | Document page: versions, editor, comments, approvals; package and TEC views |
| `js/exports.js` | DOCX, PDF and ZIP downloads; AI success-metric suggestions |
| `js/tables.js` | Sorting and pagination for every `table.t` |
| `js/main.js` | Start-up: opens Home and draws the first page |

The scripts are plain (non-module) scripts that share one global scope, so **the order in `index.html` matters**. `data.js` must come first, and `main.js` last, after every page has been registered.

## How it works

- **State:** everything lives in one global object, `S` (users, projects, tenders, docs, packages, activity, notes, catalogue). `load()` reads it from `localStorage` under the key in `STORE`, or calls `seed()` the first time. `save()` writes it back.
- **Migrations:** `migrate()` runs on every load and upgrades data saved by older versions, for example turning old sub-projects into project-level data (`dropSubprojects`). Add a step here when the data shape changes.
- **Routing:** URLs are hashes such as `#/tender/<id>/team`. `route(name, fn)` registers a page; `fn` returns an HTML string that `render()` puts into `#view`. Home uses `#/search/<project>/<tender>/<document>`.
- **Events:** elements declare their handler in markup with `data-act` (click), `data-chg` (change) or `data-inp` (input). A single listener in `core.js` calls `ACT[name](element, event)`. To add an action, define `ACT.myAction = el => { … }` and use `data-act="myAction"`.
- **Updating the screen:** after changing `S`, call `rerender()`, which saves and redraws the current page.
- **Pop-ups:** `openModal({title, body, submit, onSubmit})`. Returning a string from `onSubmit` shows it as a validation error and keeps the pop-up open.
- **Permissions:** helpers in `data.js` such as `isAdmin`, `isPL`, `isIC`, `canCreateProject`, `canSeeTender`, `canEditDoc`. Pages call `denied(message)` when the current role can't see them.

## Configuration points

These lists are expected to move to back-end configuration:

| Setting | Where |
|---|---|
| Document library categories and types | `LIB_DOC_CONFIG` in `js/library.js` |
| Platform roles | `PLATFORM_ROLES` in `js/data.js` |
| Tender stages | `STAGES` in `js/data.js` |
| Document and package statuses | `DS` and `PS` in `js/data.js` |
| Library file statuses | `LIB_ST` in `js/library.js` |
| Tasks each role must complete | `ROLE_REQUIRED` in `js/tasks-admin.js` |
| Who can be contract project IC | `icCandidates` in `js/projects-tenders.js` |
| Default document catalogue | `S.catalogue` in `seed()` (`js/data.js`) |

## Current product rules

- Tenders belong directly to a project, and the Project lead prepares them. There are no sub-projects.
- Every Project lead, and every System admin, can create projects.
- A new tender needs a contract number, a title and a contract project IC.
- Files uploaded to the Document library belong to a project (not a tender) and have a category and type. They are reference copies: you can only download or delete them, with no edit, comments or activity. Tender documents keep their full workflow.

## Known gaps before production

- **No back end:** data is per browser in `localStorage`, and nothing is shared between users. Sign-in is simulated by the role menu.
- **Global scope:** every file adds to one global namespace. Moving to ES modules or a framework means making those dependencies explicit.
- **HTML built from strings:** pages are assembled as strings. Use `esc()` for any user text. A templating or component library would make this safer.
- **Sample data:** `seed()` still generates sub-projects and Sub-project lead users, which `migrate()` then converts. Keeping the generator unchanged keeps the sample data the same.
- **External scripts:** DOCX and PDF export load `docx` and `jsPDF` from public CDNs when first used. Fonts come from Google Fonts.
- **AI features:** they use `window.claude` when the page runs inside Claude, and fall back to rule-based suggestions elsewhere.
- **No automated tests.**
