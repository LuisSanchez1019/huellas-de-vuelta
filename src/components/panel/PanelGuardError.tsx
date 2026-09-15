import controls from "@/components/ui/controls.module.css";
import styles from "./panelGuardError.module.css";

/**
 * Estado de error de los guards de panel (`usePanelGuard`/`useAdminGuard`):
 * la verificación de sesión no pudo completarse (red caída, Supabase sin
 * responder a tiempo). Reemplaza el "Verificando tu sesión…" indefinido por
 * un mensaje claro con una forma real de reintentar, en vez de dejar la
 * pantalla bloqueada para siempre.
 */
export default function PanelGuardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.title}>No fue posible verificar tu sesión.</p>
      <p className={styles.text}>
        Puede deberse a una conexión inestable. Revisa tu internet e inténtalo de nuevo.
      </p>
      <button type="button" className={controls.button} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
