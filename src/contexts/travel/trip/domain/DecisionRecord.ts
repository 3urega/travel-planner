export type ScoredOption = {
  id: string;
  label: string;
  price: number;
  /** Proxy de confort normalizado 0–1 (estrellas para hotel, hora salida para vuelo). */
  comfort: number;
  priceScore: number;
  comfortScore: number;
  totalScore: number;
  chosen: boolean;
  /** Texto corto para la UI (p. ej. vuelos curados). */
  rationale?: string;
  /** Etiquetas para badges (p. ej. "Más barato"). */
  tags?: string[];
};

export type DecisionWeights = {
  /** Peso asignado al precio (0–1). */
  price: number;
  /** Peso asignado al confort (0–1). */
  comfort: number;
};

/**
 * Registro de una decisión de selección automática basada en scoring.
 * Permite responder "por qué elegimos X en lugar de Y".
 */
export type DecisionRecord = {
  id: string;
  sessionId: string;
  category: string;
  options: ScoredOption[];
  chosenId: string;
  /** Opción confirmada explícitamente por el usuario (POST /api/agent/choose); ausente si solo aplica el scoring. */
  userChosenId?: string;
  justification: string;
  weights: DecisionWeights;
  createdAt: Date;
};
