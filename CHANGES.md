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
