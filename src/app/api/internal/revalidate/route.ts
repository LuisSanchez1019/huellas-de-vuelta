import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/tags";

/**
 * Invalida un tag de caché pública. Se llama solo DESPUÉS de que una
 * mutación ya guardó su cambio (aprobar/activar organización, guardar
 * perfil, cambiar estado de mascota) — nunca reemplaza esa escritura.
 *
 * Sin verificación de rol: lo único que hace es forzar que el próximo
 * visitante público recalcule un dato YA público (no expone ni modifica
 * nada privado); el peor abuso posible es forzar recálculos de más, acotado
 * por la lista blanca de tags.
 */
const ALLOWED_TAGS: ReadonlySet<string> = new Set(PUBLIC_CACHE_TAGS);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const tag = (body as { tag?: unknown } | null)?.tag;
  if (typeof tag !== "string" || !ALLOWED_TAGS.has(tag)) {
    return NextResponse.json({ error: "Tag no permitido." }, { status: 400 });
  }
  // { expire: 0 }: expira ya (esto llega desde un Route Handler, no una
  // Server Action, así que `updateTag` no aplica). El próximo visitante
  // recalcula en el momento en vez de recibir contenido viejo un rato.
  revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: true, tag });
}
