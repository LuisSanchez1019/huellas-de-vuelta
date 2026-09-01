"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createPet, setPetPhotoPath, uploadPetPhoto } from "@/lib/supabase/pets";
import type { PetAgeUnit, PetInput, PetSex, PetSpecies } from "@/lib/supabase/types";
import {
  CAT_COLORS,
  ageUnitOptions,
  sexOptions,
  speciesOptions,
} from "@/lib/pets/labels";
import PetPhotoInput, { type PreparedPhoto } from "./PetPhotoInput";
import Toast, { type ToastState } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import styles from "./registerPet.module.css";

const DESCRIPTION_MAX = 80;

type OwnerStatus = "checking" | "ready" | "no-session";

const EMPTY = {
  species: "" as "" | PetSpecies,
  name: "",
  ageValue: "",
  ageUnit: "years" as PetAgeUnit,
  sex: "" as "" | PetSex,
  breed: "",
  speciesOther: "",
  colorPrimary: "",
  colorSecondary: "",
  colorTertiary: "",
  description: "",
};

export default function RegisterPetForm() {
  const router = useRouter();

  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>("checking");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");

  const [form, setForm] = useState({ ...EMPTY });
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) {
        setOwnerStatus("no-session");
        return;
      }
      const metadataName = session.user.user_metadata?.display_name;
      setOwnerId(session.user.id);
      setOwnerName(
        (typeof metadataName === "string" && metadataName.trim()) || session.user.email || "Tu cuenta",
      );
      setOwnerStatus("ready");
    });
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSpeciesChange(next: "" | PetSpecies) {
    setForm((current) => ({
      ...current,
      species: next,
      breed: next === "dog" ? current.breed : "",
      speciesOther: next === "other" ? current.speciesOther : "",
      colorPrimary: next === "cat" ? current.colorPrimary : "",
      colorSecondary: next === "cat" ? current.colorSecondary : "",
      colorTertiary: next === "cat" ? current.colorTertiary : "",
    }));
  }

  const isDirty = useMemo(() => {
    // `ageUnit` se omite: su valor por defecto no cuenta como "sucio".
    return (
      form.species !== "" ||
      form.name !== "" ||
      form.ageValue !== "" ||
      form.sex !== "" ||
      form.breed !== "" ||
      form.speciesOther !== "" ||
      form.colorPrimary !== "" ||
      form.colorSecondary !== "" ||
      form.colorTertiary !== "" ||
      form.description !== "" ||
      photo !== null
    );
  }, [form, photo]);

  function colorOptions(...taken: string[]) {
    return CAT_COLORS.filter((color) => !taken.includes(color.value));
  }

  function requestClear() {
    if (isDirty) {
      setConfirmClearOpen(true);
      return;
    }
    doClear();
  }

  function doClear() {
    setForm({ ...EMPTY });
    setPhoto(null);
    setPhotoError(null);
    setPhotoInputKey((key) => key + 1);
    setToast(null);
    setConfirmClearOpen(false);
  }

  function validate(): string | null {
    if (!form.species) return "Selecciona el tipo de mascota.";
    if (!form.name.trim()) return "Ingresa el nombre de la mascota.";

    if (!form.ageValue.trim()) return "Ingresa la edad de la mascota.";
    const age = Number(form.ageValue);
    if (!Number.isInteger(age) || age < 1 || age > 1200) {
      return "La edad debe ser un número entero válido.";
    }

    if (!form.sex) return "Selecciona el sexo de la mascota.";

    if (form.species === "cat" && !form.colorPrimary) return "Selecciona el color principal.";
    if (form.species === "dog" && !form.breed.trim()) return "Ingresa la raza de la mascota.";
    if (form.species === "other" && !form.speciesOther.trim()) {
      return "Indica el tipo o especie de la mascota.";
    }

    if (form.description.trim().length > DESCRIPTION_MAX) {
      return `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres.`;
    }

    if (photoError) return photoError;
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;

    const problem = validate();
    if (problem) {
      setToast({ variant: "error", message: problem });
      return;
    }
    if (!ownerId) {
      setToast({
        variant: "error",
        message: "Necesitas iniciar sesión con una cuenta real para registrar una mascota.",
      });
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
    setToast(null);

    const species = form.species as PetSpecies;
    const input: PetInput = {
      name: form.name.trim(),
      species,
      status: "at_home",
      species_other: species === "other" ? form.speciesOther.trim() : null,
      breed: species === "dog" ? form.breed.trim() : null,
      color_primary: species === "cat" ? form.colorPrimary : null,
      color_secondary: species === "cat" && form.colorSecondary ? form.colorSecondary : null,
      color_tertiary: species === "cat" && form.colorTertiary ? form.colorTertiary : null,
      age_value: Number(form.ageValue),
      age_unit: form.ageUnit,
      sex: form.sex as PetSex,
      description: form.description.trim() || null,
      photo_path: null,
    };

    try {
      const supabase = createSupabaseBrowserClient();
      const pet = await createPet(supabase, ownerId, input);

      let photoFailed = false;
      if (photo) {
        try {
          const path = await uploadPetPhoto(supabase, ownerId, pet.id, photo.blob, photo.contentType);
          await setPetPhotoPath(supabase, pet.id, path);
        } catch {
          photoFailed = true;
        }
      }

      const params = new URLSearchParams({ created: pet.name });
      if (photoFailed) params.set("photo", "failed");
      router.push(`/dashboard/mascotas?${params.toString()}`);
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar la mascota.",
      });
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  if (ownerStatus === "checking") {
    return <p className={styles.loading}>Cargando…</p>;
  }

  const disabled = isSubmitting || ownerStatus !== "ready";

  return (
    <>
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {ownerStatus === "no-session" && (
        <p className={styles.notice} role="status">
          Estás viendo el panel en modo desarrollo. Inicia sesión con una cuenta real para poder registrar una mascota.
        </p>
      )}

      <PetPhotoInput
        key={photoInputKey}
        disabled={disabled}
        onChange={setPhoto}
        onError={setPhotoError}
      />
      {photoError && <p className={styles.fieldError} role="alert">{photoError}</p>}

      <label>
        Tipo de mascota
        <select
          value={form.species}
          onChange={(event) => handleSpeciesChange(event.target.value as "" | PetSpecies)}
          disabled={disabled}
        >
          <option value="">Selecciona…</option>
          {speciesOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      {form.species && (
        <>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              maxLength={80}
              disabled={disabled}
            />
          </label>

          <div className={styles.row}>
            <label>
              Edad
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1200}
                value={form.ageValue}
                onChange={(event) => update("ageValue", event.target.value)}
                disabled={disabled}
              />
            </label>
            <label>
              Unidad
              <select
                value={form.ageUnit}
                onChange={(event) => update("ageUnit", event.target.value as PetAgeUnit)}
                disabled={disabled}
              >
                {ageUnitOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          {form.species === "other" && (
            <label>
              Tipo / especie
              <input
                value={form.speciesOther}
                onChange={(event) => update("speciesOther", event.target.value)}
                maxLength={60}
                placeholder="Conejo, ave, tortuga…"
                disabled={disabled}
              />
            </label>
          )}

          {form.species === "dog" && (
            <label>
              Raza
              <input
                value={form.breed}
                onChange={(event) => update("breed", event.target.value)}
                maxLength={100}
                placeholder="Escribe la raza"
                disabled={disabled}
              />
            </label>
          )}

          {form.species === "cat" && (
            <>
              <label>
                Color principal
                <select
                  value={form.colorPrimary}
                  onChange={(event) => update("colorPrimary", event.target.value)}
                  disabled={disabled}
                >
                  <option value="">Selecciona…</option>
                  {colorOptions(form.colorSecondary, form.colorTertiary).map((color) => (
                    <option key={color.value} value={color.value}>{color.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Color secundario (opcional)
                <select
                  value={form.colorSecondary}
                  onChange={(event) => update("colorSecondary", event.target.value)}
                  disabled={disabled}
                >
                  <option value="">Ninguno</option>
                  {colorOptions(form.colorPrimary, form.colorTertiary).map((color) => (
                    <option key={color.value} value={color.value}>{color.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Color adicional (opcional)
                <select
                  value={form.colorTertiary}
                  onChange={(event) => update("colorTertiary", event.target.value)}
                  disabled={disabled}
                >
                  <option value="">Ninguno</option>
                  {colorOptions(form.colorPrimary, form.colorSecondary).map((color) => (
                    <option key={color.value} value={color.value}>{color.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            Sexo
            <select
              value={form.sex}
              onChange={(event) => update("sex", event.target.value as "" | PetSex)}
              disabled={disabled}
            >
              <option value="">Selecciona…</option>
              {sexOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Propietario
            <input value={ownerName} disabled readOnly />
            <span className={styles.help}>Se toma automáticamente de tu cuenta y no se puede cambiar.</span>
          </label>

          <label>
            Descripción breve (opcional)
            <textarea
              value={form.description}
              onChange={(event) => update("description", event.target.value.slice(0, DESCRIPTION_MAX))}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              disabled={disabled}
            />
            <span className={styles.help}>{form.description.length}/{DESCRIPTION_MAX}</span>
          </label>

          <p className={styles.statusHint}>
            La mascota se registrará con el estado <strong>En casa</strong>.
          </p>
        </>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={disabled}>
          {isSubmitting ? "Guardando…" : "Guardar mascota"}
        </button>
        <button type="button" className={styles.clear} onClick={requestClear} disabled={isSubmitting}>
          Limpiar campos
        </button>
      </div>
    </form>

    <ConfirmDialog
      open={confirmClearOpen}
      title="Limpiar campos"
      message="Se borrará toda la información que ingresaste en este formulario. Esta acción no se puede deshacer."
      confirmLabel="Sí, borrar"
      cancelLabel="Cancelar"
      tone="danger"
      onConfirm={doClear}
      onCancel={() => setConfirmClearOpen(false)}
    />

    {toast && (
      <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />
    )}
    </>
  );
}
