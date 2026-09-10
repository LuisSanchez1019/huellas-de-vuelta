import Link from "next/link";
import { HeartIcon, StethoscopeIcon } from "@/components/icons/Icon";
import styles from "./orgChoice.module.css";

const OPTIONS = [
  {
    href: "/auth/veterinaria",
    icon: <StethoscopeIcon size={24} />,
    title: "Veterinaria",
    text: "Gestiona tu organización y servicios veterinarios.",
  },
  {
    href: "/auth/fundacion",
    icon: <HeartIcon size={24} />,
    title: "Fundación",
    text: "Gestiona tu organización y apoya el bienestar animal.",
  },
];

/**
 * Selección del tipo de organización (Veterinaria / Fundación) antes de abrir
 * su login/registro. Se usa dentro de la modal del Landing y como página
 * completa en `/auth/vet-fun`.
 */
export default function OrgTypeChoice({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className={styles.grid}>
      {OPTIONS.map((opt) => (
        <Link key={opt.href} href={`${opt.href}?mode=sign-in`} className={styles.card} onClick={onNavigate}>
          <span className={styles.icon} aria-hidden="true">{opt.icon}</span>
          <span className={styles.title}>{opt.title}</span>
          <span className={styles.text}>{opt.text}</span>
        </Link>
      ))}
    </div>
  );
}
