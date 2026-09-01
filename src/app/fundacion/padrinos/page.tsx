import { UserIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<UserIcon size={28} />}
      title="Padrinos"
      text="Aquí gestionarás las mascotas que buscan padrino monetario y los aportes recibidos de cada padrino."
      step="Próximo paso"
    />
  );
}
