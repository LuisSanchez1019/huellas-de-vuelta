import nodemailer, { type Transporter } from "nodemailer";
import type { EmailMessage, EmailProvider } from "../types";

/**
 * Proveedor SMTP genérico (hoy apunta a Brevo SMTP, pero funciona con
 * cualquier servidor SMTP estándar — cambiar de Brevo a otro proveedor SMTP
 * es solo cambiar las variables de entorno, sin tocar este archivo).
 *
 * SERVER-ONLY. Nunca importar desde un componente "use client": las
 * variables `SMTP_*` no tienen el prefijo `NEXT_PUBLIC_`, así que Next.js no
 * las incluye en el bundle del navegador, pero de todos modos este módulo
 * solo debe usarse desde Route Handlers, Server Actions o Edge Functions.
 */
function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta configurar la variable de entorno ${name} para el envío de correo.`);
  }
  return value;
}

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  const host = readRequiredEnv("SMTP_HOST");
  const port = Number(readRequiredEnv("SMTP_PORT"));
  const user = readRequiredEnv("SMTP_USER");
  const pass = readRequiredEnv("SMTP_PASSWORD");
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransport;
}

export function createSmtpEmailProvider(): EmailProvider {
  return {
    async send(message: EmailMessage) {
      const fromEmail = readRequiredEnv("SMTP_FROM_EMAIL");
      const fromName = process.env.SMTP_FROM_NAME?.trim();
      try {
        await getTransport().sendMail({
          from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
      } catch (error) {
        // Nunca registrar el usuario/contraseña SMTP: solo el tipo de error.
        console.error("[email] fallo al enviar correo vía SMTP.", {
          name: error instanceof Error ? error.name : "desconocido",
        });
        throw new Error("No fue posible enviar el correo.");
      }
    },
  };
}
