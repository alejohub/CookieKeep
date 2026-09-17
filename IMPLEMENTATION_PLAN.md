# CookieKeep — plan de implementación

1. APIs oficiales revisadas el 17/09/2026: cookies, alarms, storage, action y tabs.
2. Extensión MV3 sin dependencias ni compilación; módulos ES y UI local en español.
3. Separar normalización, política de protección, identidad/tamaño de cookies, almacenamiento, compatibilidad, limpieza y UI.
4. Protección de hostname exacto: conservar cookies host-only exactas y cookies Domain aplicables por límites de etiquetas. Conservar también particiones asociadas a un hostname protegido; sin PSL improvisada.
5. Riesgos: remove identifica por URL/nombre, no por dominio/path explícitos. Verificar selección con get y omitir grupos ambiguos que contengan cookies protegidas. Releer política dentro de una cola común con las modificaciones de whitelist. Errores de storage o inventario abortan; nunca sustituir una whitelist corrupta por una vacía.
6. Consultar todos los stores con partitionKey vacío; sin fallback destructivo si falla. Conservar particiones opacas o incompletas.
7. Preview obligatorio y confirmación para limpieza manual; alarms recuperadas al arrancar el worker. Historial agregado limitado a 30.
8. Pruebas Node de política y limpieza con API simulada, validación del paquete y entrega ZIP. Documentar la comprobación manual pendiente en navegadores reales.
