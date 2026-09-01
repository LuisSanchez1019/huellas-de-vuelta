import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isAccountRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";
import type { AccountProfile, AccountProfileInput } from "./types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function rowToProfile(row: ProfileRow): AccountProfile {
  const first = row.first_name ?? "";
  const last = row.last_name ?? "";
  return {
    id: row.id,
    role: isAccountRole(row.role) ? row.role : "usuario",
    displayName: row.display_name ?? `${first} ${last}`.trim(),
    firstName: first,
    lastName: last,
    phone: row.phone ?? "",
    avatarPath: row.avatar_path,
  };
}

/**
 * Perfil de la cuenta autenticada. Deja lista la conexión del futuro formulario
 * de "Mi perfil"; requiere sesión real de Supabase.
 */
export const accountProfileRepository = {
  async getMine(): Promise<AccountProfile | null> {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data ? rowToProfile(data as ProfileRow) : null;
  },

  async updateMine(input: AccountProfileInput): Promise<AccountProfile> {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error("No hay sesión activa.");
    const displayName = `${input.firstName} ${input.lastName}`.trim();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: input.firstName.trim() || null,
        last_name: input.lastName.trim() || null,
        phone: input.phone.trim() || null,
        display_name: displayName || null,
      })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return rowToProfile(data as ProfileRow);
  },
};
