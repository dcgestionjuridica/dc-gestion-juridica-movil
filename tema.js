// DC Gestión Jurídica · modo claro / oscuro (lo elige cada persona con el botón de luna o sol).
// Se carga en <head> para que la página no parpadee al abrir. La elección queda guardada en este celular.
(function () {
  const CLAVE = "dc-tema";
  function leer() { try { return localStorage.getItem(CLAVE) === "oscuro" ? "oscuro" : "claro"; } catch (e) { return "claro"; } }
  function aplicar(tema) {
    document.documentElement.setAttribute("data-tema", tema);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "oscuro" ? "#0b1626" : "#f8f9ff");
    document.querySelectorAll("[data-cambiar-tema]").forEach(b => {
      b.setAttribute("aria-label", tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      b.setAttribute("title", tema === "oscuro" ? "Modo claro" : "Modo oscuro");
      const uso = b.querySelector("use");
      if (uso) uso.setAttribute("href", tema === "oscuro" ? "#ic-sol" : "#ic-luna");
    });
  }
  aplicar(leer());
  document.addEventListener("DOMContentLoaded", () => {
    aplicar(leer());
    document.addEventListener("click", ev => {
      if (!ev.target.closest("[data-cambiar-tema]")) return;
      const nuevo = leer() === "oscuro" ? "claro" : "oscuro";
      try { localStorage.setItem(CLAVE, nuevo); } catch (e) {}
      aplicar(nuevo);
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
  });
})();
