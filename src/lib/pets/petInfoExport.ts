import type { SupabaseClient } from "@supabase/supabase-js";
import { ageUnitLabels, catColorLabels, sexLabels, speciesLabels, statusLabels } from "@/lib/pets/labels";
import { fetchMedicalItems, fetchMedicalSummary, MEDICAL_SOURCE_LABEL } from "@/lib/supabase/petMedical";
import { fetchMyPetsForPlate } from "@/lib/supabase/plateOrders";
import { fetchPet, PET_PHOTO_BUCKET } from "@/lib/supabase/pets";
import type { Pet } from "@/lib/supabase/types";
import { fetchAllForPdf } from "@/lib/vet/medical";
import { authorizeOwnerPdf, fetchOwnerHistoryPage } from "@/lib/vet/ownerAccess";
import { formatAge, formatBirthDate, todayLocal } from "@/lib/pets/age";
import { fetchVaccinations } from "@/lib/supabase/petVaccinations";
import { withTimeout } from "@/lib/async/withTimeout";
import type { PdfImage, PetInfoData } from "@/lib/pdf/petInfo";

/**
 * Reúne TODA la información de una mascota del propietario autenticado y la
 * entrega como PDF descargable. Nada se guarda: ni Storage, ni base de datos, ni
 * caché; el PDF solo existe en memoria hasta que el navegador lo descarga.
 *
 * Seguridad: primero `owner_pdf_authorize` (RPC) comprueba en el servidor que la
 * mascota es del usuario autenticado (`pets.owner_id = auth.uid()`), limita la
 * frecuencia y audita. El resto de lecturas también pasan por RLS/RPC del
 * propietario: un `pet_id` ajeno no devuelve nada.
 */

const PDF_TIMEOUT_MS = 90_000;

const KIND_LABELS: Record<string, string> = {
  condition: "Condición",
  allergy: "Alergia",
  medication: "Medicamento",
  urgent: "Urgente",
};

/**
 * Convierte un Blob de imagen a JPEG/PNG (data URL) reducido. Usa `createImageBitmap`
 * (no `img.decode()`, que no se resuelve si la pestaña está en segundo plano) y
 * tiene tope de tiempo: si la imagen no se puede procesar, el PDF sale sin ella.
 */
async function blobToPdfImage(blob: Blob, format: "JPEG" | "PNG", maxSide: number): Promise<PdfImage | null> {
  try {
    const bitmap = await withTimeout(createImageBitmap(blob), 8000);
    try {
      const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * ratio));
      const height = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      if (format === "JPEG") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      return {
        dataUrl: canvas.toDataURL(format === "JPEG" ? "image/jpeg" : "image/png", 0.85),
        format,
        width,
        height,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function loadPhoto(supabase: SupabaseClient, path: string | null): Promise<PdfImage | null> {
  if (!path) return null;
  try {
    const { data, error } = await withTimeout(supabase.storage.from(PET_PHOTO_BUCKET).download(path), 15000);
    if (error || !data) return null;
    return await blobToPdfImage(data, "JPEG", 900);
  } catch {
    return null;
  }
}

async function loadLogo(): Promise<PdfImage | null> {
  try {
    const res = await withTimeout(fetch("/logo-hdv.png"), 8000);
    if (!res.ok) return null;
    return await blobToPdfImage(await res.blob(), "PNG", 400);
  } catch {
    return null;
  }
}

/** Con fecha de nacimiento la edad se CALCULA al momento de exportar; si no, la edad aproximada registrada. */
function ageText(pet: Pet): string | null {
  if (pet.birth_date) return formatAge(pet.birth_date, todayLocal());
  return pet.age_value != null && pet.age_unit ? `${pet.age_value} ${ageUnitLabels[pet.age_unit].toLowerCase()}` : null;
}

function colorsText(pet: Pet): string | null {
  const values = [pet.color_primary, pet.color_secondary, pet.color_tertiary].filter((v): v is string => Boolean(v));
  const text = values.map((v) => catColorLabels[v] ?? v).join(", ");
  return text || pet.color || null;
}

const PLATE_STATUS_LABELS: Record<string, string> = {
  assigned: "Asignada (pendiente de activar)",
  active: "Activa",
  suspended: "Suspendida",
};

export async function collectPetInfo(supabase: SupabaseClient, petId: string): Promise<PetInfoData> {
  // 1. El servidor valida la propiedad, audita y limita la frecuencia. Sin esto no se arma nada.
  const auth = await authorizeOwnerPdf(supabase, petId);

  // 2. Datos de la mascota (RLS: solo si es del usuario).
  const pet = await fetchPet(supabase, petId);
  if (!pet) throw new Error("PET_NOT_FOUND");

  const [summary, items, consultations, plates, photo, logo, vaccinations] = await Promise.all([
    fetchMedicalSummary(supabase, "owner", petId).catch(() => null),
    fetchMedicalItems(supabase, "owner", petId).catch(() => []),
    fetchAllForPdf((before) => fetchOwnerHistoryPage(supabase, petId, { limit: 50, before }), 5000),
    // Placa vigente de la mascota (RPC del propietario: `qr_tags` no es legible por el dueño de la mascota).
    fetchMyPetsForPlate(supabase).catch(() => []),
    loadPhoto(supabase, pet.photo_path),
    loadLogo(),
    fetchVaccinations(supabase, petId),
  ]);

  const plate = plates.find((entry) => entry.petId === petId && entry.plateCode) ?? null;
  const flags = [
    summary?.hasCondition ? "Condición médica" : null,
    summary?.hasAllergy ? "Alergias" : null,
    summary?.hasMedication ? "Medicación" : null,
    summary?.hasUrgent ? "Requiere medicamento urgente" : null,
  ].filter((f): f is string => Boolean(f));

  return {
    generatedAt: auth.generatedAt,
    generatedBy: auth.ownerName ?? "el propietario",
    logo,
    photo,
    pet: {
      name: pet.name,
      speciesLabel: pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species],
      breed: pet.breed,
      sexLabel: pet.sex ? sexLabels[pet.sex] : null,
      birthDateText: formatBirthDate(pet.birth_date),
      ageText: ageText(pet),
      colors: colorsText(pet),
      statusLabel: statusLabels[pet.status],
      description: pet.description,
      registeredAt: pet.created_at,
    },
    plate: plate?.plateCode
      ? {
          code: plate.plateCode,
          statusLabel: (plate.plateStatus && PLATE_STATUS_LABELS[plate.plateStatus]) || plate.plateStatus || "Vinculada",
          publicUrl: null,
        }
      : null,
    medical: {
      flags,
      notes: summary?.notes ?? null,
      items: items.map((i) => ({
        kindLabel: KIND_LABELS[i.kind] ?? i.kind,
        label: i.label,
        detail: i.detail,
        sourceLabel: MEDICAL_SOURCE_LABEL[i.source] ?? i.source,
      })),
    },
    vaccinations: vaccinations.map((v) => ({
      name: v.vaccineName,
      applicationDate: v.applicationDate,
      nextDoseDate: v.nextDoseDate,
      lotNumber: v.lotNumber,
      veterinaryName: v.veterinaryName,
      notes: v.notes,
    })),
    consultations,
  };
}

/**
 * Genera el PDF completo y lo entrega como descarga. Resuelve SOLO cuando el
 * documento ya se generó y se disparó la descarga; si algo falla lanza el error
 * (y quien llama NO debe continuar con la eliminación).
 */
export async function downloadPetInfoPdf(supabase: SupabaseClient, petId: string): Promise<void> {
  // Tope global: si algo se queda colgado, se rechaza y la eliminación NO continúa.
  const data = await withTimeout(collectPetInfo(supabase, petId), PDF_TIMEOUT_MS);
  const { buildPetInfoPdf, petInfoPdfFileName } = await withTimeout(import("@/lib/pdf/petInfo"), PDF_TIMEOUT_MS);
  const doc = buildPetInfoPdf(data);
  doc.save(petInfoPdfFileName(data.pet.name));
}
