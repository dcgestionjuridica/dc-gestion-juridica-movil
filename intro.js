// V7 (pedido de Darío 15/10): entrada animada con el logo en 3D. La animación vive en estilos.css
// y termina sola aunque este archivo no cargue; aquí solo se quita del todo al terminar y se recuerda
// que ya se vio en esta visita (al volver a abrir la web, sale otra vez).
(function () {
  const intro = document.getElementById("intro3d");
  if (!intro) return;
  try { sessionStorage.setItem("dc-intro-vista", "1"); } catch (e) {}
  intro.addEventListener("animationend", ev => { if (ev.target === intro) intro.remove(); });
  setTimeout(() => intro.remove(), 4000);
})();
