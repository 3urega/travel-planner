import { z } from "zod";
import type OpenAI from "openai";

export type ToolDefinition = {
  schema: OpenAI.Chat.ChatCompletionTool;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  estimateCost?: (args: Record<string, unknown>) => number | undefined;
  /** Timeout por tool (p. ej. búsquedas lentas). Si falta, usa el default del ejecutor. */
  timeoutMs?: number;
};

const searchHotelsSchema = z.object({
  city: z.string(),
  check_in: z.string(),
  check_out: z.string(),
  budget_per_night: z.number().optional(),
});

const bookFlightSchema = z.object({
  flight_id: z.string(),
  passenger_name: z.string(),
  cost: z.number(),
});

/**
 * Tools mock que no pasan por {@link FlightSearchPort} (hoteles, reservas).
 * `search_flights` la construye {@link TravelToolCatalog}.
 */
export const staticMockTravelToolDefinitions: Record<string, ToolDefinition> = {
  search_hotels: {
    schema: {
      type: "function",
      function: {
        name: "search_hotels",
        description: "Busca hoteles disponibles en una ciudad para las fechas indicadas.",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "Ciudad de destino" },
            check_in: { type: "string", description: "Fecha de entrada (YYYY-MM-DD)" },
            check_out: { type: "string", description: "Fecha de salida (YYYY-MM-DD)" },
            budget_per_night: { type: "number", description: "Presupuesto máximo por noche en USD" },
          },
          required: ["city", "check_in", "check_out"],
        },
      },
    },
    execute: async (rawArgs: Record<string, unknown>): Promise<unknown> => {
      const args = searchHotelsSchema.parse(rawArgs);
      return [
        { id: "HT001", name: "Hotel Shinjuku", stars: 4, price_per_night: 120, city: args.city },
        { id: "HT002", name: "Capsule Inn Akihabara", stars: 3, price_per_night: 45, city: args.city },
        { id: "HT003", name: "Park Hyatt Tokyo", stars: 5, price_per_night: 450, city: args.city },
      ];
    },
  },

  book_flight: {
    schema: {
      type: "function",
      function: {
        name: "book_flight",
        description: "Reserva un vuelo específico. REQUIERE APROBACIÓN DEL USUARIO antes de ejecutarse.",
        parameters: {
          type: "object",
          properties: {
            flight_id: { type: "string", description: "ID del vuelo a reservar" },
            passenger_name: { type: "string", description: "Nombre completo del pasajero" },
            cost: { type: "number", description: "Coste total en USD" },
          },
          required: ["flight_id", "passenger_name", "cost"],
        },
      },
    },
    execute: async (rawArgs: Record<string, unknown>): Promise<unknown> => {
      const args = bookFlightSchema.parse(rawArgs);
      return {
        booking_ref: `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        flight_id: args.flight_id,
        passenger: args.passenger_name,
        status: "confirmed",
        cost: args.cost,
      };
    },
    estimateCost: (rawArgs: Record<string, unknown>): number | undefined => {
      const parsed = bookFlightSchema.safeParse(rawArgs);
      return parsed.success ? parsed.data.cost : undefined;
    },
  },
};
