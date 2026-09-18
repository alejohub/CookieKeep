# Validación de entrega

Fecha: 17/09/2026.

## Actualización 1.1.1 — whitelist posterior y preview separada

- `node --test`: **59 tests aprobados, 0 fallidos**, incluidos los 55 anteriores.
- `node scripts/build.mjs`: aprobado; incluye las nuevas referencias HTML/imports.
- Nueva prueba de alarma real del worker con API simulada: programar 4320 minutos, añadir whitelist después, crear cookies adicionales y disparar onAlarm; las cookies protegidas permanecen y las no protegidas actuales se eliminan.
- Prueba de preview: resumen y filas comparten el mismo dataset; puntos iniciales de Domain se normalizan para agrupar correctamente; una whitelist posterior cambia candidatos y métricas.
- Integración de dashboard: modal agregado sin dominios, link a pestaña separada.
- Integración de vista detallada: renderiza resumen/filas del mismo plan; Proteger sitio y cambios de cookies actualizan la vista.
- Popup: inspección del CSS/HTML identifica el párrafo notice vacío con min-height y márgenes como causa del espacio adicional; se oculta solo en popup, manteniendo ancho/padding.
- El ejecutor de limpieza, el callback de alarma, matching de protección, historial de navegación, iconos y badge no han cambiado.
- No se ha realizado una medición visual interactiva del popup ni instalación en Chrome/Edge reales en esta sesión.

Las secciones siguientes conservan las verificaciones históricas de las versiones anteriores.

## Actualización 1.1.0 — icono y ranking

- `node --test`: **55 tests aprobados, 0 fallidos**, incluidos todos los 31 anteriores.
- `node scripts/build.mjs`: aprobado; iconos transparentes regenerados y paquete validado.
- 19 tests de historial: ventanas 7/30/90/all, normalización, subdominios y falsos matches, fechas, deduplicación, empates, ceros, truncamiento, fallos y concurrencia/caché/invalidation.
- 4 tests PNG: RGBA, transparencia de esquinas, bordes suavizados y chips en 16/32/48/128 píxeles.
- Test de integración del dashboard con adaptador DOM: selector/columna condicionales, ranking real, caché, cambio de periodo, error sin fallback a cookies y borrado de historial.
- Inspección visual de PNG 16/32/128 realizada.
- Lógica de background, whitelist, cookies y limpieza conservada sin modificaciones respecto a 1.0.0. El nuevo módulo solo importa funciones de dominios existentes.
- No se ha realizado instalación interactiva en Chrome/Edge; no se presenta esta comprobación simulada como validación de navegador real.

La sección siguiente conserva el registro de la entrega original 1.0.0.

## Verificación automatizada ejecutada

- `node --test`: **31 tests aprobados, 0 fallidos**.
- `node scripts/build.mjs`: aprobado; sintaxis, imports, recursos HTML, manifest MV3, permisos e iconos.
- Pruebas de background con API simulada: protección con un clic, snapshot sin valores sensibles, detalles sin value, bloqueo de activación sin preview, confirmación con token, recuperación de alarma y desactivación.
- Pruebas de limpieza simulada: preservación de protegidas, política releída durante ejecución, selección inesperada bloqueada, fallos de remove, inventario incompleto, whitelist corrupta y límite de historial.
- Pruebas de dominio/CHIPS/identidad/URL/tamaño/dry run y borrado de múltiples coincidencias.

La primera ejecución detectó un fallo con topLevelSite opaco. Se corrigió exigiendo URL HTTP/HTTPS válida y conservando particiones ambiguas. Después se repitió la suite completa con éxito.

## Comprobación interactiva pendiente

No se ha instalado la extensión ni modificado cookies en perfiles reales de Chrome o Edge desde esta sesión. Las pruebas simuladas no reemplazan esa aceptación. Realizar lo siguiente en un **perfil de prueba**, en cada navegador:

1. Cargar carpeta CookieKeep; comprobar ausencia de errores de manifest/worker.
2. Visitar google.com y comprobar dominio, cantidad y badge.
3. Proteger con un clic; verificar que aparece en dashboard/whitelist.
4. Visitar varios sitios sin protección.
5. Generar dry run; comprobar eliminables, conservadas y dominios.
6. Confirmar Limpiar ahora; comprobar desaparición de no protegidas y conservación de las aplicables a Google.
7. Activar frecuencia tras preview, reiniciar navegador y comprobar whitelist, intervalo y próxima alarma.
8. Confirmar búsqueda, orden, filtros y detalles sin valores.
9. Verificar que borrar un dominio con cookies compartidas no elimina cookies protegidas.
10. En un entorno controlado con CHIPS, crear mismas cookies en particiones distintas y comprobar inventario, identidad y protección del topLevelSite.
11. Comprobar que chrome://, edge:// y páginas de extensión tienen badge vacío.

No marcar los 16 criterios de aceptación como verificados en navegadores reales hasta completar este ensayo.

## Canonical workspace and dashboard update (1.1.1)

- Copied all 35 original files to the canonical workspace; every SHA-256 hash matched before edits. The origin was read only and remains intact.
- Baseline: 59 tests passed, zero failed; build passed. Manifest and package both reported 1.1.1.
- Updated suite: 60 tests passed, zero failed. Pagination coverage includes 50/100/200/All, page boundaries, search/sort resets, empty results and shrinking inventory.
- Build passed and generated releases/CookieKeep-1.1.1-Chromium.zip with manifest at the archive root, runtime source and icons only.
- Corrected dashboard section and activation-modal spacing. Real Chrome/Edge visual acceptance remains pending.
- README rewritten in English. Ignore rules exclude dependency folders, environment files, private-key formats and editor files; the release ZIP remains tracked.
- Reviewed all project files and credential/personal-data search matches: synthetic cookie values and visits in tests, API field names and runtime preview tokens. No real cookies, browsing-history dumps, private keys, credentials or personal datasets found in project files.

## Additional acceptance criteria (CookieKeep 1.1.1)

- All 69 tests passed, zero failed. Pagination integration covers inventories of 0, 12, 50, 51, 107, 205 and 1,072 rows at 50/100/200/All, bidirectional navigation, boundaries, search and protected/unprotected filters. Global count/size/A-Z/local-visit sorting is verified before slicing, including visits combined with search.
- Existing property tests, protection changes during cleanup and a simulated three-day alarm confirm current protection is consulted. A site protected after scheduling, and cookies created afterward, are retained. Preview results are recalculated; no frozen deletion list is stored.
- Headless Edge with a temporary profile and synthetic chrome APIs: dashboard metrics-to-automatic and automatic-to-sites gaps both measured exactly 24 px; modal link-to-actions measured 24 px; modal has two body elements (aggregate summary and separate-view link). No page errors.
- Popup measured 360 px wide, 20 px bottom gap, 20 px lateral padding and zero min-height. Empty notice is hidden; no main/wrapper imposes additional height. Popup and modal screenshots inspected.
- Icons visually inspected at 16/32/128 px; unchanged transparent cookie artwork. PNG tests cover 16/32/48/128 transparency and absence of a green background. Badge text is still set separately via chrome.action.setBadgeText.
- Source privacy audit confirms no network/analytics code. Whitelist and cleanup aggregates are local; browsing history ranking is read on demand and cached only in memory. Test cookie values/history are synthetic fixtures, never real profile data.
- Distribution renamed to releases/CookieKeep-v1.1.1-chromium.zip, with version read from manifest. Build now verifies its complete entry list, root manifest version and SHA-256 hashes against runtime files.
- No LICENSE file is currently present. No license selected.
- Normal Git SSH remote lookup failed with Host key verification failed. No host-key check was bypassed, no private key accessed directly and no push attempted. Remote history could not be inspected. gh is not installed, so GitHub metadata was not changed.

## Popup version indicator

- All 70 tests passed, zero failed. The popup integration test uses runtime versions 9.8.7 and 2.3.4.5, verifying dynamic display and preserving snapshot and dashboard actions.
- Build passed; regenerated versioned Chromium ZIP with 21 verified runtime files and manifest at root.
- Compared the current popup against the preceding commit in headless Edge with synthetic browser APIs. Body, header, brand, right-hand label, status, hostname, stats, controls and card bounds are identical. Version is 11 px muted text aligned below the brand within existing header spacing; no page errors.

## CookieKeep 1.1.2 — security and performance patch

- H1 and H2 fixed first; 94 tests passed before optimization. Final suite: 112 passed, zero failed.
- Real unpacked extension in a new temporary Edge profile passed independent-domain collisions, manual A+B consent boundary, parent Domain collateral, newly created same-name paths, CHIPS protection/removal and native manifest/CSP loading.
- Additional real browser run seeded 1,000 synthetic cookies, closed the initiating page during deletion, recovered running progress in a new popup and cancelled with a partial summary. No real profile used.
- Concurrency bounded to 8; protection and batch writes share the queue. Unit coverage includes queued protection, API errors, cancellation, 0/1/100/1,200 candidates, monotonic progress and 200 ms throttling without real waits.
- Synthetic 1,000-cookie benchmark, 1 ms requested latency: sequential-global 108044.68 ms; bounded-targeted 11714.51 ms. Global getAll calls 4002 -> 2; returned rows 1001000 -> 3000; storage reads 1002 -> 127; writes 1 -> 1. This is mock throughput, not real-profile performance.
- history moved to optional_permissions; decline/retry/revocation tests passed. CSP hardened with default/style/image/base/form/frame restrictions and accurate documentation of its scope.
- Version from manifest/package is 1.1.2. Source and new Chromium ZIP are versioned; the published 1.1.1 ZIP and external audit remain unchanged.
- BROWSER_VALIDATION.md lists remaining interactive Chrome/Edge acceptance: native optional-permission prompts, detailed SameSite/iframe CHIPS/stores, alarms and forced worker termination. Interrupted-job recovery is covered by unit tests, not claimed as a real forced-termination test.
- SECURITY_REVIEW_1.1.2.md records selector sources, identity limitations, measurements and queue semantics. No cookie values in tokens, local/session aggregates, logs or UI.

## CookieKeep 1.1.3

- 121 tests passed, zero failed; includes six states, open-page completion, terminal reload, duplicate-cleanup prevention and timer/listener disposal.
- Build passed: 36 validated files, 23 runtime ZIP entries, root manifest version 1.1.3 and matching source hashes.
- Real Edge extension smoke passed using a disposable profile and synthetic cookies. Completion hides progress in both open pages with zero layout height; reload remains hidden. Cancellation still reports a partial result.
- Archive: releases/CookieKeep-v1.1.3-chromium.zip, 33168 bytes.
- SHA-256: D6B58FD978576C907EF74DB36E8C7D73D095ADAF64A60C3C32CEB6865006A1E6

## Site cookie inspector — unreleased source changes

- 138 tests passed, zero failed. Added compact-list, single-cookie metadata, no-value rendering, confirmation, exact identity/store/CHIPS deletion, missing targets, protected targets, ambiguous collateral and API-error regressions.
- Full build passed: 39 files validated and 24 runtime archive entries matched sources.
- Disposable-profile real Edge smoke passed, including selected metadata, individual deletion and protected action disabled, plus existing cleanup/progress security checks.
- The published 1.1.3 ZIP was restored after build validation; its original SHA-256 remains D6B58FD978576C907EF74DB36E8C7D73D095ADAF64A60C3C32CEB6865006A1E6. No new version, commit or release was requested for this task.

## CookieKeep 1.1.4 — versioned delivery

- Manifest/package updated from 1.1.3 to 1.1.4; popup version remains dynamic.
- 138 tests passed, zero failed; full build passed (39 validated files, 24 matching runtime archive entries, root manifest version 1.1.4).
- Archive: releases/CookieKeep-v1.1.4-chromium.zip, 35021 bytes.
- SHA-256: D712EF3444F48E920577BBB6250F18F489317AD002170304B4C68982F459E923
- Reviewed tracked/untracked delivery files and secret patterns; no sensitive material found. Previous published ZIPs retained unchanged.

## CookieKeep 1.1.5 — final delivery

- Completed site-cookie inspector/dashboard changes retained from 1.1.4; manifest/package/current README distribution references updated to 1.1.5.
- Full suite: 138 total, 138 passed, zero failed.
- Full build passed: 39 files validated; 24 runtime archive entries matched source bytes; manifest.json at root, version 1.1.5.
- Archive: releases/CookieKeep-v1.1.5-chromium.zip, 35021 bytes.
- SHA-256: 9CEEC6E71C309A9430EBC6D0F3A4601A79CAA594DDE5D399D60CE4AD9B8B116C
- No GitHub Release requested for this delivery. Prior versioned archives and commit history preserved.

## CookieKeep 1.1.5 — visible last-window cleanup completion

- Shared cleanupSchedule persisted with disabled/interval/lastWindowClosed modes; legacy interval state migrated. Popup and dashboard expose all five modes and share closing-mode text with no next-run date.
- windows.onRemoved detects the final normal window; auxiliary/extension-popup closure, remaining normal windows, duplicate removal and active jobs are excluded. Session contains normal IDs only for worker reactivation, no URLs.
- 146 tests total, 146 passed, zero failed. Tests cover both UI handlers/persistence/shared changes, migration, closing events, whitelist, history, worker restart and active-job exclusion.
- Disposable-profile real Edge smoke passed: visible closing-mode selectors, persistent shared state and bidirectional popup/dashboard synchronization, plus previous cleanup/security/UI regressions.
- Build passed: 43 validated files and 26 matching runtime ZIP entries; root manifest remains 1.1.5.
- Regenerated releases/CookieKeep-v1.1.5-chromium.zip: 37164 bytes.
- SHA-256: 2F08BD8A8F4B6264DA695A6684549014614C797EF17C3E6C38957594C47CC6B2
- Browser process exit may interrupt worker cleanup; no runtime.onSuspend mechanism or guarantee after process exit.

## CookieKeep 1.1.5 — automatic settings token-dependency fix

- Settings no longer read/validate/consume manual previews; popup and dashboard save schedules directly without token or immediate deletion. Manual confirmed cleanup still enforces preview validity, expiry, scope and authorized identities.
- 149 tests total, 149 passed, zero failed; includes all mode transitions, fresh automatic inventory/protection, no immediate cleanup, no manual-token consumption and flow-specific errors.
- Real disposable-profile Edge UI smoke passed without preview confirmation for settings, including bidirectional synchronization.
- Build passed: 43 validated files, 26 matching runtime ZIP entries; manifest remains 1.1.5 at root.
- Regenerated archive: releases/CookieKeep-v1.1.5-chromium.zip, 36872 bytes.
- SHA-256: 4E5B2A2CB090D43D8E9E11AD1FA37CB52085BD2B85574381E73150B80A51C0CD
