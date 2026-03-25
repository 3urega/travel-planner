import "reflect-metadata";

import { NextResponse } from "next/server";

import { ATOOrchestrator } from "@/contexts/travel/trip/application/orchestrate/ATOOrchestrator";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";
import { normalizeIncomingSlotValues } from "@/contexts/travel/trip/domain/UserTravelPreferences";
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
  const body = (await req.json()) as {
    message?: string;
    sessionId?: string;
    preferences?: unknown;
    slotValues?: unknown;
    resumeExecution?: boolean;
  };

  const message = typeof body.message === "string" ? body.message : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
  const slotValues = normalizeIncomingSlotValues(body.slotValues);
  const resumeExecution = body.resumeExecution === true;
  const isResumeGraph = resumeExecution && sessionId !== undefined;

  const isSlotContinuation =
    sessionId !== undefined &&
    slotValues !== undefined &&
    Object.keys(slotValues).length > 0;

  if (!message.trim() && !isSlotContinuation && !isResumeGraph) {
    return HttpNextResponse.badRequest(
      "El campo 'message' es obligatorio, salvo continuación (sessionId + slotValues) o resumeExecution con sessionId.",
    );
  }

  try {
    const result = await orchestrator.run(
      message,
      sessionId,
      parsePreferences(body.preferences),
      slotValues,
      { resumeExecution },
    );
    return HttpNextResponse.json(result);
  } catch (err) {
    const errMessage =
      err instanceof Error ? err.message : "Error interno del agente.";
    return HttpNextResponse.internalError(errMessage);
  }
}
