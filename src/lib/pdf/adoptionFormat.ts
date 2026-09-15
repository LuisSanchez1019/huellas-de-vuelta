import { jsPDF } from "jspdf";

/**
 * Genera (en el navegador) el formato de adopción en PDF y lo entrega listo
 * para descargar con `.save()`. NO se sube a Storage, NO se guarda en la base
 * de datos, NO recibe ni conserva datos del adoptante — esos campos quedan en
 * blanco para diligenciar a mano por fuera de la plataforma (ver Fase 18).
 *
 * Todo lo que se imprime viene de datos reales ya registrados (perfil de la
 * organización autenticada, datos de la mascota que ya le pertenece). Donde
 * un dato no existe en el modelo actual (color, esterilización, condiciones
 * médicas), se deja un espacio en blanco para completar a mano — nunca se
 * inventa ni se asume un valor.
 *
 * Tamaño carta (Letter, 8.5x11"): es el formato de oficina estándar en
 * Colombia (a diferencia de la mayoría de Latinoamérica, que usa A4).
 */

export interface AdoptionFormatOrg {
  name: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  logoDataUrl: string | null;
}

export interface AdoptionFormatPet {
  name: string;
  speciesLabel: string;
  breed: string | null;
  age: string | null;
  sexLabel: string;
  publicId: string;
}

const PAGE_W = 215.9; // carta, mm
const PAGE_H = 279.4;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = "#334155"; // mismo tono que --navy-900 en claro
const MUTED = "#64748b"; // --ink-600
const ACCENT = "#0b8272"; // --teal-600 / --primary

function today(): string {
  return new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

class PdfCursor {
  doc: jsPDF;
  y = MARGIN;
  page = 1;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  /** Salta de página si lo que sigue no cabe, para no partir una sección a la mitad. */
  ensure(height: number) {
    if (this.y + height > PAGE_H - MARGIN - 12) {
      this.doc.addPage();
      this.page += 1;
      this.y = MARGIN;
    }
  }

  gap(h: number) {
    this.y += h;
  }
}

function sectionTitle(c: PdfCursor, text: string) {
  c.ensure(14);
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(11.5);
  c.doc.setTextColor(ACCENT);
  c.doc.text(text.toUpperCase(), MARGIN, c.y);
  c.doc.setDrawColor(ACCENT);
  c.doc.setLineWidth(0.4);
  c.doc.line(MARGIN, c.y + 1.5, PAGE_W - MARGIN, c.y + 1.5);
  c.gap(8);
}

function paragraph(c: PdfCursor, text: string, options: { size?: number; color?: string; bold?: boolean } = {}) {
  const size = options.size ?? 9.5;
  c.doc.setFont("helvetica", options.bold ? "bold" : "normal");
  c.doc.setFontSize(size);
  c.doc.setTextColor(options.color ?? INK);
  const lines = c.doc.splitTextToSize(text, CONTENT_W) as string[];
  c.ensure(lines.length * (size * 0.42) + 2);
  c.doc.text(lines, MARGIN, c.y);
  c.gap(lines.length * (size * 0.42) + 3);
}

/** Campo de dos columnas: etiqueta + valor real, o una línea en blanco si no hay dato. */
function fieldRow(c: PdfCursor, fields: { label: string; value: string | null }[]) {
  const colW = CONTENT_W / fields.length;
  c.ensure(11);
  fields.forEach((field, i) => {
    const x = MARGIN + i * colW;
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(7.5);
    c.doc.setTextColor(MUTED);
    c.doc.text(field.label.toUpperCase(), x, c.y);
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(10);
    c.doc.setTextColor(INK);
    if (field.value) {
      c.doc.text(field.value, x, c.y + 5);
    } else {
      c.doc.setDrawColor(200);
      c.doc.line(x, c.y + 5, x + colW - 6, c.y + 5);
    }
  });
  c.gap(13);
}

/** Una o varias líneas para completar a mano (adoptante, vivienda, etc.). */
function blankLines(c: PdfCursor, label: string, count = 1) {
  c.ensure(7 + count * 8);
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(8.5);
  c.doc.setTextColor(MUTED);
  c.doc.text(label, MARGIN, c.y);
  c.gap(6);
  for (let i = 0; i < count; i++) {
    c.doc.setDrawColor(190);
    c.doc.line(MARGIN, c.y, PAGE_W - MARGIN, c.y);
    c.gap(8);
  }
}

function numberedList(c: PdfCursor, items: string[]) {
  items.forEach((item, i) => {
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9.5);
    c.doc.setTextColor(INK);
    const prefix = `${i + 1}. `;
    const lines = c.doc.splitTextToSize(item, CONTENT_W - 6) as string[];
    c.ensure(lines.length * 4.2 + 2);
    c.doc.text(prefix, MARGIN, c.y);
    c.doc.text(lines, MARGIN + 6, c.y);
    c.gap(lines.length * 4.2 + 2.5);
  });
  c.gap(2);
}

export function buildAdoptionFormatPdf(org: AdoptionFormatOrg, pet: AdoptionFormatPet): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const c = new PdfCursor(doc);

  // ---------- Encabezado ----------
  let textX = MARGIN;
  if (org.logoDataUrl) {
    try {
      doc.addImage(org.logoDataUrl, MARGIN, c.y, 20, 20, undefined, "FAST");
      textX = MARGIN + 26;
    } catch {
      /* si el logo no se puede incrustar, se continúa sin él */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text(org.name || "Organización", textX, c.y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("Aliado de Huellas de Vuelta", textX, c.y + 11);
  const institutional = [org.address && org.city ? `${org.address}, ${org.city}` : org.address || org.city, org.phone, org.email]
    .filter(Boolean)
    .join("  ·  ");
  if (institutional) doc.text(institutional, textX, c.y + 16);
  c.gap(24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text("Formato de adopción de mascota", MARGIN, c.y);
  c.gap(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(`Fecha de generación: ${today()}`, MARGIN, c.y);
  c.gap(8);

  paragraph(
    c,
    "Documento sujeto a revisión jurídica profesional antes de su uso definitivo. No constituye asesoría legal ni garantiza, por sí solo, el cumplimiento de la normativa vigente.",
    { size: 8, color: MUTED },
  );
  c.gap(2);

  // ---------- Sección 1: mascota ----------
  sectionTitle(c, "1. Datos de la mascota");
  fieldRow(c, [
    { label: "Nombre", value: pet.name },
    { label: "Especie", value: pet.speciesLabel },
    { label: "Sexo", value: pet.sexLabel },
  ]);
  fieldRow(c, [
    { label: "Raza", value: pet.breed },
    { label: "Edad aproximada", value: pet.age },
    { label: "Identificación (Huellas de Vuelta)", value: pet.publicId },
  ]);
  blankLines(c, "Color", 1);
  blankLines(c, "Esterilización (marcar: Sí / No / No registrada)", 1);
  blankLines(c, "Observaciones / condiciones médicas relevantes", 2);

  // ---------- Sección 2: adoptante ----------
  sectionTitle(c, "2. Datos del adoptante");
  paragraph(c, "Para diligenciar por la persona adoptante. Huellas de Vuelta no recibe ni conserva esta información.", {
    size: 8,
    color: MUTED,
  });
  blankLines(c, "Nombres y apellidos", 1);
  blankLines(c, "Tipo y número de documento", 1);
  blankLines(c, "Teléfono", 1);
  blankLines(c, "Correo electrónico", 1);
  blankLines(c, "Dirección de residencia", 1);
  blankLines(c, "Ciudad / municipio", 1);

  // ---------- Sección 3: hogar ----------
  sectionTitle(c, "3. Condiciones del hogar y la tenencia");
  blankLines(c, "Dirección donde vivirá el animal (si es distinta a la anterior)", 1);
  blankLines(c, "Tipo de vivienda (casa, apartamento, finca, otro)", 1);
  blankLines(c, "Personas responsables del cuidado diario", 1);
  blankLines(c, "Otros animales en el hogar", 1);
  blankLines(c, "Experiencia previa con mascotas", 1);
  blankLines(c, "Otras condiciones relevantes para su bienestar", 2);

  // ---------- Sección 4: compromisos ----------
  sectionTitle(c, "4. Compromisos del adoptante");
  paragraph(c, "Al firmar este acuerdo, la persona adoptante se compromete a:");
  numberedList(c, [
    "Brindar alimentación adecuada y suficiente según la especie, la raza, la edad y la condición del animal.",
    "Garantizar atención veterinaria oportuna, incluyendo vacunación y controles periódicos de salud.",
    "Adelantar o mantener la esterilización del animal cuando sea recomendable y no exista contraindicación veterinaria.",
    "Mantener actualizada la identificación del animal (placa, chip u otro medio disponible).",
    "Proporcionar un entorno seguro, con espacio, higiene y condiciones adecuadas para su bienestar físico y emocional.",
    "No abandonar al animal bajo ninguna circunstancia y no exponerlo a maltrato, violencia o tratos crueles.",
    `Informar a ${org.name || "la organización"} sobre cambios relevantes en la tenencia del animal (cambio de domicilio, imposibilidad de continuar con su cuidado, entre otros).`,
  ]);

  // ---------- Marco de protección y bienestar animal ----------
  sectionTitle(c, "Marco de protección y bienestar animal");
  paragraph(
    c,
    "Colombia cuenta con normativa de protección y bienestar animal, entre otras: la Ley 1774 de 2016, que reconoce a los animales como seres sentientes y tipifica el maltrato animal como conducta sancionable; la Ley 1801 de 2016 (Código Nacional de Policía y Convivencia), cuyo Título XIII (artículos 116 a 134) regula el cuidado y la tenencia responsable de animales; y la Ley 2054 de 2020, que modifica la Ley 1801 y regula, entre otros aspectos, los centros de bienestar animal y la adopción.",
  );
  paragraph(
    c,
    "Esta referencia normativa es informativa. Los compromisos del numeral 4 son cláusulas propias de este acuerdo de adopción y no pretenden agotar, sustituir ni interpretar de forma definitiva las obligaciones legales que puedan resultar aplicables. Ante cualquier duda sobre su alcance jurídico, se recomienda asesoría legal profesional.",
    { size: 8.5, color: MUTED },
  );

  // ---------- Consecuencias ----------
  sectionTitle(c, "Incumplimiento de los compromisos");
  paragraph(
    c,
    "El abandono o el maltrato de un animal pueden constituir conductas sancionables conforme a la Ley 1774 de 2016 y demás normas vigentes; su investigación y sanción corresponde exclusivamente a las autoridades competentes (Policía Nacional y autoridades administrativas o judiciales, según el caso). " +
      (org.name || "La organización") +
      " no impone ni pretende imponer sanciones legales.",
  );
  paragraph(
    c,
    "Como cláusula propia de este acuerdo de adopción, ante un incumplimiento grave de los compromisos de bienestar animal aquí descritos, " +
      (org.name || "la organización") +
      " podrá solicitar la devolución responsable del animal, sin perjuicio de las actuaciones administrativas o judiciales que, conforme a la normativa vigente, correspondan por separado.",
  );

  // ---------- Firmas ----------
  sectionTitle(c, "Firmas");
  c.ensure(40);
  const colW = CONTENT_W / 2 - 6;
  const signY = c.y + 14;
  doc.setDrawColor(150);
  doc.line(MARGIN, signY, MARGIN + colW, signY);
  doc.line(MARGIN + colW + 12, signY, MARGIN + colW + 12 + colW, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  doc.text("FIRMA DEL ADOPTANTE", MARGIN, signY + 5);
  doc.text("FIRMA DEL REPRESENTANTE DE LA ORGANIZACIÓN", MARGIN + colW + 12, signY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Nombre: ______________________  Documento: ____________", MARGIN, signY + 11);
  doc.text("Nombre: ______________________  Cargo: ____________", MARGIN + colW + 12, signY + 11);
  doc.text("Fecha: ____________________", MARGIN, signY + 16);
  doc.text("Fecha: ____________________", MARGIN + colW + 12, signY + 16);
  c.y = signY + 24;
  blankLines(c, "Testigo (opcional): nombre y documento", 1);

  // ---------- Pie de página / numeración ----------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(
      `${org.name || "Huellas de Vuelta"} · Formato de adopción · Sujeto a revisión jurídica profesional`,
      MARGIN,
      PAGE_H - 10,
    );
    doc.text(`Página ${p} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
  }

  return doc;
}

/** Convierte una URL de imagen pública (ej. el logo en `org-logos`) a data URL para incrustarla en el PDF. */
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
