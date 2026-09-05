import AutoScroller from "./AutoScroller";
import PetCard, { type LostPetCardData } from "./PetCard";
import styles from "./landing.module.css";

/** Presentacional: los datos ya llegan resueltos (fetch cacheado en `HelpSection`). */
export default function LostPetsScroller({ cards }: { cards: LostPetCardData[] }) {
  if (cards.length === 0) {
    return (
      <p className={styles.scrollerEmpty}>
        Aún no hay reportes de mascotas perdidas activos en la comunidad.
      </p>
    );
  }

  return (
    <AutoScroller ariaLabel="Mascotas que necesitan ayuda">
      {cards.map((card, index) => (
        <PetCard key={index} pet={card} />
      ))}
    </AutoScroller>
  );
}
