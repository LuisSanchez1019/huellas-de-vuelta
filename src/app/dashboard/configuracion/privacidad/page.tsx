import { ShieldIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<ShieldIcon size={28} />}
      title="Privacidad"
      text="Aquí podrás administrar qué información tuya es visible para otros."
      step="Paso 11"
    />
  );
}
