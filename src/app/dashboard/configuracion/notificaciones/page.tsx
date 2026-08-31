import { BellIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<BellIcon size={28} />}
      title="Preferencias de notificaciones"
      text="Aquí podrás elegir qué notificaciones quieres recibir y por qué canal."
      step="Paso 11"
    />
  );
}
