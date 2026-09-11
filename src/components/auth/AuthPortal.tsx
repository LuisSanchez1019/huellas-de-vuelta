"use client";

import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { translateAuthError } from "@/lib/supabase/errors";
import { resolvePanelSession } from "@/lib/auth/session";
import {
  accountExistsMessage,
  fetchAccountRoleForEmail,
  roleMismatchLoginMessage,
} from "@/lib/auth/accountRole";
import { roleHome, type AccountRole } from "@/lib/auth/roles";
import { orgNameAvailable, type OrgNameKind } from "@/lib/supabase/orgProfiles";
import { DATA_POLICY_PATH, DATA_POLICY_VERSION } from "@/lib/legal/policy";
import { CheckIcon, HeartIcon, StethoscopeIcon, UserIcon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "@/app/auth/page.module.css";

type Mode = "sign-in" | "sign-up";
export type PortalVariant = "usuario" | "veterinaria" | "fundacion" | "aliado";

interface VariantConfig {
  role: AccountRole;
  title: string;
  eyebrow: string;
  hint: string;
  description: string;
  icon: React.ReactNode;
  /** Etiqueta del campo "nombre de la organización" (solo vet/fun). */
  orgNameLabel?: string;
  orgNamePlaceholder?: string;
  note?: string;
}

const CONFIG: Record<PortalVariant, VariantConfig> = {
  usuario: {
    role: "usuario",
    title: "Ingreso de usuarios",
    eyebrow: "Propietarios y usuarios",
    hint: "Accede a tus mascotas, reportes y notificaciones.",
    description: "Accede a tus mascotas, reportes y notificaciones.",
    icon: <UserIcon size={18} />,
  },
  veterinaria: {
    role: "veterinaria",
    title: "Ingreso de Veterinaria",
    eyebrow: "Cuenta de organización",
    hint: "Gestiona tu veterinaria y ayuda a las mascotas de tu comunidad.",
    description: "Accede a la cuenta de tu organización y administra su información.",
    icon: <StethoscopeIcon size={18} />,
    orgNameLabel: "Nombre de la veterinaria",
    orgNamePlaceholder: "Clínica Veterinaria Huellas",
    note:
      "El nombre de la veterinaria corresponde al nombre con el que aparecerá asociada esta cuenta. Podrás completar el resto del perfil (logo, dirección, servicios…) después de crear la cuenta. Las cuentas nuevas quedan pendientes hasta que un administrador las aprueba.",
  },
  fundacion: {
    role: "fundacion",
    title: "Ingreso de Fundación",
    eyebrow: "Cuenta de organización",
    hint: "Gestiona tu fundación y apoya el bienestar animal.",
    description: "Accede a la cuenta de tu organización y administra su información.",
    icon: <HeartIcon size={18} />,
    orgNameLabel: "Nombre de la fundación",
    orgNamePlaceholder: "Fundación Huellas de Amor",
    note:
      "El nombre de la fundación corresponde al nombre con el que aparecerá asociada esta cuenta. Podrás completar el resto del perfil (logo, dirección, servicios…) después de crear la cuenta. Las cuentas nuevas quedan pendientes hasta que un administrador las aprueba.",
  },
  aliado: {
    role: "aliado",
    title: "Ingreso de aliados",
    eyebrow: "Empresas y patrocinadores",
    hint: "Accede como aliado de Huellas de Vuelta.",
    description: "Accede como aliado de Huellas de Vuelta.",
    icon: <CheckIcon size={18} />,
    orgNameLabel: "Nombre de la empresa",
    orgNamePlaceholder: "Empresa XYZ S.A.S.",
    note:
      "El nombre de la empresa corresponde al nombre con el que tu empresa aparecerá asociada a esta cuenta; es un dato distinto de tu nombre personal. El panel de aliados (perfil de empresa, campañas y patrocinios) estará disponible más adelante.",
  },
};

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.4 4.7A10.9 10.9 0 0 1 12 4.5c5 0 9 4 10.5 7.5-.6 1.4-1.5 2.8-2.7 4M6.2 6.2C4 7.7 2.4 9.7 1.5 12c1.5 3.5 5.5 7.5 10.5 7.5 1.3 0 2.5-.2 3.6-.6" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PortalForm({ variant }: { variant: PortalVariant }) {
  const cfg = CONFIG[variant];
  // Vet/fun/aliado piden "nombre de organización/empresa"; solo vet/fun vienen del selector /auth/vet-fun.
  const hasOrgName = variant !== "usuario";
  const isVetFun = variant === "veterinaria" || variant === "fundacion";
  const orgKindLabel =
    variant === "veterinaria" ? "veterinaria" : variant === "fundacion" ? "fundación" : "empresa aliada";
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "sign-in" ? "sign-in" : "sign-up";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }
  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    setPolicyAccepted(false);
    resetFeedback();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    resetFeedback();

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const orgName = String(formData.get("orgName") ?? "").trim().replace(/\s+/g, " ");
    const displayName = `${firstName} ${lastName}`.trim();

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (mode === "sign-up" && password !== String(formData.get("confirmPassword") ?? "")) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (mode === "sign-up" && hasOrgName && orgName.length < 2) {
      setError(`Escribe el ${cfg.orgNameLabel?.toLowerCase()}.`);
      return;
    }
    if (mode === "sign-up" && !policyAccepted) {
      setError(
        "Debes leer y aceptar la Política de Tratamiento de Datos Personales para crear la cuenta.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "sign-up") {
        // Un correo = una cuenta.
        const existingRole = await fetchAccountRoleForEmail(supabase, email);
        if (existingRole) {
          setError(
            existingRole === cfg.role
              ? "Este correo ya tiene una cuenta. Inicia sesión."
              : accountExistsMessage(existingRole),
          );
          return;
        }

        // Nombre de organización/empresa duplicado: se valida ANTES de crear la
        // cuenta (la garantía real es el índice único (kind, name_norm) en BD +
        // handle_new_user).
        if (hasOrgName) {
          const available = await orgNameAvailable(supabase, cfg.role as OrgNameKind, orgName);
          if (!available) {
            setError(
              `Esta ${orgKindLabel} ya está registrada. ` +
                "Si eres el responsable, inicia sesión con la cuenta correspondiente.",
            );
            return;
          }
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // El servidor (trigger handle_new_user) fija el rol real y crea la
            // organización a partir de esta lista blanca + org_name.
            data: {
              display_name: displayName,
              first_name: firstName,
              last_name: lastName,
              role: cfg.role,
              // Consentimiento OBLIGATORIO de la Politica de Tratamiento de Datos
              // Personales. El servidor (handle_new_user) lo revalida y lo
              // registra en user_policy_consents; sin esto el registro se rechaza.
              policy_consent_version: DATA_POLICY_VERSION,
              ...(hasOrgName ? { org_name: orgName } : {}),
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) {
          if (hasOrgName && /organization_profiles|name_norm|duplicate key/i.test(signUpError.message)) {
            setError(`Esta ${orgKindLabel} ya está registrada.`);
            return;
          }
          throw signUpError;
        }

        form.reset();
        setShowPassword(false);
        setShowConfirmPassword(false);
        setPolicyAccepted(false);

        if (data.session) {
          const check = await resolvePanelSession();
          router.push(
            check.status === "authenticated" ? roleHome[check.session.role] : roleHome[cfg.role],
          );
        } else {
          setMessage("Revisa tu correo para confirmar la cuenta antes de iniciar sesión.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        // El rol REAL (profiles.role, server-side) manda: si no es el de este
        // portal, se cierra la sesión y se bloquea el acceso.
        const check = await resolvePanelSession();
        const realRole = check.status === "authenticated" ? check.session.role : null;
        if (!realRole || realRole !== cfg.role) {
          await supabase.auth.signOut();
          setError(realRole ? roleMismatchLoginMessage(realRole) : "No fue posible validar la cuenta.");
          return;
        }

        form.reset();
        setShowPassword(false);
        router.push(roleHome[realRole]);
      }
    } catch (caughtError) {
      setError(translateAuthError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.themeSlot}>
        <ThemeToggle />
      </div>

      <div className={styles.shell}>
        <aside className={styles.brandPanel}>
          <Link className={styles.brandBack} href={isVetFun ? "/auth/vet-fun" : "/"}>← Volver</Link>
          <div className={styles.brandMain}>
            <Image className={styles.brandLogo} src="/logo-emblem-hdv.png" alt="Huellas de Vuelta" width={2000} height={2000} priority />
            <p className={styles.brandName}>Huellas de Vuelta</p>
            <p className={styles.brandTagline}>Ayudamos a que cada mascota vuelva a casa.</p>
            <ul className={styles.brandPoints}>
              <li><CheckIcon size={18} /> Placas QR que conectan a quien encuentra con la familia.</li>
              <li><CheckIcon size={18} /> Reportes de mascotas perdidas y encontradas.</li>
              <li><CheckIcon size={18} /> {cfg.hint}</li>
            </ul>
          </div>
          <p className={styles.brandFoot}>Acceso seguro · Tus datos están protegidos.</p>
        </aside>

        <section className={styles.card} aria-labelledby="auth-title">
          <p className={styles.eyebrow}>{cfg.eyebrow}</p>
          <h1 id="auth-title">
            <span className={styles.titleIcon} aria-hidden="true">{cfg.icon}</span> {cfg.title}
          </h1>
          <p className={styles.description}>{cfg.description}</p>

          <div className={styles.tabs} role="tablist" aria-label="Opciones de acceso">
            <button className={mode === "sign-up" ? styles.activeTab : styles.tab} onClick={() => handleModeChange("sign-up")} type="button">Crear cuenta</button>
            <button className={mode === "sign-in" ? styles.activeTab : styles.tab} onClick={() => handleModeChange("sign-in")} type="button">Iniciar sesión</button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {mode === "sign-up" && (
              <div className={styles.nameRow}>
                <label>Nombre<input name="firstName" autoComplete="given-name" maxLength={60} required /></label>
                <label>Apellido<input name="lastName" autoComplete="family-name" maxLength={60} required /></label>
              </div>
            )}

            {mode === "sign-up" && hasOrgName && (
              <label>
                {cfg.orgNameLabel}
                <input name="orgName" maxLength={120} placeholder={cfg.orgNamePlaceholder} required />
              </label>
            )}

            <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>

            <label>
              Contraseña
              <div className={styles.passwordField}>
                <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required />
                <button className={styles.toggleVisibility} type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>
            </label>

            {mode === "sign-in" && (
              <div className={styles.forgotRow}>
                <Link className={styles.forgotLink} href="/auth/recuperar">¿Olvidaste tu contraseña?</Link>
              </div>
            )}

            {mode === "sign-up" && (
              <label>
                Confirmar contraseña
                <div className={styles.passwordField}>
                  <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required />
                  <button className={styles.toggleVisibility} type="button" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showConfirmPassword}>
                    <EyeIcon hidden={showConfirmPassword} />
                  </button>
                </div>
              </label>
            )}

            {mode === "sign-up" && (
              <div className={styles.consent}>
                <label className={styles.consentRow}>
                  {/* Sin `required` nativo: la validación explícita (mensaje en
                      español) la hace handleSubmit, y el servidor la revalida en
                      handle_new_user. */}
                  <input
                    type="checkbox"
                    name="policyConsent"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                    aria-describedby="policy-consent-note"
                  />
                  <span>
                    He leído y acepto la{" "}
                    <Link
                      className={styles.consentLink}
                      href={DATA_POLICY_PATH}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Política de Tratamiento de Datos Personales
                    </Link>{" "}
                    de Huellas de Vuelta y autorizo el tratamiento de mis datos personales de acuerdo con
                    las finalidades informadas.
                  </span>
                </label>
                <p id="policy-consent-note" className={styles.consentNote}>
                  El tratamiento de tus datos personales se realizará de acuerdo con nuestra Política de
                  Tratamiento de Datos Personales. Puedes consultar, actualizar, rectificar o solicitar la
                  supresión de tus datos cuando corresponda.
                </p>
              </div>
            )}

            {error && <p className={styles.error} role="alert">{error}</p>}
            {message && <p className={styles.message} role="status">{message}</p>}
            <button className={styles.submit} disabled={isSubmitting} type="submit">
              {isSubmitting ? "Procesando…" : mode === "sign-up" ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </form>

          {cfg.note && <p className={styles.centerNote}>{cfg.note}</p>}

          <p className={styles.switchLine}>
            {mode === "sign-up" ? "¿Ya tienes cuenta? " : "¿No tienes una cuenta? "}
            <button type="button" className={styles.switchButton} onClick={() => handleModeChange(mode === "sign-up" ? "sign-in" : "sign-up")}>
              {mode === "sign-up" ? "Inicia sesión" : "Crear cuenta"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function AuthPortal({ variant }: { variant: PortalVariant }) {
  return (
    <Suspense fallback={null}>
      <PortalForm variant={variant} />
    </Suspense>
  );
}
