import "reflect-metadata";

import { NextResponse } from "next/server";

import { GraphRefineService } from "@/contexts/travel/trip/application/graph/GraphRefineService";
import type { FlightRefinementFilters } from "@/contexts/travel/trip/application/flights/flightRefinementTypes";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";

const graphRefineService = container.get(GraphRefineService);

function parseFilters(raw: unknown): FlightRefinementFilters | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const f: FlightRefinementFilters = {};
  if (o.maxStops !== undefined) {
    const n = Number(o.maxStops);
    if (!Number.isFinite(n) || n < 0) return null;
    f.maxStops = n;
  }
  if (o.maxPriceUsd !== undefined) {
    const n = Number(o.maxPriceUsd);
    if (!Number.isFinite(n) || n <= 0) return null;
    f.maxPriceUsd = n;
  }
  if (o.preferMorning === true) f.preferMorning = true;
  if (o.preferAfternoon === true) f.preferAfternoon = true;
  return f;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return HttpNextResponse.badRequest("JSON inválido.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return HttpNextResponse.badRequest("Body debe ser un objeto.");
  }
  const o = body as Record<string, unknown>;
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const graphVersionId =
    typeof o.graphVersionId === "string" ? o.graphVersionId.trim() : "";
  const selectionRequestLogicalId =
    typeof o.selectionRequestLogicalId === "string"
      ? o.selectionRequestLogicalId.trim()
      : "";
  const filters = parseFilters(o.filters);
  if (filters === null) {
    return HttpNextResponse.badRequest("filters inválidos.");
  }
  if (!sessionId || !graphVersionId || !selectionRequestLogicalId) {
    return HttpNextResponse.badRequest(
      "sessionId, graphVersionId y selectionRequestLogicalId son obligatorios.",
    );
  }

  try {
    const result = await graphRefineService.refineFlightSelection({
      sessionId,
      graphVersionId,
      selectionRequestLogicalId,
      filters,
    });
    if (!result.ok) {
      return HttpNextResponse.badRequest(result.error);
    }
    return HttpNextResponse.json({
      ok: true,
      pendingSelection: result.pendingSelection,
      decisions: result.decisions,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno al refinar la selección.";
    return HttpNextResponse.internalError(message);
  }
}
