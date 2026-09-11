import { redirect } from "next/navigation";

// "Mi actividad" se retiró: su contenido (avisos y estado de reportes) vive en
// "Notificaciones" y "Mis reportes". Se conserva la ruta como redirección para
// no dejar enlaces rotos.
export default function Page() {
  redirect("/dashboard");
}
