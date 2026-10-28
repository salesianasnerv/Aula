// Sondeo de clase: página del alumnado (sin cuenta). Entra con el código o el QR que pone su profesor/a,
// elige su nombre (y su clave, si el sondeo la pide), contesta y envía. No puede leer nada de nadie.
(() => {
  "use strict";
  const CFG = window.APP_CONFIG;
  const qs = new URLSearchParams(location.search);
  const DEMO = !CFG.supabaseUrl || qs.has("demo");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r1 = (v) => Math.round(v * 10) / 10;
  const limpiarCodigo = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };
  const SS = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
    quitar(k) { try { sessionStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
  };
  function toast(msg, tipo = "ok", ms = 3500) {
    const el = document.createElement("div");
    el.className = "toast" + (tipo === "error" ? " error" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // ─── Datos: Supabase (funciones públicas del sondeo) o modo prueba (lo que guarda la web del profesorado
  //     en este mismo navegador con ?demo) ────────────────────────────────────────────────────────────────
  const sb = DEMO ? null : supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: false } });
  const ok = (r) => { if (r.error) throw r.error; return r.data; };
  const remoto = {
    async ver(c) { return ok(await sb.rpc("aul_sondeo_ver", { p_codigo: c })); },
    async entrar(c, al, clave) { return ok(await sb.rpc("aul_sondeo_entrar", { p_codigo: c, p_alumno: al, p_clave: clave || null })); },
    async responder(c, al, clave, r) {
      return ok(await sb.rpc("aul_sondeo_responder", { p_codigo: c, p_alumno: al, p_clave: clave || null, p_si: r.si, p_no: r.no, p_plano: r.plano, p_mensaje: r.mensaje }));
    },
  };
  // Modo prueba: mismas comprobaciones que las funciones de Supabase (supabase/sondeos.sql)
  const demo = {
    sondeo(c) {
      const s = LS.get("aula-sondeos-demo", []).find((x) => x.codigo === c);
      return s && !s.cerrado && (!s.abierto_hasta || new Date(s.abierto_hasta) > new Date()) ? s : null;
    },
    resp() { return LS.get("aula-sondeos-demo-resp", []); },
    async ver(c) {
      const s = this.sondeo(c); if (!s) return null;
      const hechos = new Set(this.resp().filter((r) => r.sondeo_id === s.id).map((r) => r.alumno_id));
      const cortos = s._alumnos.map((a) => corto(a.nombre)), rep = (n) => cortos.filter((x) => x === n).length > 1;
      return { nombre: s.nombre, profesor: s.creador_nombre, clase: s._clase, preguntas: s.preguntas, max_si: s.max_si, max_no: s.max_no,
        identificacion: s.identificacion, disposiciones: s.disposiciones,
        alumnos: s._alumnos.map((a) => ({ id: a.id, nombre: rep(corto(a.nombre)) ? corto(a.nombre, true) : corto(a.nombre), hecho: hechos.has(a.id) }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) };
    },
    async entrar(c, al, clave) {
      const s = this.sondeo(c); if (!s) return "cerrado";
      if (!s._alumnos.some((a) => a.id === al)) return "no_esta";
      if (this.resp().some((r) => r.sondeo_id === s.id && r.alumno_id === al)) return "ya";
      if (s.identificacion === "clave" && LS.get("aula-claves-demo", {})[al] !== String(clave || "").trim()) return "clave";
      return "ok";
    },
    async responder(c, al, clave, r) {
      const e = await this.entrar(c, al, clave); if (e !== "ok") return e;
      const s = this.sondeo(c);
      LS.set("aula-sondeos-demo-resp", [...this.resp(), { id: Date.now(), sondeo_id: s.id, alumno_id: al, si: r.si, no: r.no, plano: r.plano, mensaje: r.mensaje, creado: new Date().toISOString() }]);
      return "ok";
    },
  };
  const api = DEMO ? demo : remoto;
  // «García López, Lucía» → «Lucía G.» (o «Lucía García» si se repite en la clase). Igual que aul_nombre_corto().
  function corto(n, largo = false) {
    const i = n.indexOf(",");
    const nom = i < 0 ? n.trim().split(/\s+/)[0] : n.slice(i + 1).trim();
    let ape = i < 0 ? n.trim().split(/\s+/).slice(1).join(" ") : n.slice(0, i).trim();
    ape = ape.replace(/^((de|del|la|las|los|y|san|da|do|dos|van|von)\s+)+/i, "");
    return (nom + " " + (!ape ? "" : largo ? ape.split(" ")[0] : ape[0] + ".")).trim();
  }

  // ─── Estado ───────────────────────────────────────────────────────────────
  const MENSAJES = {
    cerrado: "Este sondeo ya está cerrado o el código no es correcto. Revisa el código o pregunta a tu profesor/a.",
    no_esta: "Ese nombre no está en la lista de esta clase.",
    ya: "Ya hay una respuesta con ese nombre. Si no la has enviado tú, díselo a tu profesor/a.",
    clave: "La clave no es correcta. Revisa tu tarjeta o pídesela a tu profesor/a.",
    bloqueado: "Se ha escrito mal la clave demasiadas veces. Pide a tu profesor/a una clave nueva.",
    datos: "Algo no está bien en las respuestas. Revísalas y vuelve a enviar.",
  };
  const E = { codigo: limpiarCodigo(qs.get("c")), s: null, paso: "codigo", yo: null, clave: "", si: [], no: [], disp: null, asientos: {}, mensaje: "", tocado: null, enviando: false };
  const nombreDe = (id) => E.s?.alumnos.find((a) => a.id === id)?.nombre || "";
  const disp = () => E.s.disposiciones.find((d) => d.id === E.disp) || E.s.disposiciones[0];
  const clave = () => "sondeo-borrador-" + E.codigo;
  const guardarBorrador = () => { if (E.yo != null) SS.set(clave(), { paso: E.paso, yo: E.yo, clave: E.clave, si: E.si, no: E.no, disp: E.disp, asientos: E.asientos, mensaje: E.mensaje }); };

  function pasos() {
    const p = E.s?.preguntas || {};
    return ["codigo", "nombre", ...(E.s?.identificacion === "clave" ? ["clave"] : []), "aviso",
      ...(p.si ? ["si"] : []), ...(p.no ? ["no"] : []), ...(p.plano && E.s?.disposiciones?.length ? ["plano"] : []), ...(p.msg ? ["msg"] : []), "fin"];
  }
  function ir(p) { E.paso = p; document.getElementById("toasts").textContent = ""; guardarBorrador(); pintar(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const siguiente = () => { const ps = pasos(); ir(ps[Math.min(ps.indexOf(E.paso) + 1, ps.length - 1)]); };
  const anterior = () => { const ps = pasos(); ir(ps[Math.max(ps.indexOf(E.paso) - 1, 0)]); };

  // ─── Pintar ───────────────────────────────────────────────────────────────
  function pintar() {
    const c = $("#son"), ps = pasos(), i = ps.indexOf(E.paso);
    const prog = E.paso !== "codigo" && E.paso !== "gracias"
      ? `<div class="son-prog" aria-label="Paso ${i} de ${ps.length - 1}">${ps.slice(1).map((_, k) => `<i class="${k < i ? "on" : ""}"></i>`).join("")}</div>` : "";
    const pie = (sig = "Siguiente", ok2 = true, atras = true) => `<div class="son-pie">${atras ? `<button class="btn" type="button" data-atras>Atrás</button>` : ""}<button class="btn pri" type="button" data-sig${ok2 ? "" : " disabled"}>${sig}</button></div>`;
    const tit = E.s ? `<p class="son-clase">${esc(E.s.clase || "")} · ${esc(E.s.nombre)}</p>` : "";
    const otros = () => E.s.alumnos.filter((a) => a.id !== E.yo);
    let h = "";
    switch (E.paso) {
      case "codigo":
        h = `<h1>Sondeo de clase</h1><p>Escribe el código que ves en la pizarra.</p>
          <label class="son-codigo-l" for="inCodigo">Código</label>
          <input class="son-codigo" id="inCodigo" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(E.codigo)}" placeholder="ABC123">
          ${pie("Entrar", true, false)}`;
        break;
      case "nombre":
        h = `${prog}${tit}<h1>¿Quién eres?</h1><p>Elige tu nombre.</p>
          <div class="son-nombres">${E.s.alumnos.map((a) => `<button class="son-chip${a.id === E.yo ? " yo" : ""}" type="button" data-yo="${a.id}"${a.hecho ? " disabled" : ""}>${esc(a.nombre)}${a.hecho ? "<small>Ya ha contestado</small>" : ""}</button>`).join("")}</div>
          ${pie("Siguiente", false)}`;
        break;
      case "clave":
        h = `${prog}${tit}<h1>Tu clave</h1><p>Escribe la clave de 4 cifras de tu tarjeta.</p>
          <input class="son-codigo" id="inClave" maxlength="4" inputmode="numeric" autocomplete="off" value="${esc(E.clave)}" aria-label="Clave personal">
          <p class="son-nota">¿No tienes tu tarjeta? Pídesela a tu profesor/a.</p>${pie("Entrar")}`;
        break;
      case "aviso": {
        const nom = nombreDe(E.yo).split(" ")[0];
        h = `${prog}${tit}<h1>Hola, ${esc(nom)}</h1><p>Tu profesor/a quiere organizar la clase teniendo en cuenta tu opinión.</p>
          <div class="son-aviso"><b>Antes de empezar</b><ul>
            <li>Tus respuestas solo las ven ${E.s.profesor ? esc(E.s.profesor) + ", que ha abierto el sondeo," : "quien ha abierto el sondeo"} y el tutor/a de tu grupo.</li>
            <li>Nadie de tu clase las verá.</li>
            <li>Es una ayuda para decidir: al final decide el profesorado y no siempre se podrá cumplir todo.</li>
            <li>Se borran al acabar el curso (31 de agosto).</li></ul></div>${pie("Empezar")}`;
        break;
      }
      case "si":
        h = `${prog}${tit}<h1>¿Con quién te gustaría sentarte?</h1><p>Elige hasta ${E.s.max_si} compañeros/as con quienes trabajas bien.</p>
          <div class="son-nombres">${otros().map((a) => `<button class="son-chip si" type="button" data-si="${a.id}" aria-pressed="${E.si.includes(a.id)}"${E.no.includes(a.id) ? " disabled" : ""}>${esc(a.nombre)}</button>`).join("")}</div>
          <p class="son-nota">${E.si.length} de ${E.s.max_si} elegidos</p>${pie("Siguiente", E.si.length > 0)}`;
        break;
      case "no":
        h = `${prog}${tit}<h1>¿Con quién preferirías no sentarte?</h1><p>Hasta ${E.s.max_no}. Solo si de verdad te cuesta trabajar al lado de alguien. Puedes dejarlo en blanco.</p>
          <div class="son-nombres">${otros().map((a) => `<button class="son-chip no" type="button" data-no="${a.id}" aria-pressed="${E.no.includes(a.id)}"${E.si.includes(a.id) ? " disabled" : ""}>${esc(a.nombre)}</button>`).join("")}</div>
          <p class="son-nota">${E.no.length} de ${E.s.max_no} · Esto no lo verá nadie de tu clase.</p>${pie(E.no.length ? "Siguiente" : "Prefiero no elegir a nadie")}`;
        break;
      case "plano": {
        const d = disp(), puestos = Object.keys(E.asientos).length, colocados = new Set(Object.values(E.asientos));
        const sin = E.s.alumnos.filter((a) => !colocados.has(a.id));
        h = `${prog}${tit}<h1>¿Cómo colocarías la clase?</h1><p>Opcional. Toca un nombre y después una silla. Toca una silla ocupada para dejarla libre.</p>
          ${E.s.disposiciones.length > 1 ? `<div class="son-disp"><span>Elige cómo quieres las mesas:</span><div>${E.s.disposiciones.map((x) => `<button class="son-chip yo" type="button" data-disp="${esc(x.id)}" aria-pressed="${x.id === d.id}">${esc(x.n)}</button>`).join("")}</div></div>`
            : `<p class="son-nota">Mesas: <b>${esc(d.n)}</b>.</p>`}
          <div class="son-plano">${svg(d)}</div>
          <div class="son-nombres son-sin">${sin.map((a) => `<button class="son-chip yo" type="button" data-t="${a.id}" aria-pressed="${E.tocado === a.id}">${esc(a.nombre)}</button>`).join("") || `<p class="son-nota">Ya has colocado a toda la clase.</p>`}</div>
          <p class="son-nota">${puestos} de ${E.s.alumnos.length} colocados${puestos ? ` · <button class="son-enlace" type="button" id="btnVaciar">Empezar de nuevo</button>` : " · puedes saltar este paso"}</p>
          ${pie(puestos ? "Siguiente" : "Saltar")}`;
        break;
      }
      case "msg":
        h = `${prog}${tit}<h1>¿Algo más?</h1><p>Si quieres contarle algo a tu profesor/a sobre dónde sentarte (ves mal de lejos, te distraes en la ventana…). Opcional.</p>
          <textarea id="inMsg" rows="5" maxlength="300" class="son-texto">${esc(E.mensaje)}</textarea>
          <p class="son-nota">No escribas datos de salud ni cosas de otras personas.</p>${pie()}`;
        break;
      case "fin": {
        const p = E.s.preguntas, lista = (ids) => ids.map(nombreDe).map(esc).join(", ");
        h = `${prog}${tit}<h1>Revisa y envía</h1><dl class="son-resumen">
          ${p.si ? `<dt>Me gustaría sentarme con</dt><dd>${lista(E.si) || "—"}</dd>` : ""}
          ${p.no ? `<dt>Preferiría no sentarme con</dt><dd>${lista(E.no) || "nadie"}</dd>` : ""}
          ${p.plano && E.s.disposiciones?.length ? `<dt>Mi propuesta de clase</dt><dd>${Object.keys(E.asientos).length ? Object.keys(E.asientos).length + " colocados · " + esc(disp().n) : "no he hecho"}</dd>` : ""}
          ${p.msg ? `<dt>Mensaje</dt><dd>${E.mensaje.trim() ? esc(E.mensaje.trim()) : "—"}</dd>` : ""}</dl>
          <p class="son-nota">Cuando lo envíes ya no podrás cambiarlo.</p>${pie(E.enviando ? "Enviando…" : "Enviar", !E.enviando)}`;
        break;
      }
      case "gracias":
        h = `<h1>¡Gracias, ${esc(nombreDe(E.yo).split(" ")[0])}!</h1><p>Tus respuestas se han enviado. Ya puedes cerrar esta página.</p>
          <div class="son-aviso">Si te has equivocado en algo, díselo a tu profesor/a.</div>`;
        break;
    }
    c.innerHTML = h;
    eventos(c);
  }

  // Plano de la disposición elegida (en centímetros, como en la web del profesorado; la pizarra arriba)
  function svg(d) {
    let g = `<rect class="son-suelo" x="0" y="0" width="${d.ancho}" height="${d.fondo}"/>`;
    const caja = (o, cls) => `<rect class="${cls}" x="${r1(-o.w / 2)}" y="${r1(-o.h / 2)}" width="${r1(o.w)}" height="${r1(o.h)}" rx="3" transform="translate(${r1(o.x)} ${r1(o.y)}) rotate(${o.r || 0})"/>`;
    for (const m of d.muebles || []) {
      g += caja(m, "son-mueble " + m.t);
      if (m.et) g += `<text class="son-mtxt" x="${r1(m.x)}" y="${r1(m.y + (m.h < 20 ? 26 : 5))}">${esc(m.et)}</text>`;
    }
    for (const m of d.mesas) g += caja(m, "son-mesa");
    const fs = Math.max(10, Math.min(15, Math.min(...d.puestos.map((p) => p.w)) / 5));
    for (const p of d.puestos) {
      const al = E.asientos[p.k], cls = ["son-puesto", al != null ? "ocup" : "", al != null && al === E.yo ? "mio" : ""].join(" ");
      g += `<g class="${cls}" data-k="${esc(p.k)}" role="button" tabindex="0" aria-label="${al != null ? esc(nombreDe(al)) : "Silla libre"}">${caja({ ...p, w: p.w - 4, h: p.h - 4 }, "son-silla")}`;
      if (al != null) {
        const [a, b] = nombreDe(al).split(/ (.+)/);
        g += `<text class="son-nom" x="${r1(p.x)}" y="${r1(p.y - (b ? fs * 0.15 : -fs * 0.35))}" font-size="${r1(fs)}">${esc(a)}</text>`;
        if (b) g += `<text class="son-nom" x="${r1(p.x)}" y="${r1(p.y + fs * 0.95)}" font-size="${r1(fs * 0.9)}">${esc(b)}</text>`;
      }
      g += `</g>`;
    }
    return `<svg viewBox="-15 -15 ${d.ancho + 30} ${d.fondo + 30}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano del aula">${g}</svg>`;
  }

  function eventos(c) {
    const sig = $("[data-sig]", c), atr = $("[data-atras]", c);
    if (atr) atr.onclick = anterior;
    switch (E.paso) {
      case "codigo": {
        const inp = $("#inCodigo");
        inp.oninput = () => { inp.value = limpiarCodigo(inp.value); E.codigo = inp.value; };
        inp.onkeydown = (e) => { if (e.key === "Enter") sig.click(); };
        sig.onclick = cargar;
        if (!E.codigo) inp.focus();
        break;
      }
      case "nombre":
        $$("[data-yo]", c).forEach((b) => (b.onclick = async () => {
          const id = +b.dataset.yo;
          if (E.yo !== id) { E.yo = id; E.si = []; E.no = []; E.asientos = {}; E.mensaje = ""; E.clave = ""; }
          if (E.s.identificacion === "clave") return siguiente();
          const r = await api.entrar(E.codigo, id, null).catch(() => "red");
          if (r === "ok") siguiente(); else toast(MENSAJES[r] || "No hay conexión. Inténtalo de nuevo.", "error", 6000);
        }));
        break;
      case "clave": {
        const inp = $("#inClave");
        inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 4); E.clave = inp.value; };
        inp.onkeydown = (e) => { if (e.key === "Enter") sig.click(); };
        inp.focus();
        sig.onclick = async () => {
          if (E.clave.length !== 4) return toast("La clave tiene 4 cifras.", "error");
          const r = await api.entrar(E.codigo, E.yo, E.clave).catch(() => "red");
          if (r === "ok") siguiente(); else toast(MENSAJES[r] || "No hay conexión. Inténtalo de nuevo.", "error", 6000);
        };
        break;
      }
      case "si": case "no": {
        const lista = E[E.paso], max = E.s["max_" + E.paso];
        $$(`[data-${E.paso}]`, c).forEach((b) => (b.onclick = () => {
          const id = +b.dataset[E.paso], k = lista.indexOf(id);
          if (k >= 0) lista.splice(k, 1); else if (lista.length < max) lista.push(id); else return toast(`Puedes elegir hasta ${max}.`);
          guardarBorrador(); pintar();
        }));
        sig.onclick = siguiente;
        break;
      }
      case "plano":
        $$("[data-disp]", c).forEach((b) => (b.onclick = () => {
          if (b.dataset.disp === disp().id) return;
          E.disp = b.dataset.disp; E.asientos = {}; E.tocado = null; guardarBorrador(); pintar();
        }));
        $$("[data-t]", c).forEach((b) => (b.onclick = () => { E.tocado = E.tocado === +b.dataset.t ? null : +b.dataset.t; pintar(); }));
        $$(".son-puesto", c).forEach((g) => {
          const tocar = () => {
            const k = g.dataset.k;
            if (E.tocado != null) { E.asientos[k] = E.tocado; E.tocado = null; }
            else if (E.asientos[k] != null) delete E.asientos[k];
            else return toast("Primero toca un nombre de la lista.");
            guardarBorrador(); pintar();
          };
          g.onclick = tocar;
          g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tocar(); } };
        });
        if ($("#btnVaciar")) $("#btnVaciar").onclick = () => { E.asientos = {}; E.tocado = null; guardarBorrador(); pintar(); };
        sig.onclick = siguiente;
        break;
      case "msg":
        $("#inMsg").oninput = (e) => { E.mensaje = e.target.value; guardarBorrador(); };
        sig.onclick = siguiente;
        break;
      case "aviso":
        sig.onclick = siguiente;
        break;
      case "fin":
        sig.onclick = enviar;
        break;
    }
  }

  async function cargar() {
    E.codigo = limpiarCodigo(E.codigo);
    if (E.codigo.length !== 6) return toast("El código tiene 6 letras o números.", "error");
    let s;
    try { s = await api.ver(E.codigo); } catch (e) { console.error(e); return toast("No hay conexión. Inténtalo de nuevo.", "error", 6000); }
    if (!s) return toast(MENSAJES.cerrado, "error", 6000);
    E.s = s; E.disp = s.disposiciones?.[0]?.id || null;
    // Si se recarga la página a mitad, se sigue donde estaba
    const b = SS.get(clave());
    if (b && s.alumnos.some((a) => a.id === b.yo && !a.hecho)) {
      Object.assign(E, b);
      if (!s.disposiciones.some((d) => d.id === E.disp)) { E.disp = s.disposiciones?.[0]?.id || null; E.asientos = {}; }
      if (!pasos().includes(E.paso) || E.paso === "codigo") E.paso = "nombre";
      if (E.s.identificacion === "clave" && E.paso !== "nombre") E.paso = "clave";
      return pintar();
    }
    ir("nombre");
  }

  async function enviar() {
    E.enviando = true; pintar();
    const d = E.s.preguntas.plano && E.s.disposiciones?.length && Object.keys(E.asientos).length ? { disp: disp().id, asientos: E.asientos } : null;
    let r;
    try { r = await api.responder(E.codigo, E.yo, E.clave, { si: E.si, no: E.no, plano: d, mensaje: E.mensaje.trim() || null }); }
    catch (e) { console.error(e); r = "red"; }
    E.enviando = false;
    if (r === "ok") { SS.quitar(clave()); E.paso = "gracias"; return pintar(); }
    pintar();
    toast(MENSAJES[r] || "No se ha podido enviar. Revisa la conexión e inténtalo de nuevo.", "error", 7000);
  }

  $("#sonDemo").hidden = !DEMO;
  if (E.codigo.length === 6) cargar().then(() => { if (!E.s) pintar(); }); else pintar();
})();
