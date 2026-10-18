(() => {
  "use strict";
  const CFG = window.APP_CONFIG;
  const DEMO = !CFG.supabaseUrl || new URLSearchParams(location.search).has("demo");

  // ─── Utilidades ────────────────────────────────────────────────────────────
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const ajusta = (v) => Math.round(v / 5) * 5;
  const r1 = (v) => Math.round(v * 10) / 10;
  const cursoTexto = () => { const d = new Date(), y = d.getFullYear() - (d.getMonth() < 8 ? 1 : 0); return `${y}-${y + 1}`; };
  const hoyTexto = () => new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };
  function barajar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(msg, tipo = "ok", ms = 3500) {
    const el = document.createElement("div");
    el.className = "toast" + (tipo === "error" ? " error" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  function fallo(e) { console.error(e); toast("Error: " + (e.message || e), "error", 7000); }

  // ─── Nombres ("Apellidos, Nombre") ─────────────────────────────────────────
  const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "san", "da", "do", "dos", "van", "von"]);
  function partes(n) {
    const i = n.indexOf(",");
    if (i < 0) { const w = n.trim().split(/\s+/); return { nom: w[0], ape: w.slice(1).join(" ") }; }
    return { nom: n.slice(i + 1).trim(), ape: n.slice(0, i).trim() };
  }
  function primerApellido(ape) {
    const out = [];
    for (const w of ape.split(/\s+/).filter(Boolean)) { out.push(w); if (!PARTICULAS.has(w.toLowerCase())) break; }
    return out.join(" ");
  }
  const inicial = (ape) => { const p = primerApellido(ape).split(" ").pop(); return p ? p[0] + "." : ""; };
  const nombreLista = (a) => { const p = partes(a.nombre); return (p.nom + " " + p.ape).trim(); };
  // Líneas que se escriben en la mesa
  function etiqueta(a, modo, repetidos) {
    const { nom, ape } = partes(a.nombre);
    if (modo === "c") return [nom, ape];
    if (modo === "ni") return [(nom + " " + inicial(ape)).trim()];
    if (modo === "n") return [repetidos.has(nom) ? (nom + " " + inicial(ape)).trim() : nom];
    return [nom, primerApellido(ape)];
  }

  // ─── Catálogo de mesas y mobiliario (medidas en cm) ────────────────────────
  // p: puestos [x, y, lado de la silla] respecto al centro de la mesa; sw: ancho de cada puesto
  const MESAS = {
    ind:    { n: "Individual",  w: 70,  h: 50,  sw: 70, p: [[0, 0, "s"]] },
    doble:  { n: "Doble",       w: 130, h: 50,  sw: 65, p: [[-32.5, 0, "s"], [32.5, 0, "s"]] },
    triple: { n: "Triple",      w: 195, h: 50,  sw: 65, p: [[-65, 0, "s"], [0, 0, "s"], [65, 0, "s"]] },
    cara:   { n: "Cara a cara", w: 70,  h: 100, sw: 70, p: [[0, -25, "n"], [0, 25, "s"]] },
    g4:     { n: "Grupo de 4",  w: 130, h: 100, sw: 65, p: [[-32.5, -25, "n"], [32.5, -25, "n"], [-32.5, 25, "s"], [32.5, 25, "s"]] },
    g6:     { n: "Grupo de 6",  w: 195, h: 100, sw: 65, p: [[-65, -25, "n"], [0, -25, "n"], [65, -25, "n"], [-65, 25, "s"], [0, 25, "s"], [65, 25, "s"]] },
  };
  // Grupos de 3, 5 y 8: dos filas enfrentadas (la de delante con los que sobran)
  const MIEMBROS = [3, 4, 5, 6, 8];
  for (const n of MIEMBROS) {
    if (MESAS["g" + n]) continue;
    const arriba = Math.ceil(n / 2), abajo = n - arriba, w = arriba * 65;
    const fila = (k, y, lado) => Array.from({ length: k }, (_, i) => [(i - (k - 1) / 2) * 65, y, lado]);
    MESAS["g" + n] = { n: `Grupo de ${n}`, w, h: 100, sw: 65, p: [...fila(arriba, -25, "n"), ...fila(abajo, 25, "s")] };
  }
  // Orden de la paleta y del selector de tipo de mesa
  const ORDEN_MESAS = ["ind", "doble", "triple", "cara", "g3", "g4", "g5", "g6", "g8"];
  for (const k of ORDEN_MESAS) { const m = MESAS[k]; delete MESAS[k]; MESAS[k] = m; }
  const MUEBLES = {
    docente:    { n: "Mesa del docente", w: 140, h: 70, et: "Docente" },
    pizarra:    { n: "Pizarra",          w: 300, h: 10, et: "Pizarra", fino: true },
    pantalla:   { n: "Pantalla",         w: 200, h: 8,  et: "Pantalla", fino: true },
    puerta:     { n: "Puerta",           w: 90,  h: 10, et: "Puerta", fino: true },
    ventana:    { n: "Ventana",          w: 150, h: 10, fino: true },
    armario:    { n: "Armario",          w: 100, h: 50, et: "Armario" },
    estanteria: { n: "Estantería",       w: 120, h: 35, et: "Estantería" },
    auxiliar:   { n: "Mesa auxiliar",    w: 120, h: 60, et: "Mesa auxiliar" },
    ordenador:  { n: "Ordenador",        w: 60,  h: 50, et: "PC" },
    columna:    { n: "Columna",          w: 40,  h: 40 },
    papelera:   { n: "Papelera",         w: 30,  h: 30 },
    texto:      { n: "Texto",            w: 120, h: 30 },
  };
  const T = { ...MESAS, ...MUEBLES };
  const tam = (it) => ({ w: it.w ?? T[it.t].w, h: it.h ?? T[it.t].h });

  // Posición en el aula de un punto de la mesa (la mesa puede estar girada)
  function aMundo(it, lx, ly) {
    const a = ((it.r || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [it.x + lx * c - ly * s, it.y + lx * s + ly * c];
  }
  function puestosDe(d) {
    const out = [];
    for (const it of d.items) {
      const t = T[it.t]; if (!t?.p) continue;
      t.p.forEach(([px, py], i) => { const [x, y] = aMundo(it, px, py); out.push({ k: it.id + ":" + i, x, y, it }); });
    }
    return out;
  }
  // De delante (pizarra) hacia atrás y de izquierda a derecha
  const ordenados = (d) => puestosDe(d).sort((a, b) => Math.round(a.y / 40) - Math.round(b.y / 40) || a.x - b.x);
  const claveDe = (d, id) => Object.keys(d.asientos).find((k) => d.asientos[k] === id) || null;

  // ─── Plantillas de aula ───────────────────────────────────────────────────
  const PLANTILLAS = [
    { id: "filas", n: "Individuales" },
    { id: "parejas", n: "Parejas" },
    { id: "u", n: "En forma de U" },
    { id: "grupos", n: "Grupos" },
    { id: "vacia", n: "Aula vacía" },
  ];
  function basicos(W, H) {
    return [
      { id: uid(), t: "pizarra", x: ajusta(W / 2), y: 9, r: 0 },
      { id: uid(), t: "docente", x: 130, y: 105, r: 0 },
      { id: uid(), t: "puerta", x: W, y: 140, r: 90 },
      { id: uid(), t: "ventana", x: 0, y: ajusta(H / 2), r: 90, w: 250 },
    ];
  }
  function bloque(tipo, filas, cols, sepX, sepY, W, y0) {
    const t = T[tipo], out = [];
    const ancho = cols * t.w + (cols - 1) * sepX, x0 = (W - ancho) / 2 + t.w / 2;
    const extra = t.p.some((p) => p[2] === "n") ? 20 : 0;
    for (let f = 0; f < filas; f++)
      for (let c = 0; c < cols; c++)
        out.push({ id: uid(), t: tipo, x: ajusta(x0 + c * (t.w + sepX)), y: ajusta(y0 + extra + t.h / 2 + f * (t.h + sepY + extra)), r: 0 });
    return out;
  }
  function cabe(tipo, sepX, sepY, W, H, y0) {
    const t = T[tipo], extra = t.p.some((p) => p[2] === "n") ? 20 : 0;
    return {
      cols: Math.max(1, Math.floor((W - 60 + sepX) / (t.w + sepX))),
      filas: Math.max(1, Math.floor((H - y0 - 45 + sepY + extra) / (t.h + sepY + extra))),
    };
  }
  // Coloca una lista de mesas en filas centradas, de delante hacia atrás. Devuelve las mesas y dónde acaba la última fila.
  function colocar(tipos, sx, sy, W, y0) {
    if (!tipos.length) return { items: [], fin: y0 };
    const paso = Math.max(...tipos.map((k) => T[k].w));
    const maxCols = Math.max(1, Math.floor((W - 60 + sx) / (paso + sx)));
    const filas = Math.ceil(tipos.length / maxCols), cols = Math.ceil(tipos.length / filas);
    const items = []; let y = y0;
    for (let f = 0; f < filas; f++) {
      const fila = tipos.slice(f * cols, (f + 1) * cols);
      const extra = fila.some((k) => T[k].p.some((q) => q[2] === "n")) ? 20 : 0, alto = Math.max(...fila.map((k) => T[k].h));
      const x0 = (W - (fila.length * paso + (fila.length - 1) * sx)) / 2 + paso / 2;
      fila.forEach((k, i) => items.push({ id: uid(), t: k, x: ajusta(x0 + i * (paso + sx)), y: ajusta(y + extra + alto / 2), r: 0 }));
      y += extra + alto + sy;
    }
    return { items, fin: y - sy };
  }
  // Reparte n alumnos en grupos lo más iguales posible (22 de 5 en 5 → 5, 5, 4, 4, 4)
  function tiposGrupos(n, m) {
    const g = Math.ceil(n / m), base = Math.floor(n / g), mas = n % g;
    const mesa = (k) => (k >= 3 ? "g" + k : k === 2 ? "cara" : "ind");
    return Array.from({ length: g }, (_, i) => mesa(i < mas ? base + 1 : base));
  }
  // Mesas de cada plantilla. Con n (alumnado de la clase) se crean justo los puestos necesarios;
  // sin n, las que quepan en el aula. Si no caben, «fondo» indica cuánto hay que alargar el aula.
  function mesasPlantilla(id, W, H, miembros = 4, n = 0) {
    const y0 = 215;
    const lista = (tipo, sx, sy, cuantos) => {
      if (!cuantos) { const { cols, filas } = cabe(tipo, sx, sy, W, H, y0); cuantos = cols * filas; }
      return Array(cuantos).fill(tipo);
    };
    const enFilas = (tipos, sx, sy) => { const r = colocar(tipos, sx, sy, W, y0); return { items: r.items, fondo: r.fin + 45 }; };
    const m = MESAS["g" + miembros] ? miembros : 4;
    switch (id) {
      case "filas": return enFilas(lista("ind", 45, 60, n), 45, 60);
      case "parejas": {
        const t = n ? [...Array(Math.floor(n / 2)).fill("doble"), ...(n % 2 ? ["ind"] : [])] : lista("doble", 60, 60);
        return enFilas(t, 60, 60);
      }
      case "grupos": return enFilas(n ? tiposGrupos(n, m) : lista("g" + m, 80, 70), 80, 70);
      case "u": return mesasU(W, H, n);
      default: return { items: [], fondo: H };
    }
  }
  // En U: mesas dobles en los dos laterales y al fondo, mirando al centro
  function mesasU(W, H, n) {
    const capFondo = Math.max(1, Math.floor((W - 330) / 135));
    let lados, fondo, suelta = false;
    if (n) {
      const mesas = Math.ceil(n / 2); suelta = n % 2 === 1;
      fondo = Math.min(capFondo, Math.max(1, Math.round(mesas / 3)));
      if (mesas === 1) fondo = 1;
      lados = mesas - fondo;
    } else {
      const porLado = Math.max(1, Math.floor((H - 175 - 265 + 70) / 135));
      lados = porLado * 2; fondo = capFondo;
    }
    const izq = Math.ceil(lados / 2), der = lados - izq, out = [];
    for (let i = 0; i < izq; i++) out.push({ id: uid(), t: "doble", x: 75, y: 265 + i * 135, r: 90 });
    for (let i = 0; i < der; i++) out.push({ id: uid(), t: "doble", x: W - 75, y: 265 + i * 135, r: -90 });
    const yF = Math.max(n ? 0 : H - 95, izq ? 265 + (izq - 1) * 135 + 65 + 85 : 265);
    const x0 = (W - (fondo * 130 + (fondo - 1) * 5)) / 2 + 65;
    for (let i = 0; i < fondo; i++) out.push({ id: uid(), t: "doble", x: ajusta(x0 + i * 135), y: ajusta(yF), r: 0 });
    // Con un número impar, la última mesa (la de más atrás) es individual
    if (suelta) { const ult = out[out.length - 1]; ult.t = "ind"; ult.x = ajusta(ult.x - 32.5); }
    return { items: out, fondo: yF + 95 };
  }
  function datosNuevos(plantilla, W = CFG.aula?.ancho || 800, H = CFG.aula?.fondo || 700, miembros, n) {
    const { items, fondo } = mesasPlantilla(plantilla, W, H, miembros, n);
    H = Math.max(H, ajusta(fondo));
    return { ancho: W, fondo: H, plantilla, miembros: miembros || 4, items: [...basicos(W, H), ...items], asientos: {}, fijos: [], noJuntos: [], extra: [], excluidos: [], niveles: {}, diversidad: {}, filasDelante: 2 };
  }

  // ─── Estado ──────────────────────────────────────────────────────────────
  const S = {
    user: null, cursoId: null, cursoNombre: cursoTexto(), clases: [], alumnos: new Map(), porClase: new Map(),
    planos: [], claseId: null, plano: null, modo: "alumnado", sel: new Set(), alSel: null,
    hist: [], fut: [], zoom: 1, arrastre: null, marco: null,
    vista: LS.get("aula-vista", "alumnado"), nombre: LS.get("aula-nombre", "n1"), verNiveles: LS.get("aula-ver-niveles", false),
    orientacion: new Map(), // alumno/a (matrícula) → medida de Orientación que obliga a sentarlo delante
  };
  const D = () => S.plano?.datos;
  const esMio = (p) => p && p.propietario === S.user.email;
  // Distribuciones de la tutoría: las del tutor/a del grupo (su correo está en la lista común de grupos)
  const correoTutor = (claseId) => (claseDe(claseId)?.tutor_email || "").toLowerCase();
  const deTutoria = (p) => !!p && !!correoTutor(p.clase_id) && String(p.propietario).toLowerCase() === correoTutor(p.clase_id);
  const soyTutor = (claseId = S.claseId) => !!correoTutor(claseId) && correoTutor(claseId) === S.user.email.toLowerCase();
  const editable = () => esMio(S.plano);
  const claseDe = (id) => S.clases.find((c) => c.id == id);

  // ─── Datos: Supabase (alumnado y grupos de la base de datos común) o modo prueba ─────────
  const sb = DEMO ? null : supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const ok = (r) => { if (r.error) throw r.error; return r.data; };
  const TABLA = "aul_planos";

  const remoto = {
    async sesion() {
      let { data: { session } } = await sb.auth.getSession();
      // Abierta desde la app de Teams: entra sola con la cuenta de Teams
      if (!session && await window.TeamsSSO?.entrar(sb)) ({ data: { session } } = await sb.auth.getSession());
      if (!session) return null;
      const u = session.user, email = (u.email || "").toLowerCase();
      if (![CFG.dominio, ...(CFG.dominiosExtra || [])].some((d) => email.endsWith("@" + d))) {
        await sb.auth.signOut();
        throw new Error(`Solo se permite el acceso con cuentas @${CFG.dominio}.`);
      }
      return { email, nombre: u.user_metadata?.full_name || u.user_metadata?.name || email };
    },
    async login() {
      if (await window.TeamsSSO?.entrar(sb)) return location.reload();
      ok(await sb.auth.signInWithOAuth({ provider: "azure", options: { scopes: "email profile", redirectTo: location.origin + location.pathname } }));
    },
    async logout() { await sb.auth.signOut(); location.reload(); },
    async datos() {
      const cursos = ok(await sb.from("cursos").select("id,nombre,activo").order("nombre"));
      const curso = cursos.find((c) => c.activo) || cursos[cursos.length - 1];
      if (!curso) throw new Error("Todavía no hay ningún curso con alumnado.");
      // Todas las etapas están ya en la lista común de grupos («clases»). Se leen también las listas
      // antiguas de Primaria (aul_clases) por si aún existen; si un grupo sale en las dos, cuenta una vez.
      // Primero la lista común (todas las etapas, con el correo del tutor/a); si no existe, las listas antiguas.
      let clases, comun = true;
      try { clases = ok(await sb.from("grupos").select("*").eq("curso_id", curso.id).order("orden")); }
      catch (e) {
        comun = false;
        clases = ok(await sb.from("clases").select("*").eq("curso_id", curso.id).order("orden"));
        try { clases.push(...ok(await sb.from("aul_clases").select("*").eq("curso_id", curso.id).order("orden"))); } catch (e2) { /* ya no existe */ }
      }
      const vistos = new Set(), unicas = clases.filter((c) => !vistos.has(c.id) && vistos.add(c.id));
      const leer = async (tabla, ids, out) => {
        for (let i = 0; ids.length; i += 1000) {
          const d = ok(await sb.from(tabla).select("id,clase_id,nombre,orden").eq("activo", true).in("clase_id", ids).order("id").range(i, i + 999));
          out.push(...d); if (d.length < 1000) break;
        }
      };
      const alumnos = [], ids = unicas.map((c) => c.id);
      await leer(comun ? "matriculas" : "alumnos", ids, alumnos);
      const faltan = unicas.filter((c) => !alumnos.some((a) => a.clase_id === c.id)).map((c) => c.id);
      if (faltan.length) try { await leer("aul_alumnos", faltan, alumnos); } catch (e) { /* ya no existe */ }
      const vistosA = new Set();
      return { curso, clases: unicas, alumnos: alumnos.filter((a) => !vistosA.has(a.id) && vistosA.add(a.id)) };
    },
    // Medidas de Orientación que afectan al sitio (si la función aún no existe, no pasa nada)
    async medidas(cursoId) {
      const { data, error } = await sb.rpc("aul_medidas_orientacion", { p_curso: cursoId });
      if (error) { console.warn("Sin medidas de Orientación", error); return []; }
      return data || [];
    },
    async planos(cursoId) { return ok(await sb.from(TABLA).select("*").eq("curso_id", cursoId).order("actualizado", { ascending: false })); },
    async crear(p) { return ok(await sb.from(TABLA).insert(p).select().single()); },
    async guardar(id, c) { ok(await sb.from(TABLA).update(c).eq("id", id)); },
    async borrar(id) { ok(await sb.from(TABLA).delete().eq("id", id)); },
  };

  const CLAVE = "aula-planos-v1";
  const local = {
    todos() { return LS.get(CLAVE, []); },
    poner(v) { LS.set(CLAVE, v); },
    async planos(cursoId) { return this.todos().filter((p) => String(p.curso_id) === String(cursoId)); },
    async crear(p) { const r = { ...p, id: uid(), propietario: S.user.email, actualizado: new Date().toISOString() }; this.poner([...this.todos(), r]); return r; },
    async guardar(id, c) { this.poner(this.todos().map((p) => (p.id === id ? { ...p, ...c, actualizado: new Date().toISOString() } : p))); },
    async borrar(id) { this.poner(this.todos().filter((p) => p.id !== id)); },
  };
  let almacen = DEMO ? local : remoto;

  function datosDemo() {
    const curso = { id: "demo", nombre: cursoTexto() };
    if (Array.isArray(window.DEMO_DATA) && window.DEMO_DATA.length) {
      let id = 1; const clases = [], alumnos = [];
      window.DEMO_DATA.forEach((c, i) => {
        clases.push({ id: i + 1, nombre: c.nombre, tutor: c.tutor, orden: i });
        c.alumnos.forEach((a, j) => alumnos.push({ id: id++, clase_id: i + 1, nombre: a.nombre, orden: j }));
      });
      return { curso, clases, alumnos };
    }
    const NOM = ["Lucía", "Hugo", "Martina", "Pablo", "Sofía", "Daniel", "Julia", "Álvaro", "Paula", "Mario", "Valeria", "Manuel", "Carmen", "Javier", "Noa", "Adrián", "Alba", "David", "Claudia", "Marcos", "Irene", "Diego", "Rocío", "Jesús", "Lola", "Gonzalo", "María José", "Juan Manuel", "Elena", "Rafael"];
    const AP = ["García", "Rodríguez", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Ruiz", "Díaz", "Moreno", "Muñoz", "Romero", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Serrano", "Molina", "de la Rosa", "Castillo", "Ortega", "Delgado", "Marín", "Cano", "Prieto"];
    let s = 11; const azar = () => (s = (s * 16807) % 2147483647) / 2147483647, uno = (a) => a[Math.floor(azar() * a.length)];
    const grupos = ["1º Primaria A", "4º Primaria B", "1º ESO A", "1º ESO B", "2º ESO A", "2º ESO B", "3º ESO A", "4º ESO A", "1º Bach A", "2º Bach A"];
    const clases = [], alumnos = []; let id = 1;
    grupos.forEach((g, i) => {
      // En la prueba: 1º Primaria A tiene una tutora con su distribución; de 1º ESO A eres tú el tutor/a
      const tutor = i === 0 ? "Gómez Ruiz, Carmen" : i === 2 ? "Modo prueba" : `${uno(AP)} ${uno(AP)}, ${uno(NOM)}`;
      const tutor_email = i === 0 ? "carmen.gomez@" + CFG.dominio : i === 2 ? "prueba@" + CFG.dominio : "";
      clases.push({ id: i + 1, nombre: g, tutor, tutor_email, orden: i });
      const n = 22 + Math.floor(azar() * 8), lista = [];
      for (let j = 0; j < n; j++) lista.push(`${uno(AP)} ${uno(AP)}, ${uno(NOM)}`);
      lista.sort((a, b) => a.localeCompare(b, "es")).forEach((nombre, j) => alumnos.push({ id: id++, clase_id: i + 1, nombre, orden: j }));
    });
    return { curso, clases, alumnos };
  }

  // ─── Diálogos ────────────────────────────────────────────────────────────
  function dialogo(html, { aceptar = "Aceptar", cancelar = "Cancelar", peligro = false, alAbrir } = {}) {
    const dlg = $("#dlg"), f = $("#dlgForm");
    f.innerHTML = html + `<div class="dlg-botones">${cancelar ? `<button class="btn" value="no" formnovalidate>${cancelar}</button>` : ""}<button class="btn ${peligro ? "borrar" : "primario"}" value="si">${aceptar}</button></div>`;
    return new Promise((res) => {
      dlg.onclose = () => res(dlg.returnValue === "si" ? new FormData(f) : null);
      dlg.returnValue = "";
      dlg.showModal();
      alAbrir?.(f);
      $("input:not([type=checkbox]):not([type=radio]), select", f)?.focus();
    });
  }
  const confirmar = (titulo, texto, aceptar = "Sí", peligro = true) =>
    dialogo(`<h2>${titulo}</h2><p class="dlg-sub">${texto}</p>`, { aceptar, peligro }).then(Boolean);

  // ─── Cambios, deshacer y guardado ─────────────────────────────────────────
  function avisoLectura() { toast("Esta distribución es de otra persona: pulsa «Duplicar» para tener tu copia y cambiarla."); }
  function cambio(fn) {
    if (!editable()) { avisoLectura(); return false; }
    S.hist.push(JSON.stringify(D())); if (S.hist.length > 80) S.hist.shift();
    S.fut = [];
    fn(D()); limpiar(D()); render(); programarGuardado();
    return true;
  }
  function limpiar(d) {
    const porId = new Map(d.items.map((i) => [i.id, i]));
    const validos = new Set(alumnosPlano().map((a) => a.id));
    for (const k of Object.keys(d.asientos)) {
      const [id, i] = k.split(":"), it = porId.get(id);
      if (!it || !T[it.t].p || +i >= T[it.t].p.length || !validos.has(d.asientos[k])) delete d.asientos[k];
    }
    d.fijos = d.fijos.filter((a) => claveDe(d, a));
  }
  function deshacer() {
    if (!editable() || !S.hist.length) return;
    S.fut.push(JSON.stringify(D())); S.plano.datos = JSON.parse(S.hist.pop());
    S.sel.clear(); render(); programarGuardado();
  }
  function rehacer() {
    if (!editable() || !S.fut.length) return;
    S.hist.push(JSON.stringify(D())); S.plano.datos = JSON.parse(S.fut.pop());
    S.sel.clear(); render(); programarGuardado();
  }

  let tGuardar = null, pendiente = null;
  function estado(txt, mal = false) { const e = $("#estado"); e.textContent = txt; e.classList.toggle("mal", mal); }
  function programarGuardado() {
    pendiente = S.plano; estado("Guardando…");
    clearTimeout(tGuardar); tGuardar = setTimeout(guardarYa, 800);
  }
  async function guardarYa() {
    clearTimeout(tGuardar);
    const p = pendiente; pendiente = null;
    if (!p) return;
    try {
      await almacen.guardar(p.id, { datos: p.datos, nombre: p.nombre, compartido: p.compartido });
      p.actualizado = new Date().toISOString();
      if (p === S.plano) estado(almacen === local ? "Guardado en este navegador" : "Guardado");
    } catch (e) { pendiente = pendiente || p; estado("No se ha podido guardar", true); fallo(e); }
  }
  window.addEventListener("beforeunload", (e) => { if (pendiente) { guardarYa(); e.preventDefault(); e.returnValue = ""; } });

  // ─── Alumnado de la distribución ──────────────────────────────────────────
  function alumnosPlano(p = S.plano) {
    if (!p) return [];
    const d = p.datos, fuera = new Set(d.excluidos);
    const base = (S.porClase.get(p.clase_id) || []).filter((a) => !fuera.has(a.id));
    const ids = new Set(base.map((a) => a.id));
    const extra = d.extra.map((id) => S.alumnos.get(id)).filter((a) => a && !ids.has(a.id)).sort(porNombre);
    return [...base, ...extra];
  }
  const repetidos = (als) => { const c = new Map(); for (const a of als) { const n = partes(a.nombre).nom; c.set(n, (c.get(n) || 0) + 1); } return new Set([...c].filter(([, n]) => n > 1).map(([n]) => n)); };

  function asignar(alId, k) {
    cambio((d) => {
      const antes = claveDe(d, alId), otro = d.asientos[k];
      if (antes === k) return;
      if (antes) delete d.asientos[antes];
      d.asientos[k] = alId;
      if (otro != null && otro !== alId && antes) d.asientos[antes] = otro;
    });
  }
  function levantar(alId) { cambio((d) => { const k = claveDe(d, alId); if (k) delete d.asientos[k]; }); }

  function sentarPorLista(d, als) {
    const fijos = new Set(d.fijos), nuevos = {};
    for (const k in d.asientos) if (fijos.has(d.asientos[k])) nuevos[k] = d.asientos[k];
    const libres = ordenados(d).filter((p) => !(p.k in nuevos));
    als.filter((a) => !fijos.has(a.id)).forEach((a, i) => { if (libres[i]) nuevos[libres[i].k] = a.id; });
    d.asientos = nuevos;
    ponerDelante(d);
  }
  function sentarAzar(d, als) {
    const fijos = new Set(d.fijos), base = {};
    for (const k in d.asientos) if (fijos.has(d.asientos[k])) base[k] = d.asientos[k];
    const pos = new Map(puestosDe(d).map((p) => [p.k, p]));
    const mover = als.filter((a) => !fijos.has(a.id)).map((a) => a.id);
    const libres = ordenados(d).filter((p) => !(p.k in base)).slice(0, mover.length);
    const cerca = (k1, k2) => { const a = pos.get(k1), b = pos.get(k2); return a.it === b.it || Math.hypot(a.x - b.x, a.y - b.y) < 100; };
    let mejor = null, mejorMal = Infinity;
    for (let n = 0; n < 500 && mejorMal > 0; n++) {
      barajar(mover); const as = { ...base };
      mover.forEach((id, i) => { if (libres[i]) as[libres[i].k] = id; });
      ponerDelante(d, as);
      const donde = new Map(Object.entries(as).map(([k, v]) => [v, k]));
      let mal = 0;
      for (const [a, b] of d.noJuntos) { const ka = donde.get(a), kb = donde.get(b); if (ka && kb && cerca(ka, kb)) mal++; }
      if (mal < mejorMal) { mejor = as; mejorMal = mal; }
    }
    d.asientos = mejor || base;
    return mejorMal;
  }

  // ─── Atención a la diversidad: siempre en las primeras filas ──────────────
  const MOTIVOS = { docente: "Ubicación cercana al docente", vision: "Problemas de visión", otro: "Otra razón" };
  const motivoTexto = (m) => (m?.motivo === "orientacion" ? m.medida + " (Orientación)" : m?.motivo === "otro" ? m.otro || MOTIVOS.otro : MOTIVOS[m?.motivo] || "");
  // Lo que marca cada docente más lo que ya consta en Orientación (eso no se puede quitar desde aquí)
  function diversidadDe(d) {
    const o = {};
    for (const [id, medida] of S.orientacion) o[id] = { motivo: "orientacion", medida };
    return { ...(d.diversidad || {}), ...o };
  }
  // Puestos de las N primeras filas de mesas (mesas a menos de 60 cm de altura cuentan como la misma fila)
  function puestosDelante(d, nf = d.filasDelante || 2) {
    const ys = [...new Set(d.items.filter((i) => T[i.t].p).map((i) => i.y))].sort((a, b) => a - b), filas = [];
    for (const y of ys) { if (!filas.length || y - filas.at(-1).at(-1) > 60) filas.push([y]); else filas.at(-1).push(y); }
    const lim = filas.length ? filas[Math.min(nf, filas.length) - 1].at(-1) : -Infinity;
    return ordenados(d).filter((p) => p.it.y <= lim).map((p) => p.k);
  }
  // Mueve a las primeras filas a quien lo necesita, cambiándolo por alguien que no (si puede, del mismo nivel).
  // Devuelve cuántos no caben delante.
  function ponerDelante(d, as = d.asientos) {
    const div = new Set(Object.keys(diversidadDe(d)).map(Number)), fijos = new Set(d.fijos);
    if (!div.size) return 0;
    const delante = puestosDelante(d), enDelante = new Set(delante);
    const clave = (id) => Object.keys(as).find((k) => as[k] === id);
    let fuera = 0;
    for (const id of div) {
      const k = clave(id);
      if (!k || enDelante.has(k) || fijos.has(id)) continue;
      const libres = delante.filter((k2) => as[k2] == null || (!div.has(as[k2]) && !fijos.has(as[k2])));
      if (!libres.length) { fuera++; continue; }
      const k2 = libres.find((x) => as[x] == null) || libres.find((x) => (d.niveles[as[x]] || 0) === (d.niveles[id] || 0)) || libres[0];
      const otro = as[k2];
      as[k2] = id;
      if (otro == null) delete as[k]; else as[k] = otro;
    }
    return fuera;
  }

  // ─── Nivel competencial ──────────────────────────────────────────────────
  const NIVELES = [
    { v: 4, n: "Alto", c: "#8a9400" },
    { v: 3, n: "Medio alto", c: "#009abb" },
    { v: 2, n: "Medio bajo", c: "#ee712a" },
    { v: 1, n: "Bajo", c: "#d23c3c" },
  ];
  const nivelDe = (v) => NIVELES.find((x) => x.v === v);
  // Puestos libres agrupados por mesa, de delante hacia atrás
  function mesasLibres(d, ocupados) {
    const mesas = new Map();
    for (const p of ordenados(d)) {
      if (p.k in ocupados) continue;
      if (!mesas.has(p.it.id)) mesas.set(p.it.id, []);
      mesas.get(p.it.id).push(p.k);
    }
    return [...mesas.values()];
  }
  // «niveles»: en cada mesa, alumnado del mismo nivel (los niveles más bajos, delante, cerca del docente).
  // «equilibrado»: en cada mesa se compensan niveles (parejas: alto con medio bajo y medio alto con bajo;
  // grupos: de todos los niveles). Respeta a quien está fijado y, si se puede, «no deben sentarse juntos».
  function sentarNiveles(d, als, modo) {
    const fijos = new Set(d.fijos), base = {};
    for (const k in d.asientos) if (fijos.has(d.asientos[k])) base[k] = d.asientos[k];
    const pos = new Map(puestosDe(d).map((p) => [p.k, p]));
    const cerca = (k1, k2) => { const a = pos.get(k1), b = pos.get(k2); return a.it === b.it || Math.hypot(a.x - b.x, a.y - b.y) < 100; };
    const mover = als.filter((a) => !fijos.has(a.id)).map((a) => a.id);
    const nivel = (id) => d.niveles[id] || 2.5; // sin nivel: en medio
    const mesas = mesasLibres(d, base);
    let mejor = null, mejorMal = Infinity;
    for (let n = 0; n < 400 && mejorMal > 0; n++) {
      // Orden por nivel, al azar dentro de cada nivel
      const lista = barajar([...mover]).sort((a, b) => (modo === "niveles" ? nivel(a) - nivel(b) : nivel(b) - nivel(a)));
      const as = { ...base };
      if (modo === "niveles") {
        const libres = mesas.flat();
        lista.forEach((id, i) => { if (libres[i]) as[libres[i]] = id; });
      } else {
        // Reparto por rondas entre las mesas (en zigzag si son de 3 o más)
        const cap = mesas.map((m) => m.length), dentro = mesas.map(() => 0);
        const zig = Math.max(...cap, 0) >= 3;
        let i = 0, ronda = 0;
        while (i < lista.length && dentro.some((x, j) => x < cap[j])) {
          const orden = mesas.map((_, j) => j);
          if (zig && ronda % 2) orden.reverse();
          for (const j of orden) { if (i >= lista.length) break; if (dentro[j] < cap[j]) as[mesas[j][dentro[j]++]] = lista[i++]; }
          ronda++;
        }
      }
      ponerDelante(d, as);
      const donde = new Map(Object.entries(as).map(([k, v]) => [v, k]));
      let mal = 0;
      for (const [a, b] of d.noJuntos) { const ka = donde.get(a), kb = donde.get(b); if (ka && kb && cerca(ka, kb)) mal++; }
      if (mal < mejorMal) { mejor = as; mejorMal = mal; }
    }
    d.asientos = mejor || base;
    return mejorMal;
  }

  // ─── Dibujo del plano (SVG; se usa en pantalla y al imprimir) ─────────────
  // Nombres en los puestos: Fira Sans y el MISMO tamaño en todo el plano, el mayor con el que
  // caben todos (el nombre en negrita; el apellido, un poco más pequeño)
  const PROP2 = 0.82, TAM_MIN = 8, TAM_MAX = 17;
  const medidas = new Map();
  const medir = (() => {
    const ctx = document.createElement("canvas").getContext("2d"), cache = medidas;
    return (txt, negrita) => {
      const k = (negrita ? "b" : "r") + txt;
      if (!cache.has(k)) { ctx.font = `${negrita ? 700 : 400} 100px "Fira Sans", system-ui, sans-serif`; cache.set(k, ctx.measureText(txt).width / 100); }
      return cache.get(k);
    };
  })();
  // Hasta que carga Fira Sans se mide con otra letra: al cargar, se vuelve a medir y pintar
  document.fonts?.ready.then(() => { medidas.clear(); if (S.plano) render(); });
  // Formas de escribir una etiqueta: tal cual, o partiendo en dos una línea con espacios («Juan Manuel» → «Juan / Manuel»)
  function formas(lineas) {
    const base = lineas.map((t, i) => ({ t, b: i === 0 }));
    const out = [base];
    base.forEach((l, i) => {
      const sp = [...l.t.matchAll(/ /g)].map((m) => m.index); if (!sp.length) return;
      const k = sp.reduce((x, y) => (Math.abs(y - l.t.length / 2) < Math.abs(x - l.t.length / 2) ? y : x));
      out.push([...base.slice(0, i), { t: l.t.slice(0, k), b: l.b }, { t: l.t.slice(k + 1), b: l.b }, ...base.slice(i + 1)]);
    });
    return out;
  }
  // Tamaño máximo con el que una forma cabe en el puesto (a lo ancho y a lo alto)
  function cabeCon(f, ancho, alto) {
    let t = Math.min(TAM_MAX, alto / (1.12 * f.reduce((s, l) => s + (l.b ? 1 : PROP2), 0)));
    for (const l of f) { const w = medir(l.t, l.b) * (l.b ? 1 : PROP2); if (w > 0) t = Math.min(t, ancho / w); }
    return t;
  }
  function mejorForma(lineas, ancho, alto) {
    let mejor = null;
    for (const f of formas(lineas)) { const t = cabeCon(f, ancho, alto); if (!mejor || t > mejor.t + 0.3) mejor = { f, t }; }
    return mejor;
  }
  function textoAjustado(x, y, f, ancho, t) {
    const tams = f.map((l) => t * (l.b ? 1 : PROP2)), total = 1.12 * tams.reduce((s, v) => s + v, 0);
    let yy = y - total / 2;
    return f.map((l, i) => {
      const cy = yy + (1.12 * tams[i]) / 2; yy += 1.12 * tams[i];
      // Solo se estrecha si ni con el tamaño mínimo cabe (nombres larguísimos)
      const aj = medir(l.t, l.b) * tams[i] > ancho + 0.5 ? ` textLength="${r1(ancho)}" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text class="et${l.b ? " n1" : ""}" x="${r1(x)}" y="${r1(cy)}" font-size="${r1(tams[i])}"${aj}>${esc(l.t)}</text>`;
    }).join("");
  }
  function svgItem(it, d, o) {
    const t = T[it.t], { w, h } = tam(it);
    let s = "";
    if (t.p) {
      for (const [px, py, l] of t.p) s += `<rect class="silla" x="${px - 17}" y="${l === "s" ? py + 28 : py - 42}" width="34" height="14" rx="6"/>`;
      s += `<rect class="mesa" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3"/>`;
      t.p.forEach(([px, py], i) => {
        const k = it.id + ":" + i, al = d.asientos[k], cls = ["puesto"];
        if (al != null) cls.push("ocupado");
        if (o.interactivo && S.alSel != null) { if (al == null) cls.push("libre-dest"); else if (al === S.alSel) cls.push("elegido"); }
        s += `<rect class="${cls.join(" ")}"${o.interactivo ? ` data-seat="${k}"` : ""} x="${px - t.sw / 2 + 2}" y="${py - 23}" width="${t.sw - 4}" height="46" rx="3"/>`;
        const nv = o.interactivo && S.verNiveles && al != null && nivelDe(d.niveles?.[al]);
        if (nv) s += `<rect x="${px - t.sw / 2 + 4}" y="${py + 19}" width="${t.sw - 8}" height="3" rx="1.5" fill="${nv.c}" pointer-events="none"/>`;
      });
      const cols = t.p.filter((p) => p[1] === t.p[0][1]).length;
      for (let j = 1; j < cols; j++) { const x = -w / 2 + t.sw * j; s += `<line class="div-puesto" x1="${x}" y1="${-h / 2}" x2="${x}" y2="${h / 2}"/>`; }
      if (t.p.length > cols) s += `<line class="div-puesto" x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0"/>`;
    } else {
      const R = (cls, rx = 3) => `<rect class="${cls}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${rx}"/>`;
      switch (it.t) {
        case "docente": s += `<rect class="silla" x="-17" y="${h / 2 + 3}" width="34" height="14" rx="6"/>` + R("docente"); break;
        case "pizarra": s += R("pizarra", 2); break;
        case "pantalla": s += R("pantalla", 2); break;
        case "ventana": s += R("ventana", 1) + `<line class="ventana" x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0"/>`; break;
        case "puerta":
          s += `<rect class="suelo" x="${-w / 2}" y="${-h / 2 - 1}" width="${w}" height="${h + 2}"/>` +
            `<path class="giro" d="M ${-w / 2} ${h / 2 + w} A ${w} ${w} 0 0 0 ${w / 2} ${h / 2}"/>` +
            `<line x1="${-w / 2}" y1="${h / 2}" x2="${-w / 2}" y2="${h / 2 + w}" stroke="var(--pl-puerta)" stroke-width="4" stroke-linecap="round"/>`;
          break;
        case "columna": s += R("pizarra", 2); break;
        case "papelera": s += `<circle class="mueble" r="${Math.min(w, h) / 2}"/>`; break;
        case "texto": break;
        default: s += R("mueble");
      }
      if (o.interactivo) { const hh = Math.max(h, 30); s += `<rect class="hueco" x="${-w / 2}" y="${-hh / 2}" width="${w}" height="${hh}"/>`; }
    }
    if (o.sel?.has(it.id)) s += `<rect class="marco" x="${-w / 2 - 7}" y="${-h / 2 - 7}" width="${w + 14}" height="${h + 14}" rx="6"/>`;
    // Asa de giro libre: con un solo elemento seleccionado, se arrastra para girarlo
    if (o.interactivo && o.sel?.size === 1 && o.sel.has(it.id) && editable()) {
      const ya = -h / 2 - (t.p ? 58 : 34);
      s += `<line class="asa-linea" x1="0" y1="${-h / 2 - 7}" x2="0" y2="${ya + 9}"/><g class="asa-giro" data-giro><circle cx="0" cy="${ya}" r="13"/>` +
        `<path d="M -5 ${ya - 3} A 6 6 0 1 1 -4 ${ya + 4}" /><path d="M -8 ${ya - 6} L -5 ${ya - 3} L -1 ${ya - 6}"/></g>`;
    }
    return `<g class="it"${o.interactivo ? ` data-id="${it.id}"` : ""} transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.r || 0})">${s}</g>`;
  }
  function svgPlano(d, o = {}) {
    const W = d.ancho, H = d.fondo, M = o.margen ?? 30;
    const doc = (o.vista ?? S.vista) === "docente";
    const V = ([x, y]) => (doc ? [W - x, H - y] : [x, y]);
    let g = `<rect class="suelo" x="0" y="0" width="${W}" height="${H}"/>`;
    if (o.rejilla !== false) {
      for (let x = 50; x < W; x += 50) g += `<line class="rejilla-l" x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
      for (let y = 50; y < H; y += 50) g += `<line class="rejilla-l" x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    }
    g += `<rect class="pared" x="0" y="0" width="${W}" height="${H}"/>`;
    const items = [...d.items].sort((a, b) => (T[a.t].p ? 1 : 0) - (T[b.t].p ? 1 : 0));
    for (const it of items) g += svgItem(it, d, o);
    if (o.marco) { const m = o.marco; g += `<rect class="seleccion" x="${Math.min(m.x0, m.x1)}" y="${Math.min(m.y0, m.y1)}" width="${Math.abs(m.x1 - m.x0)}" height="${Math.abs(m.y1 - m.y0)}"/>`; }

    // Nombres y rótulos, siempre derechos aunque la mesa esté girada
    const als = o.alumnos || alumnosPlano(), rep = repetidos(als), modo = o.nombre || S.nombre;
    // Hueco del puesto tal y como se ve (la mesa puede estar girada; el texto, no)
    const huecoPuesto = (it) => { const rr = (((it.r || 0) % 180) + 180) % 180, w = T[it.t].sw - 6, h = 46 - 10; return rr > 45 && rr < 135 ? [h, w] : [w, h]; };
    const etqs = [];
    for (const it of d.items) {
      if (!T[it.t].p) continue;
      T[it.t].p.forEach(([px, py], i) => {
        const al = d.asientos[it.id + ":" + i], a = al != null && S.alumnos.get(al);
        if (!a) return;
        const [ancho, alto] = huecoPuesto(it), m = mejorForma(etiqueta(a, modo, rep), ancho, alto);
        etqs.push({ it, px, py, al, t: m.t, ancho, alto, lineas: etiqueta(a, modo, rep), f: m.f });
      });
    }
    const tamNombre = Math.max(TAM_MIN, Math.min(TAM_MAX, ...etqs.map((e) => e.t)));
    // Con el tamaño común, cada nombre se parte solo si no cabe entero
    for (const e of etqs) e.f = formas(e.lineas).find((f) => cabeCon(f, e.ancho, e.alto) >= tamNombre - 0.01) || e.f;
    let et = "";
    for (const it of d.items) {
      const t = T[it.t];
      if (t.p) {
        etqs.filter((e) => e.it === it).forEach(({ px, py, al, f, ancho }) => {
          const [x, y] = V(aMundo(it, px, py));
          et += textoAjustado(x, y, f, ancho, tamNombre);
          if (d.fijos.includes(al)) et += `<circle class="pin" cx="${r1(x + ancho / 2 - 1)}" cy="${r1(y - 18)}" r="3.5"/>`;
        });
      } else if (it.t === "texto") {
        if (it.texto) { const [x, y] = V([it.x, it.y]); et += `<text class="et-t" x="${r1(x)}" y="${r1(y)}">${esc(it.texto)}</text>`; }
      } else if (t.et) {
        const { h } = tam(it), [x, y] = V(t.fino ? aMundo(it, 0, h / 2 + 13) : [it.x, it.y]);
        et += `<text class="et-m" x="${r1(x)}" y="${r1(y)}">${t.et}</text>`;
      }
    }
    return {
      vb: `${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`,
      html: `<g id="mundo"${doc ? ` transform="rotate(180 ${W / 2} ${H / 2})"` : ""}>${g}</g><g class="etiquetas">${et}</g>`,
    };
  }
  function miniatura(d) {
    const { vb, html } = svgPlano(d, { rejilla: false, margen: 10, vista: "alumnado", alumnos: [] });
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${html.replace(/<g class="etiquetas">[\s\S]*<\/g>$/, "")}</svg>`;
  }
  function icono(tipo) {
    const t = T[tipo], { w, h } = t, m = t.p ? 18 : 6;
    const it = { id: "i", t: tipo, x: 0, y: 0, r: 0 };
    const body = svgItem(it, { asientos: {} }, {});
    return `<svg viewBox="${-w / 2 - m} ${-h / 2 - m} ${w + 2 * m} ${h + 2 * m}" aria-hidden="true">${body}</svg>`;
  }

  // ─── Pintar la pantalla ───────────────────────────────────────────────────
  function render() {
    const hay = !!S.plano;
    $("#editor").hidden = !hay;
    $("#sinPlano").hidden = hay || !S.claseId;
    for (const id of ["#btnDuplicar", "#btnRenombrar", "#btnCompartir", "#btnEliminar", "#btnImprimir"]) $(id).disabled = !hay;
    if (!hay) { $("#soloLectura").hidden = true; estado(""); return; }
    const mio = editable();
    $("#btnRenombrar").disabled = $("#btnCompartir").disabled = $("#btnEliminar").disabled = !mio;
    const tut = deTutoria(S.plano);
    $("#btnCompartir").classList.toggle("activo", !!S.plano.compartido || tut);
    $("#btnCompartir").textContent = tut ? "De la tutoría ✓" : S.plano.compartido ? "Compartida ✓" : "Compartir";
    if (tut) { $("#btnCompartir").disabled = true; $("#btnCompartir").title = "Eres tutor/a de este grupo: el profesorado ya ve esta distribución"; }
    else $("#btnCompartir").title = "Que el resto del claustro pueda verla y copiarla";
    $("#soloLectura").hidden = mio && !tut;
    $("#soloLectura").classList.toggle("tutoria", tut);
    if (mio && tut) $("#soloLectura").innerHTML = `<span class="tag-tut">De la tutoría</span> Eres tutor/a de este grupo: el profesorado ve esta distribución automáticamente al elegir el grupo (solo puede verla, imprimirla o copiarla).`;
    else if (tut) $("#soloLectura").innerHTML = `<span class="tag-tut">De la tutoría · puesta por el tutor/a</span> Distribución de <strong>${esc(S.plano.propietario_nombre || S.plano.propietario)}</strong>, tutor/a del grupo. Puedes verla e imprimirla; para cambiarla, <button class="btn mini primario" type="button" data-dup>Duplicar</button>`;
    else if (!mio) $("#soloLectura").innerHTML = `Distribución de <strong>${esc(S.plano.propietario_nombre || S.plano.propietario)}</strong>, compartida con el claustro. Puedes verla e imprimirla; para cambiarla, <button class="btn mini primario" type="button" data-dup>Duplicar</button>`;
    const et = $("#etqTutoria");
    et.hidden = !tut;
    if (tut) et.textContent = mio ? "De la tutoría · la ve el profesorado" : `De la tutoría · puesta por ${S.plano.propietario_nombre || S.plano.propietario} (tutor/a)`;
    pintarPlano(); pintarPanel(); pintarBarra();
  }
  function pintarPlano() {
    const svg = $("#plano"), d = D();
    const { vb, html } = svgPlano(d, { interactivo: true, sel: S.modo === "aula" ? S.sel : null, marco: S.marco });
    svg.setAttribute("viewBox", vb);
    svg.innerHTML = html;
    svg.setAttribute("class", "modo-" + S.modo);
    ajustarTamaño();
  }
  // El plano cabe entero en el recuadro (con «Ajustar») y se amplía con + y −
  function ajustarTamaño() {
    const d = D(), lz = $("#lienzo"), svg = $("#plano"); if (!d || lz.offsetParent === null) return;
    const ar = (d.ancho + 60) / (d.fondo + 60), estrecho = innerWidth <= 960;
    if (estrecho) lz.style.height = Math.round(Math.min(innerHeight * 0.75, (lz.clientWidth - 2) / ar)) + "px";
    else lz.style.height = "";
    const w = Math.min(lz.clientWidth, lz.clientHeight * ar) - 2;
    svg.style.width = Math.round(w * S.zoom) + "px";
    svg.style.height = Math.round((w / ar) * S.zoom) + "px";
    svg.style.margin = S.zoom === 1 ? "0 auto" : "0";
  }
  window.addEventListener("resize", () => ajustarTamaño());
  function pintarBarra() {
    const d = D(), ps = puestosDe(d), oc = Object.keys(d.asientos).length;
    $("#puestos").textContent = `${ps.length} puestos · ${oc} ocupados · ${ps.length - oc} libres`;
    $("#btnVista").textContent = S.vista === "docente" ? "Vista: desde la mesa del docente" : "Vista: desde el fondo del aula";
    $("#btnDeshacer").disabled = !S.hist.length || !editable();
    $("#btnRehacer").disabled = !S.fut.length || !editable();
  }
  const PIN = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M14.5 2.5 21.5 9.5 19 10.5 15.5 14l-.5 5-3-3-5.5 5.5-1-1L11 15l-3-3 5-.5L16.5 8 17.5 5.5z"/></svg>`;
  function pintarPanel() {
    $$(".pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.modo === S.modo));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== S.modo));
    const d = D(), als = alumnosPlano(), sentado = new Set(Object.values(d.asientos)), fijos = new Set(d.fijos);
    const sin = als.filter((a) => !sentado.has(a.id)), con = als.filter((a) => sentado.has(a.id));
    const extra = new Set(d.extra), dvs = diversidadDe(d);
    const chip = (a, sentadoYa) => `<span class="al${S.alSel === a.id ? " elegido" : ""}${fijos.has(a.id) ? " fijo" : ""}" data-al="${a.id}" title="${esc(nombreLista(a))}${extra.has(a.id) ? " · " + esc(claseDe(a.clase_id)?.nombre || "") : ""}">
      ${dvs[a.id] ? `<i class="dv" title="Atención a la diversidad: ${esc(motivoTexto(dvs[a.id]))}">D</i>` : ""}${nivelDe(d.niveles[a.id]) ? `<i class="nv" style="--c:${nivelDe(d.niveles[a.id]).c}" title="Nivel ${nivelDe(d.niveles[a.id]).n.toLowerCase()}"></i>` : ""}<span class="nm">${esc(nombreLista(a))}</span>${sentadoYa ? `<button type="button" data-fijar class="${fijos.has(a.id) ? "on" : ""}" title="${fijos.has(a.id) ? "Quitar fijación" : "Fijar en su sitio (no se mueve al sentar al azar ni por lista)"}">${PIN}</button><button type="button" data-levantar title="Dejar sin sitio">↥</button>` : ""}<button type="button" data-excluir title="${extra.has(a.id) ? "Quitar de esta distribución" : "No está en este grupo (desdobles, optativas…)"}">✕</button></span>`;
    $("#listaSin").innerHTML = sin.map((a) => chip(a, false)).join("");
    $("#listaSin").dataset.vacio = als.length ? "Todo el alumnado tiene sitio." : "No hay alumnado.";
    $("#listaCon").innerHTML = con.map((a) => chip(a, true)).join("");
    $("#listaCon").dataset.vacio = "Arrastra aquí para quitar a alguien de su sitio.";
    $("#nSin").textContent = sin.length; $("#nCon").textContent = con.length;
    const fuera = (S.porClase.get(S.plano.clase_id) || []).filter((a) => d.excluidos.includes(a.id));
    $("#detFuera").hidden = !fuera.length; $("#nFuera").textContent = fuera.length;
    $("#listaFuera").innerHTML = fuera.map((a) => `<span class="al" data-al="${a.id}"><span class="nm">${esc(nombreLista(a))}</span><button type="button" data-volver title="Volver a añadir">↩</button></span>`).join("");
    const ps = puestosDe(d).length;
    $("#cuenta").innerHTML = `<div><b>${als.length}</b>alumnos</div><div><b>${ps}</b>puestos</div>` +
      (als.length > ps ? `<div style="background:var(--aviso-bg);color:var(--aviso)"><b>${als.length - ps}</b>sin mesa</div>` : "");
    const np = d.noJuntos.length, nn = als.filter((a) => d.niveles[a.id]).length;
    $("#resNoJuntos").textContent = np ? `${np} pareja${np > 1 ? "s" : ""}` : "Ninguna todavía";
    const div = als.filter((a) => dvs[a.id]), delante = new Set(puestosDelante(d));
    const atras = div.filter((a) => { const k = claveDe(d, a.id); return k && !delante.has(k); }).length;
    $("#resDiversidad").textContent = !div.length ? "Nadie indicado" : `${div.length} alumno${div.length > 1 ? "s" : ""} · ${(d.filasDelante || 2) === 1 ? "1.ª fila" : `${d.filasDelante || 2} primeras filas`}` + (atras ? ` · ⚠ ${atras} más atrás` : "");
    $("#resDiversidad").classList.toggle("mal", !!atras);
    $("#resNiveles").textContent = nn ? `${nn} de ${als.length} con nivel` : "Sin indicar";
    $("#btnPorNivel").disabled = $("#btnEquilibrado").disabled = !nn;
    $("#btnPorNivel").title = $("#btnEquilibrado").title = nn ? "" : "Indica antes el nivel competencial (A tener en cuenta)";
    $("#verNivelesCaja").hidden = !nn; $("#verNiveles").checked = S.verNiveles;
    $("#selNombre").value = S.nombre;
    $("#inAncho").value = d.ancho / 100; $("#inFondo").value = d.fondo / 100;
    if (S.modo === "aula") pintarPlantillasPanel();
    pintarProps();
  }
  function pintarProps() {
    const el = $("#props"), its = D().items.filter((i) => S.sel.has(i.id));
    if (S.modo !== "aula" || !its.length) { el.innerHTML = ""; return; }
    const giros = `<div class="grupo-btn"><button class="btn mini" data-acc="g-15" type="button">↺ 15°</button><button class="btn mini" data-acc="g15" type="button">↻ 15°</button><button class="btn mini" data-acc="g90" type="button">↻ 90°</button></div>`;
    const fin = `<div class="grupo-btn"><button class="btn mini" data-acc="dup" type="button">Duplicar</button><button class="btn mini peligro" data-acc="del" type="button">Eliminar</button></div>`;
    if (its.length === 1) {
      const it = its[0], t = T[it.t], { w, h } = tam(it);
      el.innerHTML = `<h3>${t.p ? "Mesa · " : ""}${t.n}</h3>${giros}` +
        `<label class="campo giro-campo">Giro <span><input data-prop="r" type="number" min="-180" max="180" step="1" value="${it.r || 0}"> °</span></label>` +
        (t.p ? `<label class="campo">Cambiar mesa por <select data-prop="t">${Object.entries(MESAS).map(([k, m]) => `<option value="${k}"${k === it.t ? " selected" : ""}>${m.n} (${m.p.length})</option>`).join("")}</select></label>`
          : `<div class="fila"><label class="campo">Largo (cm) <input data-prop="w" type="number" min="10" max="2000" step="5" value="${w}"></label><label class="campo">Ancho (cm) <input data-prop="h" type="number" min="4" max="2000" step="5" value="${h}"></label></div>`) +
        (it.t === "texto" ? `<label class="campo">Texto <input data-prop="texto" value="${esc(it.texto || "")}" placeholder="Escribe el rótulo"></label>` : "") + fin;
    } else {
      el.innerHTML = `<h3>${its.length} elementos seleccionados</h3>${giros}
        <div class="grupo-btn"><button class="btn mini" data-acc="alH" type="button">Alinear en fila</button><button class="btn mini" data-acc="alV" type="button">Alinear en columna</button></div>
        <div class="grupo-btn"><button class="btn mini" data-acc="repH" type="button">Repartir ↔</button><button class="btn mini" data-acc="repV" type="button">Repartir ↕</button></div>${fin}`;
    }
  }

  // ─── Acciones sobre el mobiliario ─────────────────────────────────────────
  // Cambia una mesa por otra sin dejar a nadie sin sitio: si la nueva tiene menos puestos que alumnado
  // sentado, se separa en varias mesas iguales, una al lado de otra (pareja → dos individuales).
  // Si tiene más, quien estaba sigue en su sitio y los puestos nuevos quedan libres (pareja → grupo de 3).
  function cambiarMesa(d, it, nuevo) {
    if (!MESAS[nuevo] || nuevo === it.t) return;
    const viejos = T[it.t].p.map((_, i) => it.id + ":" + i);
    const sentados = viejos.map((k) => d.asientos[k]).filter((x) => x != null);
    viejos.forEach((k) => delete d.asientos[k]);
    it.t = nuevo;
    const cap = MESAS[nuevo].p.length, n = Math.max(1, Math.ceil(sentados.length / cap));
    const mesas = [it], paso = MESAS[nuevo].w + 20, x0 = -((n - 1) / 2) * paso, cx = it.x, cy = it.y;
    for (let j = 0; j < n; j++) {
      const [x, y] = aMundo({ x: cx, y: cy, r: it.r }, x0 + j * paso, 0);
      if (j === 0) { it.x = ajusta(x); it.y = ajusta(y); continue; }
      const m = { id: uid(), t: nuevo, x: ajusta(x), y: ajusta(y), r: it.r || 0 };
      d.items.push(m); mesas.push(m);
    }
    sentados.forEach((al, i) => (d.asientos[mesas[Math.floor(i / cap)].id + ":" + (i % cap)] = al));
    if (n > 1) S.sel = new Set(mesas.map((m) => m.id));
  }

  function añadir(tipo) {
    const d = D(); let x = ajusta(d.ancho / 2), y = ajusta(d.fondo / 2);
    while (d.items.some((i) => Math.abs(i.x - x) < 10 && Math.abs(i.y - y) < 10)) { x += 30; y += 30; }
    const it = { id: uid(), t: tipo, x, y, r: 0 };
    if (tipo === "texto") it.texto = "Texto";
    if (cambio((d) => d.items.push(it))) { S.sel = new Set([it.id]); render(); }
  }
  function accion(a) {
    const ids = S.sel;
    const sel = () => D().items.filter((i) => ids.has(i.id));
    switch (a) {
      case "g15": case "g-15": case "g90": { const g = a === "g90" ? 90 : a === "g15" ? 15 : -15; cambio(() => sel().forEach((i) => (i.r = (((i.r || 0) + g + 540) % 360) - 180))); break; }
      case "dup": {
        const nuevos = sel().map((i) => ({ ...i, id: uid(), x: i.x + 30, y: i.y + 30 }));
        if (cambio((d) => d.items.push(...nuevos))) { S.sel = new Set(nuevos.map((i) => i.id)); render(); }
        break;
      }
      case "del": if (cambio((d) => (d.items = d.items.filter((i) => !ids.has(i.id))))) { S.sel.clear(); render(); } break;
      case "alH": cambio(() => { const s = sel(), y = ajusta(s.reduce((m, i) => m + i.y, 0) / s.length); s.forEach((i) => (i.y = y)); }); break;
      case "alV": cambio(() => { const s = sel(), x = ajusta(s.reduce((m, i) => m + i.x, 0) / s.length); s.forEach((i) => (i.x = x)); }); break;
      case "repH": case "repV": cambio(() => {
        const e = a === "repH" ? "x" : "y", s = sel().sort((p, q) => p[e] - q[e]);
        if (s.length < 3) return;
        const a0 = s[0][e], paso = (s[s.length - 1][e] - a0) / (s.length - 1);
        s.forEach((i, n) => (i[e] = ajusta(a0 + n * paso)));
      }); break;
    }
  }

  // ─── Ratón y pantalla táctil sobre el plano ───────────────────────────────
  function punto(e) {
    const m = $("#plano #mundo").getScreenCTM().inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  }
  function prepararLienzo() {
    const svg = $("#plano");
    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !S.plano) return;
      const d = D();
      if (S.modo === "alumnado") {
        const seat = e.target.closest("[data-seat]");
        if (!seat) { if (S.alSel != null) { S.alSel = null; render(); } return; }
        const k = seat.dataset.seat, al = d.asientos[k];
        if (S.alSel != null && S.alSel !== al) { const id = S.alSel; S.alSel = null; asignar(id, k); return; }
        if (al != null) arrastreAlumno(e, al, k);
        return;
      }
      if (!editable()) { avisoLectura(); return; }
      const p = punto(e), g = e.target.closest(".it[data-id]");
      svg.setPointerCapture(e.pointerId);
      if (g && e.target.closest("[data-giro]")) {
        const it = d.items.find((i) => i.id === g.dataset.id);
        S.arrastre = { tipo: "girar", it, antes: JSON.stringify(d), movido: false };
        return;
      }
      if (g) {
        const id = g.dataset.id;
        if (e.shiftKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); }
        else if (!S.sel.has(id)) S.sel = new Set([id]);
        const orig = new Map(d.items.filter((i) => S.sel.has(i.id)).map((i) => [i.id, { x: i.x, y: i.y }]));
        S.arrastre = { tipo: "mover", p0: p, orig, antes: JSON.stringify(d), movido: false };
      } else {
        if (!e.shiftKey) S.sel.clear();
        S.arrastre = { tipo: "marco", base: new Set(S.sel) };
        S.marco = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      }
      render();
    });
    svg.addEventListener("pointermove", (e) => {
      const a = S.arrastre; if (!a) return;
      const p = punto(e), d = D();
      if (a.tipo === "girar") {
        // Ángulo libre de 1 en 1 grado; cerca de los múltiplos de 15° se queda en ellos
        let g = Math.round((Math.atan2(p.x - a.it.x, -(p.y - a.it.y)) * 180) / Math.PI);
        const m15 = Math.round(g / 15) * 15; if (!e.shiftKey && Math.abs(g - m15) <= 3) g = m15;
        g = ((g + 540) % 360) - 180;
        if (g !== a.it.r) { a.it.r = g; a.movido = true; pintarPlano(); pintarProps(); }
        return;
      }
      if (a.tipo === "mover") {
        const dx = p.x - a.p0.x, dy = p.y - a.p0.y;
        if (!a.movido && Math.hypot(dx, dy) < 4) return;
        a.movido = true;
        for (const it of d.items) { const o = a.orig.get(it.id); if (o) { it.x = ajusta(o.x + dx); it.y = ajusta(o.y + dy); } }
      } else {
        S.marco.x1 = p.x; S.marco.y1 = p.y;
        const m = S.marco, x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
        S.sel = new Set(a.base);
        for (const it of d.items) if (it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1) S.sel.add(it.id);
      }
      pintarPlano();
    });
    const soltar = () => {
      const a = S.arrastre; if (!a) return;
      S.arrastre = null; S.marco = null;
      if ((a.tipo === "mover" || a.tipo === "girar") && a.movido) {
        S.hist.push(a.antes); if (S.hist.length > 80) S.hist.shift(); S.fut = [];
        programarGuardado();
      }
      render();
    };
    svg.addEventListener("pointerup", soltar);
    svg.addEventListener("pointercancel", soltar);
    svg.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); zoom(e.deltaY < 0 ? 0.25 : -0.25);
    }, { passive: false });
  }
  function zoom(paso) { S.zoom = paso === 0 ? 1 : Math.min(3, Math.max(1, S.zoom + paso)); ajustarTamaño(); }

  // Arrastrar un nombre (desde la lista o desde una mesa) con ratón o con el dedo
  function arrastreAlumno(e, alId, origen) {
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY; let fant = null, dest = null;
    const marcar = (el) => { if (dest === el) return; dest?.classList.remove("destino"); dest = el; dest?.classList.add("destino"); };
    const objetivo = (ev) => { const el = document.elementFromPoint(ev.clientX, ev.clientY); return el?.closest("[data-seat]") || el?.closest(".zona-lista") || null; };
    const mover = (ev) => {
      if (!fant) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        if (!editable()) { fin(); avisoLectura(); return; }
        fant = document.createElement("div"); fant.className = "fantasma";
        fant.textContent = nombreLista(S.alumnos.get(alId)); document.body.append(fant);
      }
      fant.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 10}px)`;
      marcar(objetivo(ev));
    };
    const fin = (ev) => {
      window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", fin); window.removeEventListener("pointercancel", fin);
      if (!ev) return;
      if (!fant) { S.alSel = S.alSel === alId ? null : alId; render(); return; }
      fant.remove(); marcar(null);
      const o = ev.type === "pointerup" ? objetivo(ev) : null;
      S.alSel = null;
      if (o?.dataset.seat) asignar(alId, o.dataset.seat);
      else if (o && origen) levantar(alId);
      else render();
    };
    window.addEventListener("pointermove", mover); window.addEventListener("pointerup", fin); window.addEventListener("pointercancel", fin);
  }

  // ─── Panel del alumnado ───────────────────────────────────────────────────
  function prepararPanel() {
    $$(".pestanas button").forEach((b) => (b.onclick = () => { S.modo = b.dataset.modo; S.alSel = null; render(); }));
    const listas = $("#panelAlumnado");
    listas.addEventListener("pointerdown", (e) => {
      const chip = e.target.closest(".al[data-al]");
      if (!chip || e.target.closest("button") || chip.closest("#listaFuera") || e.button !== 0) return;
      const id = +chip.dataset.al;
      arrastreAlumno(e, id, claveDe(D(), id));
    });
    listas.addEventListener("click", (e) => {
      const b = e.target.closest("button"), chip = e.target.closest(".al[data-al]");
      if (!b || !chip) return;
      const id = +chip.dataset.al;
      if (b.hasAttribute("data-levantar")) levantar(id);
      else if (b.hasAttribute("data-fijar")) cambio((d) => { d.fijos = d.fijos.includes(id) ? d.fijos.filter((x) => x !== id) : [...d.fijos, id]; });
      else if (b.hasAttribute("data-excluir")) cambio((d) => {
        if (d.extra.includes(id)) d.extra = d.extra.filter((x) => x !== id); else d.excluidos.push(id);
        d.noJuntos = d.noJuntos.filter((p) => !p.includes(id));
      });
      else if (b.hasAttribute("data-volver")) cambio((d) => (d.excluidos = d.excluidos.filter((x) => x !== id)));
    });
    $("#btnOrden").onclick = () => cambio((d) => sentarPorLista(d, alumnosPlano()));
    $("#btnAzar").onclick = () => {
      let mal = 0;
      if (cambio((d) => (mal = sentarAzar(d, alumnosPlano())))) toast(mal ? `No se ha podido separar a ${mal} pareja(s): revisa las mesas.` : "Alumnado colocado al azar");
    };
    const porNiveles = (modo) => {
      let mal = 0;
      if (cambio((d) => (mal = sentarNiveles(d, alumnosPlano(), modo))))
        toast(mal ? `No se ha podido separar a ${mal} pareja(s): revisa las mesas.` : modo === "niveles" ? "Alumnado sentado por niveles" : "Mesas equilibradas por niveles");
    };
    $("#btnPorNivel").onclick = () => porNiveles("niveles");
    // «i» de información: abre o cierra la explicación (solo una a la vez)
    $$(".info-i").forEach((b) => (b.onclick = () => {
      const abrir = $("#" + b.dataset.info).hidden;
      $$(".info-i").forEach((x) => { $("#" + x.dataset.info).hidden = true; x.setAttribute("aria-expanded", "false"); });
      $("#" + b.dataset.info).hidden = !abrir; b.setAttribute("aria-expanded", String(abrir));
    }));
    $("#btnEquilibrado").onclick = () => porNiveles("equilibrado");
    $("#btnNiveles").onclick = niveles;
    $("#btnDiversidad").onclick = diversidad;
    $("#verNiveles").onchange = (e) => { S.verNiveles = e.target.checked; LS.set("aula-ver-niveles", S.verNiveles); render(); };
    $("#btnLevantar").onclick = async () => {
      if (!Object.keys(D().asientos).length) return;
      if (await confirmar("¿Levantar a todos?", "Todo el alumnado queda sin sitio (también quien estaba fijado). Se puede deshacer.", "Levantar a todos")) cambio((d) => { d.asientos = {}; d.fijos = []; });
    };
    $("#selNombre").onchange = (e) => { S.nombre = e.target.value; LS.set("aula-nombre", S.nombre); render(); };
    $("#btnNoJuntos").onclick = noJuntos;
    $("#btnOtraClase").onclick = otraClase;
  }

  async function noJuntos() {
    if (!editable()) return avisoLectura();
    const als = alumnosPlano(), nom = (id) => nombreLista(S.alumnos.get(id) || { nombre: "?" });
    let pares = D().noJuntos.filter(([a, b]) => S.alumnos.has(a) && S.alumnos.has(b)).map((p) => [...p]);
    const opts = als.map((a) => `<option value="${a.id}">${esc(nombreLista(a))}</option>`).join("");
    const pintar = (f) => {
      $(".parejas", f).innerHTML = pares.length ? pares.map(([a, b], i) => `<li><span>${esc(nom(a))} <b>·</b> ${esc(nom(b))}</span><button class="btn mini peligro" type="button" data-q="${i}">Quitar</button></li>`).join("")
        : `<li>Todavía no hay ninguna pareja.</li>`;
    };
    const r = await dialogo(`<h2>No deben sentarse juntos</h2>
      <p class="dlg-sub">Al sentar al azar, por niveles o equilibrado, estas parejas no quedan en la misma mesa ni en mesas pegadas.</p>
      <div class="dlg-rejilla"><label class="campo">Alumno/a <select id="nj1">${opts}</select></label><label class="campo">Alumno/a <select id="nj2">${opts}</select></label></div>
      <div class="grupo-btn" style="margin-top:10px"><button class="btn" type="button" id="njAdd">+ Añadir pareja</button></div>
      <ul class="parejas scroll"></ul>`, {
      aceptar: "Guardar",
      alAbrir: (f) => {
        pintar(f);
        $("#nj2", f).selectedIndex = Math.min(1, als.length - 1);
        $("#njAdd", f).onclick = () => {
          const a = +$("#nj1", f).value, b = +$("#nj2", f).value;
          if (a === b) return toast("Elige dos personas distintas");
          if (!pares.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) pares.push([a, b]);
          pintar(f);
        };
        $(".parejas", f).onclick = (e) => { const q = e.target.closest("[data-q]"); if (q) { pares.splice(+q.dataset.q, 1); pintar(f); } };
      },
    });
    if (r) cambio((d) => (d.noJuntos = pares));
  }

  async function niveles() {
    if (!editable()) return avisoLectura();
    const als = alumnosPlano(), nv = { ...D().niveles };
    const fila = (a) => `<li><span class="nm">${esc(nombreLista(a))}</span><span class="nv-opc">${NIVELES.map((x) =>
      `<label title="${x.n}"><input type="radio" name="n${a.id}" value="${x.v}"${nv[a.id] === x.v ? " checked" : ""}><span style="--c:${x.c}">${x.n}</span></label>`).join("")}
      <label title="Sin indicar"><input type="radio" name="n${a.id}" value=""${nv[a.id] ? "" : " checked"}><span class="nada">—</span></label></span></li>`;
    const r = await dialogo(`<h2>Nivel competencial</h2>
      <p class="dlg-sub">Sirve para «Sentar por niveles» (cada mesa con alumnado del mismo nivel) o «Equilibrado» (cada mesa compensa niveles distintos). Solo lo ves tú; no sale en la hoja impresa.</p>
      <ul class="niveles scroll">${als.map(fila).join("")}</ul>`, { aceptar: "Guardar" });
    if (!r) return;
    cambio((d) => {
      d.niveles = {};
      for (const a of als) { const v = +r.get("n" + a.id); if (v) d.niveles[a.id] = v; }
    });
  }

  async function diversidad() {
    if (!editable()) return avisoLectura();
    const als = alumnosPlano(), dv = D().diversidad, nf = D().filasDelante || 2;
    const fila = (a) => {
      if (S.orientacion.has(a.id)) return `<li><span class="nm">${esc(nombreLista(a))}</span><span class="dv-fija" title="Consta en su ficha de Orientación; se cambia allí">${esc(S.orientacion.get(a.id))} · Orientación</span></li>`;
      const m = dv[a.id] || {};
      return `<li><span class="nm">${esc(nombreLista(a))}</span>
        <span class="dv-campos"><select name="m${a.id}" data-dv>
          <option value="">—</option>${Object.entries(MOTIVOS).map(([k, t]) => `<option value="${k}"${m.motivo === k ? " selected" : ""}>${t}</option>`).join("")}
        </select><input name="o${a.id}" placeholder="Especifica la razón" maxlength="80" value="${esc(m.otro || "")}"${m.motivo === "otro" ? "" : " hidden"}></span></li>`;
    };
    const r = await dialogo(`<h2>Atención a la diversidad</h2>
      <p class="dlg-sub">Alumnado con medida de ubicación cercana al docente, problemas de visión u otra razón. Quien tiene en Orientación la medida «Ubicación cercana al profesor/a» ya sale marcado. Al sentar (por lista, al azar, por niveles o equilibrado) siempre queda en las primeras filas. Solo lo ves tú; no sale en la hoja impresa.</p>
      <div class="filas-delante"><span>Sentar en</span>${[1, 2, 3].map((n) => `<label><input type="radio" name="nf" value="${n}"${n === nf ? " checked" : ""}><span>${n === 1 ? "la 1.ª fila" : `las ${n} primeras filas`}</span></label>`).join("")}</div>
      <ul class="niveles scroll">${als.map(fila).join("")}</ul>`, {
      aceptar: "Guardar",
      alAbrir: (f) => f.addEventListener("change", (e) => {
        if (!e.target.matches("[data-dv]")) return;
        const o = e.target.nextElementSibling; o.hidden = e.target.value !== "otro"; if (!o.hidden) o.focus();
      }),
    });
    if (!r) return;
    let fuera = 0;
    cambio((d) => {
      d.diversidad = {}; d.filasDelante = +r.get("nf") || 2;
      for (const a of als) {
        const m = r.get("m" + a.id); if (!m) continue;
        d.diversidad[a.id] = m === "otro" ? { motivo: m, otro: String(r.get("o" + a.id) || "").trim() } : { motivo: m };
      }
      fuera = ponerDelante(d);
    });
    if (fuera) toast(`No caben todos delante: ${fuera} alumno(s) se quedan más atrás. Añade mesas delante o elige más filas.`, "error", 7000);
  }

  async function otraClase() {
    if (!editable()) return avisoLectura();
    const otras = S.clases.filter((c) => c.id != S.plano.clase_id);
    const lista = (cid) => {
      const ext = new Set(D().extra);
      return (S.porClase.get(+cid) || []).map((a) => `<label class="check"><input type="checkbox" name="al" value="${a.id}"${ext.has(a.id) ? " checked" : ""}> ${esc(nombreLista(a))}</label>`).join("");
    };
    let cid = otras[0]?.id;
    const r = await dialogo(`<h2>Añadir alumnado de otra clase</h2>
      <p class="dlg-sub">Para desdobles, optativas o grupos mixtos. Marca a quien venga a esta distribución.</p>
      <label class="campo">Clase <select id="ocSel">${otras.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}</select></label>
      <div class="grupo-btn" style="margin:10px 0"><button class="btn mini" type="button" id="ocTodos">Marcar todos</button><button class="btn mini" type="button" id="ocNinguno">Ninguno</button></div>
      <div class="marcar scroll" id="ocLista">${lista(cid)}</div>`, {
      aceptar: "Guardar",
      alAbrir: (f) => {
        $("#ocSel", f).onchange = (e) => { cid = +e.target.value; $("#ocLista", f).innerHTML = lista(cid); };
        $("#ocTodos", f).onclick = () => $$("#ocLista input", f).forEach((i) => (i.checked = true));
        $("#ocNinguno", f).onclick = () => $$("#ocLista input", f).forEach((i) => (i.checked = false));
      },
    });
    if (!r) return;
    const deClase = new Set((S.porClase.get(+cid) || []).map((a) => a.id)), marcados = r.getAll("al").map(Number);
    cambio((d) => (d.extra = [...d.extra.filter((id) => !deClase.has(id)), ...marcados]));
  }

  // ─── Panel del aula ───────────────────────────────────────────────────────
  function prepararAula() {
    $("#paletaMuebles").innerHTML = Object.entries(MUEBLES).map(([k, t]) => `<button type="button" data-add="${k}">${icono(k)}${t.n}</button>`).join("");
    $$("[data-add]").forEach((b) => (b.onclick = () => añadir(b.dataset.add)));
    const medida = (prop) => (e) => {
      const v = Math.round(parseFloat(String(e.target.value).replace(",", ".")) * 100);
      if (!(v >= 300 && v <= 3000)) { pintarPanel(); return toast("Escribe una medida entre 3 y 30 m"); }
      cambio((d) => {
        const antes = d[prop]; d[prop] = v;
        // Lo que estaba pegado a la pared de la derecha o del fondo se mueve con ella
        const e2 = prop === "ancho" ? "x" : "y";
        d.items.forEach((i) => { if (Math.abs(i[e2] - antes) < 20) i[e2] = v; });
      });
    };
    $("#inAncho").onchange = medida("ancho");
    $("#inFondo").onchange = medida("fondo");
    $("#props").addEventListener("click", (e) => { const b = e.target.closest("[data-acc]"); if (b) accion(b.dataset.acc); });
    $("#props").addEventListener("change", (e) => {
      const p = e.target.dataset.prop; if (!p) return;
      const id = [...S.sel][0];
      cambio((d) => {
        const it = d.items.find((i) => i.id === id); if (!it) return;
        if (p === "t") cambiarMesa(d, it, e.target.value);
        else if (p === "texto") it[p] = e.target.value;
        else if (p === "r") { const v = Math.round(+e.target.value); if (Number.isFinite(v)) it.r = ((v + 540) % 360) - 180; }
        else { const v = Math.round(+e.target.value); if (v > 0) it[p] = v; }
      });
    });
    $("#panelPlantillas").addEventListener("click", (e) => {
      const p = e.target.closest("[data-pl]"), mb = e.target.closest("[data-mb]"), d = D();
      if (p) aplicarPlantilla(p.dataset.pl, d.miembros || LS.get("aula-miembros", 4));
      else if (mb) { LS.set("aula-miembros", +mb.dataset.mb); aplicarPlantilla("grupos", +mb.dataset.mb); }
    });
  }

  function opcionesPlantilla(sel = "parejas", W, H, n) {
    const m = LS.get("aula-miembros", 4);
    return `<div class="plantillas">${PLANTILLAS.map((p) => `<label><input type="radio" name="pl" value="${p.id}"${p.id === sel ? " checked" : ""}><span class="mini" data-mini="${p.id}">${miniatura(datosNuevos(p.id, W, H, m, n))}</span>${p.n}</label>`).join("")}</div>
      <fieldset class="miembros" hidden><legend>Miembros por grupo</legend>
        <div class="chips">${MIEMBROS.map((x) => `<label><input type="radio" name="miembros" value="${x}"${x === m ? " checked" : ""}><span>${x}</span></label>`).join("")}</div>
      </fieldset>`;
  }
  // Al elegir «Grupos» aparece el número de miembros, y la miniatura cambia con él
  function prepararPlantillas(f, W, H, n) {
    const caja = $(".miembros", f);
    const pintar = () => {
      const pl = f.elements.pl.value, m = +f.elements.miembros.value || 4;
      caja.hidden = pl !== "grupos";
      $('[data-mini="grupos"]', f).innerHTML = miniatura(datosNuevos("grupos", W, H, m, n));
    };
    f.addEventListener("change", (e) => {
      if (e.target.name === "miembros") LS.set("aula-miembros", +e.target.value);
      if (e.target.name === "pl" || e.target.name === "miembros") pintar();
    });
    pintar();
  }
  // Distribución de mesas desde el panel «Aula y mesas»: se aplica al momento (se puede deshacer)
  function aplicarPlantilla(id, m) {
    if (!editable()) return avisoLectura();
    const n = alumnosPlano().length;
    cambio((d) => {
      const orden = ordenados(d).map((p) => d.asientos[p.k]).filter((x) => x != null);
      const { items, fondo } = mesasPlantilla(id, d.ancho, d.fondo, m, n);
      d.fondo = Math.max(d.fondo, ajusta(fondo));
      d.items = [...d.items.filter((i) => !T[i.t].p), ...items];
      d.plantilla = id; d.miembros = m;
      d.asientos = {}; d.fijos = [];
      ordenados(d).forEach((p, i) => { if (orden[i] != null) d.asientos[p.k] = orden[i]; });
      ponerDelante(d);
    });
  }
  const minis = new Map();
  function pintarPlantillasPanel() {
    const d = D(), n = alumnosPlano().length, m = d.miembros || LS.get("aula-miembros", 4), act = d.plantilla;
    const mini = (id) => {
      const k = [id, d.ancho, d.fondo, n, id === "grupos" ? m : ""].join("|");
      if (!minis.has(k)) minis.set(k, miniatura(datosNuevos(id, d.ancho, d.fondo, m, n)));
      return minis.get(k);
    };
    $("#panelPlantillas").innerHTML = `<div class="plantillas panel-pl">${PLANTILLAS.map((p) =>
      `<button type="button" data-pl="${p.id}" class="${p.id === act ? "activa" : ""}"${editable() ? "" : " disabled"}>${mini(p.id)}${p.n}</button>`).join("")}</div>
      <div class="miembros" ${act === "grupos" ? "" : "hidden"}><span class="miembros-t">Miembros por grupo</span>
        <div class="chips">${MIEMBROS.map((x) => `<button type="button" data-mb="${x}" class="${x === m ? "activa" : ""}"${editable() ? "" : " disabled"}>${x}</button>`).join("")}</div></div>`;
  }

  // ─── Clases y distribuciones ──────────────────────────────────────────────
  const ETAPAS = ["Infantil", "Primaria", "ESO", "Bachillerato", "Otros grupos"];
  const etapa = (c) => c.etapa || (/infantil/i.test(c.nombre) ? "Infantil" : /prim/i.test(c.nombre) ? "Primaria" : /bach/i.test(c.nombre) ? "Bachillerato" : /eso/i.test(c.nombre) ? "ESO" : "Otros grupos");
  function pintarClases() {
    const grupos = new Map(ETAPAS.map((e) => [e, []]));
    for (const c of S.clases) { const e = etapa(c); if (!grupos.has(e)) grupos.set(e, []); grupos.get(e).push(c); }
    for (const [e, cs] of grupos) if (!cs.length) grupos.delete(e);
    $("#selClase").innerHTML = [...grupos].map(([e, cs]) => `<optgroup label="${e}">${cs.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}</optgroup>`).join("");
  }
  const planosClase = () => S.planos.filter((p) => p.clase_id == S.claseId)
    .sort((a, b) => (esMio(b) - esMio(a)) || (deTutoria(b) - deTutoria(a)) || a.nombre.localeCompare(b.nombre, "es"));
  function pintarPlanos() {
    const ps = planosClase(), mios = ps.filter(esMio), tut = ps.filter((p) => !esMio(p) && deTutoria(p)), otros = ps.filter((p) => !esMio(p) && !deTutoria(p));
    const quien = (p) => " · " + esc(p.propietario_nombre || p.propietario);
    const op = (p) => `<option value="${p.id}">${esc(p.nombre)}${esMio(p) ? (deTutoria(p) ? " (de la tutoría)" : p.compartido ? " (compartida)" : "") : deTutoria(p) ? " · puesta por el tutor/a, " + esc(p.propietario_nombre || p.propietario) : quien(p)}</option>`;
    $("#selPlano").innerHTML = !ps.length ? `<option value="">— Ninguna todavía —</option>`
      : (mios.length ? `<optgroup label="Mis distribuciones">${mios.map(op).join("")}</optgroup>` : "") +
        (tut.length ? `<optgroup label="De la tutoría (la ha puesto el tutor/a del grupo)">${tut.map(op).join("")}</optgroup>` : "") +
        (otros.length ? `<optgroup label="Compartidas por el claustro">${otros.map(op).join("")}</optgroup>` : "");
    $("#selPlano").value = S.plano?.id || "";
  }
  async function elegirClase(id, planoId) {
    await guardarYa();
    S.claseId = +id || id; $("#selClase").value = id;
    const ps = planosClase();
    const p = ps.find((x) => x.id === planoId) || ps.find(esMio) || ps.find(deTutoria) || ps[0] || null;
    abrir(p);
  }
  function abrir(p) {
    S.plano = p; S.sel.clear(); S.alSel = null; S.hist = []; S.fut = [];
    if (p) {
      const d = p.datos || (p.datos = datosNuevos("vacia"));
      for (const [k, v] of Object.entries({ items: [], asientos: {}, fijos: [], noJuntos: [], extra: [], excluidos: [], niveles: {}, diversidad: {}, filasDelante: 2 })) if (!d[k]) d[k] = v;
      d.ancho ||= 800; d.fondo ||= 700;
      limpiar(d);
      estado(esMio(p) ? (almacen === local ? "Guardado en este navegador" : "Guardado") : "Solo lectura");
    }
    LS.set("aula-ultimo", { clase: S.claseId, plano: p?.id || null });
    pintarPlanos(); render();
  }
  async function crear(nombre, datos, compartido = false) {
    await guardarYa();
    const fila = await almacen.crear({ curso_id: S.cursoId, clase_id: S.claseId, nombre, propietario_nombre: S.user.nombre, compartido, datos });
    S.planos.push(fila); abrir(fila);
  }
  async function nuevo() {
    const c = claseDe(S.claseId), n = planosClase().filter(esMio).length;
    const al = (S.porClase.get(S.claseId) || []).length;
    const r = await dialogo(`<h2>Nueva distribución</h2><p class="dlg-sub">${esc(c?.nombre || "")} · ${al} alumnos/as: se crea un puesto para cada uno</p>
      <label class="campo">Nombre <input name="nombre" required maxlength="80" value="${n ? "Propuesta " + (n + 1) : "Distribución principal"}"></label>
      <h3 style="font-size:13px;color:var(--suave);margin:14px 0 0">Plantilla de partida</h3>
      ${opcionesPlantilla("parejas", undefined, undefined, al)}
      <label class="check"><input type="checkbox" name="sentar" checked> Sentar ya al alumnado por orden de lista</label>`, { aceptar: "Crear", alAbrir: (f) => prepararPlantillas(f, undefined, undefined, al) });
    if (!r) return;
    const datos = datosNuevos(r.get("pl"), undefined, undefined, +r.get("miembros") || 4, al);
    // Se mantienen el nivel competencial y las parejas de tu última distribución de esta clase
    const previa = planosClase().filter(esMio).sort((a, b) => String(b.actualizado || "").localeCompare(String(a.actualizado || "")))[0];
    if (previa?.datos) { datos.niveles = { ...(previa.datos.niveles || {}) }; datos.diversidad = JSON.parse(JSON.stringify(previa.datos.diversidad || {})); datos.filasDelante = previa.datos.filasDelante || 2; datos.noJuntos = (previa.datos.noJuntos || []).map((p) => [...p]); }
    if (r.get("sentar")) sentarPorLista(datos, alumnosPlano({ clase_id: S.claseId, datos }));
    try { await crear(String(r.get("nombre")).trim() || "Distribución", datos); toast("Distribución creada"); } catch (e) { fallo(e); }
  }
  async function duplicar() {
    const p = S.plano; if (!p) return;
    const r = await dialogo(`<h2>Duplicar</h2><p class="dlg-sub">Se crea una copia tuya que puedes cambiar sin tocar el original.</p>
      <label class="campo">Nombre de la copia <input name="nombre" required maxlength="80" value="${esc((esMio(p) ? "Copia de " : "") + p.nombre)}"></label>`, { aceptar: "Duplicar" });
    if (!r) return;
    try { await crear(String(r.get("nombre")).trim() || "Copia", JSON.parse(JSON.stringify(p.datos))); toast("Copia creada"); } catch (e) { fallo(e); }
  }
  async function renombrar() {
    const p = S.plano; if (!esMio(p)) return;
    const r = await dialogo(`<h2>Cambiar nombre</h2><label class="campo">Nombre <input name="nombre" required maxlength="80" value="${esc(p.nombre)}"></label>`, { aceptar: "Guardar" });
    if (!r) return;
    p.nombre = String(r.get("nombre")).trim() || p.nombre; pintarPlanos(); programarGuardado();
  }
  async function compartir() {
    const p = S.plano; if (!esMio(p)) return;
    const ok2 = await confirmar(p.compartido ? "Dejar de compartir" : "Compartir con el claustro",
      p.compartido ? "El resto del profesorado dejará de verla." : "El resto del profesorado (con cuenta del colegio) podrá verla, imprimirla y hacer su propia copia, pero no cambiar la tuya.",
      p.compartido ? "Dejar de compartir" : "Compartir", false);
    if (!ok2) return;
    p.compartido = !p.compartido; pintarPlanos(); render(); programarGuardado();
    toast(p.compartido ? "Compartida con el claustro" : "Ya no está compartida");
  }
  async function eliminar() {
    const p = S.plano; if (!esMio(p)) return;
    if (!(await confirmar("Eliminar distribución", `Se borra «${esc(p.nombre)}». Esto no se puede deshacer.`, "Eliminar"))) return;
    try {
      if (pendiente === p) { clearTimeout(tGuardar); pendiente = null; }
      await almacen.borrar(p.id);
      S.planos = S.planos.filter((x) => x !== p); S.plano = null;
      elegirClase(S.claseId); toast("Distribución eliminada");
    } catch (e) { fallo(e); }
  }

  // ─── Impresión: una hoja A4 con formato corporativo ───────────────────────
  const OPC = () => ({ titulo: "Distribución del aula", orient: "h", fecha: true, tutor: true, profe: true, sinsitio: true, rejilla: false, ...LS.get("aula-imprimir", {}), vista: S.vista, nombre: S.nombre });
  function hoja(o) {
    const p = S.plano, d = p.datos, c = claseDe(p.clase_id);
    const als = alumnosPlano(), sentado = new Set(Object.values(d.asientos)), sin = als.filter((a) => !sentado.has(a.id));
    const { vb, html } = svgPlano(d, { vista: o.vista, nombre: o.nombre, rejilla: o.rejilla, margen: 22 });
    const lado = (o.sinsitio && sin.length ? `<section><h2>Sin sitio (${sin.length})</h2><ol>${sin.map((a) => `<li>${esc(nombreLista(a))}</li>`).join("")}</ol></section>` : "") +
      (o.obs ? `<section><h2>Observaciones</h2><p>${esc(o.obs)}</p></section>` : "");
    const meta = [
      o.tutor && c?.tutor ? `Tutor/a: <b>${esc(c.tutor)}</b>` : "",
      o.profe && o.profeNombre ? `Profesor/a: <b>${esc(o.profeNombre)}</b>` : "",
      `Alumnado: <b>${als.length}</b> · Puestos: <b>${puestosDe(d).length}</b>`,
      o.fecha ? esc(hoyTexto()) : "",
    ].filter(Boolean).join("<br>");
    return `<div class="hoja${o.orient === "v" ? " vertical" : ""}">
      <header class="imp-cab">
        <img src="logo.svg" alt="Salesianas Nervión">
        <div class="imp-tit"><span class="imp-eyebrow">Curso ${esc(S.cursoNombre)}</span><h1>${esc(o.titulo || "Distribución del aula")}</h1><p>${esc(o.sub)}</p></div>
        <div class="imp-meta">${meta}</div>
      </header>
      <div class="imp-franja"><i></i><i></i><i></i></div>
      <div class="imp-cuerpo">
        <div class="imp-plano"><svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" font-family="Fira Sans, sans-serif">${html}</svg>
          <div class="imp-vista">${o.vista === "docente" ? "Vista desde la mesa del docente (la pizarra queda abajo)" : "Vista desde el fondo del aula (la pizarra queda arriba)"}</div></div>
        ${lado ? `<aside class="imp-lado">${lado}</aside>` : ""}
      </div>
      <footer class="imp-pie"><span><b>Escuelas Salesianas María Auxiliadora</b> · Nervión (Sevilla)</span><span>${esc(c?.nombre || "")} · ${esc(p.nombre)}</span></footer>
    </div>`;
  }
  function prepararHoja(o) {
    const sub = o.sub ?? [claseDe(S.plano.clase_id)?.nombre, S.plano.nombre].filter(Boolean).join(" · ");
    $("#impresion").innerHTML = hoja({ ...o, sub, profeNombre: o.profeNombre ?? S.user.nombre });
    $("#estiloPagina").textContent = `@page { size: A4 ${o.orient === "v" ? "portrait" : "landscape"}; margin: 0; }`;
  }
  async function imprimir() {
    if (!S.plano) return;
    await guardarYa();
    const o = OPC(), c = claseDe(S.plano.clase_id);
    const sel = (v, x) => (v === x ? " selected" : ""), chk = (v) => (v ? " checked" : "");
    const r = await dialogo(`<h2>Imprimir</h2><p class="dlg-sub">Una sola hoja A4 con el encabezado y los colores del colegio.</p>
      <div class="dlg-rejilla">
        <label class="campo ancho">Título <input name="titulo" maxlength="80" value="${esc(o.titulo)}"></label>
        <label class="campo ancho">Subtítulo <input name="sub" maxlength="120" value="${esc([c?.nombre, S.plano.nombre].filter(Boolean).join(" · "))}"></label>
        <label class="campo">Papel <select name="orient"><option value="h"${sel(o.orient, "h")}>Horizontal (apaisado)</option><option value="v"${sel(o.orient, "v")}>Vertical</option></select></label>
        <label class="campo">Vista <select name="vista"><option value="alumnado"${sel(o.vista, "alumnado")}>Desde el fondo (pizarra arriba)</option><option value="docente"${sel(o.vista, "docente")}>Desde la mesa del docente</option></select></label>
        <label class="campo">Nombre que se ve <select name="nombre">${$("#selNombre").innerHTML.replace(`value="${o.nombre}"`, `value="${o.nombre}" selected`)}</select></label>
        <label class="campo">Profesor/a <input name="profeNombre" maxlength="80" value="${esc(S.user.nombre)}"></label>
        <label class="campo ancho">Observaciones (opcional) <textarea name="obs" rows="2" maxlength="400"></textarea></label>
      </div>
      <div class="opciones">
        <label class="check"><input type="checkbox" name="fecha"${chk(o.fecha)}> Fecha de hoy</label>
        <label class="check"><input type="checkbox" name="tutor"${chk(o.tutor)}> Tutor/a de la clase</label>
        <label class="check"><input type="checkbox" name="profe"${chk(o.profe)}> Profesor/a</label>
        <label class="check"><input type="checkbox" name="sinsitio"${chk(o.sinsitio)}> Lista del alumnado sin sitio</label>
        <label class="check"><input type="checkbox" name="rejilla"${chk(o.rejilla)}> Cuadrícula del suelo (50 cm)</label>
      </div>`, { aceptar: "Imprimir" });
    if (!r) return;
    const n = {
      titulo: r.get("titulo"), orient: r.get("orient"), vista: r.get("vista"), nombre: r.get("nombre"),
      fecha: r.has("fecha"), tutor: r.has("tutor"), profe: r.has("profe"), sinsitio: r.has("sinsitio"), rejilla: r.has("rejilla"),
    };
    LS.set("aula-imprimir", n);
    prepararHoja({ ...n, sub: r.get("sub"), obs: String(r.get("obs") || "").trim(), profeNombre: String(r.get("profeNombre") || "").trim() });
    const img = $("#impresion img");
    await Promise.race([Promise.all([img?.decode?.().catch(() => {}), document.fonts?.ready]), new Promise((ok3) => setTimeout(ok3, 1500))]);
    S.imprimiendo = true; window.print(); S.imprimiendo = false;
  }
  // Si se imprime con Ctrl+P, también sale la hoja corporativa
  window.addEventListener("beforeprint", () => { if (!S.imprimiendo && S.plano) prepararHoja(OPC()); });

  // ─── Teclado ──────────────────────────────────────────────────────────────
  function teclado(e) {
    if (!S.plano || $("#dlg").open || e.target.closest("input, select, textarea")) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); return; }
    if (mod && k === "y") { e.preventDefault(); rehacer(); return; }
    if (e.key === "Escape") { S.sel.clear(); S.alSel = null; render(); return; }
    if (S.modo !== "aula") return;
    if (mod && k === "a") { e.preventDefault(); S.sel = new Set(D().items.map((i) => i.id)); render(); return; }
    if (!S.sel.size) return;
    if (mod && k === "d") { e.preventDefault(); accion("dup"); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); accion("del"); return; }
    if (!mod && k === "r") { accion(e.shiftKey ? "g-15" : "g15"); return; }
    const fl = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (fl) {
      e.preventDefault();
      const paso = (e.shiftKey ? 1 : 5) * (S.vista === "docente" ? -1 : 1);
      cambio((d) => d.items.forEach((i) => { if (S.sel.has(i.id)) { i.x += fl[0] * paso; i.y += fl[1] * paso; } }));
    }
  }

  // ─── Instalar como app (PWA) y aviso sin conexión ─────────────────────────
  (function instalar() {
    const b = $("#instalar");
    if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let aviso = null;
    if (ios) b.hidden = false;
    addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); aviso = e; b.hidden = false; });
    addEventListener("appinstalled", () => { b.hidden = true; });
    b.onclick = async () => {
      if (aviso) { aviso.prompt(); try { await aviso.userChoice; } catch {} aviso = null; b.hidden = true; return; }
      dialogo(`<h2>Instalar la app</h2><ol class="pasos">
        <li>Pulsa el botón <b>Compartir</b> de Safari (el cuadrado con una flecha hacia arriba).</li>
        <li>Elige <b>«Añadir a pantalla de inicio»</b>.</li>
        <li>Pulsa <b>Añadir</b>. Aparecerá el icono del colegio en tu pantalla.</li></ol>`, { aceptar: "Entendido", cancelar: null });
    };
  })();
  const conexion = () => ($("#offline").hidden = navigator.onLine);
  addEventListener("online", conexion); addEventListener("offline", conexion); conexion();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  // ─── Arranque ─────────────────────────────────────────────────────────────
  async function iniciar() {
    $("#demoAviso").hidden = !DEMO;
    $("#btnLogin").onclick = () => remoto.login().catch((e) => ($("#loginError").textContent = e.message));
    try {
      S.user = DEMO ? { email: "prueba@" + CFG.dominio, nombre: "Modo prueba" } : await remoto.sesion();
    } catch (e) { $("#loginError").textContent = e.message; }
    $("#vCargando").hidden = true;
    if (!S.user) { $("#vLogin").hidden = false; $("#btnAcceso").hidden = false; return; }

    $("#usuario").textContent = S.user.nombre;
    $("#sesion").hidden = false;
    $("#btnSalir").hidden = DEMO;
    $("#btnSalir").onclick = () => remoto.logout();

    $("#vCargando").hidden = false;
    let datos;
    try { datos = DEMO ? datosDemo() : await remoto.datos(); }
    catch (e) { $("#vCargando").textContent = "No se ha podido cargar el alumnado: " + (e.message || e); return; }
    for (const m of DEMO ? [] : await remoto.medidas(datos.curso.id).catch(() => [])) S.orientacion.set(m.matricula_id, m.medida);
    S.cursoId = datos.curso.id; S.cursoNombre = /^\d{4}-\d{4}$/.test(datos.curso.nombre) ? datos.curso.nombre : cursoTexto();
    S.clases = [...datos.clases].sort((a, b) => a.orden - b.orden);
    for (const a of datos.alumnos) {
      S.alumnos.set(a.id, a);
      if (!S.porClase.has(a.clase_id)) S.porClase.set(a.clase_id, []);
      S.porClase.get(a.clase_id).push(a);
    }
    for (const l of S.porClase.values()) l.sort((a, b) => a.orden - b.orden || porNombre(a, b));
    // Modo prueba: dos alumnos/as de la primera clase con la medida de Orientación de ubicación cercana
    if (DEMO) for (const a of [4, 9].map((i) => (S.porClase.get(S.clases[0]?.id) || [])[i]).filter(Boolean)) S.orientacion.set(a.id, "Ubicación cercana al profesor/a");

    try { S.planos = await almacen.planos(S.cursoId); }
    catch (e) {
      // Si todavía no se ha creado la tabla en Supabase, se trabaja en el navegador
      console.warn(e); almacen = local; $("#localAviso").hidden = false;
      S.planos = await local.planos(S.cursoId);
    }
    // Modo prueba: la tutora de 1º Primaria A ya tiene su distribución, para ver cómo sale «De la tutoría»
    if (DEMO && !S.planos.some((p) => p.propietario === "carmen.gomez@" + CFG.dominio)) {
      const c = S.clases[0], n = (S.porClase.get(c.id) || []).length, datos = datosNuevos("grupos", undefined, undefined, 4, n);
      sentarPorLista(datos, alumnosPlano({ clase_id: c.id, datos }));
      const p = { id: uid(), curso_id: S.cursoId, clase_id: c.id, nombre: "Grupos del primer trimestre", propietario: "carmen.gomez@" + CFG.dominio,
        propietario_nombre: "Carmen Gómez Ruiz", compartido: false, datos, actualizado: new Date().toISOString() };
      local.poner([...local.todos(), p]); S.planos.push(p);
    }
    $("#vCargando").hidden = true;
    $("#vEditor").hidden = false;

    pintarClases(); prepararPanel(); prepararAula(); prepararLienzo();
    $("#selClase").onchange = (e) => elegirClase(e.target.value);
    $("#selPlano").onchange = async (e) => { await guardarYa(); abrir(S.planos.find((p) => p.id === e.target.value) || null); };
    $("#btnNuevo").onclick = $("#btnNuevo2").onclick = nuevo;
    $("#btnDuplicar").onclick = duplicar;
    $("#btnRenombrar").onclick = renombrar;
    $("#btnCompartir").onclick = compartir;
    $("#btnEliminar").onclick = eliminar;
    $("#btnImprimir").onclick = imprimir;
    $("#soloLectura").onclick = (e) => { if (e.target.closest("[data-dup]")) duplicar(); };
    $("#btnDeshacer").onclick = deshacer; $("#btnRehacer").onclick = rehacer;
    $("#btnMas").onclick = () => zoom(0.25); $("#btnMenos").onclick = () => zoom(-0.25); $("#btnAjustar").onclick = () => zoom(0);
    $("#btnVista").onclick = () => { S.vista = S.vista === "docente" ? "alumnado" : "docente"; LS.set("aula-vista", S.vista); render(); };
    document.addEventListener("keydown", teclado);

    const u = LS.get("aula-ultimo", {});
    const inicial = S.clases.find((c) => c.id == u.clase) || S.clases[0];
    if (!inicial) { $("#vEditor").innerHTML = `<p class="vacio">No hay clases en el curso actual.</p>`; return; }
    elegirClase(inicial.id, u.plano);
  }
  iniciar();
})();
