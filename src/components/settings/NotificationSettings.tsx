import { AlertIcon, BellIcon, CheckIcon, EyeIcon, HandIcon, ShieldIcon } from "@/components/icons/Icon";
import styles from "./settings.module.css";

const NOTIFICATIONS: { icon: React.ReactNode; title: string; text: string }[] = [
  {
    icon: <EyeIcon size={16} />,
    title: "Alguien vio tu mascota",
    text: "Cuando otra persona reporta un avistamiento de una de tus mascotas perdidas.",
  },
  {
    icon: <HandIcon size={16} />,
    title: "Alguien encontró tu mascota",
    text: "Cuando alguien indica que tiene contigo a una de tus mascotas y deja un medio de contacto.",
  },
  {
    icon: <AlertIcon size={16} />,
    title: "Pendiente de entrega a una organización",
    text: "Cuando quien la encontró elige llevarla a una veterinaria o fundación aliada.",
  },
  {
    icon: <CheckIcon size={16} />,
    title: "La organización recibió tu mascota",
    text: "Cuando la veterinaria o fundación confirma que ya tiene a tu mascota, con sus datos de contacto.",
  },
  {
    icon: <AlertIcon size={16} />,
    title: "La organización aún no recibió tu mascota",
    text: "Cuando la organización indica que todavía no ha llegado. El reporte sigue activo.",
  },
  {
    icon: <ShieldIcon size={16} />,
    title: "Tu organización fue verificada",
    text: "Solo para veterinarias y fundaciones: cuando el administrador aprueba el perfil.",
  },
];

/**
 * Preferencias de notificaciones. Hoy todas las notificaciones son IN-APP
 * (llegan al panel). No se muestran interruptores de correo/push porque esos
 * canales todavía no existen; se listan los avisos reales que puedes recibir.
 */
export default function NotificationSettings() {
  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Preferencias de notificaciones</h1>
        <p className={styles.subtitle}>
          Estas son las notificaciones que Huellas de Vuelta te envía hoy. Todas llegan a tu panel,
          en «Notificaciones».
        </p>
      </header>

      <div className={styles.card}>
        <p className={styles.cardTitle}>
          <BellIcon size={16} /> Avisos sobre tus mascotas
        </p>
        <div className={styles.list}>
          {NOTIFICATIONS.map((n) => (
            <div key={n.title} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden="true">{n.icon}</span>
              <div className={styles.itemBody}>
                <p className={styles.itemTitle}>{n.title}</p>
                <p className={styles.itemText}>{n.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className={styles.note}>
        Próximamente podrás elegir recibir estos avisos también por correo y silenciar tipos concretos.
        Por ahora todo se entrega dentro de la plataforma, sin compartir tu correo con terceros.
      </p>
    </section>
  );
}
