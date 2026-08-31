import { IdCardIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<IdCardIcon size={28} />}
      title="Configuración de cuenta"
      text="Aquí podrás administrar los datos generales de tu cuenta."
      step="Paso 11"
    />
  );
}
