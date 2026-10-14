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
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2800);
  }
  function fallo(e) { console.error(e); toast("Error: " + (e.message || e)); }

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
    { id: "filas", n: "Filas individuales" },
    { id: "parejas", n: "Parejas" },
    { id: "g4", n: "Grupos de 4" },
    { id: "g6", n: "Grupos de 6" },
    { id: "u", n: "En U" },
    { id: "examen", n: "Examen (separadas)" },
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
  function mesasPlantilla(id, W, H) {
    const y0 = 215;
    const rejilla = (tipo, sx, sy) => { const { cols, filas } = cabe(tipo, sx, sy, W, H, y0); return bloque(tipo, filas, cols, sx, sy, W, y0); };
    switch (id) {
      case "filas": return rejilla("ind", 45, 60);
      case "parejas": return rejilla("doble", 60, 60);
      case "g4": return rejilla("g4", 80, 70);
      case "g6": return rejilla("g6", 80, 70);
      case "examen": return rejilla("ind", 95, 85);
      case "u": {
        const out = [];
        for (let y = 265; y + 65 <= H - 175; y += 135) {
          out.push({ id: uid(), t: "doble", x: 75, y, r: 90 });
          out.push({ id: uid(), t: "doble", x: W - 75, y, r: -90 });
        }
        const n = Math.max(1, Math.floor((W - 330) / 135)), x0 = (W - (n * 130 + (n - 1) * 5)) / 2 + 65;
        for (let i = 0; i < n; i++) out.push({ id: uid(), t: "doble", x: ajusta(x0 + i * 135), y: H - 95, r: 0 });
        return out;
      }
      default: return [];
    }
  }
  function datosNuevos(plantilla, W = CFG.aula?.ancho || 800, H = CFG.aula?.fondo || 700) {
    return { ancho: W, fondo: H, items: [...basicos(W, H), ...mesasPlantilla(plantilla, W, H)], asientos: {}, fijos: [], noJuntos: [], extra: [], excluidos: [] };
  }

  // ─── Estado ──────────────────────────────────────────────────────────────
  const S = {
    user: null, cursoId: null, cursoNombre: cursoTexto(), clases: [], alumnos: new Map(), porClase: new Map(),
    planos: [], claseId: null, plano: null, modo: "alumnado", sel: new Set(), alSel: null,
    hist: [], fut: [], zoom: 1, arrastre: null, marco: null,
    vista: LS.get("aula-vista", "alumnado"), nombre: LS.get("aula-nombre", "n1"),
  };
  const D = () => S.plano?.datos;
  const esMio = (p) => p && p.propietario === S.user.email;
  const editable = () => esMio(S.plano);
  const claseDe = (id) => S.clases.find((c) => c.id == id);

  // ─── Datos: Supabase (alumnado de Control de baños) o modo prueba ─────────
  const sb = DEMO ? null : supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const ok = (r) => { if (r.error) throw r.error; return r.data; };
  const TABLA = "aul_planos";

  const remoto = {
    async sesion() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      const u = session.user, email = (u.email || "").toLowerCase();
      if (!email.endsWith("@" + CFG.dominio)) {
        await sb.auth.signOut();
        throw new Error(`Solo se permite el acceso con cuentas @${CFG.dominio}.`);
      }
      return { email, nombre: u.user_metadata?.full_name || u.user_metadata?.name || email };
    },
    async login() {
      ok(await sb.auth.signInWithOAuth({ provider: "azure", options: { scopes: "email profile", redirectTo: location.origin + location.pathname } }));
    },
    async logout() { await sb.auth.signOut(); location.reload(); },
    async datos() {
      const cursos = ok(await sb.from("cursos").select("id,nombre,activo").order("nombre"));
      const curso = cursos.find((c) => c.activo) || cursos[cursos.length - 1];
      if (!curso) throw new Error("Todavía no hay ningún curso con alumnado.");
      const clases = ok(await sb.from("clases").select("id,nombre,tutor,orden").eq("curso_id", curso.id).order("orden"));
      const ids = clases.map((c) => c.id), alumnos = [];
      for (let i = 0; ids.length; i += 1000) {
        const d = ok(await sb.from("alumnos").select("id,clase_id,nombre,orden").eq("activo", true).in("clase_id", ids).order("id").range(i, i + 999));
        alumnos.push(...d); if (d.length < 1000) break;
      }
      // Primaria (y otras etapas que no usa Control de baños): tablas propias de esta web
      try {
        const extra = ok(await sb.from("aul_clases").select("id,etapa,nombre,tutor,orden").eq("curso_id", curso.id).order("orden"));
        const eids = extra.map((c) => c.id);
        for (let i = 0; eids.length; i += 1000) {
          const d = ok(await sb.from("aul_alumnos").select("id,clase_id,nombre,orden").eq("activo", true).in("clase_id", eids).order("id").range(i, i + 999));
          alumnos.push(...d); if (d.length < 1000) break;
        }
        clases.push(...extra);
      } catch (e) { console.warn("Sin tablas de Primaria todavía", e); }
      return { curso, clases, alumnos };
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
      clases.push({ id: i + 1, nombre: g, tutor: `${uno(AP)} ${uno(AP)}, ${uno(NOM)}`, orden: i });
      const n = 22 + Math.floor(azar() * 8), lista = [];
      for (let j = 0; j < n; j++) lista.push(`${uno(AP)} ${uno(AP)}, ${uno(NOM)}`);
      lista.sort((a, b) => a.localeCompare(b, "es")).forEach((nombre, j) => alumnos.push({ id: id++, clase_id: i + 1, nombre, orden: j }));
    });
    return { curso, clases, alumnos };
  }

  // ─── Diálogos ────────────────────────────────────────────────────────────
  function dialogo(html, { aceptar = "Aceptar", cancelar = "Cancelar", peligro = false, alAbrir } = {}) {
    const dlg = $("#dlg"), f = $("#dlgForm");
    f.innerHTML = html + `<div class="dlg-botones">${cancelar ? `<button class="btn" value="no" formnovalidate>${cancelar}</button>` : ""}<button class="btn ${peligro ? "aviso" : "primario"}" value="si">${aceptar}</button></div>`;
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
      const donde = new Map(Object.entries(as).map(([k, v]) => [v, k]));
      let mal = 0;
      for (const [a, b] of d.noJuntos) { const ka = donde.get(a), kb = donde.get(b); if (ka && kb && cerca(ka, kb)) mal++; }
      if (mal < mejorMal) { mejor = as; mejorMal = mal; }
    }
    d.asientos = mejor || base;
    return mejorMal;
  }

  // ─── Dibujo del plano (SVG; se usa en pantalla y al imprimir) ─────────────
  function textoAjustado(x, y, lineas, ancho) {
    const tam = lineas.length > 1 ? [14, 11.5] : [14.5];
    const ys = lineas.length > 1 ? [y - 7.5, y + 9] : [y];
    return lineas.map((l, i) => {
      const est = l.length * tam[i] * 0.54;
      const aj = est > ancho ? ` textLength="${ancho}" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text class="et${i === 0 ? " n1" : ""}" x="${r1(x)}" y="${r1(ys[i])}" font-size="${tam[i]}"${aj}>${esc(l)}</text>`;
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
    let et = "";
    for (const it of d.items) {
      const t = T[it.t];
      if (t.p) {
        const rr = (((it.r || 0) % 180) + 180) % 180, ancho = (rr > 45 && rr < 135 ? 46 : t.sw) - 7;
        t.p.forEach(([px, py], i) => {
          const al = d.asientos[it.id + ":" + i]; if (al == null) return;
          const a = S.alumnos.get(al); if (!a) return;
          const [x, y] = V(aMundo(it, px, py));
          et += textoAjustado(x, y, etiqueta(a, modo, rep), ancho);
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
    $("#btnCompartir").classList.toggle("activo", !!S.plano.compartido);
    $("#btnCompartir").textContent = S.plano.compartido ? "Compartida ✓" : "Compartir";
    $("#soloLectura").hidden = mio;
    if (!mio) $("#soloLectura").innerHTML = `Distribución de <strong>${esc(S.plano.propietario_nombre || S.plano.propietario)}</strong>, compartida con el claustro. Puedes verla e imprimirla; para cambiarla, <button class="btn mini primario" type="button" data-dup>Duplicar</button>`;
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
    const extra = new Set(d.extra);
    const chip = (a, sentadoYa) => `<span class="al${S.alSel === a.id ? " elegido" : ""}${fijos.has(a.id) ? " fijo" : ""}" data-al="${a.id}" title="${esc(nombreLista(a))}${extra.has(a.id) ? " · " + esc(claseDe(a.clase_id)?.nombre || "") : ""}">
      <span class="nm">${esc(nombreLista(a))}</span>${sentadoYa ? `<button type="button" data-fijar class="${fijos.has(a.id) ? "on" : ""}" title="${fijos.has(a.id) ? "Quitar fijación" : "Fijar en su sitio (no se mueve al sentar al azar ni por lista)"}">${PIN}</button><button type="button" data-levantar title="Dejar sin sitio">↥</button>` : ""}<button type="button" data-excluir title="${extra.has(a.id) ? "Quitar de esta distribución" : "No está en este grupo (desdobles, optativas…)"}">✕</button></span>`;
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
    $("#selNombre").value = S.nombre;
    $("#inAncho").value = d.ancho / 100; $("#inFondo").value = d.fondo / 100;
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
        (t.p ? `<label class="campo">Tipo de mesa <select data-prop="t">${Object.entries(MESAS).map(([k, m]) => `<option value="${k}"${k === it.t ? " selected" : ""}>${m.n} (${m.p.length})</option>`).join("")}</select></label>`
          : `<div class="fila"><label class="campo">Largo (cm) <input data-prop="w" type="number" min="10" max="2000" step="5" value="${w}"></label><label class="campo">Ancho (cm) <input data-prop="h" type="number" min="4" max="2000" step="5" value="${h}"></label></div>`) +
        (it.t === "texto" ? `<label class="campo">Texto <input data-prop="texto" value="${esc(it.texto || "")}" placeholder="Escribe el rótulo"></label>` : "") + fin;
    } else {
      el.innerHTML = `<h3>${its.length} elementos seleccionados</h3>${giros}
        <div class="grupo-btn"><button class="btn mini" data-acc="alH" type="button">Alinear en fila</button><button class="btn mini" data-acc="alV" type="button">Alinear en columna</button></div>
        <div class="grupo-btn"><button class="btn mini" data-acc="repH" type="button">Repartir ↔</button><button class="btn mini" data-acc="repV" type="button">Repartir ↕</button></div>${fin}`;
    }
  }

  // ─── Acciones sobre el mobiliario ─────────────────────────────────────────
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
      if (a.tipo === "mover" && a.movido) {
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
      <p class="dlg-sub">Al pulsar «Sentar al azar», estas parejas no quedan en la misma mesa ni en mesas pegadas.</p>
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
    $("#paletaMesas").innerHTML = Object.entries(MESAS).map(([k, t]) => `<button type="button" data-add="${k}">${icono(k)}${t.n}</button>`).join("");
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
        if (p === "t" || p === "texto") it[p] = e.target.value;
        else { const v = Math.round(+e.target.value); if (v > 0) it[p] = v; }
      });
    });
    $("#btnBloque").onclick = bloqueMesas;
    $("#btnPlantilla").onclick = cambiarPlantilla;
  }

  async function bloqueMesas() {
    if (!editable()) return avisoLectura();
    const d = D();
    const r = await dialogo(`<h2>Bloque de mesas</h2><p class="dlg-sub">Crea varias filas iguales de una vez. Después puedes moverlas como un bloque.</p>
      <div class="dlg-rejilla">
        <label class="campo ancho">Tipo de mesa <select name="tipo">${Object.entries(MESAS).map(([k, m]) => `<option value="${k}">${m.n}</option>`).join("")}</select></label>
        <label class="campo">Filas <input name="filas" type="number" min="1" max="20" value="4"></label>
        <label class="campo">Columnas <input name="cols" type="number" min="1" max="20" value="4"></label>
        <label class="campo">Separación entre columnas (cm) <input name="sx" type="number" min="0" max="400" step="5" value="50"></label>
        <label class="campo">Separación entre filas (cm) <input name="sy" type="number" min="0" max="400" step="5" value="60"></label>
      </div>
      <div class="opciones"><label class="check"><input type="checkbox" name="sust"> Quitar antes las mesas que hay</label></div>`, { aceptar: "Crear" });
    if (!r) return;
    const nuevos = bloque(r.get("tipo"), +r.get("filas") || 1, +r.get("cols") || 1, +r.get("sx") || 0, +r.get("sy") || 0, d.ancho, 215);
    if (cambio((d) => { if (r.get("sust")) d.items = d.items.filter((i) => !T[i.t].p); d.items.push(...nuevos); })) {
      S.sel = new Set(nuevos.map((i) => i.id)); render();
    }
  }
  function opcionesPlantilla(sel = "parejas") {
    return `<div class="plantillas">${PLANTILLAS.map((p) => `<label><input type="radio" name="pl" value="${p.id}"${p.id === sel ? " checked" : ""}>${miniatura(datosNuevos(p.id))}${p.n}</label>`).join("")}</div>`;
  }
  async function cambiarPlantilla() {
    if (!editable()) return avisoLectura();
    const r = await dialogo(`<h2>Cambiar las mesas por una plantilla</h2>
      <p class="dlg-sub">Se sustituyen solo las mesas del alumnado; el resto del mobiliario se queda. Quien tenía sitio se vuelve a sentar en el mismo orden.</p>
      ${opcionesPlantilla()}`, { aceptar: "Cambiar" });
    if (!r) return;
    cambio((d) => {
      const orden = ordenados(d).map((p) => d.asientos[p.k]).filter((x) => x != null);
      d.items = [...d.items.filter((i) => !T[i.t].p), ...mesasPlantilla(r.get("pl"), d.ancho, d.fondo)];
      d.asientos = {}; d.fijos = [];
      ordenados(d).forEach((p, i) => { if (orden[i] != null) d.asientos[p.k] = orden[i]; });
    });
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
    .sort((a, b) => (esMio(b) - esMio(a)) || a.nombre.localeCompare(b.nombre, "es"));
  function pintarPlanos() {
    const ps = planosClase(), mios = ps.filter(esMio), otros = ps.filter((p) => !esMio(p));
    const op = (p) => `<option value="${p.id}">${esc(p.nombre)}${esMio(p) && p.compartido ? " (compartida)" : ""}${!esMio(p) ? " · " + esc(p.propietario_nombre || p.propietario) : ""}</option>`;
    $("#selPlano").innerHTML = !ps.length ? `<option value="">— Ninguna todavía —</option>`
      : (mios.length ? `<optgroup label="Mis distribuciones">${mios.map(op).join("")}</optgroup>` : "") +
        (otros.length ? `<optgroup label="Compartidas por el claustro">${otros.map(op).join("")}</optgroup>` : "");
    $("#selPlano").value = S.plano?.id || "";
  }
  async function elegirClase(id, planoId) {
    await guardarYa();
    S.claseId = +id || id; $("#selClase").value = id;
    const ps = planosClase();
    const p = ps.find((x) => x.id === planoId) || ps.find(esMio) || ps[0] || null;
    abrir(p);
  }
  function abrir(p) {
    S.plano = p; S.sel.clear(); S.alSel = null; S.hist = []; S.fut = [];
    if (p) {
      const d = p.datos || (p.datos = datosNuevos("vacia"));
      for (const [k, v] of Object.entries({ items: [], asientos: {}, fijos: [], noJuntos: [], extra: [], excluidos: [] })) if (!d[k]) d[k] = v;
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
    const r = await dialogo(`<h2>Nueva distribución</h2><p class="dlg-sub">${esc(c?.nombre || "")}</p>
      <label class="campo">Nombre <input name="nombre" required maxlength="80" value="${n ? "Propuesta " + (n + 1) : "Distribución principal"}"></label>
      <h3 style="font-size:13px;color:var(--suave);margin:14px 0 0">Plantilla de partida</h3>
      ${opcionesPlantilla()}
      <label class="check"><input type="checkbox" name="sentar" checked> Sentar ya al alumnado por orden de lista</label>`, { aceptar: "Crear" });
    if (!r) return;
    const datos = datosNuevos(r.get("pl"));
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
      <div class="franja"><i></i><i></i><i></i></div>
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

  // ─── Arranque ─────────────────────────────────────────────────────────────
  async function iniciar() {
    $("#demoAviso").hidden = !DEMO;
    $("#btnLogin").onclick = () => remoto.login().catch((e) => ($("#loginError").textContent = e.message));
    try {
      S.user = DEMO ? { email: "prueba@" + CFG.dominio, nombre: "Modo prueba" } : await remoto.sesion();
    } catch (e) { $("#loginError").textContent = e.message; }
    $("#vCargando").hidden = true;
    if (!S.user) { document.body.classList.add("sin-sesion"); $("#vLogin").hidden = false; return; }

    $("#usuario").innerHTML = `<span>${esc(S.user.nombre)}</span>` + (DEMO ? "" : `<a href="#" id="btnSalir">Salir</a>`);
    $("#btnSalir")?.addEventListener("click", (e) => { e.preventDefault(); remoto.logout(); });

    $("#vCargando").hidden = false;
    let datos;
    try { datos = DEMO ? datosDemo() : await remoto.datos(); }
    catch (e) { $("#vCargando").textContent = "No se ha podido cargar el alumnado: " + (e.message || e); return; }
    S.cursoId = datos.curso.id; S.cursoNombre = /^\d{4}-\d{4}$/.test(datos.curso.nombre) ? datos.curso.nombre : cursoTexto();
    S.clases = [...datos.clases].sort((a, b) => a.orden - b.orden);
    for (const a of datos.alumnos) {
      S.alumnos.set(a.id, a);
      if (!S.porClase.has(a.clase_id)) S.porClase.set(a.clase_id, []);
      S.porClase.get(a.clase_id).push(a);
    }
    for (const l of S.porClase.values()) l.sort((a, b) => a.orden - b.orden || porNombre(a, b));

    try { S.planos = await almacen.planos(S.cursoId); }
    catch (e) {
      // Si todavía no se ha creado la tabla en Supabase, se trabaja en el navegador
      console.warn(e); almacen = local; $("#localAviso").hidden = false;
      S.planos = await local.planos(S.cursoId);
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
