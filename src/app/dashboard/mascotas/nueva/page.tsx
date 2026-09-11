import { Suspense } from "react";
import RegisterPetForm from "@/components/mascotas/RegisterPetForm";
import styles from "@/components/mascotas/registerPet.module.css";

export default function Page() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Registrar mascota</h1>
        <p className={styles.pageSubtitle}>
          Completa los datos básicos de tu mascota. Podrás editarlos y añadir más información después.
        </p>
      </div>
      <Suspense fallback={null}>
        <RegisterPetForm />
      </Suspense>
    </div>
  );
}
