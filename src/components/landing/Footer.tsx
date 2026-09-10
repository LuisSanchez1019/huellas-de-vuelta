import Image from "next/image";
import Link from "next/link";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

const columns = [
  {
    title: "Explora",
    links: [
      { href: "/#mascotas", label: "Mascotas perdidas" },
      { href: "/#adopciones", label: "En adopción" },
      { href: "/#apadrinamiento", label: "Apadrinamiento" },
      { href: "/#empresas", label: "Aliados" },
    ],
  },
  {
    title: "Organizaciones",
    links: [
      { href: "/#veterinarias", label: "Veterinarias" },
      { href: "/#fundaciones", label: "Fundaciones" },
      { href: "/#mapa", label: "Mapa" },
      { href: "/auth/vet-fun", label: "Registra tu organización" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/ayuda", label: "Centro de ayuda" },
      { href: "/ayuda", label: "Privacidad" },
      { href: "/ayuda", label: "Términos de uso" },
      { href: "/ayuda", label: "Contacto" },
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
              <Image className={styles.footerLogo} src="/logo-hdv.png" alt="Huellas de Vuelta" width={34} height={34} />
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
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Huellas de Vuelta. Todos los derechos reservados.</span>
          <span className={styles.footerBottomNote}>Porque ellos también son familia.</span>
        </div>
      </div>
    </footer>
  );
}
