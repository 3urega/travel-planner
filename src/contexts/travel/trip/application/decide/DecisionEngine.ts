import crypto from "crypto";

import { Service } from "diod";

import type {
  DecisionRecord,
  DecisionWeights,
  ScoredOption,
} from "../../domain/DecisionRecord";

const DEFAULT_WEIGHTS: DecisionWeights = { price: 0.6, comfort: 0.4 };

type RawOption = {
  id: string;
  label: string;
  /** Coste absoluto en USD. */
  price: number;
  /** Proxy de confort ya normalizado a 0–1 (p. ej. estrellas/5 para hoteles). */
  comfortProxy: number;
};

/**
 * Aplica un scoring ponderado a un conjunto de opciones y elige la mejor.
 *
 * Fórmula: totalScore = priceWeight × (1 - precioPrecio/rangoPrecios)
 *                     + comfortWeight × comfortProxy
 *
 * Esto permite justificar "por qué elegimos X en lugar de Y" con números concretos.
 */
@Service()
export class DecisionEngine {
  rank(
    sessionId: string,
    category: string,
    options: RawOption[],
    weights: DecisionWeights = DEFAULT_WEIGHTS,
  ): DecisionRecord {
    if (options.length === 0) {
      return this.emptyRecord(sessionId, category, weights);
    }

    const prices = options.map((o) => o.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const scored: ScoredOption[] = options.map((opt) => {
      const priceScore = 1 - (opt.price - minPrice) / priceRange;
      const comfortScore = Math.max(0, Math.min(1, opt.comfortProxy));
      const totalScore =
        weights.price * priceScore + weights.comfort * comfortScore;

      return {
        id: opt.id,
        label: opt.label,
        price: opt.price,
        comfort: opt.comfortProxy,
        priceScore: Math.round(priceScore * 100) / 100,
        comfortScore: Math.round(comfortScore * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
        chosen: false,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    const chosen = scored[0];
    chosen.chosen = true;

    const justification =
      `Se eligió "${chosen.label}" (score: ${chosen.totalScore}). ` +
      `Precio: ${chosen.priceScore} × ${weights.price} | ` +
      `Confort: ${chosen.comfortScore} × ${weights.comfort}. ` +
      `Ponderación: precio ${Math.round(weights.price * 100)}% / confort ${Math.round(weights.comfort * 100)}%.`;

    return {
      id: crypto.randomUUID(),
      sessionId,
      category,
      options: scored,
      chosenId: chosen.id,
      justification,
      weights,
      createdAt: new Date(),
    };
  }

  private emptyRecord(
    sessionId: string,
    category: string,
    weights: DecisionWeights,
  ): DecisionRecord {
    return {
      id: crypto.randomUUID(),
      sessionId,
      category,
      options: [],
      chosenId: "",
      justification: "Sin opciones disponibles para puntuar.",
      weights,
      createdAt: new Date(),
    };
  }
}
