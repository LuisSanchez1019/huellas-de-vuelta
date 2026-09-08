import Link from "next/link";
import { ActivityIcon } from "@/components/icons/Icon";
import DashboardPlaceholder from "@/components/dashboard/DashboardPlaceholder";

export default function Page() {
  return (
    <DashboardPlaceholder
      icon={<ActivityIcon size={28} />}
      title="Buscar hogar"
      text="Marca cada mascota como disponible para adopción desde el Listado. El seguimiento de solicitudes de adopción (recepción, revisión y estado del proceso) necesita estructura de base de datos que todavía no existe y está documentada como pendiente."
      step="Pendiente de estructura"
    >
      <Link href="/fundacion/mascotas">Ir al listado de mascotas</Link>
      <p>En el listado puedes filtrar por &laquo;Buscan hogar&raquo; y activar o desactivar ese estado en cada mascota.</p>
    </DashboardPlaceholder>
  );
}
