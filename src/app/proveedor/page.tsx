"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resolvePanelSession } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchMyOrgName } from "@/lib/supabase/orgProfiles";
import OrgStatusCard from "@/components/organizacion/OrgStatusCard";
import { QrIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./proveedor.module.css";

export default function ProveedorHomePage() {
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
        <h1 className={styles.title}>Tu cuenta de proveedor</h1>
        <p className={styles.subtitle}>Bienvenido al panel de proveedores de Huellas de Vuelta.</p>
      </div>

      {companyName && (
        <div className={controls.section} style={{ marginTop: 0 }}>
          <p className={controls.sectionTitle}>Empresa</p>
          <p className={styles.subtitle} style={{ marginTop: ".4rem" }}>{companyName}</p>
        </div>
      )}

      <OrgStatusCard role="proveedor" />

      <div className={styles.card} style={{ marginTop: "1.25rem" }}>
        <p>Desde tu cuenta ya puedes:</p>
        <div className={styles.placeholderGrid}>
          <Link href="/proveedor/qr" className={styles.placeholderCard} style={{ display: "block", textDecoration: "none" }}>
            <QrIcon size={22} />
            <p className={styles.placeholderTitle}>Códigos QR</p>
            <p className={styles.placeholderText}>
              Crear lotes de códigos QR genéricos (1, 5, 10 o 20), consultar su estado y descargarlos en
              SVG, PNG o como paquete ZIP.
            </p>
          </Link>
        </div>
        <p className={styles.note}>
          La asignación de un código QR a una mascota todavía no está disponible en la plataforma: los
          códigos que generes quedan disponibles, listos para imprimir.
        </p>
      </div>
    </div>
  );
}
