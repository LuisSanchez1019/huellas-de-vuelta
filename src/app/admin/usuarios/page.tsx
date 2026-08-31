import UsersTable from "@/components/admin/UsersTable";
import { mockAdminUsers } from "@/data/mockAdminUsers";
import styles from "../admin.module.css";

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className={styles.title}>Usuarios</h1>
      <p className={styles.subtitle}>Busca, filtra y revisa las cuentas registradas en la plataforma.</p>
      <UsersTable users={mockAdminUsers} />
    </div>
  );
}
