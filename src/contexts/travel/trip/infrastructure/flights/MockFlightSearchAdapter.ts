import { Service } from "diod";

import { FlightSearchPort } from "../../domain/FlightSearchPort";
import type { FlightSearchQuery } from "../../domain/FlightSearchQuery";
import type { NormalizedFlightOffer } from "../../domain/NormalizedFlightOffer";

function offer(
  id: string,
  airline: string,
  priceUsd: number,
  departureTime: string,
  arrivalTime: string,
  stops: number,
  durationMinutes: number,
  q: FlightSearchQuery,
): NormalizedFlightOffer {
  return {
    id,
    airline,
    priceUsd,
    departureTime,
    arrivalTime,
    stops,
    durationMinutes,
    originCode: q.from,
    destinationCode: q.to,
    displayLabel: `${airline} ${departureTime}→${arrivalTime} · ${stops === 0 ? "directo" : `${stops} escala(s)`} · $${priceUsd}`,
    providerTag: "mock",
  };
}

@Service()
export class MockFlightSearchAdapter extends FlightSearchPort {
  override async search(q: FlightSearchQuery): Promise<NormalizedFlightOffer[]> {
    return [
      offer("FL001", "Iberia", 320, "08:00", "16:30", 0, 510, q),
      offer("FL002", "Air Europa", 280, "11:45", "20:15", 1, 510, q),
      offer("FL003", "Ryanair", 150, "06:00", "14:30", 1, 510, q),
    ];
  }
}
