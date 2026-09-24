/**
 * ¿Es `path` una ruta interna segura para redirigir después del login?
 * Se usa para `?next=` (ej. volver a `/m/<publicId>` tras iniciar sesión).
 * Rechaza cualquier cosa que un navegador pueda interpretar como una URL
 * externa: protocolo explícito, "protocolo relativo" (`//evil.com`) o la
 * variante con backslash (`/\evil.com`, que algunos navegadores tratan igual
 * que `//`). Nunca se sigue un `next` que no cumpla esto.
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  return true;
}
