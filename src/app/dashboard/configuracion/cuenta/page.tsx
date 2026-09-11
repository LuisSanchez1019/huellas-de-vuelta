import { redirect } from "next/navigation";

// "Cuenta" se fusionó con "Mi perfil": toda la información de identidad y de la
// cuenta se ve y se edita allí. Se conserva la ruta como redirección.
export default function Page() {
  redirect("/dashboard/perfil");
}
