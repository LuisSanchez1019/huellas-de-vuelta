"use client";

import { useState } from "react";
import { HandIcon } from "@/components/icons/Icon";
import Modal from "@/components/ui/Modal";
import type { PublicActiveAlly } from "@/lib/supabase/publicCache";
import styles from "./landing.module.css";

/**
 * Tarjeta pública de un aliado + modal "+ Información". Solo muestra los
 * campos que la RPC `list_public_active_allies` ya entrega (nunca datos de
 * la cuenta que administra el perfil: sin nombre/apellido del responsable,
 * correo de login ni teléfono personal — eso no forma parte de este tipo).
 */
export default function AllyCard({ ally }: { ally: PublicActiveAlly }) {
  const [open, setOpen] = useState(false);

  return (
    <li className={styles.allyCard}>
      {ally.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo público de Supabase Storage
        <img src={ally.logoUrl} alt={ally.name} className={styles.allyLogo} />
      ) : (
        <span className={styles.allyLogoPlaceholder} aria-hidden="true"><HandIcon size={22} /></span>
      )}
      <span className={styles.allyName}>{ally.name}</span>
      <span className={styles.allyTag}>Aliado de Huellas de Vuelta</span>
      {(ally.sectorName || ally.city) && (
        <span className={styles.allyMeta}>{[ally.sectorName, ally.city].filter(Boolean).join(" · ")}</span>
      )}
      <button type="button" className={styles.allyInfoBtn} onClick={() => setOpen(true)}>
        + Información
      </button>

      <Modal open={open} title={ally.name} onClose={() => setOpen(false)}>
        <div className={styles.allyModal}>
          {ally.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logo público de Supabase Storage
            <img src={ally.logoUrl} alt={ally.name} className={styles.allyModalLogo} />
          )}
          <p className={styles.allyTag}>Aliado de Huellas de Vuelta</p>

          {ally.sectorName && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Sector</span>
              <span className={styles.allyModalValue}>{ally.sectorName}</span>
            </div>
          )}
          {ally.description && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Sobre la empresa</span>
              <span className={styles.allyModalValue}>{ally.description}</span>
            </div>
          )}
          {(ally.country || ally.city) && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Ubicación</span>
              <span className={styles.allyModalValue}>{[ally.city, ally.country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {ally.address && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Dirección</span>
              <span className={styles.allyModalValue}>{ally.address}</span>
            </div>
          )}
          {ally.mapUrl && (
            <div className={styles.allyModalRow}>
              <a className={styles.allyModalLink} href={ally.mapUrl} target="_blank" rel="noopener noreferrer">
                Ver ubicación en Google Maps
              </a>
            </div>
          )}
          {ally.email && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Correo</span>
              <span className={styles.allyModalValue}>{ally.email}</span>
            </div>
          )}
          {ally.phone && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Teléfono</span>
              <span className={styles.allyModalValue}>{ally.phone}</span>
            </div>
          )}
          {(ally.mobilePhone || ally.whatsapp) && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Celular / WhatsApp</span>
              <span className={styles.allyModalValue}>{[ally.mobilePhone, ally.whatsapp].filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {ally.website && (
            <div className={styles.allyModalRow}>
              <span className={styles.allyModalLabel}>Sitio web</span>
              <a className={styles.allyModalLink} href={ally.website} target="_blank" rel="noopener noreferrer">
                {ally.website}
              </a>
            </div>
          )}
        </div>
      </Modal>
    </li>
  );
}
