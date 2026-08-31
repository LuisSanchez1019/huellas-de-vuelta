import { PawIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<PawIcon size={28} />}
      title="Mis mascotas"
      text="Aquí verás el listado de tus mascotas registradas, con su estado y acciones rápidas."
      step="Paso 3"
    />
  );
}
