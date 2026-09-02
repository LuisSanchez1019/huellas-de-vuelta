"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getOrgLogoPublicUrl,
  listPublishedOrgProfileRows,
  type OrgProfileKind,
  type OrgProfileRow,
} from "@/lib/supabase/orgProfiles";
import type { OrgCategory } from "@/lib/pets/reencuentro";
import SectionTitle from "./SectionTitle";
import AutoScroller from "./AutoScroller";
import OrgCard, { type OrgCardData } from "./OrgCard";
import styles from "./landing.module.css";

function toCard(row: OrgProfileRow, logoUrl: string | null): OrgCardData {
  const category = (
    ["veterinaria", "fundacion", "refugio", "otro_aliado"].includes(row.category)
      ? row.category
      : row.kind
  ) as OrgCategory;
  return {
    id: row.id,
    name: row.name,
    category,
    logoUrl,
    description: row.description ?? "",
    city: row.city ?? "",
    neighborhood: row.neighborhood ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    services: Array.isArray(row.services) ? row.services : [],
  };
}

function useApprovedOrgs(kind: OrgProfileKind) {
  const [cards, setCards] = useState<OrgCardData[] | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    listPublishedOrgProfileRows(kind)
      .then((rows) => {
        if (!active) return;
        setCards(
          rows.map((row) =>
            toCard(row, row.logo_path ? getOrgLogoPublicUrl(supabase, row.logo_path) : row.logo_url),
          ),
        );
      })
      .catch(() => {
        if (active) setCards([]);
      });
    return () => {
      active = false;
    };
  }, [kind]);

  return cards;
}

function OrgSubsection({
  kind,
  eyebrow,
  title,
  subtitle,
  emptyText,
  ariaLabel,
}: {
  kind: OrgProfileKind;
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyText: string;
  ariaLabel: string;
}) {
  const cards = useApprovedOrgs(kind);

  return (
    <div className={styles.subsectionGap}>
      <SectionTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {cards === null ? null : cards.length === 0 ? (
        <p className={styles.scrollerEmpty}>{emptyText}</p>
      ) : (
        <AutoScroller ariaLabel={ariaLabel}>
          {cards.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </AutoScroller>
      )}
    </div>
  );
}

export default function PartnersSection() {
  return (
    <section id="aliados" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Fundaciones y veterinarias aliadas">
      <div className={styles.sectionInner}>
        <OrgSubsection
          kind="veterinaria"
          eyebrow="Atención veterinaria"
          title="Veterinarias aliadas"
          subtitle="Clínicas verificadas por Huellas de Vuelta que colaboran con la atención de mascotas encontradas y en proceso de reencuentro."
          emptyText="Aún no hay veterinarias aliadas verificadas."
          ariaLabel="Veterinarias aliadas"
        />
        <OrgSubsection
          kind="fundacion"
          eyebrow="Red de aliados"
          title="Fundaciones aliadas"
          subtitle="Organizaciones verificadas que ayudan a atender, rehabilitar y proteger mascotas."
          emptyText="Aún no hay fundaciones aliadas verificadas."
          ariaLabel="Fundaciones aliadas"
        />
      </div>
    </section>
  );
}
