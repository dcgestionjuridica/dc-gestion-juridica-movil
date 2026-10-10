// Reglas de la web para el celular, sin pantalla: fechas, colores, grupos y alertas.
// Son las mismas del programa de escritorio (Centro de vencimientos y Alertas de riesgo).
(function (raiz) {
  const DIA = 86400000;

  // «2026-10-09», «2026-10-09T00:00:00» o «09/10/2026» → Date a medianoche local; otra cosa → null.
  function parseFecha(texto) {
    const t = String(texto || "").trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return fechaValida(+m[1], +m[2], +m[3]);
    m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return fechaValida(+m[3], +m[2], +m[1]);
    return null;
  }
  function fechaValida(a, me, d) {
    const f = new Date(a, me - 1, d);
    return f.getFullYear() === a && f.getMonth() === me - 1 && f.getDate() === d ? f : null;
  }
  function hoyLocal(ahora) {
    const h = ahora || new Date();
    return new Date(h.getFullYear(), h.getMonth(), h.getDate());
  }
  // Días desde hoy hasta la fecha (negativo = ya pasó). null si la fecha no se entiende.
  function diasHasta(texto, ahora) {
    const f = parseFecha(texto);
    return f ? Math.round((f - hoyLocal(ahora)) / DIA) : null;
  }
  function iso(f) {
    return f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
  }
  function fechaCorta(texto) {
    const f = parseFecha(texto);
    return f ? String(f.getDate()).padStart(2, "0") + "/" + String(f.getMonth() + 1).padStart(2, "0") + "/" + f.getFullYear() : String(texto || "");
  }
  // Como en la maqueta: vencido o 1 día rojo, hasta 5 ámbar, hasta 15 verde, más adelante azul.
  function colorPunto(dias) {
    if (dias === null) return "z";
    if (dias <= 1) return "r";
    if (dias <= 5) return "a";
    if (dias <= 15) return "v";
    return "z";
  }
  function cuando(dias) {
    if (dias === null) return "";
    if (dias < -1) return "venció hace " + -dias + " días";
    if (dias === -1) return "venció ayer";
    if (dias === 0) return "vence hoy";
    if (dias === 1) return "vence mañana";
    return "vence en " + dias + " días";
  }
  const CERRADOS = ["COMPLETADO", "COMPLETADA", "CANCELADO", "CANCELADA", "ANULADO", "ANULADA"];
  function estaPendiente(estado) {
    return CERRADOS.indexOf(String(estado || "").trim().toUpperCase()) < 0;
  }

  // Vencimientos pendientes en tres grupos: Vencidos, Esta semana (0 a 6 días) y Más adelante.
  function agruparVencimientos(vencimientos, ahora) {
    const g = { vencidos: [], semana: [], despues: [] };
    vencimientos.filter(v => estaPendiente(v.estado)).forEach(v => {
      const d = diasHasta(v.fecha_vencimiento, ahora);
      const item = Object.assign({}, v, { dias: d });
      if (d === null || d > 6) g.despues.push(item);
      else if (d < 0) g.vencidos.push(item);
      else g.semana.push(item);
    });
    const orden = (x, y) => (x.dias === null ? 1e9 : x.dias) - (y.dias === null ? 1e9 : y.dias);
    g.vencidos.sort(orden); g.semana.sort(orden); g.despues.sort(orden);
    return g;
  }

  // Las 4 alertas de riesgo del programa (PantallaAlertasRiesgo).
  function alertas(vencimientos, expedientes, eventos, ahora) {
    const salida = [];
    const pend = vencimientos.filter(v => estaPendiente(v.estado)).map(v => Object.assign({}, v, { dias: diasHasta(v.fecha_vencimiento, ahora) }));
    const ultimaActuacion = {};
    eventos.forEach(e => {
      const d = diasHasta(e.fecha_evento, ahora);
      if (d === null) return;
      const atras = -d;
      if (ultimaActuacion[e.expediente_id] === undefined || atras < ultimaActuacion[e.expediente_id]) ultimaActuacion[e.expediente_id] = atras;
    });
    // 1) Vencido sin completar.
    pend.filter(v => v.dias !== null && v.dias < 0).forEach(v =>
      salida.push({ tipo: "Vencido sin completar", color: "r", titulo: v.titulo, detalle: v, dias: v.dias }));
    // 2) Vence en 5 días o menos y el expediente no tiene actuaciones en los últimos 15 días.
    pend.filter(v => v.dias !== null && v.dias >= 0 && v.dias <= 5).forEach(v => {
      const u = ultimaActuacion[v.expediente_id];
      if (u === undefined || u > 15) salida.push({ tipo: "Término sin actuación", color: "a", titulo: v.titulo, detalle: v, dias: v.dias });
    });
    // 3) Dos o más vencimientos del mismo expediente el mismo día o con un día de diferencia.
    const porExp = {};
    pend.filter(v => v.dias !== null).forEach(v => (porExp[v.expediente_id] = porExp[v.expediente_id] || []).push(v));
    Object.keys(porExp).forEach(k => {
      const l = porExp[k].sort((x, y) => x.dias - y.dias);
      for (let i = 1; i < l.length; i++) {
        if (l[i].dias - l[i - 1].dias <= 1) {
          salida.push({ tipo: "Vencimientos en conflicto", color: "a", titulo: l[i - 1].titulo + " / " + l[i].titulo, detalle: l[i], dias: l[i].dias });
        }
      }
    });
    // 4) Expediente abierto sin actuaciones en 30 días o más.
    expedientes.filter(e => String(e.estado || "").toLowerCase() === "abierto" && !e.archivado_en).forEach(e => {
      const u = ultimaActuacion[e.id];
      const desdeApertura = diasHasta(e.fecha_apertura, ahora);
      const inactivo = u === undefined ? (desdeApertura === null || -desdeApertura >= 30) : u >= 30;
      if (inactivo) salida.push({ tipo: "Expediente inactivo", color: "z", titulo: "Expediente " + e.numero, expediente: e,
        dias: null, sinActuacion: u === undefined ? null : u });
    });
    return salida;
  }

  // Agenda: notas personales + vencimientos + tareas, desde hoy, por fecha y hora.
  function agenda(eventosAgenda, vencimientos, tareas, ahora, diasAdelante) {
    const max = diasAdelante === undefined ? 30 : diasAdelante;
    const items = [];
    eventosAgenda.forEach(e => items.push({ fecha: e.fecha, hora: e.hora || "", titulo: e.titulo, tipo: e.tipo || "Nota", sub: e.descripcion || "" }));
    vencimientos.filter(v => estaPendiente(v.estado)).forEach(v => items.push({ fecha: v.fecha_vencimiento, hora: "", titulo: v.titulo, tipo: "Vencimiento", sub: "", ref: v }));
    tareas.filter(t => estaPendiente(t.estado)).forEach(t => items.push({ fecha: t.fecha_limite, hora: "", titulo: t.titulo, tipo: "Tarea", sub: t.responsable || "" }));
    return items
      .map(i => Object.assign(i, { dias: diasHasta(i.fecha, ahora) }))
      .filter(i => i.dias !== null && i.dias >= 0 && i.dias <= max)
      .sort((x, y) => x.dias - y.dias || String(x.hora).localeCompare(String(y.hora)));
  }

  function saludo(ahora) {
    const h = (ahora || new Date()).getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  }
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fechaLarga(f) { return DIAS[f.getDay()] + " " + f.getDate() + " de " + MESES[f.getMonth()]; }

  raiz.DC_LOGICA = { parseFecha, diasHasta, iso, fechaCorta, colorPunto, cuando, estaPendiente, agruparVencimientos, alertas, agenda, saludo, fechaLarga, hoyLocal };
  if (typeof module !== "undefined") module.exports = raiz.DC_LOGICA;
})(typeof window !== "undefined" ? window : globalThis);
