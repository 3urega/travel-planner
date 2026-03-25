"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingSelectionItem } from "@/contexts/travel/trip/domain/GraphExecutionCheckpoint";

export type WorkspaceStatus = "idle" | "loading" | "done" | "error";

function buildPreferencesBody(
  priceComfortSlider: number,
  maxPriceUsdInput: string,
): Record<string, unknown> {
  const v = priceComfortSlider;
  const priceWeight = 1 - v / 100;
  const comfortWeight = v / 100;
  const maxParsed =
    maxPriceUsdInput.trim() === "" ? undefined : Number(maxPriceUsdInput);
  if (maxParsed !== undefined && Number.isFinite(maxParsed) && maxParsed > 0) {
    return { maxPriceUsd: maxParsed, priceWeight, comfortWeight };
  }
  return { priceWeight, comfortWeight };
}

export function useWorkspaceAgent(): {
  response: ATOResponse | null;
  status: WorkspaceStatus;
  error: string;
  sessionIdForNext: string | null;
  goalMessage: string;
  setGoalMessage: (s: string) => void;
  priceComfortSlider: number;
  setPriceComfortSlider: (n: number) => void;
  maxPriceUsd: string;
  setMaxPriceUsd: (s: string) => void;
  slotDraft: Record<string, string>;
  setSlotDraft: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  runFromGoal: () => Promise<void>;
  continueSlots: () => Promise<void>;
  resumeGraph: () => Promise<void>;
  selectCatalogOption: (
    item: PendingSelectionItem,
    optionId: string,
  ) => Promise<void>;
} {
  const [response, setResponse] = useState<ATOResponse | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [error, setError] = useState("");
  const [sessionIdForNext, setSessionIdForNext] = useState<string | null>(null);
  const [goalMessage, setGoalMessage] = useState("");
  const [priceComfortSlider, setPriceComfortSlider] = useState(40);
  const [maxPriceUsd, setMaxPriceUsd] = useState("");
  const [slotDraft, setSlotDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (response?.phase === "awaiting_input" && response.missingSlots) {
      setSlotDraft((prev) => {
        const next = { ...prev };
        for (const s of response.missingSlots!) {
          if (next[s.id] === undefined) next[s.id] = "";
        }
        return next;
      });
    }
  }, [response]);

  const preferences = useMemo(
    () => buildPreferencesBody(priceComfortSlider, maxPriceUsd),
    [priceComfortSlider, maxPriceUsd],
  );

  const postAgent = useCallback(
    async (body: Record<string, unknown>): Promise<ATOResponse> => {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ATOResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      return data as ATOResponse;
    },
    [],
  );

  const runFromGoal = useCallback(async () => {
    if (!goalMessage.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const body: Record<string, unknown> = {
        message: goalMessage.trim(),
        preferences,
      };
      if (sessionIdForNext) body.sessionId = sessionIdForNext;
      const data = await postAgent(body);
      setResponse(data);
      setSessionIdForNext(data.sessionId);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  }, [goalMessage, postAgent, preferences, sessionIdForNext]);

  const continueSlots = useCallback(async () => {
    if (
      response?.phase !== "awaiting_input" ||
      !sessionIdForNext ||
      !response.missingSlots?.length
    ) {
      return;
    }
    for (const s of response.missingSlots) {
      if (!slotDraft[s.id]?.trim()) {
        setError("Completa todos los campos solicitados.");
        return;
      }
    }
    setStatus("loading");
    setError("");
    try {
      const data = await postAgent({
        sessionId: sessionIdForNext,
        message: "",
        preferences,
        slotValues: Object.fromEntries(
          response.missingSlots.map((s) => [s.id, slotDraft[s.id]!.trim()]),
        ),
      });
      setResponse(data);
      setSessionIdForNext(data.sessionId);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  }, [postAgent, preferences, response, sessionIdForNext, slotDraft]);

  const resumeGraph = useCallback(async () => {
    if (!sessionIdForNext || response?.phase !== "awaiting_selection") return;
    setStatus("loading");
    setError("");
    try {
      const data = await postAgent({
        sessionId: sessionIdForNext,
        message: "",
        preferences,
        resumeExecution: true,
      });
      setResponse(data);
      setSessionIdForNext(data.sessionId);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  }, [postAgent, preferences, response?.phase, sessionIdForNext]);

  const selectCatalogOption = useCallback(
    async (item: PendingSelectionItem, optionId: string) => {
      const gv = response?.adgGraphVersionId;
      const sid = response?.sessionId ?? sessionIdForNext;
      if (!gv || !sid) {
        setError("Falta graphVersionId o sesión.");
        return;
      }
      setStatus("loading");
      setError("");
      try {
        const r1 = await fetch("/api/graph/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            graphVersionId: gv,
            selectionRequestLogicalId: item.selectionRequestLogicalId,
            selectedOptionId: optionId,
          }),
        });
        const j1 = (await r1.json()) as { error?: string };
        if (!r1.ok) throw new Error(j1.error ?? `select ${r1.status}`);

        const data = await postAgent({
          sessionId: sid,
          message: "",
          preferences,
          resumeExecution: true,
        });
        setResponse(data);
        setSessionIdForNext(data.sessionId);
        setStatus("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setStatus("error");
      }
    },
    [postAgent, preferences, response, sessionIdForNext],
  );

  return {
    response,
    status,
    error,
    sessionIdForNext,
    goalMessage,
    setGoalMessage,
    priceComfortSlider,
    setPriceComfortSlider,
    maxPriceUsd,
    setMaxPriceUsd,
    slotDraft,
    setSlotDraft,
    runFromGoal,
    continueSlots,
    resumeGraph,
    selectCatalogOption,
  };
}
