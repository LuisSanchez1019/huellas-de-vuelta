import { ActivityIcon, PawIcon, UserIcon } from "@/components/icons/Icon";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { mockAdminUsers } from "@/data/mockAdminUsers";
import styles from "./admin.module.css";

export default function AdminHomePage() {
  const total = mockAdminUsers.length;
  const active = mockAdminUsers.filter((user) => user.status === "active").length;
  const suspended = total - active;
  const totalPets = mockAdminUsers.reduce((sum, user) => sum + user.petsCount, 0);

  return (
    <div>
      <h1 className={styles.title}>Panel de administración</h1>
      <p className={styles.subtitle}>
        Resumen general de la plataforma. Los datos que ves aquí son de ejemplo mientras se conecta este módulo a la base de datos real.
      </p>

      <div className={styles.statGrid}>
        <AdminStatCard icon={<UserIcon size={22} />} label="Usuarios totales" value={total} />
        <AdminStatCard icon={<ActivityIcon size={22} />} label="Usuarios activos" value={active} />
        <AdminStatCard icon={<UserIcon size={22} />} label="Usuarios suspendidos" value={suspended} />
        <AdminStatCard icon={<PawIcon size={20} />} label="Mascotas registradas" value={totalPets} />
      </div>
    </div>
  );
}
