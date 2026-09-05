import type { Metadata } from "next";
import { statusLabels } from "@/lib/pets/labels";
import { fetchPublicPet } from "@/lib/supabase/pets";
import { createSupabasePublicServerClient } from "@/lib/supabase/serverPublic";
import PublicPetView from "@/components/mascota/PublicPetView";

type Params = { publicId: string };

/**
 * Metadata de la página pública de una mascota (placa QR): usa SOLO los
 * mismos datos públicos que ya devuelve `get_public_pet` (nombre, especie,
 * estado, ciudad) — nunca datos del propietario, que esa RPC ni siquiera
 * devuelve. `robots: noindex` a propósito: son páginas individuales y
 * transitorias (dejan de ser relevantes tras el reencuentro), así que no
 * conviene indexarlas en buscadores, aunque sí deben verse bien al
 * compartirse por WhatsApp/redes (Open Graph no depende de `noindex`).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const pet = await fetchPublicPet(createSupabasePublicServerClient(), publicId).catch(() => null);

  if (!pet) {
    return { title: "Mascota no encontrada", robots: { index: false, follow: false } };
  }

  const title = pet.status === "lost" ? `${pet.name} está perdido` : pet.name;
  const description =
    pet.status === "lost"
      ? `${pet.name} se perdió${pet.lostCity ? ` en ${pet.lostCity}` : ""}. Si lo viste o lo tienes, avisa a su familia sin crear una cuenta.`
      : `Perfil de ${pet.name} en Huellas de Vuelta. Estado: ${statusLabels[pet.status]}.`;

  return {
    title,
    description,
    alternates: { canonical: `/m/${pet.publicId}` },
    openGraph: { title, description, url: `/m/${pet.publicId}` },
    twitter: { title, description },
    robots: { index: false, follow: true },
  };
}

export default async function PublicPetPage({ params }: { params: Promise<Params> }) {
  const { publicId } = await params;
  return <PublicPetView publicId={publicId} />;
}
