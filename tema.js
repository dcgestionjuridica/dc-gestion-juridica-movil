// DC Gestión Jurídica · modo claro / oscuro / automático, tamaño de la letra y «Ocultar valores».
// Se carga en <head> para que la página no parpadee al abrir. Todo queda guardado en este celular.
// 28/10/2026: estas opciones se eligen en Configuración (engranaje de arriba).
(function () {
  const CLAVE = "dc-tema";
  const raiz = document.documentElement;
  const oscuroCelular = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const leerLs = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const guardarLs = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  // «claro», «oscuro» o «auto» (como el celular).
  function leer() { const t = leerLs(CLAVE); return t === "oscuro" || t === "auto" ? t : "claro"; }
  function efectivo() { const t = leer(); return t === "auto" ? (oscuroCelular && oscuroCelular.matches ? "oscuro" : "claro") : t; }
  function aplicar() {
    const tema = efectivo();
    raiz.setAttribute("data-tema", tema);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "oscuro" ? "#0b1626" : "#f8f9ff");
    document.querySelectorAll("[data-cambiar-tema]").forEach(b => {
      b.setAttribute("aria-label", tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      b.setAttribute("title", tema === "oscuro" ? "Modo claro" : "Modo oscuro");
      const uso = b.querySelector("use");
      if (uso) uso.setAttribute("href", tema === "oscuro" ? "#ic-sol" : "#ic-luna");
    });
  }
  // Tamaño de la letra: normal, grande o muy grande (agranda toda la pantalla por igual).
  const ZOOM = { normal: "", grande: "1.12", muy: "1.25" };
  function leerLetra() { const l = leerLs("dc-letra"); return ZOOM[l] !== undefined ? l : "normal"; }
  function aplicarLetra() { raiz.style.zoom = ZOOM[leerLetra()]; }
  function aplicarOcultar() { raiz.classList.toggle("ocultar-valores", leerLs("dc-ocultar-valores") === "1"); }

  aplicar(); aplicarLetra(); aplicarOcultar();
  if (oscuroCelular && oscuroCelular.addEventListener) oscuroCelular.addEventListener("change", () => { if (leer() === "auto") aplicar(); });

  window.DC_TEMA = {
    leer, leerLetra,
    poner(t) { guardarLs(CLAVE, t); aplicar(); },
    ponerLetra(l) { guardarLs("dc-letra", l === "normal" ? "" : l); aplicarLetra(); },
    ocultarValores() { return leerLs("dc-ocultar-valores") === "1"; },
    ponerOcultar(si) { guardarLs("dc-ocultar-valores", si ? "1" : ""); aplicarOcultar(); },
    animacion() { return leerLs("dc-intro-no") !== "1"; },
    ponerAnimacion(si) { guardarLs("dc-intro-no", si ? "" : "1"); }
  };

  document.addEventListener("DOMContentLoaded", () => {
    aplicar();
    document.addEventListener("click", ev => {
      if (!ev.target.closest("[data-cambiar-tema]")) return;
      guardarLs(CLAVE, efectivo() === "oscuro" ? "claro" : "oscuro");
      aplicar();
    });
    // Botón del ojo para ver u ocultar la contraseña.
    document.addEventListener("click", ev => {
      const b = ev.target.closest("[data-ver-clave]");
      if (!b) return;
      const campo = document.getElementById(b.dataset.verClave);
      if (!campo) return;
      const ver = campo.type === "password";
      campo.type = ver ? "text" : "password";
      b.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
    });
    // «Ocultar valores»: al tocar un monto oculto se ve; al tocarlo otra vez se vuelve a ocultar.
    document.addEventListener("click", ev => {
      const m = ev.target.closest && ev.target.closest(".monto");
      if (m && raiz.classList.contains("ocultar-valores")) m.classList.toggle("ver");
    });
  });
})();
