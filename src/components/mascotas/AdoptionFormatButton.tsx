"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { DownloadIcon } from "@/components/icons/Icon";
import { foundationRepository } from "@/lib/foundations/repository";
import { speciesText } from "@/lib/pets/publicPetCards";
import { sexLabels } from "@/lib/pets/labels";
import { buildAdoptionFormatPdf, imageUrlToDataUrl } from "@/lib/pdf/adoptionFormat";
import type { BulkPet, OrgScope } from "@/lib/pets/bulkPets";
import controls from "@/components/ui/controls.module.css";

/**
 * Botón + modal para descargar el formato de adopción en PDF de una mascota.
 * El PDF se genera enteramente en el navegador (jsPDF) y se descarga al
 * dispositivo del usuario: nada se sube a Storage ni se guarda en la base de
 * datos. Solo se puede elegir entre las mascotas ya cargadas por la propia
 * organización (`pets`), así que no hay forma de pedir el formato de una
 * mascota ajena manipulando un ID.
 */
export default function AdoptionFormatButton({ scope, pets }: { scope: OrgScope; pets: BulkPet[] }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pets.length === 0) return null;

  const selected = pets.find((pet) => pet.id === selectedId) ?? null;

  function handleOpen() {
    setSelectedId(pets[0]?.id ?? null);
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (isGenerating) return;
    setOpen(false);
  }

  async function handleDownload() {
    if (!selected) return;
    setIsGenerating(true);
    setError(null);
    try {
      const org = await foundationRepository.getMine(scope.id);
      if (!org) throw new Error("org-not-found");
      const logoDataUrl = org.logoUrl ? await imageUrlToDataUrl(org.logoUrl) : null;
      const doc = buildAdoptionFormatPdf(
        {
          name: org.name,
          address: org.location.address,
          city: org.location.city,
          phone: org.phone,
          whatsapp: org.whatsapp,
          email: org.email,
          logoDataUrl,
        },
        {
          name: selected.name,
          speciesLabel: speciesText(selected.species, selected.speciesOther),
          breed: selected.breed,
          age: selected.age,
          sexLabel: sexLabels[selected.sex],
          publicId: selected.publicId,
        },
      );
      const safeName = selected.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-");
      doc.save(`formato-adopcion-${safeName || "mascota"}.pdf`);
      setOpen(false);
    } catch {
      setError("No fue posible generar el documento. Intenta de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <div className={controls.buttonRow} style={{ marginTop: "1.5rem" }}>
        <button type="button" className={controls.buttonSecondary} onClick={handleOpen}>
          <DownloadIcon size={18} />
          Descargar formato de adopción
        </button>
      </div>

      <Modal open={open} title="Formato de adopción" onClose={handleClose}>
        <p style={{ color: "var(--ink-600)", fontSize: ".9rem", lineHeight: 1.55, marginBottom: "1.1rem" }}>
          Elige la mascota para generar un formato en PDF con sus datos públicos y espacios en blanco
          para completar a mano con la persona adoptante fuera de la plataforma. El documento se
          descarga a tu dispositivo; Huellas de Vuelta no lo almacena.
        </p>

        <label className={controls.field}>
          Mascota
          <select
            className={controls.select}
            value={selectedId ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={isGenerating}
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} · {speciesText(pet.species, pet.speciesOther)}
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <div className={controls.chips} style={{ marginTop: "1rem" }}>
            <span className={controls.chip}>{speciesText(selected.species, selected.speciesOther)}</span>
            {selected.breed && <span className={controls.chip}>{selected.breed}</span>}
            {selected.age && <span className={controls.chip}>{selected.age}</span>}
            <span className={controls.chip}>{sexLabels[selected.sex]}</span>
          </div>
        )}

        {error && (
          <p className={controls.errorText} style={{ marginTop: "1rem" }}>
            {error}
          </p>
        )}

        <div className={controls.buttonRow} style={{ marginTop: "1.5rem" }}>
          <button type="button" className={controls.buttonSecondary} onClick={handleClose} disabled={isGenerating}>
            Cancelar
          </button>
          <button type="button" className={controls.button} onClick={handleDownload} disabled={!selected || isGenerating}>
            {isGenerating ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </Modal>
    </>
  );
}
