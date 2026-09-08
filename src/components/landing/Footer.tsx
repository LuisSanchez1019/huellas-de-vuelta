import Image from "next/image";
import Link from "next/link";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

const columns = [
  {
    title: "Enlaces",
    links: [
      { href: "/", label: "Inicio" },
      { href: "/#mascotas", label: "Mascotas perdidas" },
      { href: "/#adopciones", label: "En adopción" },
      { href: "/#aliados", label: "Aliados" },
      { href: "/#mapa", label: "Mapa" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/ayuda", label: "Preguntas frecuentes" },
      { href: "/ayuda", label: "Términos y condiciones" },
      { href: "/ayuda", label: "Política de privacidad" },
      { href: "/auth?mode=sign-up", label: "Registra tu organización" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrandCol}>
            <div className={styles.footerBrand}>
              <Image className={styles.footerLogo} src="/logo.png" alt="Huellas de Vuelta" width={34} height={34} />
              <span>
                Huellas de Vuelta
                <span className={styles.footerBrandTagline}>Conectando corazones</span>
              </span>
            </div>
            <p className={styles.footerTagline}>
              Plataforma sin ánimo de lucro para reencontrar mascotas perdidas, gestionar mascotas
              encontradas y facilitar adopciones responsables en Colombia.
            </p>
            <div className={styles.footerSocial}>
              <a className={styles.footerSocialIcon} href="#" aria-label="Facebook"><FacebookIcon size={16} /></a>
              <a className={styles.footerSocialIcon} href="#" aria-label="Instagram"><InstagramIcon size={16} /></a>
              <a className={styles.footerSocialIcon} href="#" aria-label="WhatsApp"><WhatsAppIcon size={16} /></a>
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

          <div>
            <p className={styles.footerColumnTitle}>Novedades</p>
            <p className={styles.footerNewsText}>
              Consejos de cuidado y avances de la plataforma. Muy pronto podrás suscribirte a nuestro
              boletín.
            </p>
            <Link className={styles.footerNewsCta} href="/ayuda">Ir al centro de ayuda</Link>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Huellas de Vuelta. Todos los derechos reservados.</span>
          <span className={styles.footerBottomNote}>Porque ellos también son familia.</span>
        </div>
      </div>
    </footer>
  );
}
