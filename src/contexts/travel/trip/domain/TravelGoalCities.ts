/**
 * Heurística de dominio para extraer par origen/destino del texto libre del viajero.
 * Si hay un destino con "en <ciudad>", el origen se busca solo en el texto previo
 * para no absorber "Madrid en París" como un solo origen de varias palabras.
 */
export class TravelGoalCities {
  static inferFromGoal(goal: string): { from: string; to: string } {
    const g = goal.trim();
    const en = g.match(
      /\ben\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/i,
    );
    const toCity = en?.[1]?.trim() ?? "Destination";
    const beforeEn =
      en?.index !== undefined ? g.slice(0, en.index) : g;
    const desde = beforeEn.match(
      /\b(?:desde|from)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/i,
    );
    const fromCity = desde?.[1]?.trim() ?? "Origin";
    return { from: fromCity, to: toCity };
  }
}
