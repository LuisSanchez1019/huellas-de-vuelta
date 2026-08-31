import { HomeIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<HomeIcon size={30} />}
      title="Bienvenido a tu panel"
      text="Aquí verás el resumen de tus mascotas, reportes activos y notificaciones recientes. Este contenido se construye en el siguiente paso."
      step="Paso 2"
    />
  );
}
