import { CheckIcon } from "@/components/icons/Icon";
import styles from "./aliado.module.css";

export default function AliadoHomePage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>Tu cuenta de aliado está activa</h1>
        <p className={styles.subtitle}>
          Gracias por sumarte a Huellas de Vuelta. Estamos preparando el panel de aliados.
        </p>
      </div>

      <div className={styles.card}>
        <p>
          Por ahora tu cuenta te permite iniciar sesión y recuperar tu contraseña. Pronto podrás
          gestionar desde aquí:
        </p>
        <ul className={styles.list}>
          <li><CheckIcon size={16} /> Perfil de tu empresa y logo.</li>
          <li><CheckIcon size={16} /> Información comercial y enlace externo.</li>
          <li><CheckIcon size={16} /> Campañas y patrocinios.</li>
          <li><CheckIcon size={16} /> Estadísticas de tu aparición en la plataforma.</li>
        </ul>
        <p className={styles.note}>
          Te avisaremos cuando el panel de aliados esté disponible. No necesitas hacer nada más por ahora.
        </p>
      </div>
    </div>
  );
}
