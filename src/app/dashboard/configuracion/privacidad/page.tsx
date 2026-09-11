import { redirect } from "next/navigation";

/**
 * «Privacidad» se unificó dentro de «Seguridad y privacidad». Esta ruta se
 * conserva solo para no romper enlaces o marcadores antiguos.
 */
export default function Page() {
  redirect("/dashboard/configuracion/seguridad");
}
