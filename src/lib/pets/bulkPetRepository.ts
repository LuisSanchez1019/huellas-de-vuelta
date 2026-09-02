import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseUserId } from "@/lib/auth/session";
import { PET_PHOTO_BUCKET } from "@/lib/supabase/pets";
import type { Database } from "@/lib/supabase/database.types";
import type { PetSex, PetSpecies } from "@/lib/supabase/types";
import { isBulkPetStatus, type BulkPet, type BulkPetInput, type OrgScope } from "./bulkPets";
import { seedBulkPets } from "./mockBulkPets";

type OrgPetRow = Database["public"]["Tables"]["organization_pets"]["Row"];

/**
 * Sube la foto de una mascota de organización al mismo bucket privado que las
 * mascotas de usuario (`pet-photos`), en la carpeta de la organización
 * (`<org_id>/orgpet/<petId>.<ext>`). Las políticas RLS de Storage ya lo permiten
 * porque `org_id === auth.uid()`. Devuelve la ruta del objeto.
 */
export async function uploadOrgPetPhoto(
  supabase: SupabaseClient,
  orgId: string,
  petId: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const extension = contentType === "image/jpeg" ? "jpg" : "webp";
  const path = `${orgId}/orgpet/${petId}.${extension}`;
  const { error } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Contrato de acceso a datos de mascotas de organizaciones (fundación /
 * veterinaria). La UI solo depende de esta interfaz: para conectar Supabase
 * más adelante basta con cambiar la implementación por debajo.
 */
export interface BulkPetRepository {
  list(scope: OrgScope): Promise<BulkPet[]>;
  createMany(scope: OrgScope, inputs: BulkPetInput[]): Promise<BulkPet[]>;
  update(scope: OrgScope, id: string, patch: Partial<BulkPetInput>): Promise<BulkPet>;
  remove(scope: OrgScope, id: string): Promise<void>;
  setFlags(scope: OrgScope, id: string, flags: { needsHome?: boolean; needsSponsor?: boolean }): Promise<BulkPet>;
}

function storageKey(scope: OrgScope): string {
  return `hdv.bulkPets.${scope.kind}.${scope.id}`;
}

function readStore(scope: OrgScope): BulkPet[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BulkPet[]) : null;
  } catch {
    return null;
  }
}

function writeStore(scope: OrgScope, pets: BulkPet[]): void {
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(pets));
  } catch {
    /* almacenamiento no disponible: se ignora en modo demo */
  }
}

function loadOrSeed(scope: OrgScope): BulkPet[] {
  const stored = readStore(scope);
  if (stored) return stored;
  const seeded = seedBulkPets(scope.kind, scope.id, scope.name);
  writeStore(scope, seeded);
  return seeded;
}

function newId(): string {
  return `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function materialize(scope: OrgScope, input: BulkPetInput): BulkPet {
  const now = new Date();
  return {
    id: newId(),
    name: input.name,
    species: input.species,
    speciesOther: input.speciesOther ?? null,
    breed: input.breed ?? null,
    age: input.age ?? null,
    sex: input.sex,
    status: input.status ?? "available",
    photoUrl: input.photoUrl ?? null,
    photoPath: input.photoPath ?? null,
    intakeDate: input.intakeDate ?? now.toISOString().slice(0, 10),
    orgKind: scope.kind,
    orgId: scope.id,
    orgName: scope.name,
    needsHome: false,
    needsSponsor: false,
    createdAt: now.toISOString(),
  };
}

/** Implementación local (localStorage) para la etapa sin backend. */
class LocalBulkPetRepository implements BulkPetRepository {
  async list(scope: OrgScope): Promise<BulkPet[]> {
    return loadOrSeed(scope)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createMany(scope: OrgScope, inputs: BulkPetInput[]): Promise<BulkPet[]> {
    const current = loadOrSeed(scope);
    const created = inputs.map((input) => materialize(scope, input));
    writeStore(scope, [...created, ...current]);
    return created;
  }

  async update(scope: OrgScope, id: string, patch: Partial<BulkPetInput>): Promise<BulkPet> {
    const current = loadOrSeed(scope);
    const index = current.findIndex((pet) => pet.id === id);
    if (index === -1) throw new Error("No se encontró la mascota.");
    const previous = current[index];
    const updated: BulkPet = {
      ...previous,
      name: patch.name ?? previous.name,
      species: patch.species ?? previous.species,
      sex: patch.sex ?? previous.sex,
      status: patch.status ?? previous.status,
      speciesOther: patch.speciesOther ?? previous.speciesOther,
      breed: patch.breed ?? previous.breed,
      age: patch.age ?? previous.age,
      photoUrl: patch.photoUrl ?? previous.photoUrl,
      photoPath: patch.photoPath ?? previous.photoPath,
      intakeDate: patch.intakeDate ?? previous.intakeDate,
    };
    const next = current.slice();
    next[index] = updated;
    writeStore(scope, next);
    return updated;
  }

  async remove(scope: OrgScope, id: string): Promise<void> {
    const current = loadOrSeed(scope);
    writeStore(scope, current.filter((pet) => pet.id !== id));
  }

  async setFlags(
    scope: OrgScope,
    id: string,
    flags: { needsHome?: boolean; needsSponsor?: boolean },
  ): Promise<BulkPet> {
    const current = loadOrSeed(scope);
    const index = current.findIndex((pet) => pet.id === id);
    if (index === -1) throw new Error("No se encontró la mascota.");
    const updated: BulkPet = {
      ...current[index],
      needsHome: flags.needsHome ?? current[index].needsHome,
      needsSponsor: flags.needsSponsor ?? current[index].needsSponsor,
    };
    const next = current.slice();
    next[index] = updated;
    writeStore(scope, next);
    return updated;
  }
}

/** Implementación contra Supabase (tabla `organization_pets`, RLS por organización). */
class SupabaseBulkPetRepository implements BulkPetRepository {
  private rowToPet(row: OrgPetRow, orgName: string): BulkPet {
    return {
      id: row.id,
      name: row.name,
      species: row.species as PetSpecies,
      speciesOther: row.species_other,
      breed: row.breed,
      age: row.age,
      sex: row.sex as PetSex,
      status: isBulkPetStatus(row.status) ? row.status : "available",
      photoUrl: row.photo_url,
      photoPath: row.photo_path,
      intakeDate: row.intake_date ?? row.created_at.slice(0, 10),
      orgKind: (row.org_kind === "veterinaria" ? "veterinaria" : "fundacion"),
      orgId: row.org_id,
      orgName,
      needsHome: row.needs_home,
      needsSponsor: row.needs_sponsor,
      createdAt: row.created_at,
    };
  }

  async list(scope: OrgScope): Promise<BulkPet[]> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("organization_pets")
      .select("*")
      .eq("org_id", scope.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => this.rowToPet(row, scope.name));
  }

  async createMany(scope: OrgScope, inputs: BulkPetInput[]): Promise<BulkPet[]> {
    if (inputs.length === 0) return [];
    const supabase = createSupabaseBrowserClient();
    const payload = inputs.map((input) => ({
      org_id: scope.id,
      org_kind: scope.kind,
      name: input.name,
      species: input.species,
      species_other: input.speciesOther ?? null,
      breed: input.breed ?? null,
      age: input.age ?? null,
      sex: input.sex,
      status: input.status ?? "available",
      photo_url: input.photoUrl ?? null,
      photo_path: input.photoPath ?? null,
      intake_date: input.intakeDate ?? null,
    }));
    const { data, error } = await supabase.from("organization_pets").insert(payload).select("*");
    if (error) throw error;
    return (data ?? []).map((row) => this.rowToPet(row, scope.name));
  }

  async update(scope: OrgScope, id: string, patch: Partial<BulkPetInput>): Promise<BulkPet> {
    const supabase = createSupabaseBrowserClient();
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.species !== undefined) payload.species = patch.species;
    if (patch.speciesOther !== undefined) payload.species_other = patch.speciesOther;
    if (patch.breed !== undefined) payload.breed = patch.breed;
    if (patch.age !== undefined) payload.age = patch.age;
    if (patch.sex !== undefined) payload.sex = patch.sex;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.photoUrl !== undefined) payload.photo_url = patch.photoUrl;
    if (patch.photoPath !== undefined) payload.photo_path = patch.photoPath;
    if (patch.intakeDate !== undefined) payload.intake_date = patch.intakeDate;
    const { data, error } = await supabase
      .from("organization_pets")
      .update(payload)
      .eq("id", id)
      .eq("org_id", scope.id)
      .select("*")
      .single();
    if (error) throw error;
    return this.rowToPet(data, scope.name);
  }

  async remove(scope: OrgScope, id: string): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("organization_pets")
      .delete()
      .eq("id", id)
      .eq("org_id", scope.id);
    if (error) throw error;
  }

  async setFlags(
    scope: OrgScope,
    id: string,
    flags: { needsHome?: boolean; needsSponsor?: boolean },
  ): Promise<BulkPet> {
    const supabase = createSupabaseBrowserClient();
    const payload: Record<string, unknown> = {};
    if (flags.needsHome !== undefined) payload.needs_home = flags.needsHome;
    if (flags.needsSponsor !== undefined) payload.needs_sponsor = flags.needsSponsor;
    const { data, error } = await supabase
      .from("organization_pets")
      .update(payload)
      .eq("id", id)
      .eq("org_id", scope.id)
      .select("*")
      .single();
    if (error) throw error;
    return this.rowToPet(data, scope.name);
  }
}

const local = new LocalBulkPetRepository();
const supabaseImpl = new SupabaseBulkPetRepository();

// Adaptador: con sesión real de Supabase → base de datos; sin sesión
// (modo desarrollo) → localStorage. La UI no cambia.
export const bulkPetRepository: BulkPetRepository = {
  async list(scope) {
    return (await getSupabaseUserId()) ? supabaseImpl.list(scope) : local.list(scope);
  },
  async createMany(scope, inputs) {
    return (await getSupabaseUserId()) ? supabaseImpl.createMany(scope, inputs) : local.createMany(scope, inputs);
  },
  async update(scope, id, patch) {
    return (await getSupabaseUserId()) ? supabaseImpl.update(scope, id, patch) : local.update(scope, id, patch);
  },
  async remove(scope, id) {
    return (await getSupabaseUserId()) ? supabaseImpl.remove(scope, id) : local.remove(scope, id);
  },
  async setFlags(scope, id, flags) {
    return (await getSupabaseUserId()) ? supabaseImpl.setFlags(scope, id, flags) : local.setFlags(scope, id, flags);
  },
};
