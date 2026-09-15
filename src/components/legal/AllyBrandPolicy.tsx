import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import {
  ALLY_BRAND_POLICY_LAST_UPDATED,
  ALLY_BRAND_POLICY_VERSION,
} from "@/lib/legal/allyBrandPolicy";
import { DATA_POLICY_PATH } from "@/lib/legal/policy";
import styles from "./DataPolicy.module.css";

/**
 * Política de información y uso de marca de aliados: complementa (no
 * reemplaza) la Política de Tratamiento de Datos Personales general. Cuando
 * la información involucrada es un dato personal, se aplica también esa
 * política general y la legislación colombiana vigente de protección de
 * datos personales.
 *
 * Los datos de identificación del responsable son marcadores de posición:
 * deben completarse antes de la publicación definitiva. El documento está
 * sujeto a revisión jurídica profesional; no constituye una certificación de
 * cumplimiento ni una garantía jurídica absoluta de protección de marca.
 *
 * La versión y la fecha se toman de `@/lib/legal/allyBrandPolicy`, que a su
 * vez debe coincidir con `public._current_ally_brand_policy_version()` en
 * Supabase.
 */

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

const SECTIONS: Section[] = [
  {
    id: "objeto",
    title: "1. Objeto",
    blocks: [
      {
        kind: "p",
        text: "Esta política regula el tratamiento de la información empresarial de las cuentas aliadas de Huellas de Vuelta y el uso del logo de su empresa, cuando así lo autorizan, en la publicación pública de su perfil y en actividades relacionadas con la plataforma.",
      },
      {
        kind: "p",
        text: "Complementa — y no reemplaza — la Política de Tratamiento de Datos Personales general de Huellas de Vuelta. Cuando la información involucrada constituye un dato personal (por ejemplo, si un aliado es persona natural), se aplican también esa política general y la legislación colombiana vigente de protección de datos personales.",
      },
    ],
  },
  {
    id: "informacion-recopilada",
    title: "2. Qué información empresarial se recopila",
    blocks: [
      {
        kind: "p",
        text: "En el perfil de la cuenta aliada se recopila información de identidad (logo, nombre comercial, razón social, descripción breve), información empresarial (sector, país, ciudad, dirección, enlace de Google Maps, sitio web) e información de contacto empresarial (correo, teléfono fijo, celular, WhatsApp).",
      },
      {
        kind: "p",
        text: "Esta información empresarial se mantiene separada de los datos personales de la cuenta que administra el perfil (nombre y apellido de la persona responsable, correo de acceso, teléfono personal), que se rigen por la Política de Tratamiento de Datos Personales general.",
      },
    ],
  },
  {
    id: "finalidad",
    title: "3. Para qué se utiliza",
    blocks: [
      {
        kind: "p",
        text: "La información empresarial se utiliza para gestionar la participación del aliado en la plataforma y, cuando su participación se encuentra vigente y cuenta con la autorización correspondiente, para presentar su perfil dentro de la red pública de aliados de Huellas de Vuelta.",
      },
    ],
  },
  {
    id: "informacion-publica",
    title: "4. Qué información puede aparecer públicamente",
    blocks: [
      {
        kind: "p",
        text: "Solo puede mostrarse públicamente la información de un aliado que se encuentre aprobado, activo, con período de visibilidad vigente y con la autorización de publicación otorgada. Sin esa autorización, el perfil de la empresa no aparece en la red pública de aliados, sin importar su estado de aprobación o pago.",
      },
      {
        kind: "p",
        text: "Cuando corresponde mostrarse, el listado público y su modal de información pueden incluir: logo (solo si además se autorizó su uso, ver sección siguiente), nombre, «Aliado de Huellas de Vuelta», sector empresarial, descripción, país, ciudad, dirección, correo empresarial, teléfono, celular/WhatsApp, sitio web y enlace de Google Maps.",
      },
      {
        kind: "p",
        text: "Nunca se muestra públicamente: el nombre o apellido de la persona responsable de la cuenta, el correo de acceso (login) cuando difiere del correo empresarial, el teléfono personal, ni ningún otro dato de cuenta que no sea empresarial.",
      },
    ],
  },
  {
    id: "uso-del-logo",
    title: "5. Cómo se utiliza el logo",
    blocks: [
      {
        kind: "p",
        text: "El logo de la empresa solo se muestra o utiliza públicamente cuando el aliado otorgó, de forma independiente, la autorización específica de uso del logo. Sin esa autorización, el perfil público de la empresa se presenta sin la imagen del logo.",
      },
    ],
  },
  {
    id: "campanas",
    title: "6. En qué tipos de campañas puede aparecer",
    blocks: [
      {
        kind: "p",
        text: "Con la autorización de uso del logo otorgada, este puede aparecer en campañas, piezas de comunicación, actividades y publicaciones institucionales organizadas por Huellas de Vuelta, relacionadas con la plataforma y como reconocimiento al apoyo del aliado.",
      },
      {
        kind: "p",
        text: "El logo no se utiliza para: publicidad engañosa, actividades políticas, actividades ilícitas, contenidos ofensivos, actividades que contradigan la misión de la plataforma, ni para respaldar productos o servicios del aliado como si Huellas de Vuelta los certificara.",
      },
    ],
  },
  {
    id: "autorizacion-independiente",
    title: "7. Autorización independiente para el logo",
    blocks: [
      {
        kind: "p",
        text: "La autorización de uso del logo es independiente de la autorización de publicación de información empresarial: un aliado puede otorgar una sin la otra, y ninguna se asume o se deriva automáticamente de la otra. Ambas se guardan por separado, con su propio historial.",
      },
    ],
  },
  {
    id: "revocacion",
    title: "8. Revocación",
    blocks: [
      {
        kind: "p",
        text: "El aliado puede retirar cualquiera de las dos autorizaciones en cualquier momento desde su perfil. Al retirar la autorización de publicación, su empresa deja de mostrarse en la red pública de aliados. Al retirar la autorización del logo, se impide su uso en campañas o publicaciones futuras.",
      },
      {
        kind: "p",
        text: "Retirar una autorización no elimina los registros históricos de consentimiento, que se conservan por razones legales, administrativas o de auditoría, ni implica necesariamente la eliminación inmediata de referencias ya publicadas con anterioridad cuando exista una razón legítima para conservarlas.",
      },
    ],
  },
  {
    id: "proteccion-identidad",
    title: "9. Protección de la identidad empresarial",
    blocks: [
      {
        kind: "p",
        text: "Huellas de Vuelta se compromete a utilizar la identidad de sus aliados de manera responsable, evitando usos engañosos, ilícitos, ofensivos o ajenos a las finalidades informadas en esta política.",
      },
      {
        kind: "p",
        text: "La presentación de una empresa como aliada no constituye una recomendación, certificación ni garantía de calidad de sus productos o servicios, ni una relación distinta de la que expresamente se haya informado. Esta política no promete una protección jurídica absoluta de la marca del aliado.",
      },
    ],
  },
  {
    id: "seguridad",
    title: "10. Seguridad",
    blocks: [
      {
        kind: "p",
        text: "La información empresarial se almacena en la misma infraestructura de base de datos con controles de acceso (RLS) que el resto de la plataforma. Las autorizaciones de publicación y de uso del logo se registran mediante funciones del servidor que validan la identidad del aliado antes de aceptar cualquier cambio; no se confía únicamente en el frontend ni se guardan solo en el dispositivo del aliado.",
      },
    ],
  },
  {
    id: "control-acceso",
    title: "11. Control de acceso",
    blocks: [
      {
        kind: "p",
        text: "Cada cuenta aliada solo puede ver y modificar su propio perfil empresarial y sus propias autorizaciones. Las reglas de acceso a la base de datos impiden que una cuenta aliada modifique el perfil o las autorizaciones de otra.",
      },
    ],
  },
  {
    id: "conservacion",
    title: "12. Conservación de registros",
    blocks: [
      {
        kind: "p",
        text: "El historial de autorizaciones (otorgamientos y revocaciones, con fecha, versión de esta política y, cuando corresponde, la persona que realizó el cambio) se conserva de forma permanente como registro de auditoría, incluso después de una revocación.",
      },
    ],
  },
  {
    id: "criterios-publicacion",
    title: "13. Criterios para publicación",
    blocks: [
      {
        kind: "p",
        text: "Además de contar con la autorización correspondiente, un aliado debe estar aprobado, activo y dentro de un período de visibilidad vigente para aparecer en la red pública. Huellas de Vuelta puede establecer criterios adicionales de publicación cuando sea necesario para proteger la integridad, seguridad, reputación y finalidad de la plataforma.",
      },
    ],
  },
  {
    id: "retiro-publicacion",
    title: "14. Retiro de una publicación",
    blocks: [
      {
        kind: "p",
        text: "Huellas de Vuelta puede retirar temporalmente una empresa de los espacios públicos cuando sea necesario para proteger la plataforma, respetando las condiciones aplicables y los derechos del aliado. El aliado también puede solicitar su propio retiro en cualquier momento, o hacerlo directamente revocando su autorización de publicación.",
      },
    ],
  },
  {
    id: "contacto",
    title: "15. Contacto para solicitudes",
    blocks: [
      {
        kind: "p",
        text: "Las solicitudes relacionadas con esta política (información empresarial, uso del logo, revocación o retiro de una publicación) pueden dirigirse al correo de contacto que se defina como canal oficial de Huellas de Vuelta: [CORREO DE CONTACTO PARA ALIADOS].",
      },
    ],
  },
  {
    id: "relacion-politica-general",
    title: "16. Relación con la Política de Tratamiento de Datos Personales general",
    blocks: [
      {
        kind: "p",
        text: "Esta política es un complemento específico para la información empresarial y el uso de marca de los aliados; no sustituye la Política de Tratamiento de Datos Personales general de Huellas de Vuelta, que sigue aplicando en todo lo relacionado con datos personales.",
      },
      {
        kind: "ul",
        items: [
          `Política de Tratamiento de Datos Personales: ${DATA_POLICY_PATH}`,
        ],
      },
    ],
  },
];

export default function AllyBrandPolicy() {
  return (
    <>
      <Header />
      <main className={styles.wrap}>
        <p className={styles.eyebrow}>Aliados comerciales</p>
        <h1 className={styles.title}>Política de información y uso de marca de aliados</h1>

        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt>Versión</dt>
            <dd>{ALLY_BRAND_POLICY_VERSION}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt>Última actualización</dt>
            <dd>{ALLY_BRAND_POLICY_LAST_UPDATED}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt>Responsable</dt>
            <dd>[RAZÓN SOCIAL / NOMBRE DEL RESPONSABLE]</dd>
          </div>
        </dl>

        <p className={styles.draftBanner}>
          Documento sujeto a revisión jurídica profesional antes de su publicación definitiva. Esta
          política describe el funcionamiento real de la plataforma y toma como marco de referencia la
          normativa colombiana vigente (Ley 1581 de 2012, Decreto 1074 de 2015 y normas que lo
          modifiquen, lineamientos de la Superintendencia de Industria y Comercio, y la clasificación
          económica vigente de DANE para el sector empresarial), pero no constituye una certificación ni
          una garantía de cumplimiento jurídico absoluto.
        </p>

        <section className={styles.reference}>
          <h2 className={styles.sectionTitle}>Marco de referencia</h2>
          <ul className={styles.list}>
            <li>Ley 1581 de 2012.</li>
            <li>Decreto 1074 de 2015 y las normas que lo modifiquen o desarrollen.</li>
            <li>Lineamientos aplicables de la Superintendencia de Industria y Comercio.</li>
            <li>Clasificación económica vigente de DANE (CIIU), para las categorías de sector empresarial.</li>
          </ul>
        </section>

        <nav className={styles.toc} aria-label="Contenido de la política">
          <p className={styles.tocTitle}>Contenido</p>
          <ol className={styles.tocList}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.sections}>
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              {section.blocks.map((block, i) => {
                if (block.kind === "p") {
                  return (
                    <p key={i} className={styles.paragraph}>
                      {block.text}
                    </p>
                  );
                }
                return (
                  <ul key={i} className={styles.list}>
                    {block.items.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                );
              })}
            </section>
          ))}
        </div>

        <p className={styles.back}>
          <Link href="/aliado/perfil">Volver al perfil de la empresa</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
