import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isAccountRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";
import type { AccountProfile, AccountProfileInput } from "./types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Bucket público del avatar del perfil (carpeta = id del usuario). */
export const AVATAR_BUCKET = "avatars";

function rowToProfile(
  row: ProfileRow,
  email: string | null,
  emailConfirmed: boolean,
): AccountProfile {
  const first = row.first_name ?? "";
  const last = row.last_name ?? "";
  return {
    id: row.id,
    role: isAccountRole(row.role) ? row.role : "usuario",
    isAdmin: row.is_admin === true,
    email,
    emailConfirmed,
    displayName: row.display_name ?? `${first} ${last}`.trim(),
    firstName: first,
    lastName: last,
    phone: row.phone ?? "",
    avatarPath: row.avatar_path,
    createdAt: row.created_at ?? null,
  };
}

/** URL pública (permanente) del avatar. */
export function getAvatarPublicUrl(path: string): string {
  return createSupabaseBrowserClient().storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Perfil de la cuenta autenticada (tabla `profiles`). Un usuario solo puede
 * leer/modificar el suyo (RLS `Users can ... their own profile`; el trigger
 * `lock_profile_role` impide cambiar `role`/`is_admin` desde aquí).
 */
export const accountProfileRepository = {
  async getMine(): Promise<AccountProfile | null> {
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data ? rowToProfile(data as ProfileRow, user.email ?? null, Boolean(user.email_confirmed_at ?? user.confirmed_at)) : null;
  },

  async updateMine(input: AccountProfileInput): Promise<AccountProfile> {
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("No hay sesión activa.");
    const displayName = `${input.firstName} ${input.lastName}`.trim();
    const patch: Record<string, unknown> = {
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      phone: input.phone.trim() || null,
      display_name: displayName || null,
    };
    if (input.avatarPath !== undefined) patch.avatar_path = input.avatarPath;
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToProfile(data as ProfileRow, user.email ?? null, Boolean(user.email_confirmed_at ?? user.confirmed_at));
  },

  /** Sube el avatar ya optimizado a `avatars/<userId>/<uuid>.<ext>`. */
  async uploadAvatar(blob: Blob, contentType: string): Promise<string> {
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("No hay sesión activa.");
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { contentType, upsert: false });
    if (error) throw error;
    return path;
  },

  async deleteAvatar(path: string): Promise<void> {
    try {
      await createSupabaseBrowserClient().storage.from(AVATAR_BUCKET).remove([path]);
    } catch {
      /* mejor esfuerzo */
    }
  },
};
