"use client";

import { type FormEvent, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import PetPhotoInput, { type PreparedPhoto } from "./PetPhotoInput";
import { speciesLabels, sexLabels } from "@/lib/pets/labels";
import { bulkStatusLabels, bulkStatusOptions, type BulkPet, type BulkPetInput } from "@/lib/pets/bulkPets";
import type { PetSex, PetSpecies } from "@/lib/supabase/types";
import controls from "@/components/ui/controls.module.css";

type Mode = "view" | "edit" | "create";

const EMPTY_FORM: BulkPetInput = {
  name: "",
  species: "dog",
  speciesOther: null,
  breed: null,
  age: null,
  sex: "unspecified",
  status: "available",
  photoUrl: null,
  photoPath: null,
  intakeDate: new Date().toISOString().slice(0, 10),
};

export default function BulkPetFormModal({
  open,
  mode,
  pet,
  onClose,
  onSave,
  onCreate,
  photoPreviewUrl = null,
}: {
  open: boolean;
  mode: Mode;
  pet: BulkPet | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<BulkPetInput>, photo: PreparedPhoto | null) => Promise<void>;
  onCreate?: (input: BulkPetInput, photo: PreparedPhoto | null) => Promise<void>;
  photoPreviewUrl?: string | null;
}) {
  const [form, setForm] = useState<BulkPetInput | null>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setPhoto(null);
      setPhotoError(null);
      setError(null);
      if (mode === "create") {
        setForm({ ...EMPTY_FORM });
        return;
      }
      if (!pet) {
        setForm(null);
        return;
      }
      setForm({
        name: pet.name,
        species: pet.species,
        speciesOther: pet.speciesOther,
        breed: pet.breed,
        age: pet.age,
        sex: pet.sex,
        status: pet.status,
        photoUrl: pet.photoUrl,
        photoPath: pet.photoPath,
        intakeDate: pet.intakeDate,
      });
    });
  }, [pet, mode, open]);

  if (mode === "view") {
    if (!pet) return null;
    return (
      <Modal open={open} title={pet.name} onClose={onClose}>
        <dl className={controls.sectionBody}>
          <Field label="Especie" value={pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species]} />
          <Field label="Raza" value={pet.breed || "—"} />
          <Field label="Edad" value={pet.age || "—"} />
          <Field label="Sexo" value={sexLabels[pet.sex]} />
          <Field label="Estado" value={bulkStatusLabels[pet.status]} />
          <Field label="Fecha de ingreso" value={pet.intakeDate} />
          <Field label="Organización" value={pet.orgName} />
          <Field label="Buscando hogar" value={pet.needsHome ? "Sí" : "No"} />
          <Field label="Buscando padrino" value={pet.needsSponsor ? "Sí" : "No"} />
        </dl>
      </Modal>
    );
  }

  if (!form) return null;

  function update<K extends keyof BulkPetInput>(key: K, value: BulkPetInput[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (photoError) {
      setError(photoError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload: BulkPetInput = {
        name: form.name.trim(),
        species: form.species,
        speciesOther: form.species === "other" ? (form.speciesOther?.trim() || null) : null,
        breed: form.breed?.trim() || null,
        age: form.age?.trim() || null,
        sex: form.sex,
        status: form.status,
        photoUrl: form.photoUrl,
        photoPath: form.photoPath,
        intakeDate: form.intakeDate,
      };
      if (mode === "create") {
        await onCreate?.(payload, photo);
      } else if (pet) {
        await onSave(pet.id, payload, photo);
      }
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={open} title={mode === "create" ? "Agregar mascota" : `Editar a ${pet?.name ?? ""}`} onClose={onClose}>
      <form className={controls.sectionBody} onSubmit={handleSubmit}>
        <PetPhotoInput
          initialPreviewUrl={mode === "edit" ? photoPreviewUrl : null}
          onChange={setPhoto}
          onError={setPhotoError}
          disabled={isSaving}
        />

        <label className={controls.field}>
          Nombre
          <input className={controls.input} value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={80} />
        </label>
        <div className={controls.row2}>
          <label className={controls.field}>
            Especie
            <select className={controls.select} value={form.species} onChange={(e) => update("species", e.target.value as PetSpecies)}>
              {(Object.keys(speciesLabels) as PetSpecies[]).map((value) => (
                <option key={value} value={value}>{speciesLabels[value]}</option>
              ))}
            </select>
          </label>
          <label className={controls.field}>
            Sexo
            <select className={controls.select} value={form.sex} onChange={(e) => update("sex", e.target.value as PetSex)}>
              {(Object.keys(sexLabels) as PetSex[]).map((value) => (
                <option key={value} value={value}>{sexLabels[value]}</option>
              ))}
            </select>
          </label>
        </div>
        {form.species === "other" && (
          <label className={controls.field}>
            Tipo / especie
            <input className={controls.input} value={form.speciesOther ?? ""} onChange={(e) => update("speciesOther", e.target.value)} maxLength={60} />
          </label>
        )}
        <div className={controls.row2}>
          <label className={controls.field}>
            Raza
            <input className={controls.input} value={form.breed ?? ""} onChange={(e) => update("breed", e.target.value)} maxLength={100} />
          </label>
          <label className={controls.field}>
            Edad
            <input className={controls.input} value={form.age ?? ""} onChange={(e) => update("age", e.target.value)} maxLength={40} placeholder="3 años" />
          </label>
        </div>
        <div className={controls.row2}>
          <label className={controls.field}>
            Estado
            <select className={controls.select} value={form.status} onChange={(e) => update("status", e.target.value as BulkPetInput["status"])}>
              {bulkStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={controls.field}>
            Fecha de ingreso
            <input className={controls.input} type="date" value={form.intakeDate ?? ""} onChange={(e) => update("intakeDate", e.target.value)} />
          </label>
        </div>
        {(error || photoError) && (
          <p style={{ color: "#8b3023", fontWeight: 600, fontSize: ".85rem" }}>{error || photoError}</p>
        )}
        <div className={controls.buttonRow}>
          <button type="submit" className={controls.button} disabled={isSaving}>
            {isSaving ? "Guardando…" : mode === "create" ? "Guardar mascota" : "Guardar cambios"}
          </button>
          <button type="button" className={controls.buttonSecondary} onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: ".78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ink-600)" }}>
        {label}
      </dt>
      <dd style={{ marginTop: ".15rem", color: "var(--navy-900)" }}>{value}</dd>
    </div>
  );
}
