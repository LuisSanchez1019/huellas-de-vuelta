import type { Metadata } from "next";
import AllyBrandPolicy from "@/components/legal/AllyBrandPolicy";

const description =
  "Política de información y uso de marca de aliados de Huellas de Vuelta: complementa la Política de Tratamiento de Datos Personales. Documento sujeto a revisión jurídica profesional antes de su publicación definitiva.";

export const metadata: Metadata = {
  title: "Política de información y uso de marca de aliados",
  description,
  alternates: { canonical: "/legal/marca-aliados" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <AllyBrandPolicy />;
}
