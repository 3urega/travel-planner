import "reflect-metadata";

import { NextResponse } from "next/server";

import { ATOOrchestrator } from "@/contexts/travel/trip/application/orchestrate/ATOOrchestrator";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";
import type { UserTravelPreferences } from "@/contexts/travel/trip/domain/UserTravelPreferences";

const orchestrator = container.get(ATOOrchestrator);

function parsePreferences(raw: unknown): UserTravelPreferences | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const maxPriceUsd =
    typeof o.maxPriceUsd === "number" && Number.isFinite(o.maxPriceUsd) && o.maxPriceUsd > 0
      ? o.maxPriceUsd
      : undefined;
  const priceWeight =
    typeof o.priceWeight === "number" && Number.isFinite(o.priceWeight)
      ? Math.max(0, Math.min(1, o.priceWeight))
      : undefined;
  const comfortWeight =
    typeof o.comfortWeight === "number" && Number.isFinite(o.comfortWeight)
      ? Math.max(0, Math.min(1, o.comfortWeight))
      : undefined;
  if (
    maxPriceUsd === undefined &&
    priceWeight === undefined &&
    comfortWeight === undefined
  ) {
    return undefined;
  }
  return { maxPriceUsd, priceWeight, comfortWeight };
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json() as {
    message?: string;
    sessionId?: string;
    preferences?: unknown;
  };

  if (!body.message || typeof body.message !== "string" || body.message.trim() === "") {
    return HttpNextResponse.badRequest("El campo 'message' es obligatorio.");
  }

  try {
    const result = await orchestrator.run(
      body.message.trim(),
      typeof body.sessionId === "string" ? body.sessionId : undefined,
      parsePreferences(body.preferences),
    );
    return HttpNextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno del agente.";
    return HttpNextResponse.internalError(message);
  }
}
