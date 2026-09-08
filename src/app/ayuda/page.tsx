import type { Metadata } from "next";
import HelpCenter from "@/components/ayuda/HelpCenter";

const description =
  "Preguntas frecuentes sobre cómo registrar una mascota, reportar una pérdida, entregar una mascota encontrada y registrar una organización aliada en Huellas de Vuelta.";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description,
  alternates: { canonical: "/ayuda" },
  openGraph: { title: "Centro de ayuda · Huellas de Vuelta", description, url: "/ayuda" },
};

export default function AyudaPage() {
  return <HelpCenter />;
}
