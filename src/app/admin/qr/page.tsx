"use client";

import { useState } from "react";
import QrBatchPanel from "@/components/qr/QrBatchPanel";
import QrTagsPanel from "@/components/qr/QrTagsPanel";
import controls from "@/components/ui/controls.module.css";
import styles from "./qr.module.css";

type Tab = "batches" | "tags";

/**
 * /admin/qr — administracion de placas QR. El QR es una entidad independiente:
 * el administrador genera lotes, imprime y despues asigna cada placa a una
 * mascota. Ningun usuario normal puede crear placas ni inventar codigos.
 */
export default function AdminQrPage() {
  const [tab, setTab] = useState<Tab>("batches");
  const [reloadTags, setReloadTags] = useState(0);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>QR / Placas</h1>
        <p className={controls.pageSubtitle}>
          Genera lotes de placas, expórtalas para imprimir y asígnalas a una mascota cuando
          corresponda. El código corto es solo para leer; el destino del QR es un identificador
          aleatorio y no contiene datos personales.
        </p>
      </div>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          className={tab === "batches" ? styles.tabActive : styles.tab}
          onClick={() => setTab("batches")}
        >
          Lotes
        </button>
        <button
          type="button"
          className={tab === "tags" ? styles.tabActive : styles.tab}
          onClick={() => setTab("tags")}
        >
          Placas
        </button>
      </div>

      {tab === "batches" ? (
        <QrBatchPanel onBatchCreated={() => setReloadTags((n) => n + 1)} />
      ) : (
        <QrTagsPanel reloadSignal={reloadTags} />
      )}
    </div>
  );
}
