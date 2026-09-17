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
