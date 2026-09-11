import MyOrdersList from "@/components/placas/MyOrdersList";
import styles from "@/components/mascotas/registerPet.module.css";

export default function PedidosPage() {
  return (
    <div>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Mis pedidos</h1>
        <p className={styles.pageSubtitle}>
          Tus solicitudes de placa y el seguimiento de cada envío. Solo tú puedes ver tus pedidos.
        </p>
      </div>
      <MyOrdersList />
    </div>
  );
}
