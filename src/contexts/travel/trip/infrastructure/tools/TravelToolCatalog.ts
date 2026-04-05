import { Service } from "diod";
import { z } from "zod";
import type OpenAI from "openai";

import { FlightSearchPort } from "../../domain/FlightSearchPort";
import type { NormalizedFlightOffer } from "../../domain/NormalizedFlightOffer";
import {
  staticMockTravelToolDefinitions,
  type ToolDefinition,
} from "./MockTravelTools";

const searchFlightsArgsSchema = z.object({
  from: z.string(),
  to: z.string(),
  date: z.string(),
  budget: z.number().optional(),
  adults: z.number().optional(),
  non_stop: z.boolean().optional(),
  cabin: z.string().optional(),
});

const _PLACEHOLDER_IATA = /^(origin|destination)$/i;

function assertResolvedFlightRoute(from: string, to: string): void {
  const f = from.trim();
  const t = to.trim();
  if (_PLACEHOLDER_IATA.test(f) || _PLACEHOLDER_IATA.test(t)) {
    throw new Error(
      `Ruta no resuelta: origen o destino son placeholders (Origin/Destination). Recibido from=${JSON.stringify(f)} to=${JSON.stringify(t)}`,
    );
  }
}

function isAtoFlightDebug(): boolean {
  return process.env.ATO_FLIGHT_DEBUG === "1";
}

const searchFlightsOpenAiSchema: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_flights",
    description:
      "Busca vuelos disponibles entre dos aeropuertos o ciudades (idealmente códigos IATA).",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Origen (p. ej. código IATA)",
        },
        to: {
          type: "string",
          description: "Destino (p. ej. código IATA)",
        },
        date: { type: "string", description: "Fecha de vuelo (YYYY-MM-DD)" },
        budget: { type: "number", description: "Presupuesto máximo en USD" },
        adults: { type: "number", description: "Número de adultos (opcional)" },
        non_stop: { type: "boolean", description: "Solo vuelos directos (opcional)" },
        cabin: {
          type: "string",
          description: "Cabina: economy, business, etc. (opcional)",
        },
      },
      required: ["from", "to", "date"],
    },
  },
};

function toSerializableOffer(o: NormalizedFlightOffer): Record<string, unknown> {
  return {
    id: o.id,
    airline: o.airline,
    price: o.priceUsd,
    priceUsd: o.priceUsd,
    departure: o.departureTime,
    arrival: o.arrivalTime,
    departureTime: o.departureTime,
    arrivalTime: o.arrivalTime,
    from: o.originCode,
    to: o.destinationCode,
    originCode: o.originCode,
    destinationCode: o.destinationCode,
    stops: o.stops,
    durationMinutes: o.durationMinutes,
    displayLabel: o.displayLabel,
    providerTag: o.providerTag,
    queriedAt: o.queriedAt,
  };
}

/**
 * Única fuente de verdad para tools de viaje: combina capacidades mock locales
 * con `search_flights` delegada en {@link FlightSearchPort}.
 */
@Service()
export class TravelToolCatalog {
  constructor(private readonly flightSearchPort: FlightSearchPort) {}

  getTools(): Record<string, ToolDefinition> {
    const searchFlightsTool: ToolDefinition = {
      schema: searchFlightsOpenAiSchema,
      execute: async (rawArgs: Record<string, unknown>): Promise<unknown> => {
        const args = searchFlightsArgsSchema.parse(rawArgs);
        if (isAtoFlightDebug()) {
          console.warn("[ATO][search_flights] query", {
            from: args.from,
            to: args.to,
            date: args.date,
            budget: args.budget,
            adults: args.adults,
            non_stop: args.non_stop,
            cabin: args.cabin,
          });
        }
        assertResolvedFlightRoute(args.from, args.to);
        const offers = await this.flightSearchPort.search({
          from: args.from,
          to: args.to,
          date: args.date,
          budgetUsd: args.budget,
          adults: args.adults,
          nonStop: args.non_stop,
          cabin: args.cabin,
        });
        return offers.map(toSerializableOffer);
      },
      timeoutMs: 45_000,
    };

    return {
      search_flights: searchFlightsTool,
      ...staticMockTravelToolDefinitions,
    };
  }

  getToolSchemas(): OpenAI.Chat.ChatCompletionTool[] {
    return Object.values(this.getTools()).map((t) => t.schema);
  }
}
