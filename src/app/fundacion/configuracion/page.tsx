import { SettingsIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<SettingsIcon size={28} />}
      title="Configuración"
      text="Aquí ajustarás los datos de la cuenta de la fundación, notificaciones y preferencias."
      step="Próximo paso"
    />
  );
}
