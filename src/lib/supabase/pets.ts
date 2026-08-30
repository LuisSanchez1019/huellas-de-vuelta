import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pet, PetInput } from "./types";

const TABLE = "pets";

export async function fetchPets(
  supabase: SupabaseClient,
  options: { includeArchived?: boolean } = {},
): Promise<Pet[]> {
  let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
  if (!options.includeArchived) {
    query = query.eq("is_archived", false);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Pet[];
}

export async function fetchPet(supabase: SupabaseClient, id: string): Promise<Pet | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Pet | null;
}

export async function createPet(supabase: SupabaseClient, ownerId: string, input: PetInput): Promise<Pet> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data as Pet;
}

export async function updatePet(supabase: SupabaseClient, id: string, input: PetInput): Promise<Pet> {
  const { data, error } = await supabase.from(TABLE).update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Pet;
}

export async function setPetArchived(supabase: SupabaseClient, id: string, isArchived: boolean): Promise<Pet> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_archived: isArchived })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Pet;
}
