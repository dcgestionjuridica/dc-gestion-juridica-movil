// Conexión al proyecto Supabase «DC Gestión Jurídica DEV» (el de los datos reales).
// La clave «sb_publishable» es la clave PÚBLICA, la misma que se pone en cada PC en
// Conexión compartida: está hecha para ir en páginas web y no da acceso por sí sola.
// Los datos solo se ven después de entrar con correo y contraseña, y Supabase aplica las reglas de cada rol.
window.DC_CONFIG = {
  url: "https://bopiajeyzystoaumishw.supabase.co",
  clavePublica: "sb_publishable_ggggVf0N814HmKzfk0sQpw_srEZ1ZWg"
};

// Versión de las aplicaciones web del celular (abogado y cliente); se muestra en «Acerca de».
window.DC_VERSION = "1.5.12";
