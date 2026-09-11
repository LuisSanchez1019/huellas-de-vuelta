import { Suspense } from "react";
import PlateRequestFlow from "@/components/placas/PlateRequestFlow";
import styles from "@/components/mascotas/registerPet.module.css";

export default function SolicitarPlacaPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Solicitar placa</h1>
        <p className={styles.pageSubtitle}>
          Elige una mascota, completa los datos de envío y confirma tu solicitud. Un administrador
          asigna la placa física y genera el envío.
        </p>
      </div>
      <Suspense fallback={null}>
        <PlateRequestFlow />
      </Suspense>
    </div>
  );
}
