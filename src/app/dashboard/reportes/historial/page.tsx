import { ReportIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<ReportIcon size={28} />}
      title="Historial de reportes"
      text="Aquí verás el historial de reportes cerrados o resueltos."
      step="Paso 7"
    />
  );
}
