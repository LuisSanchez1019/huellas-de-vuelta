import { UserIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<UserIcon size={28} />}
      title="Mi perfil"
      text="Aquí podrás ver y editar la información de tu perfil."
      step="Paso 10"
    />
  );
}
