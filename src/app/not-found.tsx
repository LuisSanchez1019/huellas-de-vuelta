import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";
import { PawIcon } from "@/components/icons/Icon";

export const metadata: Metadata = {
  title: "Página no encontrada — Huellas de Vuelta",
};

export default function NotFound() {
  return (
    <PlaceholderPage
      icon={<PawIcon size={30} />}
      title="404 — Esta página no existe"
      text="El enlace que seguiste puede estar roto o la página se movió. Revisa la dirección o vuelve al inicio."
    />
  );
}
