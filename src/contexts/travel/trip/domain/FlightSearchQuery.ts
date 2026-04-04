/**
 * Criterios de búsqueda de vuelos a nivel producto (agnósticos del proveedor).
 */
export type FlightSearchQuery = {
  from: string;
  to: string;
  date: string;
  /** Máximo en USD; viene del arg `budget` del tool cuando existe. */
  budgetUsd?: number;
  cabin?: string;
  adults?: number;
  nonStop?: boolean;
};
