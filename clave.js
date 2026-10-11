// Recuperar contraseña (pedido de Darío, 11/10/2026), igual en la web del despacho y en el portal del cliente.
// «¿Olvidó su contraseña?» pide a Supabase que envíe un enlace al correo. Al abrir el enlace, la página
// muestra «Nueva contraseña» y la guarda con updateUser. La contraseña nueva sirve también en el programa del PC.
window.DC_CLAVE = (function () {
  const hash = location.hash || "";
  const enRecuperacion = /type=recovery/.test(hash);
  const errorEnlace = /error_code=|[#&]error=/.test(hash)
    ? "El enlace ya venció o ya se usó. Escriba su correo y pulse «¿Olvidó su contraseña?» para recibir uno nuevo." : "";

  function preparar(sb, op) {
    const $ = id => document.getElementById(id);
    $("btn-olvido").addEventListener("click", async ev => {
      ev.preventDefault();
      const correo = $("correo").value.trim();
      $("error-entrada").textContent = "";
      $("ok-entrada").textContent = "";
      if (!/^\S+@\S+\.\S+$/.test(correo)) {
        $("error-entrada").textContent = "Escriba arriba su correo y vuelva a pulsar «¿Olvidó su contraseña?».";
        $("correo").focus();
        return;
      }
      $("btn-olvido").classList.add("apagado");
      const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.href.split("#")[0] });
      $("btn-olvido").classList.remove("apagado");
      if (error) {
        $("error-entrada").textContent = /rate|seconds/i.test(error.message)
          ? "Ya se enviaron varios correos. Espere un rato e intente de nuevo."
          : "No fue posible enviar el correo: " + error.message;
        return;
      }
      $("ok-entrada").textContent = "Si " + correo + " tiene cuenta, le llegará un correo con un enlace para crear una contraseña nueva. Revise también la carpeta de spam.";
    });

    $("form-nueva-clave").addEventListener("submit", async ev => {
      ev.preventDefault();
      const c1 = $("nueva1").value, c2 = $("nueva2").value;
      $("error-nueva-clave").textContent = "";
      if (c1.length < 8) { $("error-nueva-clave").textContent = "La contraseña debe tener al menos 8 caracteres."; return; }
      if (c1 !== c2) { $("error-nueva-clave").textContent = "Las dos contraseñas no son iguales."; return; }
      $("btn-nueva-clave").disabled = true;
      const { error } = await sb.auth.updateUser({ password: c1 });
      $("btn-nueva-clave").disabled = false;
      if (error) {
        $("error-nueva-clave").textContent = /different|same/i.test(error.message)
          ? "La contraseña nueva debe ser distinta de la anterior."
          : /session|jwt|token/i.test(error.message)
            ? "El enlace ya venció. Vuelva a pedir uno con «¿Olvidó su contraseña?»."
            : "No fue posible guardar: " + error.message;
        return;
      }
      $("nueva1").value = ""; $("nueva2").value = "";
      history.replaceState(null, "", location.pathname + location.search);
      op.alTerminar();
    });
  }

  return { enRecuperacion, errorEnlace, preparar };
})();
