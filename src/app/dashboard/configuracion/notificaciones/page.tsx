import { redirect } from "next/navigation";

// Las preferencias de notificaciones se unificaron con el buzón único de
// "Notificaciones". Se conserva la ruta como redirección.
export default function Page() {
  redirect("/dashboard/notificaciones");
}
