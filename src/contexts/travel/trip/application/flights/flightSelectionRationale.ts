const RATIONALE_BY_TAG: Record<string, string> = {
  "Más barato": "La opción más económica entre las que te mostramos.",
  "Mejor equilibrio": "Buen equilibrio entre precio y comodidad de viaje.",
  "Más rápido": "Menor tiempo de vuelo (duración total).",
  Directo: "Sin escalas; trayecto más sencillo.",
  "Más cómodo":
    "Mejor puntuación de comodidad (horarios, escalas y duración).",
};

/**
 * Texto explicativo breve a partir de las etiquetas de buckets del curador.
 */
export function rationaleForFlightTags(tags: string[]): string | undefined {
  if (!tags.length) return undefined;
  for (const t of tags) {
    const line = RATIONALE_BY_TAG[t];
    if (line) return line;
  }
  return `Destaca por: ${tags.join(", ")}.`;
}
