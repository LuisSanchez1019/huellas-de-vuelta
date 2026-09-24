"use client";

import { type FormEvent, useEffect, useState } from "react";
import { proveedorRepository } from "@/lib/proveedores/repository";
import { EMPTY_PROVEEDOR_INPUT, type ProveedorProfileInput } from "@/lib/proveedores/types";
import { ProfileSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

/**
 * Perfil mínimo de la empresa proveedora: identidad y contacto comercial.
 * Sin logo, ubicación ni servicios — el proveedor no tiene directorio
 * público en este bloque; esos campos llegarán junto con el flujo de QR.
 */
export default function ProveedorProfileForm({ ownerId }: { ownerId: string }) {
  const [form, setForm] = useState<ProveedorProfileInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    proveedorRepository
      .getMine(ownerId)
      .then((profile) => {
        if (!active) return;
        setForm(
          profile
            ? { name: profile.name, email: profile.email, phone: profile.phone, whatsapp: profile.whatsapp }
            : { ...EMPTY_PROVEEDOR_INPUT },
        );
      })
      .catch(() => {
        if (active) setForm({ ...EMPTY_PROVEEDOR_INPUT });
      });
    return () => {
      active = false;
    };
  }, [ownerId]);

  if (!form) return <ProfileSkeletonBody />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = form;
    if (!current) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await proveedorRepository.saveMine(ownerId, current);
      setSaved(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible guardar el perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={controls.sectionBody} onSubmit={handleSubmit}>
      <label className={controls.field}>
        Nombre del proveedor/empresa
        <input
          className={controls.input}
          value={form.name}
          maxLength={120}
          required
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>

      <div className={controls.row2}>
        <label className={controls.field}>
          Correo de contacto
          <input
            className={controls.input}
            type="email"
            value={form.email}
            maxLength={160}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>
        <label className={controls.field}>
          Teléfono
          <input
            className={controls.input}
            value={form.phone}
            maxLength={30}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </label>
      </div>

      <label className={controls.field}>
        WhatsApp
        <input
          className={controls.input}
          value={form.whatsapp}
          maxLength={30}
          onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
        />
      </label>

      {error && <p className={controls.errorText}>{error}</p>}
      {saved && !error && <p className={controls.notice}>Perfil guardado.</p>}

      <div className={controls.buttonRow}>
        <button type="submit" className={controls.button} disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar perfil"}
        </button>
      </div>
    </form>
  );
}
