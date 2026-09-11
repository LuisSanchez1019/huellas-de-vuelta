import type { Metadata } from "next";
import DataPolicy from "@/components/legal/DataPolicy";

const description =
  "Política de Tratamiento de Datos Personales de Huellas de Vuelta, con marco de referencia en la Ley 1581 de 2012 y su normativa reglamentaria. Documento sujeto a revisión jurídica profesional antes de su publicación definitiva.";

export const metadata: Metadata = {
  title: "Política de Tratamiento de Datos Personales",
  description,
  alternates: { canonical: "/legal/tratamiento-de-datos" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <DataPolicy />;
}
