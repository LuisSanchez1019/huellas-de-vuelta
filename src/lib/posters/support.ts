/**
 * Bloque de APOYO VOLUNTARIO que se muestra una vez antes de subir el primer
 * poster (§26). Es completamente opcional: "Continuar sin donar" siempre
 * funciona y nada de la creacion / revision / aprobacion / publicacion depende
 * de haber donado. No se registra quién donó.
 *
 * §27 / §35: por ahora es solo texto estático con un marcador para la llave.
 * Está aislado aquí para que más adelante un administrador pueda configurar
 * texto, llave, QR o enlace (por ejemplo desde una tabla `app_settings`) sin
 * tocar los componentes.
 */
export interface PosterSupportConfig {
  title: string;
  paragraphs: string[];
  keyLabel: string;
  /** Marcador visible mientras no exista una llave real. */
  keyPlaceholder: string;
  /** Cuando exista una llave real, se muestra en vez del marcador. */
  keyValue: string | null;
  supportCta: string;
  continueCta: string;
  thanksNote: string;
}

export const POSTER_SUPPORT: PosterSupportConfig = {
  title: "¿Quieres apoyar este proyecto?",
  paragraphs: [
    "Publicar un poster en Huellas de Vuelta es completamente voluntario y no tiene ningún costo.",
    "Si deseas hacerlo, una contribución voluntaria nos ayudaría a mantener, mejorar y hacer crecer este proyecto para seguir ayudando a mascotas y familias.",
  ],
  keyLabel: "LLAVE DE APOYO",
  keyPlaceholder: "[ AQUÍ IRÁ LA LLAVE ]",
  keyValue: null,
  supportCta: "APOYAR EL PROYECTO",
  continueCta: "CONTINUAR SIN DONAR",
  thanksNote:
    "Gracias por considerarlo. Cuando esté disponible la llave de apoyo aparecerá en este mismo lugar.",
};

/** Marca en el navegador que ya se mostró el mensaje (para no repetirlo). No es un permiso. */
export const POSTER_SUPPORT_SEEN_KEY = "hdv.posters.support-seen";
