"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPets, getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import type { Pet } from "@/lib/supabase/types";
import { petPublicUrl } from "@/lib/pets/publicPet";
import { qrSvgString } from "@/lib/qr/svg";
import { ageUnitLabels, speciesLabels } from "@/lib/pets/labels";
import { PawIcon } from "@/components/icons/Icon";
import Toast from "@/components/ui/Toast";
import headStyles from "@/components/mascotas/registerPet.module.css";
import listStyles from "@/components/mascotas/petsList.module.css";
import styles from "@/components/mascotas/qrPlaca.module.css";

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "mascota";
}

function petMeta(pet: Pet): string {
  const parts = [pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species]];
  if (pet.age_value != null && pet.age_unit) {
    parts.push(`${pet.age_value} ${ageUnitLabels[pet.age_unit].toLowerCase()}`);
  }
  return parts.join(" · ");
}

export default function QrPlacaPage() {
  const [ownerStatus, setOwnerStatus] = useState<"checking" | "ready" | "no-session">("checking");
  const [pets, setPets] = useState<Pet[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data }) => {
      setOrigin(window.location.origin);
      if (!data.session) {
        setOwnerStatus("no-session");
        setIsLoading(false);
        return;
      }
      setOwnerStatus("ready");
      try {
        const list = await fetchPets(supabase, { includeArchived: false });
        setPets(list);
        const entries = await Promise.all(
          list
            .filter((pet) => pet.photo_path)
            .map(async (pet) => [pet.id, await getPetPhotoSignedUrl(supabase, pet.photo_path as string)] as const),
        );
        setPhotoUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null)));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No fue posible cargar las mascotas.");
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const selected = selectedId ? pets.find((pet) => pet.id === selectedId) ?? null : null;
  const qrUrl = selected && origin ? petPublicUrl(selected.public_id, origin) : null;

  const qrSvg = useMemo(() => {
    if (!qrUrl) return null;
    try {
      return qrSvgString(qrUrl);
    } catch {
      return null;
    }
  }, [qrUrl]);

  const qrDataUrl = qrSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}` : null;

  function handleDownload() {
    if (!qrSvg || !selected) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `qr-${slugify(selected.name)}-${selected.public_id}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <div className={headStyles.pageHead}>
        <h1 className={headStyles.pageTitle}>QR / Placa</h1>
        <p className={headStyles.pageSubtitle}>
          Elige una mascota y genera su código QR. Al escanearlo se abrirá su perfil público; el QR no
          incluye tus datos personales.
        </p>
      </div>

      {ownerStatus === "no-session" && (
        <p className={headStyles.notice} role="status">
          Estás viendo el panel en modo desarrollo. Inicia sesión con una cuenta real para generar el QR de
          tus mascotas.
        </p>
      )}

      {ownerStatus === "checking" && <p className={headStyles.loading}>Cargando…</p>}

      {ownerStatus === "ready" && (
        isLoading ? (
          <p className={headStyles.loading}>Cargando mascotas…</p>
        ) : pets.length === 0 ? (
          <p className={listStyles.empty}>
            Todavía no has registrado ninguna mascota.{" "}
            <Link href="/dashboard/mascotas/nueva">Registrar una</Link>.
          </p>
        ) : (
          <div className={styles.layout}>
            <div className={styles.petList}>
              {pets.map((pet) => {
                const active = pet.id === selectedId;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    className={`${styles.petButton} ${active ? styles.petButtonActive : ""}`}
                    aria-pressed={active}
                    onClick={() => setSelectedId(pet.id)}
                  >
                    {photoUrls[pet.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                      <img src={photoUrls[pet.id]} alt={`Foto de ${pet.name}`} className={styles.thumb} />
                    ) : (
                      <span className={styles.thumbPlaceholder} aria-hidden="true"><PawIcon size={22} /></span>
                    )}
                    <span className={styles.petMain}>
                      <span className={styles.petName}>{pet.name}</span>
                      <span className={styles.petMeta}>{petMeta(pet)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && qrDataUrl ? (
              <div className={styles.previewPanel}>
                <span className={styles.previewBrand}>Huellas de Vuelta</span>
                <div className={styles.qrFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado en el cliente (data URL) */}
                  <img src={qrDataUrl} alt={`Código QR de ${selected.name}`} />
                </div>
                <span className={styles.previewName}>{selected.name}</span>
                <span className={styles.previewUrl}>{qrUrl}</span>
                <button type="button" className={styles.downloadButton} onClick={handleDownload}>
                  Descargar QR (SVG)
                </button>
                <p className={styles.hint}>
                  El archivo SVG es vectorial: puedes imprimirlo a cualquier tamaño sin que pierda nitidez.
                </p>
              </div>
            ) : selected ? (
              <p className={listStyles.empty}>No fue posible generar el QR de esta mascota.</p>
            ) : (
              <p className={styles.previewEmpty}>Selecciona una mascota para ver su código QR.</p>
            )}
          </div>
        )
      )}

      {error && <Toast variant="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
