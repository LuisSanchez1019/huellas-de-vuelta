"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { setPetPhotoPath, updatePet, uploadPetPhoto } from "@/lib/supabase/pets";
import { setPetStatus, type PanelPetStatus } from "@/lib/supabase/reports";
import type { Pet, PetAgeUnit, PetInput, PetSex, PetSpecies } from "@/lib/supabase/types";
import type { PetReport } from "@/lib/pets/reports";
import { LOST_DETAILS_MAX } from "@/lib/pets/reports";
import { CAT_COLORS, ageUnitOptions, sexOptions, speciesOptions } from "@/lib/pets/labels";
import Modal from "@/components/ui/Modal";
import PetPhotoInput, { type PreparedPhoto } from "./PetPhotoInput";
import MedicalInfoSection from "./MedicalInfoSection";
import controls from "@/components/ui/controls.module.css";
import styles from "./editPet.module.css";

const DESCRIPTION_MAX = 80;

const PANEL_STATUS_OPTIONS: { value: PanelPetStatus; label: string }[] = [
  { value: "at_home", label: "En casa" },
  { value: "lost", label: "Perdido" },
  { value: "for_adoption", label: "En adopción" },
];

function toPanelStatus(status: Pet["status"]): PanelPetStatus {
  return status === "lost" || status === "for_adoption" ? status : "at_home";
}

export default function EditPetModal({
  pet,
  activeReport,
  onClose,
  onSaved,
}: {
  pet: Pet;
  activeReport: PetReport | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [form, setForm] = useState({
    name: pet.name,
    species: pet.species as PetSpecies,
    speciesOther: pet.species_other ?? "",
    breed: pet.breed ?? "",
    colorPrimary: pet.color_primary ?? "",
    colorSecondary: pet.color_secondary ?? "",
    colorTertiary: pet.color_tertiary ?? "",
    ageValue: pet.age_value != null ? String(pet.age_value) : "",
    ageUnit: (pet.age_unit ?? "years") as PetAgeUnit,
    sex: (pet.sex ?? "unspecified") as PetSex,
    description: pet.description ?? "",
    status: toPanelStatus(pet.status),
    city: activeReport?.city ?? "",
    neighborhood: activeReport?.neighborhood ?? "",
    details: activeReport?.details ?? "",
  });
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lock = useRef(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function colorOptions(...taken: string[]) {
    return CAT_COLORS.filter((color) => !taken.includes(color.value));
  }

  const isLost = form.status === "lost";

  const problem = useMemo(() => {
    if (!form.name.trim()) return "Ingresa el nombre de la mascota.";
    if (form.ageValue.trim()) {
      const n = Number(form.ageValue);
      if (!Number.isInteger(n) || n < 1 || n > 1200) return "La edad debe ser un número entero válido.";
    }
    if (form.species === "cat" && !form.colorPrimary) return "Selecciona el color principal.";
    if (form.species === "dog" && !form.breed.trim()) return "Ingresa la raza de la mascota.";
    if (form.species === "other" && !form.speciesOther.trim()) return "Indica el tipo o especie.";
    if (isLost && (!form.city.trim() || !form.neighborhood.trim())) {
      return "Para marcarla como perdida, indica ciudad y barrio.";
    }
    if (photoError) return photoError;
    return null;
  }, [form, isLost, photoError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (problem) {
      setError(problem);
      return;
    }
    lock.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (photo) {
        const path = await uploadPetPhoto(supabase, pet.owner_id, pet.id, photo.blob, photo.contentType);
        await setPetPhotoPath(supabase, pet.id, path);
      }

      const species = form.species;
      const fields: Partial<PetInput> = {
        name: form.name.trim(),
        species,
        species_other: species === "other" ? form.speciesOther.trim() : null,
        breed: species === "dog" ? form.breed.trim() : null,
        color_primary: species === "cat" ? form.colorPrimary || null : null,
        color_secondary: species === "cat" && form.colorSecondary ? form.colorSecondary : null,
        color_tertiary: species === "cat" && form.colorTertiary ? form.colorTertiary : null,
        age_value: form.ageValue.trim() ? Number(form.ageValue) : null,
        age_unit: form.ageValue.trim() ? form.ageUnit : null,
        sex: form.sex,
        description: form.description.trim() || null,
      };
      await updatePet(supabase, pet.id, fields);

      await setPetStatus(
        supabase,
        pet.id,
        form.status,
        isLost
          ? { city: form.city.trim(), neighborhood: form.neighborhood.trim(), details: form.details.trim() }
          : undefined,
      );

      onSaved(form.name.trim());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible guardar los cambios.");
      lock.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Modal open title={`Editar a ${pet.name}`} onClose={onClose}>
      <form className={controls.sectionBody} onSubmit={handleSubmit}>
        <PetPhotoInput onChange={setPhoto} onError={setPhotoError} disabled={isSaving} />

        <label className={controls.field}>
          Nombre
          <input className={controls.input} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
        </label>

        <div className={controls.row2}>
          <label className={controls.field}>
            Especie
            <select
              className={controls.select}
              value={form.species}
              onChange={(e) => set("species", e.target.value as PetSpecies)}
            >
              {speciesOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={controls.field}>
            Sexo
            <select className={controls.select} value={form.sex} onChange={(e) => set("sex", e.target.value as PetSex)}>
              {sexOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {form.species === "other" && (
          <label className={controls.field}>
            Tipo / especie
            <input className={controls.input} value={form.speciesOther} onChange={(e) => set("speciesOther", e.target.value)} maxLength={60} />
          </label>
        )}
        {form.species === "dog" && (
          <label className={controls.field}>
            Raza
            <input className={controls.input} value={form.breed} onChange={(e) => set("breed", e.target.value)} maxLength={100} />
          </label>
        )}
        {form.species === "cat" && (
          <div className={controls.row2}>
            <label className={controls.field}>
              Color principal
              <select className={controls.select} value={form.colorPrimary} onChange={(e) => set("colorPrimary", e.target.value)}>
                <option value="">Selecciona…</option>
                {colorOptions(form.colorSecondary, form.colorTertiary).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className={controls.field}>
              Color secundario
              <select className={controls.select} value={form.colorSecondary} onChange={(e) => set("colorSecondary", e.target.value)}>
                <option value="">Ninguno</option>
                {colorOptions(form.colorPrimary, form.colorTertiary).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className={controls.row2}>
          <label className={controls.field}>
            Edad
            <input className={controls.input} type="number" min={1} max={1200} value={form.ageValue} onChange={(e) => set("ageValue", e.target.value)} />
          </label>
          <label className={controls.field}>
            Unidad
            <select className={controls.select} value={form.ageUnit} onChange={(e) => set("ageUnit", e.target.value as PetAgeUnit)}>
              {ageUnitOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className={controls.field}>
          Descripción breve (opcional)
          <textarea
            className={controls.textarea}
            value={form.description}
            onChange={(e) => set("description", e.target.value.slice(0, DESCRIPTION_MAX))}
            maxLength={DESCRIPTION_MAX}
            rows={2}
          />
          <span className={controls.hint}>{form.description.length}/{DESCRIPTION_MAX}</span>
        </label>

        <label className={controls.field}>
          Estado
          <select
            className={controls.select}
            value={form.status}
            onChange={(e) => set("status", e.target.value as PanelPetStatus)}
          >
            {PANEL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {isLost && (
          <div className={styles.lostBlock}>
            <p className={controls.notice}>
              No incluyas datos personales (teléfono, dirección exacta, documentos): esta información se
              muestra públicamente en Huellas de Vuelta.
            </p>
            <div className={controls.row2}>
              <label className={controls.field}>
                Ciudad
                <input className={controls.input} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
              </label>
              <label className={controls.field}>
                Barrio
                <input className={controls.input} value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} maxLength={80} />
              </label>
            </div>
            <label className={controls.field}>
              Detalles (opcional)
              <textarea
                className={controls.textarea}
                value={form.details}
                onChange={(e) => set("details", e.target.value.slice(0, LOST_DETAILS_MAX))}
                maxLength={LOST_DETAILS_MAX}
                rows={2}
                placeholder="Última vez visto, seña particular, comportamiento…"
              />
              <span className={controls.hint}>{form.details.length}/{LOST_DETAILS_MAX}</span>
            </label>
          </div>
        )}

        {(error || photoError) && (
          <p className={controls.errorText}>{error || photoError}</p>
        )}

        <div className={controls.buttonRow}>
          <button type="submit" className={controls.button} disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" className={controls.buttonSecondary} onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
        </div>
      </form>

      <MedicalInfoSection petKind="owner" petId={pet.id} />
    </Modal>
  );
}
