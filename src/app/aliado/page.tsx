"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchMyOrgName } from "@/lib/supabase/orgProfiles";
import OrgStatusCard from "@/components/organizacion/OrgStatusCard";
import { CheckIcon, HandIcon, HeartIcon, LockIcon, PawIcon, PinIcon, UserIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./aliado.module.css";

const SHORTCUTS = [
  { href: "/aliado/perfil", icon: <UserIcon size={18} />, label: "Perfil de tu empresa" },
  { href: "/aliado/mascotas", icon: <PawIcon size={18} />, label: "Mis mascotas" },
  { href: "/aliado/apadrina", icon: <HandIcon size={18} />, label: "Apadrina una mascota" },
  { href: "/aliado/mascotas-perdidas", icon: <PinIcon size={18} />, label: "Mascotas perdidas" },
  { href: "/aliado/visibilidad", icon: <HeartIcon size={18} />, label: "Apoya a Huellas de Vuelta" },
  { href: "/aliado/configuracion/seguridad", icon: <LockIcon size={18} />, label: "Seguridad y privacidad" },
];

export default function AliadoHomePage() {
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    resolvePanelSession().then(async (check) => {
      if (check.status === "unauthenticated" || check.status === "dev" || check.status === "error") return;
      try {
        setCompanyName(await fetchMyOrgName(createSupabaseBrowserClient(), check.session.userId));
      } catch {
        /* si falla, no se muestra la fila */
      }
    });
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>Tu cuenta de aliado está activa</h1>
        <p className={styles.subtitle}>Gracias por sumarte a Huellas de Vuelta.</p>
      </div>

      {companyName && (
        <div className={controls.section} style={{ marginTop: 0 }}>
          <p className={controls.sectionTitle}>Empresa</p>
          <p className={styles.subtitle} style={{ marginTop: ".4rem" }}>{companyName}</p>
        </div>
      )}

      <OrgStatusCard role="aliado" />

      <div className={styles.card}>
        <p>Desde tu cuenta ya puedes:</p>
        <ul className={styles.list}>
          {SHORTCUTS.map((item) => (
            <li key={item.href}>
              <CheckIcon size={16} />
              <Link href={item.href} className={styles.shortcutLink}>{item.label}</Link>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Las campañas propias de tu empresa estarán disponibles más adelante.
        </p>
      </div>
    </div>
  );
}
