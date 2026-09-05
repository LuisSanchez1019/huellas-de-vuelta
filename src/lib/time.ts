/** "08:00" -> "8:00 a.m." — usado por la tarjeta del mapa y la del Landing. */
export function to12h(value: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return value;
  let h = Number(m[1]);
  const min = m[2];
  const suffix = h < 12 ? "a.m." : "p.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}
