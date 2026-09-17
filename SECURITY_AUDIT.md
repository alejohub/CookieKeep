# Auditoría de seguridad de CookieKeep 1.1.1

Fecha: 18 de septiembre de 2026.
Código revisado: commit `1b3424fef3a7bd66dba08e0241461adc7db0b21e`, árbol de trabajo inicialmente limpio.

## Conclusión

No se identificaron vulnerabilidades críticas o altas ni mecanismos de exfiltración en el código inspeccionado. Sí se reprodujeron dos problemas de severidad media relacionados con la efectividad de la limpieza y el alcance de la confirmación manual. Hay además una oportunidad de reducir permisos y reforzar la CSP. Esta conclusión no equivale a certificar la extensión: no se instaló ni se probó contra un perfil real de Chrome.

## Alcance y comprobaciones

- Revisión de todos los módulos JavaScript de ejecución, HTML, CSS, manifiesto, scripts de construcción y empaquetado, pruebas y documentación.
- `node --test`: 70 pruebas aprobadas, 0 fallidas.
- Dos reproducciones adicionales ejecutadas en Node con cookies sintéticas y API de Chrome simulada. No se leyeron ni modificaron cookies del navegador.
- ZIP `releases/CookieKeep-v1.1.1-chromium.zip`: exactamente 21 archivos de ejecución; lista y SHA-256 de cada archivo coinciden con las fuentes locales. No se reconstruyó ni modificó el ZIP.
- No hay dependencias de terceros declaradas en package.json, ni importaciones de paquetes externos en los módulos de ejecución.
- No se modificó el código de la extensión para esta auditoría.

## H1 — Media: cookies de dominios ajenos pueden evadir la limpieza por colisión de nombre

Ubicación: `src/lib/policy.js:8` y `src/lib/cookies.js:10-12`.

La política conserva cualquier cookie que comparta nombre, almacén y partición con una cookie protegida. No comprueba si los dominios y rutas pueden quedar afectados por la misma operación de borrado. Por ello una cookie de tracker.test llamada sid se conserva cuando existe otra sid de protected.test en la lista de protección, incluso con dominios completamente independientes.

Precondiciones: debe existir una cookie protegida del mismo nombre, almacén y partición. El sitio interesado en conservar su identificador controla el nombre de su propia cookie y puede elegir un nombre habitual; no necesita acceso a la extensión ni leer la cookie protegida. La evasión no está garantizada sin esa coincidencia. No permite robar valores de otros sitios.

Reproducción ejecutada:

1. Crear dos cookies sintéticas hostOnly, no particionadas, con path / y storeId 0: protected.test/sid y tracker.test/sid.
2. Ejecutar planCleanup con whitelist [protected.test].
3. Resultado: cero cookies eliminables.
4. Comprobar inRemovalScope de la cookie protegida respecto al borrado de tracker.test: false.

Impacto: un identificador de seguimiento puede sobrevivir a las limpiezas manuales y automáticas. La interfaz tampoco explica individualmente esta excepción: sus indicadores de protección usan isProtected, mientras el plan aplica además la colisión global.

El README documenta esta conservación como decisión defensiva y una prueba existente la exige. El hallazgo evalúa la consecuencia de privacidad de esa decisión; no es una regresión desconocida ni un fallo de aislamiento de Chrome.

Recomendación: conservar la defensa frente a borrados ambiguos, pero limitarla a cookies protegidas cuyo dominio, ruta, esquema, almacén y partición realmente puedan ser afectados por la operación. Mantener la revalidación antes de borrar y validar la selección real de Chrome. Añadir pruebas para dominios independientes y para cookies compartidas entre dominio padre e hijos.

## H2 — Media: la confirmación manual permite ampliar el conjunto de cookies borradas

Ubicación: `src/background/worker.js:60-70`, `src/lib/cleanup.js:6-7` y `src/lib/ui.js:19-21`.

El token de vista previa guarda únicamente host y fecha. Al confirmar, cleanup calcula los candidatos desde un inventario nuevo, sin limitarse al conjunto presentado al usuario. Dentro de los diez minutos de validez pueden aparecer cookies de nuevos dominios o cambiar la lista de protección.

Reproducción ejecutada contra el listener real del worker, con API simulada:

1. Solicitar una vista previa global cuando solo existe before.test/old: indica una cookie eliminable.
2. Añadir after.test/new al inventario simulado.
3. Enviar clean con el token anterior.
4. Resultado: deleted = 2; también se elimina after.test, que no figuraba en la confirmación.

Impacto: pérdida de cookies o cierre de sesiones fuera del conjunto mostrado. Requiere que el usuario confirme una limpieza; una web no puede enviar por sí sola el mensaje autorizado. Se clasifica como problema de integridad y consentimiento de la operación, no como borrado remoto sin interacción.

Recomendación: para la limpieza manual, asociar al token las identidades previsualizadas y limitar el borrado a su intersección con los candidatos que sigan siendo seguros. Si se desea ampliar el conjunto, presentar una nueva confirmación. La limpieza automática debe seguir usando datos actuales, pues esa es la autorización recurrente documentada. Si se desea vincular también el contenido de cada cookie a la confirmación, una identidad sin valor no basta para detectar una sustitución de sesión.

## H3 — Baja: permiso permanente de historial para una función opcional

Ubicación: `manifest.json:7` y `src/options/options.js:6,25-31`.

history se concede desde la instalación, aunque solo se consulta cuando el usuario selecciona Más visitados. El código revisado no transmite ni persiste las URLs; se trata de reducir privilegios, no de una filtración observada.

Recomendación: declarar history como optional_permissions y pedirlo al activar esa ordenación. Mantener el panel y la limpieza utilizables si se rechaza o revoca. Chrome recomienda permisos opcionales cuando la funcionalidad lo permite: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions

El acceso HTTP/HTTPS general y cookies es coherente con una limpieza global. Restringir los hosts exige cambiar también el alcance prometido al usuario; no se considera por sí solo una vulnerabilidad.

## Refuerzo adicional — CSP y precisión de la documentación

Ubicación: `manifest.json:13` y `README.md:68`.

script-src self y object-src none son buenos controles. connect-src none bloquea las conexiones cubiertas por esa directiva, pero no constituye una prohibición universal de salida: faltan restricciones explícitas para imágenes, marcos, formularios y otros tipos de carga. Actualmente no se identificaron cargas externas ni una vía de inyección que aproveche esto, por lo que no se presenta como una exfiltración reproducida.

Considerar default-src self, base-uri none, form-action none y frame-src none, manteniendo únicamente las excepciones necesarias tras comprobar la interfaz. Matizar la afirmación de que la CSP bloquea toda conexión externa. Referencia: https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy

## Controles positivos observados

- Mensajes privilegiados restringidos por ID y URL de la extensión; las pruebas rechazan remitentes de páginas web.
- Sin content scripts, externally_connectable, web_accessible_resources, ejecución remota ni eval en el código revisado.
- Construcción de la interfaz mediante textContent; nombres y metadatos de cookies no se interpretan como HTML.
- Se elimina value de los detalles enviados a la interfaz; el historial de limpiezas guarda agregados.
- Lista de protección validada, escrituras serializadas y limpieza automática desactivada por defecto.
- Revalidación de protección y selección antes de borrar; conservación de rutas o particiones ambiguas.

## Límites y validación pendiente

Las pruebas usan APIs simuladas y no demuestran el comportamiento real de selección y borrado de Chrome. La API selecciona cookies por URL, nombre, almacén y partición; la selección y las carreras con cambios externos requieren comprobación en navegador: https://developer.chrome.com/docs/extensions/reference/api/cookies

Antes de considerar completada la validación de producto, ejecutar pruebas en un perfil desechable con cookies hostOnly/Domain de igual nombre y distintas rutas, CHIPS, ventanas de incógnito si se habilitan, suspensión del worker, permisos de sitios restringidos y creación de cookies durante una limpieza. El README ya reconoce límites de concurrencia y ausencia de aceptación real en navegador. No se afirma haber reproducido el borrado de cookies protegidas ni una escalada de privilegios.

Prioridad recomendada: acotar las colisiones de H1, vincular la confirmación manual de H2 a su conjunto de candidatos y después aplicar la reducción de permisos y el refuerzo CSP.
