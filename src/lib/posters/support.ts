/**
 * Aviso de APOYO VOLUNTARIO que se muestra cada vez que una organización
 * entra a la pantalla de Posters. Es completamente opcional y meramente
 * informativo: no depende de él ni lo condiciona ninguna acción de creación,
 * revisión, aprobación o publicación de posters, y no se registra quién
 * aporta ni si alguien lo hizo.
 *
 * Aislado aquí para que más adelante un administrador pueda configurar el
 * texto, la llave, un QR o un enlace (por ejemplo desde una tabla
 * `app_settings`) sin tocar los componentes.
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
  /** Segundos antes de cerrarse automáticamente si nadie interactúa. */
  autoCloseSeconds: number;
}

export const POSTER_SUPPORT: PosterSupportConfig = {
  title: "Publicar tu poster no tiene ningún costo",
  paragraphs: [
    "Publicar posters en Huellas de Vuelta es y será siempre gratuito para tu organización.",
    "Para nosotros es muy importante seguir creciendo y ayudando a que más mascotas vuelvan a casa. Si deseas hacer un aporte voluntario, puedes enviarlo a este número:",
  ],
  keyLabel: "Aporte voluntario",
  keyPlaceholder: "[ AQUÍ IRÁ LA LLAVE ]",
  keyValue: "3202849204",
  supportCta: "Ya hice mi aporte",
  continueCta: "Entendido",
  thanksNote: "Muchas gracias por tu apoyo. Sigamos ayudando a que más mascotas vuelvan a casa.",
  autoCloseSeconds: 20,
};
