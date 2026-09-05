import PetDeliveryPanel from "@/components/organizacion/PetDeliveryPanel";
import controls from "@/components/ui/controls.module.css";

export default function Page() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Recepción de mascotas</h1>
        <p className={controls.pageSubtitle}>
          Casos de mascotas perdidas que alguien planea traer a tu fundación. Confirma solo cuando la
          mascota realmente llegue — seleccionarla no significa que ya la recibiste.
        </p>
      </div>
      <PetDeliveryPanel kind="fundacion" />
    </div>
  );
}
