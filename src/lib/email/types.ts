/** Mensaje transaccional mínimo. Siempre se envían las dos variantes: HTML y texto plano. */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Contrato que debe cumplir cualquier proveedor de correo. Cambiar de
 * proveedor (Brevo → otro) significa implementar esta interfaz de nuevo, sin
 * tocar el código que llama a `sendEmail`.
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
