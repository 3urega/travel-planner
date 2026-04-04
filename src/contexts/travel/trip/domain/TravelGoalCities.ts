/**
 * Heurística de dominio para extraer par origen/destino del texto-libre del viajero.
 * Si hay un destino con "en <ciudad>", el origen se busca solo en el texto previo
 * para no absorber "Madrid en París" como un solo origen de varias palabras.
 *
 * En patrones "de X a Y" / "from X to Y", el destino admite como mucho dos términos
 * ("Buenos Aires") para no englobar frases como "copenhague las navidades".
 */
const _CITY_CHUNK = "[A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+){0,2}";
const _CITY_CHUNK_SHORT = "[A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+){0,1}";

/** Quita artículos o palabras de tiempo pegadas al final del nombre capturado. */
const _NON_CITY_TAIL = new Set([
  "las",
  "los",
  "la",
  "el",
  "al",
  "del",
  "the",
  "next",
  "this",
  "that",
  "for",
  "por",
]);

function trimCityPhrase(s: string): string {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  while (
    parts.length > 1 &&
    _NON_CITY_TAIL.has(parts[parts.length - 1]!.toLowerCase())
  ) {
    parts.pop();
  }
  return parts.join(" ");
}

export class TravelGoalCities {
  static inferFromGoal(goal: string): { from: string; to: string } {
    const g = goal.trim();

    const deA = g.match(
      new RegExp(
        `\\bde\\s+(${_CITY_CHUNK})\\s+a\\s+(${_CITY_CHUNK_SHORT})\\b`,
        "i",
      ),
    );
    if (deA?.[1] && deA[2]) {
      return {
        from: trimCityPhrase(deA[1]),
        to: trimCityPhrase(deA[2]),
      };
    }

    const fromTo = g.match(
      new RegExp(
        `\\bfrom\\s+(${_CITY_CHUNK})\\s+to\\s+(${_CITY_CHUNK_SHORT})\\b`,
        "i",
      ),
    );
    if (fromTo?.[1] && fromTo[2]) {
      return {
        from: trimCityPhrase(fromTo[1]),
        to: trimCityPhrase(fromTo[2]),
      };
    }

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
