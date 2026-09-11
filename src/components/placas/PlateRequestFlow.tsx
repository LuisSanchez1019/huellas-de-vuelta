"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createPlateOrder,
  fetchMyPetsForPlate,
  fetchPlateQuote,
  formatCOP,
  plateErrorMessage,
  type PetForPlate,
  type PlateQuote,
} from "@/lib/supabase/plateOrders";
import { speciesLabels } from "@/lib/pets/labels";
import type { PetSpecies } from "@/lib/supabase/types";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./placas.module.css";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  city: "",
  neighborhood: "",
  address: "",
  phone: "",
  email: "",
};

export default function PlateRequestFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectId = params.get("pet");

  const [status, setStatus] = useState<"loading" | "ready" | "no-session">("loading");
  const [pets, setPets] = useState<PetForPlate[]>([]);
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [useAccountEmail, setUseAccountEmail] = useState(true);
  const [quote, setQuote] = useState<PlateQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const lock = useRef(false);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus("no-session");
        return;
      }
      setAccountEmail(data.session.user.email ?? "");
      try {
        const list = await fetchMyPetsForPlate(supabase);
        setPets(list);
        // Preseleccion: ?pet=<id> si es elegible.
        const wanted = preselectId && list.find((p) => p.petId === preselectId && p.eligible);
        if (wanted) setSelectedId(wanted.petId);
        setStatus("ready");
      } catch (err) {
        setError(plateErrorMessage(err));
        setStatus("ready");
      }
    });
  }, [preselectId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => pets.find((p) => p.petId === selectedId) ?? null,
    [pets, selectedId],
  );

  // Cotizacion (debounced) cuando hay mascota elegible + ciudad.
  useEffect(() => {
    let active = true;
    const id = window.setTimeout(async () => {
      if (!selected?.eligible || form.city.trim().length < 3) {
        if (active) {
          setQuote(null);
          setQuoting(false);
        }
        return;
      }
      if (active) setQuoting(true);
      try {
        const result = await fetchPlateQuote(createSupabaseBrowserClient(), selected.petId, form.city.trim());
        if (active) setQuote(result);
      } catch {
        if (active) setQuote(null);
      } finally {
        if (active) setQuoting(false);
      }
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [selected, form.city]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const eligiblePets = pets.filter((p) => p.eligible);
  const problem = useMemo(() => {
    if (!selected) return "Selecciona una mascota.";
    if (!selected.eligible) return selected.reason ?? "Esta mascota no puede solicitar una placa.";
    if (!form.firstName.trim() || !form.lastName.trim()) return "Ingresa nombre y apellido de quien recibe.";
    if (form.city.trim().length < 3) return "Ingresa la ciudad de envío.";
    if (!form.neighborhood.trim()) return "Ingresa el barrio.";
    if (form.address.trim().length < 3) return "Ingresa la dirección de envío.";
    if (form.phone.trim().length < 5) return "Ingresa un número de celular válido.";
    if (!useAccountEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      return "Ingresa un correo electrónico válido.";
    }
    if (!quote) return "Calculando el envío…";
    return null;
  }, [selected, form, useAccountEmail, quote]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (problem) {
      setError(problem);
      return;
    }
    lock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createPlateOrder(createSupabaseBrowserClient(), {
        petId: selected!.petId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        city: form.city.trim(),
        neighborhood: form.neighborhood.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: useAccountEmail ? accountEmail : form.email.trim(),
        useAccountEmail,
      });
      router.push(`/dashboard/pedidos/${result.orderId}?created=1`);
    } catch (err) {
      setError(plateErrorMessage(err));
      lock.current = false;
      setSubmitting(false);
    }
  }

  if (status === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (status === "no-session") {
    return <p className={styles.emptyText}>Inicia sesión con una cuenta real para solicitar una placa.</p>;
  }

  return (
    <form className={styles.flow} onSubmit={submit}>
      <section className={controls.section}>
        <p className={controls.sectionTitle}>Mascota asignada</p>
        <div className={controls.sectionBody}>
          {pets.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No tienes mascotas registradas todavía.</p>
              <p className={styles.emptyText}>
                Registra tu mascota para poder solicitar su placa.
              </p>
              <Link className={controls.button} href="/dashboard/mascotas/nueva?returnTo=solicitar-placa">
                Crear mascota
              </Link>
            </div>
          ) : (
            <div className={styles.petList}>
              {pets.map((pet) => (
                <button
                  key={pet.petId}
                  type="button"
                  className={`${styles.petOption} ${selectedId === pet.petId ? styles.petOptionActive : ""}`}
                  aria-pressed={selectedId === pet.petId}
                  disabled={!pet.eligible}
                  onClick={() => setSelectedId(pet.petId)}
                >
                  <span className={styles.petMain}>
                    <span className={styles.petName}>{pet.name}</span>
                    <span className={styles.petMeta}>
                      {speciesLabels[pet.species as PetSpecies] ?? pet.species}
                      {" · "}
                      {pet.plateCode
                        ? `Placa: ${pet.plateCode}`
                        : pet.activeOrderRef
                          ? "Solicitud pendiente"
                          : "Sin placa"}
                    </span>
                    {!pet.eligible && pet.reason && (
                      <span className={styles.petMeta}>{pet.reason}</span>
                    )}
                  </span>
                  {pet.eligible ? (
                    <span className={styles.petTag}>Elegible</span>
                  ) : (
                    <span className={styles.petTag}>No disponible</span>
                  )}
                </button>
              ))}
              <Link
                className={styles.rowButton}
                href="/dashboard/mascotas/nueva?returnTo=solicitar-placa"
                style={{ marginTop: ".3rem" }}
              >
                Registrar otra mascota
              </Link>
              {eligiblePets.length === 0 && (
                <p className={styles.petMeta}>Ninguna de tus mascotas puede solicitar una placa ahora mismo.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {selected?.eligible && (
        <>
          <section className={controls.section}>
            <p className={controls.sectionTitle}>Datos de envío</p>
            <div className={controls.sectionBody}>
              <div className={controls.row2}>
                <label className={controls.field}>
                  Nombre
                  <input className={controls.input} value={form.firstName} maxLength={80}
                    onChange={(e) => set("firstName", e.target.value)} />
                </label>
                <label className={controls.field}>
                  Apellido
                  <input className={controls.input} value={form.lastName} maxLength={80}
                    onChange={(e) => set("lastName", e.target.value)} />
                </label>
              </div>
              <div className={controls.row2}>
                <label className={controls.field}>
                  Ciudad
                  <input className={controls.input} value={form.city} maxLength={80}
                    onChange={(e) => set("city", e.target.value)} placeholder="Bucaramanga" />
                </label>
                <label className={controls.field}>
                  Barrio
                  <input className={controls.input} value={form.neighborhood} maxLength={80}
                    onChange={(e) => set("neighborhood", e.target.value)} />
                </label>
              </div>
              <label className={controls.field}>
                Dirección
                <input className={controls.input} value={form.address} maxLength={200}
                  onChange={(e) => set("address", e.target.value)} placeholder="Calle 00 # 00-00, apto…" />
              </label>
              <div className={controls.row2}>
                <label className={controls.field}>
                  Número celular
                  <input className={controls.input} value={form.phone} maxLength={30} inputMode="tel"
                    onChange={(e) => set("phone", e.target.value)} />
                </label>
                <label className={controls.field}>
                  Correo electrónico
                  <input
                    className={controls.input}
                    type="email"
                    value={useAccountEmail ? accountEmail : form.email}
                    disabled={useAccountEmail}
                    maxLength={160}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </label>
              </div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={useAccountEmail}
                  onChange={(e) => setUseAccountEmail(e.target.checked)}
                />
                <span>Usar el correo de mi cuenta ({accountEmail || "sin correo"}).</span>
              </label>
              <p className={controls.notice}>
                Tus datos de envío son privados: no aparecen en la página pública de la mascota ni se
                comparten con otros usuarios.
              </p>
            </div>
          </section>

          <section className={controls.section}>
            <p className={controls.sectionTitle}>Resumen</p>
            <div className={controls.sectionBody}>
              <div className={styles.summary}>
                <div className={styles.summaryRow}>
                  <span>Mascota</span>
                  <span>{selected.name}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Zona de envío</span>
                  <span>{quoting ? "Calculando…" : quote?.zoneName ?? "Indica la ciudad"}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Placa</span>
                  <span>{quote ? formatCOP(quote.productAmount, quote.currency) : "—"}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Envío</span>
                  <span>{quote ? formatCOP(quote.shippingAmount, quote.currency) : "—"}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>Total</span>
                  <span>{quote ? formatCOP(quote.totalAmount, quote.currency) : "—"}</span>
                </div>
              </div>
              <p className={styles.provisional}>
                Los valores son provisionales y los calcula Huellas de Vuelta. El pago se coordina
                después de confirmar la solicitud.
              </p>

              {error && <p className={controls.errorText}>{error}</p>}

              <div className={controls.buttonRow}>
                <button type="submit" className={controls.button} disabled={submitting || Boolean(problem)}>
                  {submitting ? "Enviando…" : "Confirmar solicitud"}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </form>
  );
}
