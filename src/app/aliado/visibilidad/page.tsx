import AliadoVisibilityCard from "@/components/aliado/AliadoVisibilityCard";
import controls from "@/components/ui/controls.module.css";

export default function AliadoVisibilidadPage() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Apoya a Huellas de Vuelta</h1>
        <p className={controls.pageSubtitle}>
          Elige cuántos días quieres que tu empresa aparezca en nuestra red de aliados. El valor se
          calcula según los días que elijas, sin paquetes fijos.
        </p>
      </div>
      <AliadoVisibilityCard />
    </div>
  );
}
