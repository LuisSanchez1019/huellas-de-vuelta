import controls from "@/components/ui/controls.module.css";

/**
 * Error localizado dentro de una sección (no a pantalla completa): una
 * petición falló o tardó demasiado. Muestra el motivo y permite reintentar
 * sin bloquear el resto de la página ni "congelar" la interfaz.
 */
export default function InlineRetry({
  message = "No fue posible cargar esta información.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className={controls.notice} role="alert" style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
      <span>{message}</span>
      <button type="button" className={controls.buttonSecondary} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
