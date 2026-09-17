# CookieKeep 1.1.1

CookieKeep is a Manifest V3 extension for Chrome and Edge Chromium. Protect sites with one click and remove unprotected cookies locally. The interface is in Spanish. Automatic cleanup is disabled by default. There are no frameworks, third-party dependencies, telemetry or remote services.

## Install

Extract `releases/CookieKeep-1.1.1-Chromium.zip`, open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the extracted folder containing `manifest.json`. The manifest is at the archive root. You can also load the repository root directly. Pin the extension to display its cookie badge.

To update an existing installation, keep its folder location, replace its runtime files, press **Reload** on the extensions page, then reopen the popup and dashboard. Keeping the extension installed preserves its local whitelist and settings.

## Development and release

Requires Node.js 20 or later; Windows PowerShell is used for ZIP packaging. No dependency installation is needed. Run from the repository root:

```powershell
node --test
node scripts/build.mjs
```

`npm test` and `npm run build` are equivalent if npm is available. The build regenerates transparent PNG icons at 16/32/48/128 pixels, checks JavaScript syntax, relative imports, HTML resources, manifest entries and permissions. On Windows it also creates the versioned Chromium ZIP in `releases/`, containing only `manifest.json`, `src/` and `icons/`. The source tree remains directly loadable. On other platforms, validation and icon generation run; create the archive with `scripts/package.ps1` on Windows. The ZIP is intentionally tracked in Git alongside the complete source.

The original 1.1.1 baseline passed 59 tests. The current suite passes 60, including dashboard pagination integration coverage. Tests use synthetic data and simulated browser APIs; they do not access a real browser profile.

## Use

The popup displays the current HTTP/HTTPS hostname, protection state, applicable cookies across accessible stores, estimated size and next cleanup. Protection toggles with one click. Green badge means explicitly whitelisted; red means cookies without explicit hostname protection; gray means no cookies. Internal browser pages have an empty badge.

The dashboard displays total cookies, domains, estimated size, protected sites and removable cookies. Search and filter rows, sort by count, size, domain or visits, inspect metadata, protect sites, or delete unprotected cookies. Cookie domains are normalized without their leading dot. Whitelisted hostnames appear even when they have no cookies. Conserved cookies inherited from another protected site are distinguished from explicit protection.

Pagination offers **50 / 100 / 200 / Todas (All)**, defaulting to 50. Search, state filters and sorting apply to the complete inventory before pagination. Changing those controls or page size returns to page one. Refresh clamps the current page if the inventory shrinks. Previous/next controls, row range and page count reflect the filtered results. All renders the complete filtered inventory and can be slower with large inventories.

**Vista previa / Dry Run** never modifies cookies. Manual cleanup requires confirmation. Automatic intervals are 24 hours, 3 days or 7 days. The activation modal shows aggregate counts, a separately spaced **Ver qué se eliminará** link and confirmation controls. The link opens an extension tab with a fresh preview, per-domain counts and protection actions. Protection and cookie changes recalculate that preview. The modal updates its summary after local settings changes. Dashboard sections use consistent spacing; empty status messages occupy no space.

Preview tokens expire after ten minutes or a worker restart. Generate a new preview when needed. Scheduled cleanup always reads the current cookies and whitelist; configuring a schedule does not freeze a deletion list. Alarms are recovered from local settings on worker startup, browser startup/installation and view access. They can be delayed and do not wake a sleeping device. There is no cleanup on browser shutdown.

## Protection and safe deletion

Protection uses exact hostnames, without automatic registrable-domain grouping. Host-only cookies require an exact hostname match. Domain cookies apply to matching hosts and subdomains, with label boundaries: protecting `www.example.com` conserves applicable `.example.com` cookies, but protecting `example.com` does not automatically protect host-only cookies of `sub.example.com`. `evil-example.com` never matches `example.com`. Case, leading cookie dots, trailing DNS dots and IDNs are normalized; `www` remains distinct.

Shared parent-domain cookies are conservatively preserved. CHIPS cookies are protected when applicable to a protected hostname or when their partition top-level site has a parent/child relationship to it. Opaque or incomplete partitions are preserved.

Cleanup enumerates accessible stores and partitions, then uses the same pure policy as dry run. Before each deletion it rereads inventory and protection through a shared queue, constructs a safe HTTP/HTTPS URL and checks cookie identity (name, domain, path, store and full partition key). Ambiguous paths are skipped. Because the removal API cannot select every identity field explicitly, any name/store/partition group containing a protected cookie is skipped conservatively. Removal is followed by an absence check.

The whitelist also takes priority during per-site deletion. Storage failure, an invalid whitelist or incomplete inventory blocks cleanup. Removal failures are counted as failures. A run is limited to three minutes; an incomplete run can be repeated. Protection takes effect when saved and cannot undo a deletion already started. Browser APIs do not provide an atomic transaction against external site changes.

## Visits ranking

**Más visitados** shows visits over rolling 7/30/90-day windows or all available history; the default is 30 days. One global `history.search` query is followed by `getVisits` for relevant unique HTTP/HTTPS URLs, with at most six concurrent requests. Counts use visit timestamps, deduplicate visit IDs, exclude subframes and include reloads and available synchronized records. They represent navigation records, not users or sessions; cumulative `visitCount` is not used.

A domain row includes visits to its subdomains using label boundaries. Parent and child rows may overlap, so their counts should not be summed. Ties use domain A–Z. No records means zero visits. Loading or failures show A–Z ordering and unavailable visit counts, with an explanatory status. There is no fallback to cookie counts. Reaching the 100,000-URL search limit or encountering missing timestamps displays partial counts with `≥` and an incomplete-ranking warning.

History is read only when that sort is selected in the dashboard. Aggregates are cached only in memory by period and domain inventory. Refresh, new visits and history deletion invalidate the cache; stale requests are discarded. No browsing URLs are persisted. Deleted or unavailable history cannot be reconstructed.

## Privacy and permissions

Cookie values are read transiently for estimated UTF-8 JSON size. They are never stored, logged, sent to the interface or transmitted to servers. Details show metadata only. Sizes are payload estimates, not disk usage. Local extension storage contains the whitelist, schedule and at most 30 aggregate cleanup records (date, source, deletion/domain counts, estimated bytes, skipped/failed counts and incomplete flag).

The extension uses local DOM construction and `textContent`, without content scripts or remote scripts. Its CSP blocks external connections.

| Permission | Purpose |
| --- | --- |
| `cookies` | Enumerate, observe and remove cookies |
| `storage` | Store local protection, schedule and aggregate cleanup records |
| `alarms` | Recoverable periodic cleanup |
| `history` | Read local visit records for dashboard ranking; never modify history |
| HTTP/HTTPS host permissions | Access cookies and covered tab URLs |

The manifest does not request `tabs`, `activeTab`, `scripting`, `browsingData`, notifications or file access.

## Source layout

- `manifest.json`: Manifest V3, version 1.1.1.
- `src/background/worker.js`: messages, alarms, badges and coordination.
- `src/lib/`: domain matching, cookie identity, policy, storage, compatibility, cleanup, visit ranking and DOM helpers.
- `src/popup/`: compact current-site view.
- `src/options/`: dashboard and detailed preview.
- `src/shared.css`: shared layout and styles.
- `icons/`: generated transparent PNG icons.
- `tests/`: policy and simulated browser integration tests.
- `scripts/`: validation, icon generation and Windows ZIP packaging.
- `releases/`: versioned Chromium ZIP.
- `CHANGES.md`, `VALIDATION.md`, `IMPLEMENTATION_PLAN.md`: change and implementation records.

## Compatibility and verification limits

The manifest requires Chrome 130 or later; Edge must expose equivalent Chromium APIs, including full partition keys. Unsupported partition enumeration blocks cleanup instead of silently using partial results. Only the installed profile and API-accessible stores are available. Incognito must be explicitly enabled and has no separately validated workflow.

CookieKeep does not remove localStorage, IndexedDB, cache or other credentials. Open sites can immediately recreate cookies; the browser can discard session cookies independently of the whitelist. Repeated inventory checks can be slow with thousands of cookies, and concurrent expiration or regeneration affects aggregate estimates.

Automated tests validate policy, guards, simulated alarms, preview consistency, ranking and pagination. Interactive installation and visual acceptance in real Chrome/Edge remain pending. See `VALIDATION.md`. For manual acceptance, verify pagination across all four sizes, search from a later page, inspect modal spacing, protect a site after scheduling cleanup and confirm it stays protected when cleanup runs in a disposable test profile.
