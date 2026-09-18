# CookieKeep

Keep the cookies you want. Automatically clean the rest.

CookieKeep is a Chrome and Edge extension that lets users protect the cookies they want to keep and automatically clean the rest. The Spanish interface runs locally, without frameworks, third-party runtime dependencies, analytics, telemetry or remote services. Automatic cleanup is disabled by default.

## Project status and license

Version **1.1.7** adds recent-cookie cleanup, separates the automatic and recent cleanup cards, and polishes popup/dashboard headers with dynamic version metadata and explicit GitHub links. Earlier cleanup-policy, progress, cancellation, optional history and CSP safeguards remain in place. Source and Chromium ZIPs are tracked together. The published 1.1.1 archive is retained unchanged; the current archive is `releases/CookieKeep-v1.1.7-chromium.zip`.

All 177 Node tests pass. A real extension smoke test also passed in headless Edge using a new disposable profile and synthetic cookies. Manual acceptance in interactive Chrome/Edge, detailed SameSite behavior, forced worker termination and optional-permission prompts are covered by the reproducible guide in `BROWSER_VALIDATION.md`, not claimed as fully verified.

No LICENSE file is currently present.

## Install

Download and extract `releases/CookieKeep-v1.1.7-chromium.zip`. The manifest is at the archive root.

**Chrome:** open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.

**Microsoft Edge:** open `edge://extensions` and follow the same Developer mode / Load unpacked steps.

You can also load the repository root. Pin the extension to see its badge. Update an existing installation by keeping its folder path, replacing runtime files, pressing **Reload**, and reopening the views; do not uninstall if you want to preserve local settings. Existing installations may retain a previously granted history permission; you can revoke it with the browser's extension controls or Permissions API.

## Features

- One-click protection for the current HTTP/HTTPS hostname.
- Manual global or per-site cookie cleanup, requiring a fresh preview and confirmation.
- Scheduled cleanup every 24 hours, 3 days or 7 days using current cookies and protection.
- Dynamic preview with aggregates and a separate per-domain page with protection actions.
- Dashboard totals, approximate payload size, cookie metadata and aggregate cleanup history.
- Search, protected/unprotected filters and sorting by cookies, size, A-Z or local visits.
- Pagination: 50 / 100 / 200 / Todas (All), default 50, after filtering and sorting.
- Worker-owned progress, percentage, processed/total, deleted/failed/protected-skip counts and cancellation.
- Dynamic cookie-count badge and manifest version displayed in both popup and dashboard headers.
- Discreet GitHub repository links beside the version, opened in a new tab only when clicked; no automatic version checks or network requests.

The popup displays applicable cookies across accessible stores, estimated size and next cleanup. Green badge means explicitly protected, red means cookies without explicit hostname protection, gray means no cookies; internal browser pages have no badge. Conserved shared cookies are distinguished from explicit protection in the dashboard.

## Manual preview security

A preview token authorizes only the metadata identities of candidates in that preview. On confirmation, CookieKeep intersects that authorization with the current inventory and protection. New cookies require a new preview. A candidate is skipped if the actual remove selector could affect any cookie outside the authorized set, even when that cookie shares its name and URL. Host scope must match the token; tokens are one-use, expire after ten minutes, are bounded to 32 entries and disappear on worker restart.

Identity includes store ID, name, domain, path, hostOnly, Secure, HttpOnly, SameSite, session/persistent status, expiration date, and the full partition top-level site/cross-site-ancestor pair. **No cookie value is stored in a token.** Observed cookie-change events invalidate pending and active manual authorization, including value-only overwrites. Missing or changed metadata fails closed.

The API exposes no creation ID or atomic get/remove transaction. A same-metadata replacement cannot be distinguished by identity alone; change events reduce this risk but cannot eliminate an external mutation in the final API race window. CookieKeep therefore does not claim an absolute guarantee against every browser/site race.

Automatic cleanup does not reuse a scheduled preview list. It builds candidates when the alarm or last-window event executes and rechecks current protection during each batch. A cookie created after scheduling is considered at execution; cookies created after that run's initial inventory wait for a subsequent run rather than silently expanding that run's selector.

## Protection and precise removal scope

Protection uses exact hostnames, not guessed registrable domains. Host-only cookies match exactly; Domain cookies match the hostname and descendants with label boundaries. `evil-example.com` never matches `example.com`. Case, cookie/DNS dots and IDNs are normalized; `www` remains distinct.

Protecting `www.example.com` preserves applicable `.example.com` cookies. Protecting `example.com` does not automatically protect host-only cookies of `sub.example.com`. Shared Domain cookies and CHIPS top-level-site parent/child relationships are preserved conservatively. Incomplete partitions or unknown hostOnly fields are protected.

The collision defense considers the effective remove URL, domain/hostOnly, path boundaries, HTTP/HTTPS, store and partition. Unrelated same-name cookies no longer inherit protection. Potential unpartitioned collateral of a partitioned Chromium deletion is included conservatively; other CHIPS partitions remain separate. Ambiguous URL paths are skipped. `cookies.get` selection is checked, then Chrome itself supplies the URL-matching inventory, which is checked again before removal and afterward to confirm absence. Overlapping selectors are not run concurrently.

## Performance, progress and cancellation

`DELETE_CONCURRENCY = 8` bounds batches; there is no `Promise.all` over the full inventory. The old pipeline performed global inventories and a complete policy calculation for every cookie. The new pipeline enumerates globally once, then uses targeted name/store queries covering all possible partitions. It reads protection once per batch under the same queue used by protection writes. A protection request is saved after already-started batch operations finish and before the next batch begins; it cannot undo an in-flight removal.

Progress is aggregated in the worker, published at batch boundaries at most every 200 ms plus start/end, and checkpointed in `storage.session`. UI polling is 250 ms only while active, independent of deletion calls. Terminal states stop polling; session checkpoint events detect subsequent jobs. Page closure removes the listener and timer. Closing/reopening a popup retrieves current state. Cancel stops new removal starts, lets calls already in flight finish, and stores a partial aggregate summary. A restarted worker marks an interrupted operation failed and requires a new preview; it does not resume a stale deletion list. Cleanup history is written once at the end, at most 30 records. Runs have a three-minute limit.

Synthetic benchmark (`node scripts/benchmark.mjs 1000 1`): 1,000 cookies and 1 ms requested API latency measured **108,044.68 ms** for the sequential global-inventory pipeline and **11,714.51 ms** for bounded targeted deletion. Global getAll calls: 4,002 versus 2; returned cookie rows: 1,001,000 versus 3,000; storage reads: 1,002 versus 127; concurrent removes: 1 versus 8. Timer scheduling and synthetic data affect these measurements. They do not predict real-profile throughput or replace measuring the reported 3,500-cookie workload.

## Optional local visit ranking

`history` is optional and used only for **Más visitados**. Selecting that sort requests the permission directly from the user gesture; Chrome avoids another prompt if it is already granted. The load checks `permissions.contains`. Refusal leaves the dashboard/cleanup usable with A-Z and unavailable visit counts, explains the permission and offers **Permitir historial** to retry. Revocation clears the in-memory cache and degrades the view.

Periods are rolling 7/30/90 days or all available history; default 7. One global history search is followed by relevant unique URL visit queries, at most six concurrently. Counts use visit timestamps and unique visit IDs, exclude subframes, and include reloads and available synced records. They represent navigation records, not users or sessions. Parent/child row counts can overlap. Empty history means zero; loading/errors use A-Z and unavailable counts, never cookie counts. The 100,000-URL limit or missing timestamps produces partial `≥` counts. URLs are never persisted; aggregates exist only in dashboard memory and are invalidated by refresh/history events.

## Privacy and permissions

Processing stays local. Cookie values are read transiently for UTF-8 JSON payload-size estimates; they are never logged, persisted in local/session storage, shown in the UI or sent to servers. Approximate size is not disk usage. Local storage contains whitelist, schedule and aggregate cleanup records; session storage contains aggregate progress. No content scripts or external network/analytics code exists.

| Manifest permission | Purpose |
| --- | --- |
| `cookies` | Enumerate, observe and remove cookies |
| `storage` | Local settings/history and session progress |
| `alarms` | Recoverable scheduled cleanup |
| Optional `history` | Local dashboard visit ranking only |
| HTTP/HTTPS host permissions | Cookies and covered tab URLs |

The CSP is `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`. It limits packaged subresources, prohibits covered connect operations, plugins, frames, forms and base overrides. It is defense in depth, not a universal prohibition of network activity through navigation or browser APIs. UI uses local DOM construction and textContent, without remote scripts or HTML derived from cookie data.

## Development and validation

Requires Node.js 20+; ZIP packaging uses Windows PowerShell. No runtime dependencies or npm install are needed:

```powershell
node --test
node scripts/build.mjs
```

`npm test` / `npm run build` work if npm exists. Build regenerates PNGs and validates JavaScript, imports, HTML resources, manifest and required/optional permissions. On Windows it produces the manifest-versioned Chromium ZIP and verifies entries, version and runtime hashes. Only manifest, runtime source and icons are packaged. Tests, documentation, scripts, Git, credentials and temporary files are excluded. ZIPs are intentionally versioned.

`node scripts/benchmark.mjs 1000 1` runs the synthetic comparison. `scripts/browser-smoke.mjs` is optional and needs an existing local Playwright installation (or its index.mjs path as an argument); it always creates a new temporary Edge profile. Neither test tool accesses your real profile. See `BROWSER_VALIDATION.md`, `VALIDATION.md` and `CHANGES.md`.

Source: `src/background/worker.js` coordinates APIs, jobs and alarms; `src/lib/` implements domains, selector/identity, policy, cleanup, progress and history; `src/popup/` and `src/options/` contain the views; `tests/` contains synthetic regressions; `scripts/` contains build, packaging and optional QA tools.

## Limits

Chrome 130+ and equivalent Edge APIs are required. Unsupported partition enumeration blocks deletion. Only accessible profile stores are handled; incognito requires explicit enablement and separate acceptance. Browser sleep can delay alarms. CookieKeep does not clear localStorage, IndexedDB or cache, and cannot stop sites recreating cookies or the browser discarding session cookies. Unexpected browser/site changes may affect measured aggregate counts. Safe skipping can preserve extra cookies when selectors overlap or become ambiguous; generate a fresh preview or wait for the next schedule.

Cleanup progress is shown only while running or cancelling. Terminal results remain in cleanup history; the popup and dashboard automatically hide the progress block with no reserved space.

### Site cookie inspector

Click a dashboard domain to open a compact A–Z cookie list with name, path, session/persistent type and approximate size. **Ver** expands metadata for that cookie only; values are never displayed. **Borrar** requires confirmation and authorizes exactly one cookie identity through the existing safe cleanup engine. Protected cookies and selectors that could affect another cookie are blocked. Successful deletion refreshes the list, dashboard counts/sizes and aggregate cleanup history. The modal body scrolls while its title and Close button remain accessible.

### Cleanup when the last normal window closes

Both the popup and dashboard expose **Al cerrar todas las ventanas** alongside disabled, 24-hour, 3-day and 7-day schedules. Popup selection saves immediately; the dashboard uses Guardar frecuencia. Saving any automatic mode requires no preview/token and never starts cleanup immediately. One local `cleanupSchedule` object holds `disabled`, `interval` (with minutes), or `lastWindowClosed`; legacy interval settings are migrated on read and saved without a second interval flag. Local storage events synchronize both views. Closing mode shows **Próxima limpieza: al cerrar todas las ventanas**, with no predicted date or interval alarm.

The worker listens to `chrome.windows.onRemoved`, tracks normal-window IDs in session storage, and checks for remaining normal windows. Auxiliary-window and extension-popup closures do not trigger cleanup; duplicate final-removal events and overlapping jobs are ignored. Automatic cleanup reads current cookies/protection and records its aggregate result. `runtime.onSuspend` is not used. If closing all windows also exits the browser process, browser shutdown can interrupt the worker; completion cannot be guaranteed after process exit. An interrupted checkpoint is reported safely when the worker restarts.

### Protect current dashboard list

**Proteger listado actual** confirms and protects exactly the domains rendered on the current page after search, filtering, sorting and pagination. **Todas** includes all filtered visible results. Existing whitelist entries are preserved; at most one serialized whitelist write adds missing entries. The table, protected-site metrics and active filters refresh immediately. This action does not delete cookies, request previews or alter cleanup schedules.

The dashboard defaults to **Más visitados / 7 días**. Explicit sort/history-range choices are saved in local `dashboardPreferences` and restored on reopening. History remains optional; opening the dashboard checks permission without prompting, and falls back to A–Z/unavailable counts until access is granted.

### Recent cleanup dashboard

The header contains only Refresh. Two independent cleanup cards separate automatic scheduling from recent cleanup. **Dry run** simulates the selected 1/2/24-hour window; **Limpiar selección** previews and confirms that window; **Limpiar todo** independently previews all unprotected cookies, ignoring the window. All manual tokens keep their exact host/time scope and authorized intersection, and current protection is revalidated.

Recent eligibility means a creation/update event observed by CookieKeep, not a Chrome-provided creation date. Unknown timestamps are excluded. Session storage contains SHA-256 metadata fingerprints and last-observed timestamps, without cookie values or plaintext names/domains. Tracking begins with observed events, survives worker reactivation when its session checkpoint is available and resets with browser session loss. It does not backdate existing cookies. Automatic cleanup remains current-inventory based. No additional permission is required.
