import { KeyIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<KeyIcon size={28} />}
      title="Seguridad"
      text="Aquí podrás cambiar tu contraseña y revisar la seguridad de tu cuenta."
      step="Paso 11"
    />
  );
}
