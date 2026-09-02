import ReportsList from "@/components/reportes/ReportsList";
import controls from "@/components/ui/controls.module.css";

export default function Page() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Reportes activos</h1>
        <p className={controls.pageSubtitle}>
          Reportes de mascota perdida que siguen abiertos. Se cierran al volver a marcar la mascota como
          «En casa» o «En adopción» desde su ficha.
        </p>
      </div>
      <ReportsList status="active" />
    </div>
  );
}
