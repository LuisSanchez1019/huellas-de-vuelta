import Link from "next/link";
import { UserIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<UserIcon size={28} />}
      title="Padrinos"
      text="Marca cada mascota como &laquo;busca padrino&raquo; desde el Listado. La gestión de aportes y padrinos requiere una pasarela de pagos y estructura de base de datos que no forman parte de esta versión; están documentadas como pendientes. No se muestran aportes ni transacciones simuladas."
      step="Pendiente de estructura"
    >
      <Link href="/fundacion/mascotas">Ir al listado de mascotas</Link>
      <p>En el listado puedes filtrar por &laquo;Buscan padrino&raquo; y activar o desactivar ese estado en cada mascota.</p>
    </DashboardPlaceholder>
  );
}
