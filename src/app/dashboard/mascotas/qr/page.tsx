import { QrIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<QrIcon size={28} />}
      title="QR / Placa"
      text="Aquí podrás generar y administrar el código QR de la placa de tus mascotas."
      step="Paso 6"
    />
  );
}
