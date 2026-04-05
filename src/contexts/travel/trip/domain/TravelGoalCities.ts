/**
 * Heurística de dominio para extraer par origen/destino del texto-libre del viajero.
 * Origen puede ir **después** del primer "en <ciudad>" (p. ej. "en Hamburgo, salgo de Barcelona").
 *
 * En patrones "de X a Y" / "from X to Y", el destino admite como mucho dos términos
 * ("Buenos Aires") para no englobar frases como "copenhague las navidades".
 */
const _CITY_CHUNK = "[A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+){0,2}";
const _CITY_CHUNK_SHORT = "[A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+){0,1}";

/** 1–2 tokens de nombre propio sin absorber "Madrid en París" ni "París desde Madrid". */
const _CITY_1_2_NO_GLUE =
  "[A-Za-zÀ-ÿ]+(?:\\s+(?!en\\b|desde\\b|from\\b|to\\b)[A-Za-zÀ-ÿ]+){0,1}";

/**
 * Origen en frases como "salgo de …" en todo el mensaje.
 * Como máximo dos términos ("Buenos Aires") y sin tragar el siguiente conector ("en París").
 */
const _ORIGIN_PHRASE = new RegExp(
  `\\b(?:desde|from|salgo\\s+de|salimos\\s+de|parto\\s+de|partimos\\s+de|vuelo\\s+desde)\\s+(${_CITY_1_2_NO_GLUE})\\b`,
  "gi",
);

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
  "próxima",
  "proxima",
  "semana",
  "semanas",
  "mes",
  "meses",
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

function collectEnCities(goal: string): string[] {
  const re = /\ben\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(goal)) !== null) {
    const c = trimCityPhrase(m[1] ?? "");
    if (c) out.push(c);
  }
  return out;
}

function firstOriginFromFullGoal(goal: string): string {
  _ORIGIN_PHRASE.lastIndex = 0;
  const m = _ORIGIN_PHRASE.exec(goal);
  return m?.[1] ? trimCityPhrase(m[1]) : "";
}

function destinationViaIrAVoy(goal: string): string {
  const aRe = goal.match(
    new RegExp(
      `\\b(?:ir|viajar|vuelo|voy)\\s+a\\s+(${_CITY_1_2_NO_GLUE})\\b`,
      "i",
    ),
  );
  return aRe?.[1] ? trimCityPhrase(aRe[1]) : "";
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

    let fromCity = firstOriginFromFullGoal(g);

    const enCandidates = collectEnCities(g);
    let toCity = "";
    for (const c of enCandidates) {
      if (fromCity && c.toLowerCase() === fromCity.toLowerCase()) continue;
      toCity = c;
      break;
    }

    if (!toCity) {
      toCity = destinationViaIrAVoy(g);
    }

    if (!fromCity) {
      const firstEn = g.match(
        /\ben\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/i,
      );
      if (firstEn?.index !== undefined) {
        if (!toCity && firstEn[1]) {
          toCity = trimCityPhrase(firstEn[1]);
        }
        const beforeEn = g.slice(0, firstEn.index);
        const desde = beforeEn.match(
          /\b(?:desde|from)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/i,
        );
        if (desde?.[1]) {
          fromCity = trimCityPhrase(desde[1]);
        }
      }
    }

    if (!fromCity) fromCity = "Origin";
    if (!toCity) toCity = "Destination";

    return { from: fromCity, to: toCity };
  }
}
