# Distribución del aula

Web para que cada profesor/a monte el plano de su aula, siente al alumnado y lo imprima en una hoja con el formato del colegio. Inspirada en [AulaMap](https://aulamap.github.io), pero escrita desde cero con la estética de las webs «Por etapas» del portal (Horarios, Bachillerato): logo centrado, franja verde, cartel «Utilidades | Por etapas» y cajas de acceso (Profesorado, Tutores, Administración).

- **Alumnado ya cargado:** todas las etapas (Primaria, ESO y Bachillerato) salen de la base de datos común del colegio (Supabase «Acceso Microsoft 365»: grupos y matrículas). Si allí cambia una lista o un tutor/a, aquí se ve al momento. La web aún lee `aul_clases`/`aul_alumnos` si existen, sin repetir grupos.
- **Distribuciones:** cada persona tiene las suyas por clase (varias propuestas por clase). Se guardan solas. Se pueden **duplicar** y **compartir con el claustro** (el resto las ve e imprime, y puede hacerse una copia, pero no cambiar la tuya).
- **Alumnado:** arrastrar a una mesa (o tocar el nombre y después la mesa), intercambiar, sentar por lista o al azar, **fijar** a alguien en su sitio, parejas que **no deben sentarse juntas**, quitar a quien no está en el grupo y **añadir alumnado de otra clase** (desdobles, optativas).
- **Aula:** medidas reales, plantillas (filas, parejas, grupos de 4 y 6, en U, examen), bloque de mesas, mobiliario, girar, alinear, repartir, deshacer. Vista desde el fondo o desde la mesa del docente.
- **Imprimir:** una sola hoja A4 (horizontal o vertical) con logo, título, curso, clase, tutor/a, profesor/a, fecha, franja de colores corporativos, pie del colegio y, si se quiere, la lista de quien no tiene sitio y observaciones. Ctrl+P también saca la hoja corporativa.

- **App instalable:** botón «Instalar como app» en la franja verde (`manifest.json` y `sw.js`; si cambias la lista de archivos de `sw.js`, sube su `VERSION`).

- **En Teams:** la app de Teams abre la web con `?teams=1` y `teams.js` entra sola con la cuenta de Teams (hace falta la línea `api://aula-nervion.vercel.app/…` en Entra ID, ver «0 - Apps de Teams/README.md»). En el navegador no cambia nada.

## Probarla sin conexión (modo prueba)

Abre la web con `?demo` al final (`https://aula-nervion.vercel.app/?demo`): alumnado ficticio y todo se guarda solo en ese navegador.

## Puesta en marcha (una vez)

1. **Tabla de distribuciones:** en Supabase (proyecto común «Acceso Microsoft 365») → *SQL Editor*, pega y ejecuta `supabase/planos.sql`. Solo crea la tabla `aul_planos` (y las antiguas `aul_clases`/`aul_alumnos` si no existen); no toca las listas comunes. Mientras no se haga, la web avisa y guarda en el navegador.
   El alumnado de cada curso nuevo (todas las etapas) se carga en la base de datos común, no en esta web.
   Después ejecuta `supabase/tutoria.sql`: añade el correo del tutor/a a cada grupo y hace que el profesorado vea automáticamente las distribuciones de la tutoría. Al final lista los grupos sin correo para completarlos a mano.
2. **GitHub:** sube el contenido de esta carpeta a un repositorio nuevo (por ejemplo `distribucion-aula`).
3. **Vercel:** *Add New → Project*, importa el repositorio y pulsa *Deploy* (no hay que compilar nada).
4. **Acceso con Microsoft 365:** en Supabase → *Authentication → URL Configuration → Redirect URLs*, añade la dirección de Vercel (`https://aula-nervion.vercel.app/**`). Sin esto, al entrar vuelve a otra web del colegio.
5. **Portal:** añade la tarjeta en `utilidades.js` del portal de claustro-utilidades.

## Privacidad

En el repositorio y en Vercel no hay ningún nombre del alumnado: se leen de Supabase solo tras entrar con una cuenta @salesianas.org.
Cada profesor/a ve solo los grupos de su etapa, según los grupos de Microsoft 365 (Infantil, Primaria, ESO, Bachillerato, CCFF) que la sincronización nocturna apunta en `personal`. Quien tiene el permiso `banos` (gestiona las listas) o `todas` ve todo el colegio. Las distribuciones compartidas y la medida de Orientación «Ubicación cercana al profesor/a» siguen la misma regla. Ver `supabase/solo-profesorado-de-cada-etapa.sql` (25-10-2026). `data/` (listas para pruebas locales) está excluida en `.gitignore`.
