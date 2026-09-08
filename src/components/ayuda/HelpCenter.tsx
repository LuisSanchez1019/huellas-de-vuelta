import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { ChevronDownIcon, PawIcon, PinIcon, HandIcon, ShieldIcon, IdCardIcon } from "@/components/icons/Icon";
import styles from "./HelpCenter.module.css";

interface Faq {
  q: string;
  a: string[];
}

interface FaqGroup {
  title: string;
  icon: React.ReactNode;
  items: Faq[];
}

const GROUPS: FaqGroup[] = [
  {
    title: "Registrar y proteger a tu mascota",
    icon: <PawIcon size={20} />,
    items: [
      {
        q: "¿Cómo registro mi mascota?",
        a: [
          "Crea una cuenta de usuario e ingresa a tu panel. En la sección Mis mascotas puedes añadir cada mascota con su nombre, especie, raza, edad, sexo, señas particulares y una o varias fotos.",
          "Cada mascota registrada genera un perfil público con un identificador único que puedes compartir o imprimir en una placa.",
        ],
      },
      {
        q: "¿Cómo funciona la placa QR?",
        a: [
          "Al registrar una mascota se crea una página pública en huellasdevuelta con la dirección /m/ seguida del identificador de la mascota. El código QR de la placa apunta a esa página.",
          "Cuando alguien escanea el QR ve la ficha de la mascota y, si está reportada como perdida, un formulario para avisar que la vio o que la encontró. Tus datos de contacto solo se muestran cuando es necesario coordinar la entrega.",
        ],
      },
      {
        q: "¿Cómo funciona el NFC?",
        a: [
          "La placa puede incluir un chip NFC además del QR impreso. Acercar un teléfono a la placa abre la misma página pública /m/ de la mascota, sin necesidad de escanear el código.",
          "El QR y el NFC llevan al mismo lugar: la ficha de la mascota. No se necesita instalar ninguna aplicación.",
        ],
      },
    ],
  },
  {
    title: "Si tu mascota se perdió",
    icon: <PinIcon size={20} />,
    items: [
      {
        q: "¿Qué hago si mi mascota se perdió?",
        a: [
          "Desde tu panel, en Reportes, crea un reporte de mascota perdida. Indica la última zona donde la viste y una descripción. La mascota queda marcada como perdida y su ficha pública muestra el aviso.",
          "El reporte tiene un identificador único que puedes compartir. Mientras esté activo, cualquiera que escanee la placa o abra la ficha puede avisarte.",
        ],
      },
      {
        q: "¿Qué pasa cuando alguien encuentra mi mascota?",
        a: [
          "Recibes una notificación dentro de la plataforma cuando alguien reporta que vio o encontró a tu mascota. En Mi actividad puedes seguir el estado de cada aviso.",
          "Si quien la encontró la llevó a una veterinaria o fundación aliada, el aviso queda como pendiente de entrega hasta que la organización confirme la recepción.",
        ],
      },
    ],
  },
  {
    title: "Si encontraste una mascota",
    icon: <HandIcon size={20} />,
    items: [
      {
        q: "¿Qué hago si encontré una mascota?",
        a: [
          "Si la mascota tiene placa, escanea el QR o acerca el teléfono al NFC para abrir su ficha. Desde ahí puedes avisar al propietario en pocos pasos, sin crear una cuenta.",
          "Si no tiene placa, puedes crear un reporte de mascota encontrada desde la página principal para que el propietario pueda localizarla.",
        ],
      },
      {
        q: "¿Cómo reporto una mascota encontrada?",
        a: [
          "En el asistente de mascota encontrada indicas dónde la hallaste, una descripción y una foto. Puedes elegir quedártela mientras aparece el propietario o entregarla a una veterinaria o fundación aliada.",
          "El reporte queda registrado con un identificador único y, si eliges una organización, se le notifica para coordinar la recepción.",
        ],
      },
      {
        q: "La mascota parece herida o necesita atención",
        a: [
          "El asistente te permite marcar que la mascota parece herida o necesita atención. En ese caso te mostramos las veterinarias y fundaciones aliadas de la ciudad para que puedas llevarla lo antes posible.",
        ],
      },
      {
        q: "¿Qué significa \"pendiente de entrega\"?",
        a: [
          "Cuando entregas una mascota encontrada a una veterinaria o fundación, el aviso queda como pendiente de entrega. Significa que la organización todavía no ha confirmado que la recibió.",
          "La organización dispone de una ventana de tiempo para confirmar. Mientras tanto, el propietario ve que su mascota está en camino a esa organización.",
        ],
      },
      {
        q: "¿Qué ocurre cuando una veterinaria o fundación confirma que recibió una mascota?",
        a: [
          "La organización tiene en su panel de recepción los casos que le fueron dirigidos. Puede confirmar Recibí la mascota o indicar No la recibí.",
          "Si confirma la recepción, el propietario recibe una notificación con los datos de la organización para pasar a recogerla. Si indica que no la recibió, el aviso vuelve a quedar abierto.",
        ],
      },
    ],
  },
  {
    title: "Organizaciones aliadas",
    icon: <IdCardIcon size={20} />,
    items: [
      {
        q: "¿Cómo registro una veterinaria o fundación?",
        a: [
          "Al crear la cuenta elige el tipo Veterinaria o Fundación. Luego completa el perfil de la organización: nombre, descripción, ciudad, dirección, teléfono de contacto, logo y ubicación en el mapa.",
          "Las veterinarias y fundaciones eligen sus servicios de un catálogo predefinido; no se escriben servicios libres.",
        ],
      },
      {
        q: "¿Cómo funciona la aprobación de una organización?",
        a: [
          "Cuando publicas el perfil de la organización queda en revisión. Un administrador verifica los datos y la aprueba o la rechaza.",
          "Solo las organizaciones aprobadas y activas aparecen en el mapa y en el directorio de aliados de la página principal, y solo ellas pueden recibir mascotas encontradas.",
        ],
      },
    ],
  },
  {
    title: "Privacidad y seguridad",
    icon: <ShieldIcon size={20} />,
    items: [
      {
        q: "¿Qué información es pública?",
        a: [
          "Es pública la ficha de cada mascota (nombre, especie, raza, características y fotos) y, si está reportada, el aviso de perdida o encontrada. También es público el directorio de organizaciones aprobadas.",
          "Tu nombre completo, tu teléfono y tu correo no se muestran en la ficha. Los datos de contacto solo se comparten con la otra parte cuando hay que coordinar una entrega.",
        ],
      },
      {
        q: "¿Cómo se protege mi cuenta?",
        a: [
          "Cada persona solo puede ver y modificar sus propias mascotas, reportes y datos de perfil. El tipo de cuenta y el rol de administrador no se pueden cambiar desde la aplicación.",
          "Puedes cambiar tu contraseña desde Configuración, en la sección Seguridad. Todas las notificaciones de la plataforma son internas: no enviamos correos ni mensajes con tus datos a terceros.",
        ],
      },
    ],
  },
];

export default function HelpCenter() {
  return (
    <>
      <Header />
      <main className={styles.wrap}>
        <p className={styles.eyebrow}>Centro de ayuda</p>
        <h1 className={styles.title}>¿Cómo podemos ayudarte?</h1>
        <p className={styles.subtitle}>
          Respuestas a las preguntas más frecuentes sobre registrar una mascota, reportar una pérdida,
          entregar una mascota encontrada y registrar una organización aliada.
        </p>

        <div className={styles.groups}>
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className={styles.groupTitle}>
                <span aria-hidden="true">{group.icon}</span> {group.title}
              </h2>
              {group.items.map((item) => (
                <details key={item.q} className={styles.item}>
                  <summary className={styles.summary}>
                    {item.q}
                    <span className={styles.chevron} aria-hidden="true">
                      <ChevronDownIcon size={18} />
                    </span>
                  </summary>
                  <div className={styles.answer}>
                    {item.a.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          ))}
        </div>

        <div className={styles.cta}>
          <p className={styles.ctaText}>
            ¿No encontraste lo que buscabas? Ingresa a tu panel para gestionar tus mascotas y reportes,
            o vuelve a la página principal.
          </p>
          <div className={styles.ctaLinks}>
            <Link className={styles.ctaButton} href="/auth?mode=sign-in">
              Ir a mi panel
            </Link>
            <Link className={`${styles.ctaButton} ${styles.ctaButtonSecondary}`} href="/">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
