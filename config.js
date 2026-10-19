// ─── Configuración de Distribución del aula ───────────────────────────────────
// Usa la base de datos común del colegio en Supabase (alumnado de todas las etapas y acceso con Microsoft 365).
// Si supabaseUrl está vacío, o se abre la web con ?demo al final de la dirección, funciona en
// MODO PRUEBA: alumnado ficticio y distribuciones guardadas solo en este navegador.
window.APP_CONFIG = {
  supabaseUrl: "https://hblayjaknhfxieqbzrlq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibGF5amFrbmhmeGllcWJ6cmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjg0ODEsImV4cCI6MjEwNjgwNDQ4MX0.K2iWyQAt9upNBXUhdZuV-Nle9fkCMYgQ6jTBBO0MluE",

  dominio: "salesianas.org",   // solo pueden entrar cuentas de este dominio

  dominiosExtra: ["salesianes.org"],  // otros dominios del mismo Microsoft 365 del colegio
  colegio: "Escuelas Salesianas María Auxiliadora · Nervión (Sevilla)",

  // Medidas del aula nueva por defecto, en centímetros (rectangular: 6 m de ancho, junto a la pizarra, y 8 m de largo)
  aula: { ancho: 600, fondo: 800 },
};
