import ReportsList from "@/components/reportes/ReportsList";
import controls from "@/components/ui/controls.module.css";

export default function Page() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Historial de reportes</h1>
        <p className={controls.pageSubtitle}>Reportes de mascota perdida que ya se cerraron.</p>
      </div>
      <ReportsList status="closed" />
    </div>
  );
}
