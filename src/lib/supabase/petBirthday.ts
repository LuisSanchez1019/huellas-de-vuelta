import type { SupabaseClient } from "@supabase/supabase-js";
import type { BirthdayPet } from "@/lib/pets/age";
import { todayLocal } from "@/lib/pets/age";

/**
 * Mensaje de cumpleaños. El SERVIDOR decide si corresponde mostrarlo y lo registra
 * (una vez por día y por usuario, entre dispositivos y pestañas). Se le envía solo la
 * fecha calendario LOCAL del usuario. Devuelve las mascotas que cumplen años hoy, o
 * `[]` si no hay ninguna o el aviso de hoy ya se mostró.
 */
export async function claimBirthdayGreeting(
  supabase: SupabaseClient,
  localDate: string = todayLocal(),
): Promise<BirthdayPet[]> {
  const { data, error } = await supabase.rpc("claim_birthday_greeting", { p_local_date: localDate });
  if (error) throw error;
  const raw = (data as unknown as { pets?: { name: string; age: number; sex: string | null }[] } | null)?.pets ?? [];
  return raw.map((p) => ({ name: String(p.name), age: Number(p.age), sex: p.sex ?? null }));
}
