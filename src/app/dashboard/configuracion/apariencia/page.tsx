import { redirect } from "next/navigation";

// "Apariencia" se retiró: el cambio claro/oscuro está en el selector superior de
// la interfaz. Se conserva la ruta como redirección.
export default function Page() {
  redirect("/dashboard/perfil");
}
