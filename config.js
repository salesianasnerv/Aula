// ─── Configuración de Distribución del aula ───────────────────────────────────
// Usa el mismo proyecto de Supabase que Control de baños (alumnado y acceso con Microsoft 365).
// Si supabaseUrl está vacío, o se abre la web con ?demo al final de la dirección, funciona en
// MODO PRUEBA: alumnado ficticio y distribuciones guardadas solo en este navegador.
window.APP_CONFIG = {
  supabaseUrl: "https://hblayjaknhfxieqbzrlq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibGF5amFrbmhmeGllcWJ6cmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjg0ODEsImV4cCI6MjEwNjgwNDQ4MX0.K2iWyQAt9upNBXUhdZuV-Nle9fkCMYgQ6jTBBO0MluE",

  dominio: "salesianas.org",   // solo pueden entrar cuentas de este dominio
  colegio: "Escuelas Salesianas María Auxiliadora · Nervión (Sevilla)",

  // Medidas del aula nueva por defecto, en centímetros
  aula: { ancho: 800, fondo: 800 },
};
