import { EyeIcon, LockIcon, QrIcon, ReportIcon } from "@/components/icons/Icon";
import styles from "./settings.module.css";

const SECTIONS: { icon: React.ReactNode; title: string; points: string[] }[] = [
  {
    icon: <LockIcon size={16} />,
    title: "Tus datos de propietario",
    points: [
      "Tu nombre, teléfono, correo y dirección NUNCA se muestran en las páginas públicas.",
      "Solo tú los ves en tu panel. El administrador ve el nombre y correo para soporte.",
    ],
  },
  {
    icon: <EyeIcon size={16} />,
    title: "Tus mascotas",
    points: [
      "Los datos de una mascota son privados mientras esté «En casa».",
      "Al reportarla como PERDIDA o publicarla EN ADOPCIÓN, se muestran públicamente su foto, nombre, especie, raza, color y edad — nunca datos tuyos.",
      "Al volver a «En casa» deja de aparecer en el Landing.",
    ],
  },
  {
    icon: <ReportIcon size={16} />,
    title: "Reportes y avisos",
    points: [
      "La zona (ciudad y barrio) del reporte es pública para ayudar a ubicarla; no se pide ni se muestra la dirección exacta de una vivienda.",
      "El contacto de quien encuentra tu mascota solo lo ves tú, nunca la organización ni el público.",
      "La foto que sube quien la encuentra solo la ves tú y el administrador.",
    ],
  },
  {
    icon: <QrIcon size={16} />,
    title: "Placa QR / perfil público",
    points: [
      "Quien escanea la placa ve la ficha pública de la mascota y puede avisarte sin ver tu teléfono, correo ni dirección.",
      "El identificador de la placa (publicId) sirve para abrir esa ficha; no revela información tuya.",
    ],
  },
];

/**
 * Página de privacidad: explica, sin interruptores, cómo se maneja realmente
 * la información en la plataforma. El contenido coincide con la implementación
 * (RLS + funciones públicas que solo devuelven columnas seguras).
 */
export default function PrivacySettings() {
  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Privacidad</h1>
        <p className={styles.subtitle}>
          Qué información es pública, qué es privada y qué se comparte solo cuando hace falta para un
          reporte.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <div key={section.title} className={styles.card}>
          <p className={styles.cardTitle}>{section.icon} {section.title}</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: ".5rem" }}>
            {section.points.map((point, i) => (
              <li key={i} style={{ color: "var(--ink-600)", fontSize: ".88rem", lineHeight: 1.55 }}>{point}</li>
            ))}
          </ul>
        </div>
      ))}

      <p className={styles.note}>
        No hay interruptores en esta pantalla porque estas reglas son fijas: están aplicadas en la base
        de datos (RLS) y en las consultas públicas, no dependen de una configuración.
      </p>
    </section>
  );
}
