import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import {
  DATA_POLICY_LAST_UPDATED,
  DATA_POLICY_VERSION,
} from "@/lib/legal/policy";
import styles from "./DataPolicy.module.css";

/**
 * Política de Tratamiento de Datos Personales de Huellas de Vuelta.
 *
 * El contenido refleja el comportamiento real de la plataforma (código y base de
 * datos) y toma como marco de referencia la Ley 1581 de 2012, el Decreto 1377 de
 * 2013 en lo que continúe aplicable, el Decreto 1074 de 2015 y las normas que lo
 * modifiquen, y los lineamientos de la Superintendencia de Industria y Comercio.
 *
 * Los datos de identificación del responsable son marcadores de posición: deben
 * completarse antes de la publicación definitiva. El documento está sujeto a
 * revisión jurídica profesional; no constituye una certificación de cumplimiento.
 *
 * La versión y la fecha se toman de `@/lib/legal/policy`, que a su vez debe
 * coincidir con `public._current_data_policy_version()` en Supabase.
 */

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "h3"; text: string };

interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

const SECTIONS: Section[] = [
  {
    id: "responsable",
    title: "1. Responsable del tratamiento",
    blocks: [
      {
        kind: "p",
        text: "El responsable del tratamiento de los datos personales recogidos a través de la plataforma Huellas de Vuelta es la persona natural o jurídica que la administra. Sus datos de identificación y contacto se completan a continuación y se mantendrán actualizados en la versión publicada de esta política:",
      },
      {
        kind: "ul",
        items: [
          "Razón social o nombre del responsable: [RAZÓN SOCIAL / NOMBRE DEL RESPONSABLE].",
          "Identificación tributaria: [NIT].",
          "Domicilio: [DIRECCIÓN].",
          "Correo de contacto para protección de datos personales: [CORREO DE PROTECCIÓN DE DATOS].",
          "Teléfono de contacto: [TELÉFONO].",
        ],
      },
      {
        kind: "p",
        text: "Las consultas, reclamos y solicitudes relacionadas con datos personales deben dirigirse al correo de contacto para protección de datos personales indicado arriba, siguiendo el procedimiento descrito en la sección 13.",
      },
    ],
  },
  {
    id: "alcance",
    title: "2. Alcance",
    blocks: [
      {
        kind: "p",
        text: "Esta política aplica a todos los datos personales que Huellas de Vuelta trata a través de su sitio web y sus paneles (cuentas de persona usuaria, veterinaria, fundación y aliado), así como a los datos asociados a mascotas, reportes de pérdida, avisos de hallazgo o avistamiento y pedidos de placa.",
      },
      {
        kind: "p",
        text: "Se aplica a titulares que crean una cuenta, a quienes registran información de terceros dentro de la plataforma bajo su responsabilidad, y a visitantes que interactúan con las páginas y perfiles públicos. No cubre sitios o servicios de terceros enlazados desde la plataforma, que se rigen por sus propias políticas.",
      },
      {
        kind: "p",
        text: "Esta política no es un documento de términos y condiciones de uso; ambos son documentos separados.",
      },
    ],
  },
  {
    id: "definiciones",
    title: "3. Definiciones",
    blocks: [
      {
        kind: "p",
        text: "Para efectos de esta política se utilizan las definiciones de la Ley 1581 de 2012 y su marco reglamentario. En particular:",
      },
      {
        kind: "ul",
        items: [
          "Titular: persona natural cuyos datos personales son objeto de tratamiento.",
          "Dato personal: cualquier información vinculada o que pueda asociarse a una persona natural determinada o determinable.",
          "Dato sensible: dato que afecta la intimidad del titular o cuyo uso indebido puede generar discriminación, como los datos relativos a la salud.",
          "Tratamiento: cualquier operación sobre datos personales, como recolección, almacenamiento, uso, circulación o supresión.",
          "Responsable del tratamiento: quien decide sobre la base de datos y su tratamiento; en este caso, Huellas de Vuelta.",
          "Encargado del tratamiento: quien trata datos personales por cuenta del responsable.",
          "Autorización: consentimiento previo, expreso e informado del titular para tratar sus datos.",
          "Aviso de privacidad: comunicación breve que informa al titular sobre el tratamiento y la forma de consultar esta política.",
        ],
      },
    ],
  },
  {
    id: "principios",
    title: "4. Principios del tratamiento",
    blocks: [
      {
        kind: "p",
        text: "El tratamiento de datos personales en Huellas de Vuelta se rige por los principios de la Ley 1581 de 2012:",
      },
      {
        kind: "ul",
        items: [
          "Legalidad: el tratamiento se sujeta a lo dispuesto en la ley y sus normas reglamentarias.",
          "Finalidad: los datos se tratan para finalidades legítimas, informadas al titular (sección 7).",
          "Libertad: el tratamiento se realiza con el consentimiento previo, expreso e informado del titular.",
          "Veracidad o calidad: la información sujeta a tratamiento debe ser veraz, completa, exacta y actualizada.",
          "Transparencia: el titular puede obtener información sobre sus datos en cualquier momento.",
          "Acceso y circulación restringida: los datos solo se ponen a disposición de personas autorizadas o en los casos previstos por la ley.",
          "Seguridad: se aplican medidas técnicas y administrativas para proteger los datos (sección 15).",
          "Confidencialidad: quienes intervienen en el tratamiento están obligados a mantener la reserva de la información.",
        ],
      },
    ],
  },
  {
    id: "datos",
    title: "5. Datos personales que se tratan",
    blocks: [
      {
        kind: "p",
        text: "Según el uso que se haga de la plataforma, se tratan las siguientes categorías de datos:",
      },
      {
        kind: "ul",
        items: [
          "Datos de identificación y contacto del titular: nombre, apellido, correo electrónico, teléfono principal y teléfono alterno.",
          "Datos del perfil: tipo de cuenta (persona usuaria, veterinaria, fundación o aliado) y preferencias de privacidad.",
          "Datos de las mascotas registradas: nombre, especie, raza, color, edad, fotografías y estado (en casa, perdida, en adopción).",
          "Datos de reportes de mascota perdida: descripción, fotografías, ciudad y barrio o zona de la última ubicación conocida.",
          "Datos de avisos de hallazgo o avistamiento: descripción, fotografías y zona (ciudad y barrio).",
          "Datos de pedidos de placa: nombre del destinatario, ciudad, barrio, dirección de envío, teléfono y correo de contacto para la entrega.",
          "Información de las organizaciones (veterinarias, fundaciones y aliados): nombre, datos de contacto, ubicación y estado de verificación.",
          "Información para administrar la cuenta: credenciales de acceso (la contraseña se almacena de forma cifrada y nunca se muestra) y registros de actividad relevantes para la operación.",
          "Información técnica de seguridad: registros internos de auditoría de operaciones sensibles (por ejemplo, cambios de estado de reportes o pedidos), utilizados para trazabilidad y control.",
        ],
      },
      {
        kind: "p",
        text: "La plataforma no recopila datos distintos de los aquí descritos. Cuando un titular registra datos de un tercero (por ejemplo, un dato de contacto para el envío de una placa), es responsable de contar con la autorización de esa persona.",
      },
    ],
  },
  {
    id: "sensibles",
    title: "6. Datos sensibles: información médica de la mascota",
    blocks: [
      {
        kind: "p",
        text: "La plataforma permite registrar de forma opcional información médica de la mascota (por ejemplo, notas de salud, vacunas o tratamientos). En la medida en que esta información pueda asociarse a una persona natural, la normativa colombiana la considera un dato sensible y recibe protección reforzada.",
      },
      {
        kind: "ul",
        items: [
          "Su registro es voluntario: la cuenta y el resto de funciones operan sin necesidad de aportarla.",
          "No se publica: no aparece en páginas ni perfiles públicos, ni en resultados de búsqueda pública.",
          "El acceso está restringido a la persona propietaria y, cuando corresponde por el contexto de atención, a la organización involucrada, mediante controles de base de datos y funciones del servidor.",
          "Se minimiza su exposición: las consultas devuelven solo lo necesario para la finalidad concreta.",
          "Su tratamiento se limita a las finalidades relacionadas con el cuidado y el reencuentro de la mascota (sección 7).",
          "Los controles técnicos vigentes que protegen esta información se mantienen y no se debilitan por efecto de esta política.",
        ],
      },
      {
        kind: "p",
        text: "El titular puede abstenerse de registrar información médica y puede solicitar su rectificación o supresión conforme a la sección 12.",
      },
    ],
  },
  {
    id: "finalidades",
    title: "7. Finalidades del tratamiento",
    blocks: [
      {
        kind: "p",
        text: "Los datos personales se tratan únicamente para las siguientes finalidades, agrupadas por ámbito:",
      },
      { kind: "h3", text: "Cuenta" },
      {
        kind: "ul",
        items: [
          "Crear y administrar la cuenta y el perfil del titular.",
          "Autenticar el acceso y proteger la seguridad de la cuenta.",
          "Gestionar las preferencias de privacidad y las autorizaciones otorgadas.",
        ],
      },
      { kind: "h3", text: "Mascotas" },
      {
        kind: "ul",
        items: [
          "Registrar y administrar la información de las mascotas del titular.",
          "Conservar la información médica que el titular decida registrar, con acceso restringido.",
        ],
      },
      { kind: "h3", text: "Reencuentro" },
      {
        kind: "ul",
        items: [
          "Publicar reportes de mascota perdida y avisos de hallazgo o avistamiento para facilitar el reencuentro.",
          "Permitir el contacto entre quien encuentra una mascota, su familia y las organizaciones involucradas, dentro del contexto de un reporte.",
        ],
      },
      { kind: "h3", text: "Comunicaciones" },
      {
        kind: "ul",
        items: [
          "Enviar notificaciones dentro de la plataforma sobre las mascotas, los reportes y los pedidos del titular.",
          "Responder consultas, reclamos y solicitudes de ejercicio de derechos.",
        ],
      },
      { kind: "h3", text: "Placas" },
      {
        kind: "ul",
        items: [
          "Gestionar la solicitud, el pago cuando aplique y el envío de placas de identificación.",
          "Dar seguimiento al estado del pedido y a su entrega.",
        ],
      },
      { kind: "h3", text: "Seguridad y cumplimiento" },
      {
        kind: "ul",
        items: [
          "Mantener registros internos de auditoría de operaciones sensibles para trazabilidad y control.",
          "Prevenir el uso indebido de la plataforma y atender requerimientos legales.",
        ],
      },
      { kind: "h3", text: "Derechos del titular" },
      {
        kind: "ul",
        items: [
          "Atender y dejar constancia de las solicitudes de conocer, actualizar, rectificar, suprimir datos o revocar la autorización.",
          "Conservar la prueba de la autorización otorgada.",
        ],
      },
      {
        kind: "p",
        text: "La plataforma no utiliza los datos personales para publicidad, mercadeo, elaboración de perfiles comerciales ni venta o cesión de datos a terceros con fines comerciales.",
      },
    ],
  },
  {
    id: "autorizacion",
    title: "8. Autorización y consentimiento",
    blocks: [
      {
        kind: "p",
        text: "Al crear una cuenta, el titular debe leer esta política y otorgar su autorización mediante una casilla de aceptación obligatoria, con el siguiente texto:",
      },
      {
        kind: "p",
        text: "«He leído y acepto la Política de Tratamiento de Datos Personales de Huellas de Vuelta y autorizo el tratamiento de mis datos personales de acuerdo con las finalidades informadas.»",
      },
      {
        kind: "p",
        text: "El enlace a esta política está disponible junto a la casilla, de modo que el titular pueda leer el documento completo antes de finalizar el registro. Sin esta aceptación no es posible crear la cuenta. La aceptación se valida también en el servidor: no es posible crear una cuenta mediante una solicitud que omita el consentimiento requerido.",
      },
      {
        kind: "p",
        text: "Cada aceptación queda registrada de forma que se pueda demostrar qué persona la otorgó, sobre qué política, en qué versión y en qué fecha. Estos registros son de solo lectura para el titular y no se modifican ni se sobrescriben cuando se publica una nueva versión: se conserva el historial (sección 12).",
      },
      {
        kind: "p",
        text: "El registro del consentimiento se limita a los datos necesarios para acreditarlo (titular, tipo de política, versión y fecha), en aplicación del principio de minimización.",
      },
    ],
  },
  {
    id: "preferencias",
    title: "9. Preferencias de privacidad",
    blocks: [
      {
        kind: "p",
        text: "Además de la autorización general de la sección 8, la plataforma ofrece tres autorizaciones adicionales, independientes y voluntarias, que el titular puede activar o desactivar en cualquier momento desde «Privacidad → Preferencias de privacidad»:",
      },
      {
        kind: "ul",
        items: [
          "Permitir que una veterinaria o fundación autorizada consulte los datos de contacto del titular cuando registre la recepción de una mascota asociada a su cuenta, para coordinar la entrega.",
          "Mostrar el número de contacto del titular en el perfil público de su mascota mientras esté reportada como perdida. Nunca se muestran la dirección ni el correo.",
          "Compartir el contacto del titular con la persona propietaria de una mascota que el titular haya encontrado, cuando sea necesario para el reencuentro.",
        ],
      },
      {
        kind: "p",
        text: "Estas tres opciones están desactivadas por defecto (opt-in), son independientes entre sí y su estado se guarda en el servidor con la fecha del cambio, de forma auditable. Aceptar la política general de la sección 8 no activa ninguna de estas autorizaciones: el titular puede usar la plataforma sin activar ninguna de las tres.",
      },
    ],
  },
  {
    id: "circulacion",
    title: "10. Circulación y acceso restringido",
    blocks: [
      {
        kind: "p",
        text: "El acceso a los datos personales está limitado por rol y por contexto:",
      },
      {
        kind: "ul",
        items: [
          "Las páginas y consultas públicas solo devuelven información no sensible de la mascota. Nunca exponen la dirección ni el correo del titular; el teléfono solo se muestra si el titular lo autorizó y la mascota está reportada como perdida.",
          "Las organizaciones aliadas solo acceden a datos de contacto del titular cuando existe un reporte que las vincula y el titular activó la autorización correspondiente.",
          "La información médica de la mascota no se expone en canales públicos y solo es accesible en el contexto descrito en la sección 6.",
          "El personal administrativo accede al mínimo de información necesario para cada tarea.",
          "Los perfiles, los consentimientos, las preferencias de privacidad y la información médica no son de lectura pública.",
        ],
      },
      {
        kind: "p",
        text: "Estas restricciones están implementadas en la base de datos (seguridad a nivel de fila) y en las funciones del servidor; la interfaz no es la única barrera de control.",
      },
    ],
  },
  {
    id: "encargados",
    title: "11. Encargados y proveedores",
    blocks: [
      {
        kind: "p",
        text: "Para operar la plataforma, Huellas de Vuelta se apoya en el siguiente proveedor que actúa como encargado del tratamiento, siguiendo sus instrucciones y con obligaciones de confidencialidad y seguridad:",
      },
      {
        kind: "ul",
        items: [
          "Supabase: provee la base de datos, el servicio de autenticación y el almacenamiento de archivos de la plataforma. En esa infraestructura se alojan las cuentas, los datos de mascotas y reportes, los archivos (fotografías y evidencias) y los registros de consentimiento y de auditoría.",
        ],
      },
      {
        kind: "p",
        text: "La plataforma no realiza cesiones de datos personales a terceros con fines comerciales. Cualquier otro encargado o proveedor que llegue a intervenir en el tratamiento se incorporará a esta lista antes de iniciar dicho tratamiento.",
      },
    ],
  },
  {
    id: "derechos",
    title: "12. Derechos del titular",
    blocks: [
      {
        kind: "p",
        text: "De acuerdo con la Ley 1581 de 2012, el titular tiene derecho a:",
      },
      {
        kind: "ul",
        items: [
          "Conocer, actualizar y rectificar sus datos personales.",
          "Solicitar prueba de la autorización otorgada, salvo cuando la ley no la exija.",
          "Ser informado sobre el uso que se ha dado a sus datos personales.",
          "Revocar la autorización cuando el tratamiento no sea acorde con la ley y la Constitución.",
          "Solicitar la supresión de los datos cuando no exista un deber legal o contractual de conservarlos.",
          "Acceder de forma gratuita a sus datos personales objeto de tratamiento.",
          "Presentar quejas ante la Superintendencia de Industria y Comercio como autoridad de protección de datos, una vez agotado el trámite de consulta o reclamo ante el responsable.",
        ],
      },
      {
        kind: "p",
        text: "La revocatoria de la autorización o la supresión de datos no procede cuando exista un deber legal o contractual de conservar la información. El historial de consentimientos otorgados se conserva como prueba de la autorización y no se elimina por la revocatoria de autorizaciones futuras.",
      },
      {
        kind: "p",
        text: "El titular puede actualizar y rectificar buena parte de sus datos directamente en «Mi perfil», y gestionar sus autorizaciones opcionales en «Privacidad → Preferencias de privacidad».",
      },
    ],
  },
  {
    id: "consultas",
    title: "13. Procedimiento para consultas y reclamos",
    blocks: [
      {
        kind: "p",
        text: "El titular puede presentar consultas y reclamos relacionados con el tratamiento de sus datos personales (acceso, actualización, rectificación, revocatoria de la autorización o supresión) a través del correo de contacto para protección de datos personales indicado en la sección 1: [CORREO DE PROTECCIÓN DE DATOS].",
      },
      { kind: "h3", text: "Consultas" },
      {
        kind: "p",
        text: "La solicitud debe identificar al titular y describir la información que desea conocer. El responsable atenderá las consultas dentro de los plazos previstos en la Ley 1581 de 2012 y sus normas reglamentarias.",
      },
      { kind: "h3", text: "Reclamos" },
      {
        kind: "p",
        text: "El reclamo debe contener la identificación del titular, la descripción de los hechos que dan lugar al reclamo, la dirección de contacto y los documentos que se quieran hacer valer. Si el reclamo está incompleto, se solicitará al interesado que lo subsane. El responsable dará trámite al reclamo dentro de los plazos legales aplicables e informará el resultado.",
      },
      {
        kind: "p",
        text: "Los plazos concretos y, si corresponde, canales adicionales de atención se detallarán en la versión publicada de esta política. Agotado el trámite ante el responsable, el titular puede acudir a la Superintendencia de Industria y Comercio.",
      },
    ],
  },
  {
    id: "nna",
    title: "14. Niños, niñas y adolescentes",
    blocks: [
      {
        kind: "p",
        text: "El tratamiento de datos personales de niños, niñas y adolescentes está sujeto a la protección especial que establece el ordenamiento colombiano. Debe responder a su interés superior y respetar sus derechos fundamentales.",
      },
      {
        kind: "p",
        text: "La plataforma está dirigida a personas mayores de edad que gestionan la información de sus mascotas. No se solicita de forma deliberada información de menores de edad. Si se identifica que se han registrado datos de un menor sin la autorización correspondiente, se procederá a su supresión a solicitud del representante legal o por iniciativa del responsable. Actualmente la plataforma no implementa un sistema específico de recolección de autorización de representantes legales.",
      },
    ],
  },
  {
    id: "seguridad",
    title: "15. Medidas de seguridad",
    blocks: [
      {
        kind: "p",
        text: "Huellas de Vuelta aplica medidas técnicas y administrativas razonables para proteger los datos personales frente a acceso no autorizado, pérdida, alteración o uso indebido:",
      },
      {
        kind: "ul",
        items: [
          "Control de acceso a nivel de base de datos (seguridad a nivel de fila) y validaciones en las funciones del servidor.",
          "Las contraseñas se almacenan de forma cifrada y nunca se muestran ni se transmiten en texto plano.",
          "Los archivos privados (fotografías y evidencias de reportes) se sirven mediante enlaces temporales firmados.",
          "Restricción del acceso del personal al mínimo necesario y deber de confidencialidad.",
          "Registros internos de auditoría de operaciones sensibles.",
        ],
      },
      {
        kind: "p",
        text: "Ninguna medida de seguridad garantiza protección absoluta; el responsable trabaja para mantener y mejorar sus controles.",
      },
    ],
  },
  {
    id: "conservacion",
    title: "16. Conservación de los datos",
    blocks: [
      {
        kind: "p",
        text: "Los datos personales se conservan mientras exista una relación entre el titular y la plataforma, y mientras una obligación legal, contractual u operativa exija conservarlos. Los registros de consentimiento se conservan como prueba de la autorización otorgada.",
      },
      {
        kind: "p",
        text: "Cuando deja de existir una finalidad que justifique el tratamiento y no hay un deber de conservación, los datos se suprimen o se anonimizan.",
      },
    ],
  },
  {
    id: "eliminacion",
    title: "17. Eliminación de la cuenta",
    blocks: [
      {
        kind: "p",
        text: "El titular puede solicitar la eliminación de su cuenta desde «Privacidad → Eliminar mi cuenta». Al completarse el proceso:",
      },
      {
        kind: "ul",
        items: [
          "Se elimina la identidad de acceso del titular en el servicio de autenticación.",
          "Se eliminan los datos asociados a la cuenta (perfil, mascotas, reportes, notificaciones y, cuando aplique, la información de la organización).",
          "Los registros internos de auditoría que deben conservarse se mantienen de forma anonimizada, sin datos que identifiquen al titular.",
        ],
      },
      {
        kind: "p",
        text: "No se promete una eliminación absoluta cuando exista una obligación legítima de conservar cierta información de forma anonimizada. Después de eliminar una cuenta, el mismo correo electrónico queda libre y puede utilizarse para registrarse nuevamente.",
      },
      {
        kind: "p",
        text: "La eliminación puede quedar temporalmente bloqueada por condiciones operativas (por ejemplo, reportes activos, pedidos de placa en curso, ser la única persona administradora o gestionar una organización). La plataforma informa estas condiciones antes de continuar.",
      },
    ],
  },
  {
    id: "cambios",
    title: "18. Cambios en la política",
    blocks: [
      {
        kind: "p",
        text: "Esta política puede actualizarse para reflejar cambios normativos o en el funcionamiento de la plataforma. Cada versión tiene un número y una fecha de última actualización.",
      },
      {
        kind: "p",
        text: "Cuando se publique una nueva versión, se solicitará al titular su aceptación de la versión vigente al ingresar a la plataforma. El consentimiento otorgado sobre versiones anteriores no se sobrescribe: se conserva el registro histórico de qué versión aceptó cada persona y en qué fecha. Los cambios relevantes se informarán dentro de la plataforma.",
      },
    ],
  },
  {
    id: "vigencia",
    title: "19. Vigencia y fecha",
    blocks: [
      {
        kind: "p",
        text: `Esta política corresponde a la Versión ${DATA_POLICY_VERSION} y rige a partir de su publicación. Última actualización: ${DATA_POLICY_LAST_UPDATED}.`,
      },
      {
        kind: "p",
        text: "Las bases de datos administradas por Huellas de Vuelta tienen vigencia mientras sea necesario para cumplir las finalidades descritas en esta política.",
      },
    ],
  },
];

export default function DataPolicy() {
  return (
    <>
      <Header />
      <main className={styles.wrap}>
        <p className={styles.eyebrow}>Protección de datos personales</p>
        <h1 className={styles.title}>Política de Tratamiento de Datos Personales</h1>

        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt>Versión</dt>
            <dd>{DATA_POLICY_VERSION}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt>Última actualización</dt>
            <dd>{DATA_POLICY_LAST_UPDATED}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt>Responsable</dt>
            <dd>[RAZÓN SOCIAL / NOMBRE DEL RESPONSABLE]</dd>
          </div>
        </dl>

        <p className={styles.draftBanner}>
          Documento sujeto a revisión jurídica profesional antes de su publicación definitiva. Esta
          política describe el funcionamiento real de la plataforma y toma como marco de referencia la
          normativa colombiana de protección de datos personales, pero no constituye una certificación
          ni una garantía de cumplimiento.
        </p>

        <section className={styles.reference}>
          <h2 className={styles.sectionTitle}>Marco de referencia</h2>
          <ul className={styles.list}>
            <li>Ley 1581 de 2012.</li>
            <li>Decreto 1377 de 2013, en lo que continúe aplicable.</li>
            <li>Decreto 1074 de 2015 y las normas que lo modifiquen.</li>
            <li>Lineamientos y criterios de la Superintendencia de Industria y Comercio.</li>
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
                if (block.kind === "h3") {
                  return (
                    <h3 key={i} className={styles.subTitle}>
                      {block.text}
                    </h3>
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
          <Link href="/dashboard/configuracion/privacidad">Volver a Privacidad</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
