import type { EmailMessage } from "./types";
import { createSmtpEmailProvider } from "./providers/smtp";

/**
 * Punto único de envío de correos TRANSACCIONALES DE LA APLICACIÓN — distinto
 * de los correos propios de Supabase Auth (confirmación de registro,
 * recuperación de contraseña): esos los sigue enviando Supabase por su
 * cuenta, configurados desde el panel de Supabase (Authentication > SMTP
 * Settings), no desde aquí. Este módulo es para notificaciones futuras de la
 * propia plataforma (ej. avisos administrativos, estados de pedidos).
 *
 * SERVER-ONLY: solo debe llamarse desde Route Handlers, Server Actions o
 * Edge Functions — nunca desde un componente "use client".
 *
 * Hoy solo existe un proveedor (SMTP, pensado para Brevo). Para cambiar de
 * proveedor en el futuro basta con implementar `EmailProvider` de nuevo y
 * cambiar la línea de abajo; ningún llamador de `sendEmail` necesita cambiar.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const provider = createSmtpEmailProvider();
  await provider.send(message);
}

export type { EmailMessage } from "./types";
