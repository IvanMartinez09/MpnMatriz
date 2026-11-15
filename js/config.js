/* ================================================================
   MPN MATRIZ - configuracion de la tienda
   Aqui se cambian los datos sin tocar el resto del codigo.
   ================================================================ */
window.MPN_CONFIG = {
  // Supabase (la llave publishable es publica, va en la pagina sin problema)
  supabaseUrl: "https://pzordgsjrkacdrqmvdgi.supabase.co",
  supabaseKey: "sb_publishable_v0MgXyUCBqud-xJQEBZeLQ_ml2M-u_e",

  tienda: {
    nombre: "MPN Matriz",
    lema: "Suplementación y nutrición deportiva",
    ciudad: "Guadalajara, Jal.",
    direccion: "Av. Enrique Díaz de León Nte. 549, Col. Santa Teresita, C.P. 44200, Guadalajara, Jalisco",
    mapa: "https://maps.app.goo.gl/CAdCcRD1Bk8J9GSg6", // ficha de MPN en Google Maps
    mapaEmbed: "https://maps.google.com/maps?cid=9543759637859867695&z=17&hl=es&output=embed",
    mapaLlegar: "https://www.google.com/maps/dir/?api=1&destination=20.6853455,-103.3592436",
    horario: "" // ej. "Lun a sáb · 9:00 a 20:00" (vacio = no se muestra)
  },

  // WhatsApp de la tienda: 52 + numero a 10 digitos
  whatsapp: "523312210830",
  whatsappVisible: "33 1221 0830",

  redes: {
    instagram: "https://www.instagram.com/mpnmatriz.gdl/",
    facebook: "https://www.facebook.com/mpnsuplementacionmatriz/",
    tiktok: "https://www.tiktok.com/@mpnmatriz"
  },

  entrega: {
    envioTexto: "Envío a domicilio (se cotiza por WhatsApp)",
    recogerTexto: "Recoger en tienda"
  },

  stockBajo: 3, // a partir de cuantas piezas se avisa "quedan pocas"

  credito: { texto: "Página hecha por Evan Lux", url: "https://www.instagram.com/evanlux.ia/" }
};
