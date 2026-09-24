import ProveedorQrPanel from "@/components/proveedores/ProveedorQrPanel";
import controls from "@/components/ui/controls.module.css";

export default function ProveedorQrPage() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Códigos QR</h1>
        <p className={controls.pageSubtitle}>
          Genera lotes de códigos QR genéricos y descárgalos en SVG, PNG o como paquete ZIP. Los
          códigos quedan disponibles, sin asignar a ninguna mascota; la asignación todavía no está
          disponible en la plataforma.
        </p>
      </div>
      <ProveedorQrPanel />
    </div>
  );
}
