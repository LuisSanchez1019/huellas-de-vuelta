import { redirect } from "next/navigation";

/**
 * El mapa interactivo vive dentro del Landing (sección `#mapa`), no en una
 * página aparte. Esta ruta antigua redirige allí.
 */
export default function MapaPage() {
  redirect("/#mapa");
}
