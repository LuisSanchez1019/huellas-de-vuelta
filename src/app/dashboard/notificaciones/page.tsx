import { BellIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<BellIcon size={28} />}
      title="Notificaciones"
      text="Aquí verás tus alertas y notificaciones recientes."
      step="Paso 8"
    />
  );
}
