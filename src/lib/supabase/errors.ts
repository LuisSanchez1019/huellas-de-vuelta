/**
 * Traduce los mensajes de error de Supabase Auth (en inglés) a mensajes
 * claros en español para mostrar en la interfaz.
 */
export function translateAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  const message = raw.toLowerCase();

  if (message.includes("email rate limit exceeded") || message.includes("over_email_send_rate_limit")) {
    return "Se enviaron demasiados correos en poco tiempo y Supabase bloqueó el envío temporalmente. Este proyecto todavía usa el servicio de correo de prueba, que tiene un límite muy bajo (pensado solo para desarrollo). Espera unos minutos e inténtalo de nuevo, o configura un proveedor de correo (SMTP) propio para levantar este límite.";
  }
  if (message.includes("for security purposes") || message.includes("you can only request this after")) {
    return "Ya hiciste esta solicitud hace muy poco. Espera un momento antes de intentarlo de nuevo.";
  }
  if (message.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (message.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
  }
  if (message.includes("user already registered") || message.includes("already registered")) {
    return "Ya existe una cuenta con este correo. Intenta iniciar sesión.";
  }
  if (message.includes("password should be at least")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (message.includes("email address") && message.includes("invalid")) {
    return "El correo electrónico no es válido.";
  }
  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return "No fue posible conectar con el servidor. Verifica tu conexión a internet.";
  }

  return raw || "No fue posible completar la operación.";
}
