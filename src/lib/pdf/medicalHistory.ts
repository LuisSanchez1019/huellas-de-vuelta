import { jsPDF } from "jspdf";
import { ROUTE_LABELS, URGENCY_LABELS, type Consultation } from "@/lib/vet/medical";

/**
 * Historia clínica en PDF. Se genera EN EL NAVEGADOR, bajo demanda, con datos
 * que la BD ya devolvió a un usuario autorizado (propietario, o veterinaria con
 * grant vigente y permiso can_generate_pdf + can_read_medical). NO se sube a
 * Storage, NO se guarda ni se cachea y no se expone por URL pública.
 * Prerrequisito de llamada: `authorizePdf` / `authorizeOwnerPdf` (audita y
 * limita la frecuencia en el servidor).
 */

export interface MedicalPdfHeader {
  petName: string;
  speciesLabel: string;
  breed: string | null;
  plateCode: string | null;
  /** Quién genera el documento: "Clínica X — Profesional Y" o "Propietario Z". */
  generatedBy: string;
  generatedAt: string;
}

export const PAGE_W = 215.9;
export const PAGE_H = 279.4;
export const MARGIN = 18;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const INK = "#334155";
export const MUTED = "#64748b";
export const ACCENT = "#0b8272";

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) +
    (withTime ? ` ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : "");
}

export class Cursor {
  y = MARGIN;
  readonly doc: jsPDF;
  constructor(doc: jsPDF) {
    this.doc = doc;
  }
  ensure(h: number) {
    if (this.y + h > PAGE_H - MARGIN - 8) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }
}

export function text(c: Cursor, value: string, opts: { size?: number; bold?: boolean; color?: string; indent?: number } = {}) {
  const size = opts.size ?? 9.5;
  const indent = opts.indent ?? 0;
  c.doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  c.doc.setFontSize(size);
  c.doc.setTextColor(opts.color ?? INK);
  const lines = c.doc.splitTextToSize(value, CONTENT_W - indent) as string[];
  const lh = size * 0.42;
  for (const line of lines) {
    c.ensure(lh + 1);
    c.doc.text(line, MARGIN + indent, c.y);
    c.y += lh;
  }
  c.y += 1.6;
}

export function labelled(c: Cursor, label: string, value: string | null | undefined) {
  if (!value) return;
  text(c, label.toUpperCase(), { size: 7.5, bold: true, color: MUTED });
  c.y -= 0.6;
  text(c, value);
}

/** Consultas (con medicamentos y aclaraciones) a partir de la posición actual del cursor. */
export function renderConsultations(c: Cursor, consultations: Consultation[]) {
  const doc = c.doc;
  consultations.forEach((k, index) => {
    c.ensure(22);
    doc.setDrawColor(ACCENT);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, c.y, PAGE_W - MARGIN, c.y);
    c.y += 5;
    text(c, `Consulta ${consultations.length - index} — ${fmtDate(k.consultedAt)}`, { bold: true, size: 11, color: ACCENT });
    text(c, `${k.orgName ?? "Organización"}  ·  ${k.vetName ?? "Profesional"}  ·  ${URGENCY_LABELS[k.urgency]}`, { size: 8.5, color: MUTED });
    labelled(c, "Motivo", k.reason);

    const vitals = [
      k.weightKg != null ? `Peso ${k.weightKg} kg` : null,
      k.temperatureC != null ? `Temperatura ${k.temperatureC} °C` : null,
      k.heartRate != null ? `Frec. cardíaca ${k.heartRate} lpm` : null,
      k.respiratoryRate != null ? `Frec. respiratoria ${k.respiratoryRate} rpm` : null,
    ].filter(Boolean);
    if (vitals.length) labelled(c, "Signos vitales", vitals.join("  ·  "));

    labelled(c, "Síntomas", k.symptoms);
    labelled(c, "Examen físico", k.physicalExam);
    labelled(c, "Diagnóstico", k.diagnosis);
    labelled(c, "Tratamiento", k.treatment);

    if (k.medications.length) {
      text(c, "MEDICAMENTOS", { size: 7.5, bold: true, color: MUTED });
      c.y -= 0.6;
      for (const m of k.medications) {
        const parts = [
          m.name,
          m.dose != null ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : null,
          m.frequency,
          m.route ? ROUTE_LABELS[m.route] : null,
          m.durationDays != null ? `${m.durationDays} días` : null,
        ].filter(Boolean);
        text(c, `• ${parts.join(" — ")}`, { indent: 3 });
        const extra = [m.instructions, m.startDate && m.endDate ? `Del ${m.startDate} al ${m.endDate}` : m.startDate ? `Desde ${m.startDate}` : null, m.notes].filter(Boolean);
        if (extra.length) text(c, extra.join(" · "), { indent: 6, size: 8.5, color: MUTED });
      }
    }

    labelled(c, "Recomendaciones", k.recommendations);
    labelled(c, "Seguimiento", k.followUpDate ? fmtDate(k.followUpDate) : null);
    labelled(c, "Observaciones finales", k.finalObservations);

    for (const a of k.addenda) {
      text(c, `Aclaración (${fmtDate(a.createdAt, true)} · ${a.orgName ?? "Organización"}): ${a.body}`, { size: 8.5, color: MUTED, indent: 3 });
    }
    c.y += 3;
  });

}

/** Pie de página con paginación en todas las hojas. */
export function addPageFooters(doc: jsPDF, label: string) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(`Huellas de Vuelta · ${label} · Página ${p} de ${pages}`, PAGE_W / 2, PAGE_H - 10, { align: "center" });
  }
}

export function buildMedicalHistoryPdf(header: MedicalPdfHeader, consultations: Consultation[]): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const c = new Cursor(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(ACCENT);
  doc.text("Huellas de Vuelta", MARGIN, c.y + 4);
  c.y += 10;
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text("Historia clínica", MARGIN, c.y);
  c.y += 7;

  text(c, `Mascota: ${header.petName}  ·  ${header.speciesLabel}${header.breed ? `  ·  ${header.breed}` : ""}`, { bold: true, size: 10.5 });
  text(c, `Identificación: ${header.plateCode ?? "sin placa registrada"}`);
  text(c, `Generado el ${fmtDate(header.generatedAt, true)} por ${header.generatedBy}`, { size: 8.5, color: MUTED });
  text(
    c,
    "Documento confidencial generado bajo autorización del propietario. Contiene solo las consultas registradas en Huellas de Vuelta.",
    { size: 8, color: MUTED },
  );
  c.y += 2;

  if (consultations.length === 0) {
    text(c, "Todavía no hay consultas registradas.");
  }

  renderConsultations(c, consultations);

  addPageFooters(doc, "Historia clínica");
  return doc;
}

/** Nombre de archivo seguro (sin caracteres especiales ni datos innecesarios). */
export function medicalPdfFileName(petName: string): string {
  const safe = petName.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `historia-clinica-${safe || "mascota"}.pdf`;
}
