"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  listHelpOrganizations,
  submitReportEvent,
  uploadReportEvidence,
} from "@/lib/supabase/reportEvents";
import {
  DESCRIPTION_MAX,
  FINDER_CONTACT_MAX,
  FINDER_NAME_MAX,
  eventTypeChoices,
  orgCategoryLabels,
  petConditionOptions,
  type HelpOrganization,
  type PetCondition,
  type ReportEventType,
} from "@/lib/pets/reencuentro";
import PetPhotoInput, { type PreparedPhoto } from "@/components/mascotas/PetPhotoInput";
import {
  CheckIcon,
  CrossIcon,
  EyeIcon,
  HandIcon,
  LockIcon,
  PawIcon,
  type IconProps,
} from "@/components/icons/Icon";
import type { EventChoiceIcon } from "@/lib/pets/reencuentro";
import controls from "@/components/ui/controls.module.css";
import styles from "./foundPetWizard.module.css";

const CHOICE_ICON: Record<EventChoiceIcon, (props: IconProps) => ReactElement> = {
  eye: EyeIcon,
  hand: HandIcon,
  cross: CrossIcon,
};

type Step = "choice" | "details" | "contact" | "help" | "sending" | "done";

const STEP_LABEL: Record<Exclude<Step, "sending" | "done">, string> = {
  choice: "Paso 1 de 3",
  details: "Paso 2 de 3",
  contact: "Datos de contacto",
  help: "Busca ayuda cerca de ti",
};

export default function FoundPetWizard({
  publicId,
  reportId,
  petName,
  defaultCity,
}: {
  publicId: string;
  reportId: string;
  petName: string;
  defaultCity: string | null;
}) {
  const [step, setStep] = useState<Step>("choice");
  const [type, setType] = useState<ReportEventType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [city, setCity] = useState(defaultCity ?? "");
  const [neighborhood, setNeighborhood] = useState("");
  const [happenedOn, setHappenedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [happenedAt, setHappenedAt] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [condition, setCondition] = useState<PetCondition | null>(null);
  const [finderName, setFinderName] = useState("");
  const [finderContact, setFinderContact] = useState("");

  const [orgs, setOrgs] = useState<HelpOrganization[] | null>(null);
  const [orgsState, setOrgsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const lock = useRef(false);

  const needsContact = type === "found" || type === "found_needs_help";
  const needsHelp = type === "found_needs_help";

  // Carga de organizaciones al llegar al paso de ayuda.
  useEffect(() => {
    if (step !== "help" || orgsState !== "idle") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    Promise.resolve()
      .then(() => {
        if (!cancelled) setOrgsState("loading");
        return listHelpOrganizations(supabase, city || defaultCity);
      })
      .then((rows) => {
        if (cancelled) return;
        setOrgs(rows);
        setOrgsState("ready");
      })
      .catch(() => {
        if (!cancelled) setOrgsState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [step, orgsState, city, defaultCity]);

  const detailsProblem = useMemo(() => {
    if (!city.trim() || !neighborhood.trim()) return "Indica la ciudad y el barrio o zona aproximada.";
    if (photoError) return photoError;
    return null;
  }, [city, neighborhood, photoError]);

  const contactProblem = useMemo(() => {
    if (!condition) return "Indica cómo se encuentra la mascota.";
    if (!finderContact.trim()) return "Deja un medio de contacto (teléfono, WhatsApp o correo).";
    return null;
  }, [condition, finderContact]);

  function goDetails(nextType: ReportEventType) {
    setType(nextType);
    setError(null);
    setStep("details");
  }

  function afterDetails() {
    if (detailsProblem) {
      setError(detailsProblem);
      return;
    }
    setError(null);
    setStep(needsContact ? "contact" : "help");
    if (!needsContact) void send();
  }

  function afterContact() {
    if (contactProblem) {
      setError(contactProblem);
      return;
    }
    setError(null);
    if (needsHelp) {
      setStep("help");
    } else {
      void send();
    }
  }

  async function send(orgId: string | null = selectedOrgId) {
    if (lock.current || !type) return;
    lock.current = true;
    setError(null);
    setStep("sending");
    try {
      const supabase = createSupabaseBrowserClient();
      let photoPath: string | null = null;
      if (photo) {
        try {
          photoPath = await uploadReportEvidence(supabase, reportId, photo.blob, photo.contentType);
        } catch {
          photoPath = null; // la foto es opcional: si falla, el aviso igual se envía
        }
      }
      await submitReportEvent(supabase, {
        publicId,
        type,
        city: city.trim(),
        neighborhood: neighborhood.trim(),
        happenedOn: happenedOn || null,
        happenedAtApprox: happenedAt.trim() || null,
        description: description.trim() || null,
        petCondition: needsContact ? condition : null,
        finderName: needsContact ? finderName.trim() || null : null,
        finderContact: needsContact ? finderContact.trim() || null : null,
        selectedOrgId: needsHelp ? orgId : null,
        photoPath,
      });
      setStep("done");
    } catch (caughtError) {
      lock.current = false;
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible enviar el aviso.");
      setStep(needsHelp ? "help" : needsContact ? "contact" : "details");
    }
  }

  if (step === "done") {
    return (
      <div className={styles.wizard}>
        <div className={styles.done}>
          <span className={styles.doneMark} aria-hidden="true"><CheckIcon size={24} /></span>
          <p className={styles.doneTitle}>¡Gracias por ayudar!</p>
          <p className={styles.doneText}>
            La familia de {petName} recibió tu aviso y podrá comunicarse contigo. {petName} sigue
            marcada como perdida hasta que confirmen el reencuentro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <div className={styles.head}>
        <p className={styles.headTitle}>
          <PawIcon size={18} className={styles.headIcon} />
          Encontré esta mascota
        </p>
        {step !== "sending" && <p className={styles.headStep}>{STEP_LABEL[step]}</p>}
      </div>

      <div className={styles.body}>
        {step === "choice" && (
          <>
            <p className={styles.prompt}>¿Qué situación describe mejor lo que ocurrió?</p>
            <div className={styles.choices}>
              {eventTypeChoices.map((choice) => {
                const ChoiceIcon = CHOICE_ICON[choice.icon];
                return (
                  <button
                    key={choice.value}
                    type="button"
                    className={`${styles.choice} ${type === choice.value ? styles.choiceActive : ""}`}
                    onClick={() => goDetails(choice.value)}
                  >
                    <span className={styles.choiceIcon} aria-hidden="true"><ChoiceIcon size={22} /></span>
                    <span className={styles.choiceMain}>
                      <span className={styles.choiceTitle}>{choice.title}</span>
                      <span className={styles.choiceHint}>{choice.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "details" && (
          <>
            <p className={styles.prompt}>Cuéntanos dónde y cuándo</p>
            <p className={styles.help}>
              Usa la zona aproximada. No pidas ni escribas la dirección exacta de una vivienda.
            </p>
            <div className={controls.row2}>
              <label className={controls.field}>
                Ciudad
                <input className={controls.input} value={city} maxLength={80}
                  onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className={controls.field}>
                Barrio o zona
                <input className={controls.input} value={neighborhood} maxLength={80}
                  onChange={(e) => setNeighborhood(e.target.value)} />
              </label>
            </div>
            <div className={controls.row2}>
              <label className={controls.field}>
                Fecha
                <input className={controls.input} type="date" value={happenedOn}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setHappenedOn(e.target.value)} />
              </label>
              <label className={controls.field}>
                Hora aproximada
                <input className={controls.input} value={happenedAt} maxLength={20}
                  placeholder="Ej. 3:30 pm" onChange={(e) => setHappenedAt(e.target.value)} />
              </label>
            </div>
            <label className={controls.field}>
              {type === "sighting" ? "¿Qué observaste?" : "Descripción"}
              <textarea className={controls.textarea} rows={3} value={description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))} />
              <span className={controls.hint}>{description.length}/{DESCRIPTION_MAX}</span>
            </label>
            <PetPhotoInput onChange={setPhoto} onError={setPhotoError} />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={controls.buttonSecondary}
                onClick={() => { setError(null); setStep("choice"); }}>
                Atrás
              </button>
              <span className={styles.spacer} />
              <button type="button" className={controls.button} onClick={afterDetails}>
                {type === "sighting" ? "Enviar aviso" : "Continuar"}
              </button>
            </div>
          </>
        )}

        {step === "contact" && (
          <>
            <p className={styles.prompt}>¿Cómo se encuentra la mascota?</p>
            <div className={styles.optionGrid}>
              {petConditionOptions.map(([value, label]) => (
                <button key={value} type="button"
                  className={`${styles.option} ${condition === value ? styles.optionActive : ""}`}
                  onClick={() => setCondition(value)}>
                  {label}
                </button>
              ))}
            </div>
            <label className={controls.field}>
              Tu nombre (opcional)
              <input className={controls.input} value={finderName} maxLength={FINDER_NAME_MAX}
                onChange={(e) => setFinderName(e.target.value)} />
            </label>
            <label className={controls.field}>
              Medio de contacto
              <input className={controls.input} value={finderContact} maxLength={FINDER_CONTACT_MAX}
                placeholder="Teléfono, WhatsApp o correo"
                onChange={(e) => setFinderContact(e.target.value)} />
            </label>
            <p className={styles.privacyNote}>
              <LockIcon size={15} className={styles.privacyIcon} />
              Tus datos de contacto solo los verá la familia de la mascota. No se muestran en público.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={controls.buttonSecondary}
                onClick={() => { setError(null); setStep("details"); }}>
                Atrás
              </button>
              <span className={styles.spacer} />
              <button type="button" className={controls.button} onClick={afterContact}>
                {needsHelp ? "Continuar" : "Enviar aviso"}
              </button>
            </div>
          </>
        )}

        {step === "help" && (
          <>
            <p className={styles.prompt}>Busca ayuda cerca de ti</p>
            <p className={styles.help}>
              Estas son organizaciones verificadas por Huellas de Vuelta. Seleccionar una no significa
              que ya recibió la mascota: solo indica a dónde piensas llevarla.
            </p>
            {orgsState === "loading" && <p className={styles.help}>Cargando organizaciones…</p>}
            {orgsState === "error" && <p className={styles.error}>No fue posible cargar las organizaciones.</p>}
            {orgsState === "ready" && orgs && orgs.length === 0 && (
              <p className={styles.notice}>
                Aún no hay organizaciones aliadas verificadas en esta zona. Puedes enviar el aviso de
                todos modos y la familia se comunicará contigo.
              </p>
            )}
            {orgsState === "ready" && orgs && orgs.length > 0 && (
              <div className={styles.orgList}>
                {orgs.map((org) => (
                  <button key={org.id} type="button"
                    className={`${styles.orgCard} ${selectedOrgId === org.id ? styles.orgCardActive : ""}`}
                    onClick={() => setSelectedOrgId((current) => (current === org.id ? null : org.id))}>
                    <span className={styles.orgTag}>{orgCategoryLabels[org.category]}</span>
                    <span className={styles.orgName}>{org.name}</span>
                    <span className={styles.orgMeta}>
                      {[org.neighborhood, org.city].filter(Boolean).join(" · ") || "Ubicación no indicada"}
                      {org.phone ? ` · ${org.phone}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={controls.buttonSecondary}
                onClick={() => { setError(null); setStep("contact"); }}>
                Atrás
              </button>
              <span className={styles.spacer} />
              <button type="button" className={controls.button} onClick={() => void send()}>
                {selectedOrgId ? "Llevaré la mascota aquí" : "Enviar sin elegir organización"}
              </button>
            </div>
          </>
        )}

        {step === "sending" && <p className={styles.help}>Enviando tu aviso…</p>}
      </div>
    </div>
  );
}
