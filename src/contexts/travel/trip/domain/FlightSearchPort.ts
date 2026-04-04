import type { FlightSearchQuery } from "./FlightSearchQuery";
import type { NormalizedFlightOffer } from "./NormalizedFlightOffer";

export abstract class FlightSearchPort {
  abstract search(
    query: FlightSearchQuery,
  ): Promise<NormalizedFlightOffer[]>;
}
