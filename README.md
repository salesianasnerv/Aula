# Distribución del aula

Web para que cada profesor/a monte el plano de su aula, siente al alumnado y lo imprima en una hoja con el formato del colegio. Inspirada en [AulaMap](https://aulamap.github.io), pero escrita desde cero con la estética de las webs «Por etapas» del portal (Horarios, Bachillerato): logo centrado, franja verde, cartel «Utilidades | Por etapas» y cajas de acceso (Profesorado, Tutores, Administración).

- **Alumnado ya cargado:** ESO y Bachillerato salen de *Control de baños* (mismo proyecto de Supabase; si cambian las listas allí, cambian aquí). Primaria, que no está en Control de baños, va en tablas propias (`aul_clases`, `aul_alumnos`).
- **Distribuciones:** cada persona tiene las suyas por clase (varias propuestas por clase). Se guardan solas. Se pueden **duplicar** y **compartir con el claustro** (el resto las ve e imprime, y puede hacerse una copia, pero no cambiar la tuya).
- **Alumnado:** arrastrar a una mesa (o tocar el nombre y después la mesa), intercambiar, sentar por lista o al azar, **fijar** a alguien en su sitio, parejas que **no deben sentarse juntas**, quitar a quien no está en el grupo y **añadir alumnado de otra clase** (desdobles, optativas).
- **Aula:** medidas reales, plantillas (filas, parejas, grupos de 4 y 6, en U, examen), bloque de mesas, mobiliario, girar, alinear, repartir, deshacer. Vista desde el fondo o desde la mesa del docente.
- **Imprimir:** una sola hoja A4 (horizontal o vertical) con logo, título, curso, clase, tutor/a, profesor/a, fecha, franja de colores corporativos, pie del colegio y, si se quiere, la lista de quien no tiene sitio y observaciones. Ctrl+P también saca la hoja corporativa.

- **App instalable:** botón «Instalar como app» en la franja verde (`manifest.json` y `sw.js`; si cambias la lista de archivos de `sw.js`, sube su `VERSION`).

## Probarla sin conexión (modo prueba)

Abre la web con `?demo` al final (`https://aula-nervion.vercel.app/?demo`): alumnado ficticio y todo se guarda solo en ese navegador.

## Puesta en marcha (una vez)

1. **Tabla de distribuciones:** en Supabase (proyecto «Acceso Microsoft 365», el de Control de baños) → *SQL Editor*, pega y ejecuta `supabase/planos.sql`. Solo crea las tablas `aul_planos`, `aul_clases` y `aul_alumnos`; no toca nada de Control de baños. Mientras no se haga, la web avisa y guarda en el navegador.
   Después ejecuta `primaria-datos.sql` (alumnado de Primaria), que está FUERA de esta carpeta, en «Disposición del aula/Privado (no subir)», porque tiene nombres reales. Para un curso nuevo, se vuelve a generar desde los PDF de Séneca.
2. **GitHub:** sube el contenido de esta carpeta a un repositorio nuevo (por ejemplo `distribucion-aula`).
3. **Vercel:** *Add New → Project*, importa el repositorio y pulsa *Deploy* (no hay que compilar nada).
4. **Acceso con Microsoft 365:** en Supabase → *Authentication → URL Configuration → Redirect URLs*, añade la dirección de Vercel (`https://aula-nervion.vercel.app/**`). Sin esto, al entrar vuelve a la web de Control de baños.
5. **Portal:** añade la tarjeta en `utilidades.js` del portal de claustro-utilidades.

## Privacidad

En el repositorio y en Vercel no hay ningún nombre del alumnado: se leen de Supabase solo tras entrar con una cuenta @salesianas.org. `data/` (listas para pruebas locales) está excluida en `.gitignore`.
