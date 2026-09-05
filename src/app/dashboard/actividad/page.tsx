import ActivityBoard from "@/components/dashboard/ActivityBoard";
import controls from "@/components/ui/controls.module.css";

export default function Page() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Mi actividad</h1>
        <p className={controls.pageSubtitle}>
          Tus mascotas agrupadas por lo que está pasando con ellas ahora mismo.
        </p>
      </div>
      <ActivityBoard />
    </div>
  );
}
