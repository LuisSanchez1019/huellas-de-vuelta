"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { GRANT_STATUS_LABELS, fetchMyGrants, type VetGrant } from "@/lib/vet/access";
import { vetErrorMessage } from "@/lib/vet/errors";
import controls from "@/components/ui/controls.module.css";
import styles from "./vet.module.css";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Accesos del propio profesional: pendientes, vigentes y cerrados en las últimas 24 h. */
export default function MyGrantsList() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [grants, setGrants] = useState<VetGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyGrants(supabase)
      .then((list) => {
        if (alive) setGrants(list);
      })
      .catch((e) => {
        if (alive) setError(vetErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [supabase]);

  if (error) return <p className={controls.errorText}>{error}</p>;
  if (!grants) return null;
  if (grants.length === 0) return null;

  return (
    <section className={controls.section}>
      <h2 className={controls.sectionTitle}>Mis accesos recientes</h2>
      <div className={styles.list}>
        {grants.map((g) => (
          <div key={g.id} className={styles.listItem}>
            <div className={styles.listItemHead}>
              <span className={styles.itemTitle}>{g.petName ?? "Mascota"}</span>
              <span
                className={`${styles.badge} ${
                  g.effectiveStatus === "active" ? styles.badgeOk : g.effectiveStatus === "pending" ? styles.badgeInfo : styles.badgeDanger
                }`}
              >
                {GRANT_STATUS_LABELS[g.effectiveStatus]}
              </span>
            </div>
            <p className={styles.meta}>
              {g.effectiveStatus === "active" && g.expiresAt ? `Vigente hasta ${fmt(g.expiresAt)}` : `Solicitado ${fmt(g.createdAt)}`}
            </p>
            {g.effectiveStatus === "active" && (
              <div className={controls.buttonRow}>
                <Link className={controls.button} href={`/veterinaria/consultar/${g.id}`}>Abrir ficha</Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
