import AliadoVisibilityCard from "@/components/aliado/AliadoVisibilityCard";
import controls from "@/components/ui/controls.module.css";

export default function AliadoVisibilidadPage() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Apoya a Huellas de Vuelta</h1>
        <p className={controls.pageSubtitle}>
          Tu aporte nos ayuda a mantener y fortalecer el proyecto para que podamos seguir trabajando
          por el bienestar de los animales y acompañando a más familias.
        </p>
      </div>
      <AliadoVisibilityCard />
    </div>
  );
}
