import { PawIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<PawIcon size={28} />}
      title="Registrar mascota"
      text="Aquí podrás registrar una nueva mascota con fotografías y características."
      step="Paso 4"
    />
  );
}
