/**
 * Oferta de vuelo normalizada para el ATO (no es el modelo del proveedor).
 */
export type NormalizedFlightOffer = {
  id: string;
  airline: string;
  priceUsd: number;
  departureTime: string;
  arrivalTime: string;
  stops: number;
  durationMinutes?: number;
  originCode: string;
  destinationCode: string;
  displayLabel: string;
  /** Metadatos de trazabilidad opcionales (p. ej. ADG); sin JSON crudo del proveedor. */
  providerTag?: string;
  queriedAt?: string;
};
