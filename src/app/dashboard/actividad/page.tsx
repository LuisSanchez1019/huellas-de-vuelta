import { ActivityIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<ActivityIcon size={28} />}
      title="Mi actividad"
      text="Aquí verás una línea de tiempo con tu actividad reciente en la plataforma."
      step="Paso 9"
    />
  );
}
