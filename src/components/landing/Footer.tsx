import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

const columns = [
  {
    title: "Plataforma",
    links: [
      { href: "/", label: "Inicio" },
      { href: "#mascotas", label: "Mascotas" },
      { href: "#adopciones", label: "Adopciones" },
      { href: "#como-funciona", label: "Cómo funciona" },
    ],
  },
  {
    title: "Aliados",
    links: [
      { href: "#aliados", label: "Fundaciones" },
      { href: "#aliados", label: "Veterinarias" },
      { href: "/auth?mode=sign-up", label: "Únete como aliado" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { href: "/mapa", label: "Mapa" },
      { href: "/ayuda", label: "Centro de ayuda" },
      { href: "/ayuda", label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/ayuda", label: "Privacidad" },
      { href: "/ayuda", label: "Términos de uso" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerBrand}>
              <Image className={styles.footerLogo} src="/logo.png" alt="Huellas de Vuelta" width={32} height={32} />
              <span>Huellas de Vuelta</span>
            </div>
            <p className={styles.footerTagline}>
              Plataforma sin ánimo de lucro para reencontrar mascotas perdidas, gestionar mascotas encontradas y facilitar adopciones responsables en Colombia.
            </p>
            <div className={styles.footerSocial}>
              <a className={styles.footerSocialIcon} href="#" aria-label="Facebook">f</a>
              <a className={styles.footerSocialIcon} href="#" aria-label="Instagram">ig</a>
              <a className={styles.footerSocialIcon} href="#" aria-label="WhatsApp">wa</a>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className={styles.footerColumnTitle}>{column.title}</p>
              <div className={styles.footerLinks}>
                {column.links.map((link) => (
                  <Link key={link.label} className={styles.footerLink} href={link.href}>{link.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className={styles.footerBottom}>© {new Date().getFullYear()} Huellas de Vuelta. Proyecto sin ánimo de lucro construido para Colombia.</p>
      </div>
    </footer>
  );
}
