"use client";

import { ServiceIcon } from "@/components/icons/Icon";
import { getServiceCatalog } from "@/lib/services/catalog";
import type { OrgProfileKind } from "@/lib/supabase/orgProfiles";
import styles from "./serviceCatalogPicker.module.css";

/**
 * Selector de servicios: tarjetas con icono, para el catálogo fijo del tipo
 * de organización dado. Sustituye la entrada de texto libre — los servicios
 * son siempre uno de los predeterminados por Huellas de Vuelta.
 */
export default function ServiceCatalogPicker({
  kind,
  selected,
  onChange,
  disabled,
}: {
  kind: OrgProfileKind;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const items = getServiceCatalog(kind);

  function toggle(id: string) {
    if (disabled) return;
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className={styles.grid} role="group" aria-label="Servicios que ofrecemos">
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.card} ${active ? styles.cardActive : ""}`}
            aria-pressed={active}
            onClick={() => toggle(item.id)}
            disabled={disabled}
          >
            <span className={styles.iconWrap}>
              <ServiceIcon icon={item.icon} size={26} />
            </span>
            <span className={styles.label}>{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}
