import { jsPDF } from "jspdf";
import {
  ACCENT,
  CONTENT_W,
  Cursor,
  INK,
  MARGIN,
  MUTED,
  PAGE_H,
  PAGE_W,
  addPageFooters,
  fmtDate,
  renderConsultations,
  text,
} from "@/lib/pdf/medicalHistory";
import type { Consultation } from "@/lib/vet/medical";

/**
 * PDF "Información de mi mascota": ficha completa que el propietario puede
 * descargar antes de eliminar una mascota. Se arma EN EL NAVEGADOR con datos que
 * la BD ya entregó al propietario autenticado; no se guarda en Storage, en la
 * base de datos ni en ningún otro lugar: solo se entrega como descarga.
 */

export interface PdfImage {
  /** Data URL JPEG o PNG. */
  dataUrl: string;
  format: "JPEG" | "PNG";
  width: number;
  height: number;
}

export interface PetInfoData {
  generatedAt: string;
  generatedBy: string;
  logo: PdfImage | null;
  photo: PdfImage | null;
  pet: {
    name: string;
    speciesLabel: string;
    breed: string | null;
    sexLabel: string | null;
    /** Fecha de nacimiento ya formateada ("23 de septiembre de 2021"), o null. */
    birthDateText: string | null;
    ageText: string | null;
    colors: string | null;
    statusLabel: string;
    description: string | null;
    registeredAt: string;
  };
  plate: { code: string; statusLabel: string; publicUrl: string | null } | null;
  medical: {
    flags: string[];
    notes: string | null;
    items: { kindLabel: string; label: string; detail: string | null; sourceLabel: string }[];
  } | null;
  vaccinations: {
    name: string;
    applicationDate: string;
    nextDoseDate: string | null;
    lotNumber: string | null;
    veterinaryName: string | null;
    notes: string | null;
  }[];
  consultations: Consultation[];
}

const BAND_H = 40;
const LIGHT = "#f1f5f9";
const LINE = "#cbd5e1";

function fit(image: PdfImage, maxW: number, maxH: number): { w: number; h: number } {
  const ratio = Math.min(maxW / image.width, maxH / image.height);
  return { w: image.width * ratio, h: image.height * ratio };
}

function sectionTitle(c: Cursor, title: string) {
  c.ensure(16);
  c.y += 4;
  c.doc.setFillColor(ACCENT);
  c.doc.rect(MARGIN, c.y - 4.6, 1.6, 6, "F");
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(11.5);
  c.doc.setTextColor(INK);
  c.doc.text(title.toUpperCase(), MARGIN + 4, c.y);
  c.doc.setDrawColor(LINE);
  c.doc.setLineWidth(0.3);
  c.doc.line(MARGIN, c.y + 2, PAGE_W - MARGIN, c.y + 2);
  c.y += 8;
}

/** Tabla de dos columnas etiqueta/valor con filas alternadas; el texto largo se ajusta sin cortarse. */
function kvTable(c: Cursor, rows: [string, string | null | undefined][], width = CONTENT_W) {
  const labelW = 46;
  const valueW = width - labelW - 6;
  let zebra = false;
  for (const [label, value] of rows) {
    if (!value) continue;
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9.5);
    const lines = c.doc.splitTextToSize(value, valueW) as string[];
    const h = Math.max(7, lines.length * 4.2 + 3);
    c.ensure(h);
    if (zebra) {
      c.doc.setFillColor(LIGHT);
      c.doc.rect(MARGIN, c.y - 4.6, width, h, "F");
    }
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(8);
    c.doc.setTextColor(MUTED);
    c.doc.text(label.toUpperCase(), MARGIN + 2, c.y);
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9.5);
    c.doc.setTextColor(INK);
    c.doc.text(lines, MARGIN + labelW, c.y);
    c.y += h;
    zebra = !zebra;
  }
}

/** Tabla con encabezado repetido en cada página. */
function gridTable(c: Cursor, headers: string[], rows: string[][], widths: number[]) {
  const drawHeader = () => {
    c.ensure(10);
    c.doc.setFillColor(ACCENT);
    c.doc.rect(MARGIN, c.y - 4.8, CONTENT_W, 7, "F");
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(8);
    c.doc.setTextColor("#ffffff");
    let x = MARGIN + 2;
    headers.forEach((h, i) => {
      c.doc.text(h.toUpperCase(), x, c.y);
      x += widths[i];
    });
    c.y += 6;
  };
  drawHeader();
  let zebra = false;
  for (const row of rows) {
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9);
    const cells = row.map((cell, i) => c.doc.splitTextToSize(cell || "—", widths[i] - 3) as string[]);
    const h = Math.max(...cells.map((l) => l.length)) * 4 + 3.5;
    if (c.y + h > PAGE_H - MARGIN - 8) {
      c.doc.addPage();
      c.y = MARGIN;
      drawHeader();
    }
    if (zebra) {
      c.doc.setFillColor(LIGHT);
      c.doc.rect(MARGIN, c.y - 4.2, CONTENT_W, h, "F");
    }
    // El encabezado repetido deja la fuente en negrita: se restaura para las celdas.
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9);
    c.doc.setTextColor(INK);
    let x = MARGIN + 2;
    cells.forEach((lines, i) => {
      c.doc.text(lines, x, c.y);
      x += widths[i];
    });
    c.y += h;
    zebra = !zebra;
  }
  c.y += 2;
}

export function buildPetInfoPdf(data: PetInfoData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const c = new Cursor(doc);

  // ---------- Cabecera / portada ----------
  doc.setFillColor(ACCENT);
  doc.rect(0, 0, PAGE_W, BAND_H, "F");
  let textX = MARGIN;
  if (data.logo) {
    try {
      const size = fit(data.logo, 26, 26);
      doc.setFillColor("#ffffff");
      doc.roundedRect(MARGIN - 1.5, 6.5, size.w + 3, size.h + 3, 3, 3, "F");
      doc.addImage(data.logo.dataUrl, data.logo.format, MARGIN, 8, size.w, size.h, undefined, "FAST");
      textX = MARGIN + size.w + 8;
    } catch {
      textX = MARGIN;
    }
  }
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("Información de mi mascota", textX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Huellas de Vuelta", textX, 27);
  doc.setFontSize(8.5);
  doc.text(`Generado el ${fmtDate(data.generatedAt, true)}`, textX, 33);

  c.y = BAND_H + 14;

  // ---------- Tarjeta de la mascota (foto + nombre) ----------
  const photoBox = 40;
  const cardTop = c.y - 6;
  if (data.photo) {
    try {
      const size = fit(data.photo, photoBox, photoBox);
      doc.setDrawColor(LINE);
      doc.setLineWidth(0.4);
      doc.roundedRect(PAGE_W - MARGIN - photoBox, cardTop, photoBox, photoBox, 2, 2, "S");
      doc.addImage(
        data.photo.dataUrl,
        data.photo.format,
        PAGE_W - MARGIN - photoBox + (photoBox - size.w) / 2,
        cardTop + (photoBox - size.h) / 2,
        size.w,
        size.h,
        undefined,
        "FAST",
      );
    } catch {
      /* si la foto no se puede incrustar, se continúa sin ella */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(INK);
  doc.text(data.pet.name, MARGIN, c.y + 4, { maxWidth: CONTENT_W - photoBox - 8 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text(
    [data.pet.speciesLabel, data.pet.breed].filter(Boolean).join("  ·  "),
    MARGIN,
    c.y + 12,
    { maxWidth: CONTENT_W - photoBox - 8 },
  );
  doc.setFontSize(8.5);
  doc.text(`Estado: ${data.pet.statusLabel}`, MARGIN, c.y + 19);
  c.y = Math.max(c.y + 26, cardTop + photoBox + 4);

  // ---------- Datos generales ----------
  sectionTitle(c, "Datos generales");
  kvTable(c, [
    ["Nombre", data.pet.name],
    ["Especie", data.pet.speciesLabel],
    ["Raza", data.pet.breed],
    ["Sexo", data.pet.sexLabel],
    ["Fecha de nacimiento", data.pet.birthDateText],
    ["Edad", data.pet.ageText],
    ["Color / características", data.pet.colors],
    ["Estado", data.pet.statusLabel],
    ["Descripción", data.pet.description],
    ["Fecha de registro", fmtDate(data.pet.registeredAt)],
  ]);

  // ---------- Placa ----------
  sectionTitle(c, "Identificación (placa QR)");
  if (data.plate) {
    kvTable(c, [
      ["Código de la placa", data.plate.code],
      ["Estado de la placa", data.plate.statusLabel],
      ["Perfil público", data.plate.publicUrl],
    ]);
  } else {
    text(c, "Esta mascota no tiene una placa asignada.", { color: MUTED });
  }

  // ---------- Información médica registrada ----------
  sectionTitle(c, "Información médica registrada");
  if (!data.medical || (data.medical.items.length === 0 && !data.medical.notes && data.medical.flags.length === 0)) {
    text(c, "No hay información médica declarada por el propietario.", { color: MUTED });
  } else {
    if (data.medical.flags.length) kvTable(c, [["Indicadores", data.medical.flags.join(", ")]]);
    if (data.medical.notes) kvTable(c, [["Observaciones", data.medical.notes]]);
    if (data.medical.items.length) {
      c.y += 2;
      gridTable(
        c,
        ["Tipo", "Descripción", "Detalle", "Registrado por"],
        data.medical.items.map((i) => [i.kindLabel, i.label, i.detail ?? "", i.sourceLabel]),
        [26, 62, 52, CONTENT_W - 140],
      );
    }
  }

  // ---------- Vacunación ----------
  sectionTitle(c, `Vacunación (${data.vaccinations.length})`);
  if (data.vaccinations.length === 0) {
    text(c, "No hay vacunas registradas.", { color: MUTED });
  } else {
    gridTable(
      c,
      ["Vacuna", "Aplicación", "Próxima dosis", "Lote", "Veterinaria / notas"],
      data.vaccinations.map((v) => [
        v.name,
        fmtDate(v.applicationDate),
        v.nextDoseDate ? fmtDate(v.nextDoseDate) : "",
        v.lotNumber ?? "",
        [v.veterinaryName, v.notes].filter(Boolean).join(" · "),
      ]),
      [44, 32, 32, 22, CONTENT_W - 130],
    );
  }

  // ---------- Historia clínica ----------
  sectionTitle(c, `Historia clínica (${data.consultations.length} ${data.consultations.length === 1 ? "consulta" : "consultas"})`);
  if (data.consultations.length === 0) {
    text(c, "Todavía no hay consultas veterinarias registradas.", { color: MUTED });
  } else {
    renderConsultations(c, data.consultations);
  }

  // ---------- Nota final ----------
  c.ensure(22);
  c.y += 4;
  doc.setDrawColor(LINE);
  doc.line(MARGIN, c.y, PAGE_W - MARGIN, c.y);
  c.y += 6;
  text(
    c,
    `Documento generado para ${data.generatedBy}. Contiene la información registrada de esta mascota en Huellas de Vuelta al momento de la descarga. Huellas de Vuelta no conserva una copia de este documento.`,
    { size: 8, color: MUTED },
  );

  addPageFooters(doc, "Información de mi mascota");
  return doc;
}

export function petInfoPdfFileName(petName: string): string {
  const safe = petName.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `informacion-${safe || "mascota"}.pdf`;
}
