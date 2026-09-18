# CookieKeep — cambios

## 1.1.1

La protección de sitios añadidos después de configurar alarmas ya funcionaba. Se conserva el ejecutor y callback de alarma y se añade una prueba específica de ese recorrido.

Archivos modificados en esta actualización:

- `src/lib/policy.js`: devuelve filas agregadas del conjunto eliminable y calcula métricas a partir del mismo plan.
- `src/background/worker.js`: incluye las filas en la respuesta preview; tokens conservan solo hostname/fecha, sin congelar candidatos.
- `src/lib/ui.js`: texto agregado de sitios/cookies conservados y eliminables.
- `src/options/options.js`: confirmación compacta, link separado y actualización del resumen ante cambios locales.
- `src/shared.css`: estilo del link; elimina el espacio reservado por notice vacío únicamente en popup.
- `tests/core.test.js`, `tests/dashboard.test.js`: verificaciones de dataset y modal/enlace.
- `manifest.json`, `package.json`: versión 1.1.1; no añade permisos.
- `README.md`, `VALIDATION.md`, `CHANGES.md`: documentación de ajustes y verificación.

Archivos añadidos:

- `src/options/preview.html`, `preview.js`: preview dinámica separada, con acción de proteger.
- `tests/automatic-protection.test.js`: alarma disparada tras modificar whitelist/cookies.
- `tests/preview-view.test.js`: integración de resumen, filas y protección/recalculo.

Sin cambios: `src/lib/cleanup.js`, callback onAlarm, `domains.js`, historial/ranking, iconos, popup HTML/JS, permisos y ancho del popup.

## 1.1.0

Cambios sobre la versión 1.0.0 recuperada del ZIP existente; se conserva su arquitectura, CSS, popup, background y comportamiento de cookies.

## Archivos modificados

- `manifest.json`: permiso history y versión 1.1.0; mismas rutas de icono.
- `package.json`: versión 1.1.0, sin dependencias nuevas.
- `icons/16.png`, `32.png`, `48.png`, `128.png`: galleta transparente, sin cifras ni fondo.
- `scripts/build.mjs`: usa generador de iconos transparente y valida el nuevo permiso.
- `src/options/index.html`: cuarta opción de orden, selector de periodo, columna de visitas y estado accesibles.
- `src/options/options.js`: consulta bajo demanda, orden por visitas, estados de carga/error y caché invalidable en memoria.
- `README.md`, `VALIDATION.md`: permiso, métrica, privacidad, límites, pruebas y recarga.

## Archivos añadidos

- `scripts/icon.mjs`: generador PNG sin dependencias, adaptado a tamaños de toolbar.
- `src/lib/history.js`: lógica testeable de ventanas, agregación, cruce por dominio, orden y caché.
- `tests/history.test.js`, `tests/icons.test.js`, `tests/dashboard.test.js`: nuevas verificaciones.
- `CHANGES.md`: este registro.

## Sin cambios

`src/background/worker.js`, `src/popup/*`, `src/shared.css` y todos los módulos previos de `src/lib` conservan sus contenidos. Los tests previos tampoco se modifican. No se migra ni borra el almacenamiento existente y no se cambia la política de whitelist, limpieza, dry run, estadísticas o badge.

### Additional 1.1.1 dashboard and repository preparation

- Added 50 / 100 / 200 / All pagination after filtering and sorting, with row range, page count and previous/next controls.
- Corrected dashboard section spacing and activation-modal summary/link/action spacing.
- Added pagination integration coverage: 60 passing tests.
- Rewrote README in English and added ignore rules for local files and credential formats.
- Added Windows ZIP packaging to build; the release archive is versioned alongside complete source.

### Additional acceptance coverage

- Expanded pagination tests to include more than 1,000 domains, all size options, protected/unprotected filters and visit ranking before pagination.
- Updated row-range wording, retained page controls disabled for All, and guarded page bounds.
- Verified dashboard, modal and popup layout in headless Edge using synthetic browser APIs; retained existing transparent cookie icons and dynamic badge.
- Added requested tagline and project/license status to the English README.
- Renamed the versioned distribution to CookieKeep-v1.1.1-chromium.zip and added archive entry/version/hash verification to packaging.

### Popup version indicator

- Added a small muted version below the CookieKeep brand using chrome.runtime.getManifest().version; no fixed version string in the UI.
- Retained existing popup/header geometry and the right-hand local-browser label placement.
- Added coverage using two alternative runtime versions; all 70 tests pass. Build and Chromium ZIP verification pass.

## 1.1.2 — security, bounded deletion and progress

- H1: scope-aware collision protection replaces global name/store/partition conservation; unrelated domains remain removable.
- H2: one-use manual previews authorize metadata identities and exact host scope. New/changed cookies or unauthorized selector collateral are skipped. Current protection always takes priority. Automatic alarms use current execution-time candidates, not scheduled previews.
- Bounded deletion concurrency 8; targeted inventories replace per-cookie global scans. Added worker-owned progress, throttled session checkpoints, partial cancellation and safe interrupted-run handling.
- history is now optional, with gesture-based request, refusal/retry and revocation handling.
- Hardened default/style/image/base/form/frame CSP directives; corrected the scope of privacy/CSP claims.
- Added synthetic regressions, benchmark, real disposable-profile Edge smoke and reproducible manual Chrome/Edge guide. 112 tests passed, zero failed.
- Version 1.1.2 and versioned Chromium ZIP; 1.1.1 published archive retained unchanged. No license selected.

## 1.1.3 — cleanup progress completion state

- Show the shared popup/dashboard progress block only for running or cancelling jobs.
- Hide terminal progress immediately with no reserved layout space; preserve results in history and cancellation/error notices.
- Stop polling at terminal states. Session checkpoints wake the UI for subsequent jobs; pagehide removes the listener and timer.
- Added state, completion, reload and timer/listener regressions: 121 tests passed, zero failed.
- Real disposable-profile Edge validation confirms completion hides progress in both open pages with zero layout height, and terminal reload remains hidden.

## 1.1.4 — compact site cookie inspector

- Replace full cookie metadata cards with a compact name-sorted list showing path, session/persistent type and approximate size.
- Expand metadata for a single cookie with Ver; cookie values remain hidden.
- Confirm individual deletion and authorize exactly one identity through the safe cleanup engine, including store/CHIPS handling and current whitelist checks. Ambiguous collateral is blocked.
- Refresh cookie rows, dashboard counts/sizes and aggregate history after deletion.
- Keep modal title/Close accessible with responsive rows and internal scrolling.
- 138 tests passed, zero failed; real disposable-profile Edge inspector and cleanup smoke passed.

## 1.1.5 — versioned delivery

- Version the completed compact site-cookie inspector and dashboard updates as 1.1.5.
- Update manifest/package metadata and current distribution references; popup version remains manifest-driven.
- Include a verified Chromium ZIP alongside source. Preserve earlier versioned archives and commit history.

### 1.1.5 completion — last normal window cleanup

- Add visible Al cerrar todas las ventanas selection in popup and dashboard, alongside all interval modes.
- Use one cleanupSchedule object; migrate legacy interval state and synchronize both views through local storage events.
- Show closing-mode text without a date; remove interval alarms in closing/disabled modes.
- Listen to windows.onRemoved and check remaining normal windows; ignore auxiliary/popup closures, repeated removal events and overlapping jobs.
- Restore normal-window IDs from session storage across worker restarts without storing URLs; reuse current-inventory/protection cleanup and aggregate history.
- 146 tests passed; real disposable-profile Edge UI persistence and bidirectional synchronization passed. Browser process exit may interrupt cleanup.

### 1.1.5 fix — automatic settings independent of manual previews

- Split settings from confirmed manual cleanup: automatic mode saves never read, validate or consume preview tokens and never delete cookies immediately.
- Popup and dashboard save automatic schedules directly; manual preview expiry, scope and authorization remain enforced.
- Closing mode displays Próxima limpieza: al cerrar todas las ventanas in both views.
- Replace mixed generic preview errors with flow-specific configuration/manual/automatic messages, including interrupted automatic jobs.
- Add token-free mode transition, fresh inventory/protection and manual authorization/expiry regressions.

## 1.1.6 — protect current dashboard list

- Add Proteger listado actual beside dashboard search/filter/sort controls with confirmation and added/already-protected feedback.
- Use exactly the final rendered collection after pagination; Todas includes all filtered results. Capture that page at confirmation without expanding hidden domains.
- Normalize and merge whitelist entries under the existing queue with at most one state write; preserve concurrent popup changes and refresh rows/metrics/filter membership.
- Default to Más visitados / 7 días and restore explicit local sort/history-range preferences. Optional-history fallback remains usable without prompting on initial load.
- 164 automated tests passed, zero failed.
