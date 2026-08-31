import { ReportIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<ReportIcon size={28} />}
      title="Reportes activos"
      text="Aquí verás tus reportes de mascotas perdidas o encontradas que siguen abiertos."
      step="Paso 7"
    />
  );
}
