import { ActivityIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<ActivityIcon size={28} />}
      title="Buscar hogar"
      text="Aquí verás las mascotas marcadas como disponibles para adopción, con seguimiento de solicitudes y estado del proceso."
      step="Próximo paso"
    />
  );
}
