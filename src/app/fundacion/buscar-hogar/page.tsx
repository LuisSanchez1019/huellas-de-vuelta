"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import { useEffect, useState } from "react";
import Link from "next/link";
import { bulkPetRepository } from "@/lib/pets/bulkPetRepository";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseUserId } from "@/lib/auth/session";
import { getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import type { BulkPet } from "@/lib/pets/bulkPets";
import { speciesText } from "@/lib/pets/publicPetCards";
import CardSlider from "@/components/landing/CardSlider";
import AdoptionCard, { type AdoptionItem } from "@/components/landing/AdoptionCard";
import InlineRetry from "@/components/panel/InlineRetry";
import { ListSkeletonBody } from "@/components/loading/SkeletonVariants";
import AdoptionFormatButton from "@/components/mascotas/AdoptionFormatButton";
import controls from "@/components/ui/controls.module.css";

function toItem(pet: BulkPet, photoUrl: string | null): AdoptionItem {
  return {
    key: pet.id,
    name: pet.name,
    photoUrl,
    meta: [speciesText(pet.species, pet.speciesOther), pet.breed, pet.age].filter(Boolean).join(" · "),
    city: null,
    badge: pet.needsHome ? "adopcion" : "padrino",
    org: null,
    href: `/m/${pet.publicId}`,
    hrefLabel: "Ver ficha pública",
    external: false,
  };
}

export default function FundacionBuscarHogarPage() {
  const scopeState = useOrgScope("fundacion");
  const [pets, setPets] = useState<BulkPet[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (scopeState.status !== "ready") return;
    let active = true;
    (async () => {
      try {
        const list = await bulkPetRepository.list(scopeState.scope);
        if (!active) return;
        setPets(list);
        if (await getSupabaseUserId()) {
          const supabase = createSupabaseBrowserClient();
          const withPhoto = list.filter((pet) => pet.photoPath);
          const entries = await Promise.all(
            withPhoto.map(async (pet) => [pet.id, await getPetPhotoSignedUrl(supabase, pet.photoPath as string)] as const),
          );
          if (!active) return;
          setPhotoUrls(Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== null)));
        }
      } catch {
        if (active) setHasError(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeState.status, attempt]);

  const listed = (pets ?? []).filter((pet) => pet.needsHome || pet.needsSponsor);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Buscan un hogar</h1>
        <p className={controls.pageSubtitle}>
          Así se ven, en la página principal de Huellas de Vuelta, las mascotas que marcaste como
          &laquo;Buscan hogar&raquo; o &laquo;Buscan padrino&raquo; desde el listado.
        </p>
      </div>

      {scopeState.status === "error" || hasError ? (
        <InlineRetry
          onRetry={() => {
            setHasError(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : scopeState.status === "loading" || pets === null ? (
        <ListSkeletonBody />
      ) : listed.length === 0 ? (
        <p className={controls.empty}>
          Todavía no tienes mascotas marcadas para adopción o padrinazgo. Actívalo desde el{" "}
          <Link href="/fundacion/mascotas">listado de mascotas</Link>, con los botones &laquo;Buscar
          casa&raquo; o &laquo;Buscar padrino monetario&raquo; de cada registro.
        </p>
      ) : (
        <CardSlider ariaLabel="Mascotas que buscan un hogar">
          {listed.map((pet) => (
            <AdoptionCard key={pet.id} item={toItem(pet, photoUrls[pet.id] ?? pet.photoUrl)} />
          ))}
        </CardSlider>
      )}

      {scopeState.status === "ready" && <AdoptionFormatButton scope={scopeState.scope} pets={listed} />}

      <p className={controls.notice} style={{ marginTop: "1.5rem" }}>
        Esta sección muestra qué mascotas son públicamente visibles para adopción. El seguimiento de
        solicitudes de adopción (recepción, revisión y estado del proceso) todavía no existe como
        funcionalidad — es una estructura pendiente, no implementada en esta fase.
      </p>
    </div>
  );
}
