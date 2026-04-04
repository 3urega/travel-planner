/**
 * @deprecated Vista legada chat-centric. La home usa `ATOWorkspacePage`; conservar
 * referencia o rutas de demo hasta migrar por completo.
 */
"use client";

import { useEffect, useState } from "react";
import type { ATOResponse, PendingApprovalItem } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingSelectionItem } from "@/contexts/travel/trip/domain/GraphExecutionCheckpoint";
import type { DecisionRecord } from "@/contexts/travel/trip/domain/DecisionRecord";
import type { AuditEvent } from "@/contexts/travel/trip/domain/AuditEvent";
import type { Plan, PlanStep } from "@/contexts/travel/trip/domain/Plan";
import type { SimulationResult } from "@/contexts/travel/trip/domain/SimulationResult";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

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

function ApprovalBadge({ level }: { level: PendingApprovalItem["level"] }): React.ReactElement {
  const styles: Record<string, string> = {
    auto: "bg-emerald-100 text-emerald-800",
    confirm: "bg-amber-100 text-amber-800",
    double: "bg-red-100 text-red-800",
    blocked: "bg-zinc-200 text-zinc-700",
  };
  const labels: Record<string, string> = {
    auto: "Auto",
    confirm: "Confirmar",
    double: "Doble confirmación",
    blocked: "Bloqueado",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles[level])}>
      {labels[level] ?? level}
    </span>
  );
}

// ─── Plan steps section ───────────────────────────────────────────────────────

function PlanSection({ plan }: { plan: Plan }): React.ReactElement {
  const typeIcons: Record<string, string> = {
    search_flights: "✈️",
    search_hotels: "🏨",
    evaluate_options: "🔍",
    propose_plan: "📋",
    simulate: "🔮",
    request_approval: "🔐",
    book_flight: "🎫",
    book_hotel: "🛎️",
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Plan estructurado
      </h2>
      <p className="mb-4 text-base font-medium text-zinc-900">{plan.goal}</p>
      <ol className="space-y-2">
        {plan.steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} icon={typeIcons[step.type] ?? "⚙️"} />
        ))}
      </ol>
    </section>
  );
}

function StepRow({
  step,
  index,
  icon,
}: {
  step: PlanStep;
  index: number;
  icon: string;
}): React.ReactElement {
  return (
    <li className="flex items-start gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
      <span className="mt-0.5 text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-zinc-700">{index + 1}. {step.description}</span>
        {step.approvalRequired && (
          <span className="ml-2 text-xs text-red-600 font-medium">• requiere aprobación</span>
        )}
        <div className="mt-0.5 font-mono text-xs text-zinc-400">{step.type}</div>
      </div>
    </li>
  );
}

// ─── Simulation section ───────────────────────────────────────────────────────

function SimulationSection({
  sim,
  phase,
}: {
  sim: SimulationResult;
  phase?: "awaiting_input" | "awaiting_selection" | "ready" | "blocked";
}): React.ReactElement {
  const awaiting =
    phase === "awaiting_input" ||
    phase === "awaiting_selection" ||
    phase === "blocked";
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Simulación
      </h2>
      <div
        className={cx(
          "mb-3 rounded-lg px-4 py-2 text-sm",
          awaiting
            ? "bg-zinc-100 text-zinc-800"
            : sim.feasible
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800",
        )}
      >
        {sim.humanSummary}
      </div>
      {sim.breakdown.length > 0 && (
        <div className="space-y-1">
          {sim.breakdown.map((b) => (
            <div key={b.stepId} className="flex justify-between text-sm text-zinc-600">
              <span>{b.description}</span>
              <span className="font-medium">${b.estimatedCost}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-zinc-200 pt-1 text-sm font-semibold text-zinc-900">
            <span>Total estimado</span>
            <span>${sim.totalEstimatedCost}</span>
          </div>
        </div>
      )}
      {sim.dependencyConflicts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {sim.dependencyConflicts.map((c, i) => (
            <li key={i} className="text-xs text-red-600">⚠ {c.reason}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Pending approvals section ────────────────────────────────────────────────

function ApprovalsSection({
  approvals,
}: {
  approvals: PendingApprovalItem[];
}): React.ReactElement {
  if (approvals.length === 0) return <></>;

  const doubles = approvals.filter((a) => a.level === "double");
  const confirms = approvals.filter((a) => a.level === "confirm");

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">
        Acciones pendientes de aprobación ({approvals.length})
      </h2>
      {doubles.length > 0 && (
        <ApprovalGroup label="Alto riesgo — doble confirmación requerida" items={doubles} />
      )}
      {confirms.length > 0 && (
        <ApprovalGroup label="Riesgo medio — confirmación simple" items={confirms} />
      )}
    </section>
  );
}

function ApprovalGroup({
  label,
  items,
}: {
  label: string;
  items: PendingApprovalItem[];
}): React.ReactElement {
  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-semibold text-zinc-600">{label}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.stepId}
            className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-800">{item.description}</span>
              <ApprovalBadge level={item.level} />
            </div>
            <p className="mt-1 text-xs text-amber-700">{item.reason}</p>
            {item.estimatedCost !== undefined && (
              <p className="mt-1 text-xs text-zinc-500">
                Coste estimado: <strong>${item.estimatedCost}</strong>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Pending HITL selections (ADG selection_request) ─────────────────────────

function PendingSelectionsSection({
  items,
  sessionId,
  graphVersionId,
  preferences,
  onResumed,
}: {
  items: PendingSelectionItem[];
  sessionId: string;
  graphVersionId?: string;
  preferences: Record<string, unknown>;
  onResumed: (r: ATOResponse) => void;
}): React.ReactElement {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (items.length === 0) return <></>;

  const choose = async (
    item: PendingSelectionItem,
    optionId: string,
  ): Promise<void> => {
    if (!graphVersionId) {
      setLocalError("Falta adgGraphVersionId en la respuesta.");
      return;
    }
    setBusyKey(`${item.selectionRequestLogicalId}:${optionId}`);
    setLocalError(null);
    try {
      const r1 = await fetch("/api/graph/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          graphVersionId,
          selectionRequestLogicalId: item.selectionRequestLogicalId,
          selectedOptionId: optionId,
        }),
      });
      const j1 = (await r1.json()) as { error?: string };
      if (!r1.ok) throw new Error(j1.error ?? `select ${r1.status}`);

      const r2 = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: "",
          resumeExecution: true,
          preferences,
        }),
      });
      const j2 = (await r2.json()) as ATOResponse | { error?: string };
      if (!r2.ok) {
        throw new Error(
          (j2 as { error?: string }).error ?? `agent ${r2.status}`,
        );
      }
      onResumed(j2 as ATOResponse);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "Error al reanudar el grafo.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-900">
        Tu elección requerida
      </h2>
      <p className="mb-3 text-xs text-amber-950/90">
        El plan está en pausa. La elección se persiste como{" "}
        <code className="font-mono text-[11px]">selection_result</code> en el ADG.
      </p>
      {localError && (
        <p className="mb-2 text-xs text-red-700" role="alert">
          {localError}
        </p>
      )}
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.selectionRequestLogicalId}
            className="rounded-lg border border-amber-200 bg-white p-3"
          >
            <p className="text-sm font-medium text-zinc-800">{item.title}</p>
            <div className="mt-2 flex flex-col gap-2">
              {item.options.map((opt) => {
                const k = `${item.selectionRequestLogicalId}:${opt.id}`;
                const loading = busyKey === k;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={loading || Boolean(busyKey)}
                    onClick={() => void choose(item, opt.id)}
                    className={cx(
                      "rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs transition-colors hover:bg-amber-50",
                      loading && "opacity-60",
                      Boolean(busyKey) && !loading && "opacity-50",
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    {opt.priceUsd !== undefined && (
                      <span className="ml-2 tabular-nums text-zinc-500">
                        ${opt.priceUsd}
                      </span>
                    )}
                    {loading && <span className="ml-2 text-amber-700">…</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Decisions section ────────────────────────────────────────────────────────

function DecisionsSection({
  decisions,
  sessionId,
  graphVersionId,
  onChoiceConfirmed,
}: {
  decisions: DecisionRecord[];
  sessionId: string;
  graphVersionId?: string;
  onChoiceConfirmed: (decisionId: string, chosenOptionId: string) => void;
}): React.ReactElement {
  if (decisions.length === 0) return <></>;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Decisiones automáticas (scoring)
      </h2>
      <p className="mb-3 text-xs text-zinc-500">
        Ajusta presupuesto máximo y balance precio/confort antes de ejecutar. Tras la primera respuesta,
        al volver a ejecutar se reutiliza el mismo <code className="text-zinc-600">sessionId</code> en
        servidor (preferencias fusionadas); el plan se genera de nuevo con el LLM.
      </p>
      <p className="mb-3 text-xs text-zinc-600">
        Haz clic en una opción para confirmar tu elección. Si no eliges, se mantiene la sugerencia del
        sistema.
      </p>
      <div className="space-y-4">
        {decisions.map((d) => (
          <DecisionCard
            key={d.id}
            decision={d}
            sessionId={sessionId}
            graphVersionId={graphVersionId}
            onChoiceConfirmed={onChoiceConfirmed}
          />
        ))}
      </div>
    </section>
  );
}

function DecisionCard({
  decision,
  sessionId,
  graphVersionId,
  onChoiceConfirmed,
}: {
  decision: DecisionRecord;
  sessionId: string;
  graphVersionId?: string;
  onChoiceConfirmed: (decisionId: string, chosenOptionId: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const canPersistChoice = Boolean(graphVersionId);
  const userPick = decision.userChosenId;

  const chooseOption = async (chosenOptionId: string): Promise<void> => {
    if (!canPersistChoice) {
      setLocalError("No hay versión ADG en esta respuesta; no se puede persistir la elección.");
      return;
    }
    setLocalError(null);
    setPendingId(chosenOptionId);
    try {
      const res = await fetch("/api/agent/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          decisionId: decision.id,
          chosenOptionId,
          graphVersionId,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; chosenOptionId?: string; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      if (body.chosenOptionId) {
        onChoiceConfirmed(decision.id, body.chosenOptionId);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "No se pudo guardar la elección.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize text-zinc-700">
          {decision.category === "flight" ? "✈️ Vuelo" : "🏨 Hotel"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-blue-600 hover:underline"
        >
          {open ? "Ocultar alternativas" : "Ver todas las alternativas"}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{decision.justification}</p>
      {localError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {localError}
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-2">
          {decision.options.map((opt) => {
            const confirmedByUser = userPick === opt.id;
            const systemSuggestion = opt.chosen && !confirmedByUser;
            const isLoading = pendingId === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                disabled={isLoading}
                onClick={() => void chooseOption(opt.id)}
                className={cx(
                  "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  confirmedByUser
                    ? "border-blue-400 bg-blue-50 text-blue-950"
                    : opt.chosen
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                  isLoading && "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{opt.label}</span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {isLoading ? "…" : `score ${opt.totalScore}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {systemSuggestion && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Sugerencia del sistema
                    </span>
                  )}
                  {confirmedByUser && (
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                      Confirmado por ti
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Audit trail section ──────────────────────────────────────────────────────

function AuditSection({
  events,
  sessionId,
}: {
  events: AuditEvent[];
  sessionId: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);

  const actorColors: Record<string, string> = {
    llm: "bg-violet-100 text-violet-700",
    system: "bg-blue-100 text-blue-700",
    user: "bg-zinc-200 text-zinc-700",
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Audit trail ({events.length} eventos)
        </h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-blue-600 hover:underline"
        >
          {open ? "Ocultar" : "Ver todo"}
        </button>
      </div>
      <p className="mt-1 font-mono text-xs text-zinc-400">
        session: {sessionId}
      </p>
      {open && (
        <ol className="mt-3 space-y-1">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <span
                className={cx(
                  "mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-medium",
                  actorColors[e.actor] ?? "bg-zinc-100 text-zinc-600",
                )}
              >
                {e.actor}
              </span>
              <span className="font-medium text-zinc-700">{e.type}</span>
              {e.reason && (
                <span className="text-zinc-400 truncate max-w-xs">{e.reason}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ─── Main chat component ──────────────────────────────────────────────────────

type Status = "idle" | "loading" | "done" | "error";

export function ATOView(): React.ReactElement {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<ATOResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  /** Reenvío a /api/agent para fusionar preferencias en la misma sesión. */
  const [sessionIdForNext, setSessionIdForNext] = useState<string | null>(null);
  /** Valores para slots pedidos por el planner (ids alineados con missingSlots). */
  const [slotDraft, setSlotDraft] = useState<Record<string, string>>({});
  /** 0 = priorizar precio, 100 = priorizar confort (mapea a pesos 1−v/100 y v/100). */
  const [priceComfortSlider, setPriceComfortSlider] = useState(40);
  const [maxPriceUsd, setMaxPriceUsd] = useState("");

  const awaitingInput = response?.phase === "awaiting_input";
  const awaitingSelection = response?.phase === "awaiting_selection";
  const showPlanPhase =
    response !== null &&
    (response.phase === "ready" ||
      response.phase === "awaiting_selection" ||
      response.phase === "blocked");

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

  const submit = async (): Promise<void> => {
    if (status === "loading") return;

    const preferences = buildPreferencesBody(priceComfortSlider, maxPriceUsd);

    const continuation =
      awaitingInput &&
      sessionIdForNext &&
      response?.missingSlots &&
      response.missingSlots.length > 0;

    if (continuation) {
      for (const s of response.missingSlots!) {
        if (!slotDraft[s.id]?.trim()) {
          setErrorMsg("Completa todos los campos solicitados.");
          return;
        }
      }
    } else if (!message.trim()) {
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const body: Record<string, unknown> = {
        preferences,
      };
      if (sessionIdForNext) {
        body.sessionId = sessionIdForNext;
      }

      if (continuation) {
        body.slotValues = Object.fromEntries(
          response!.missingSlots!.map((s) => [s.id, slotDraft[s.id]!.trim()]),
        );
        body.message = "";
      } else {
        body.message = message.trim();
      }

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? `Error ${res.status}`);
      }

      const data = (await res.json()) as ATOResponse;
      setResponse(data);
      setSessionIdForNext(data.sessionId);
      if (
        data.phase === "ready" ||
        data.phase === "awaiting_selection" ||
        data.phase === "blocked"
      ) {
        setSlotDraft({});
      }
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
    }
  };

  const canSubmitContinue =
    awaitingInput &&
    sessionIdForNext &&
    (response?.missingSlots ?? []).length > 0 &&
    (response?.missingSlots ?? []).every((s) => slotDraft[s.id]?.trim());

  const primaryDisabled =
    status === "loading" ||
    awaitingSelection ||
    (!awaitingInput && !message.trim()) ||
    (awaitingInput && !canSubmitContinue);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!primaryDisabled) void submit();
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto py-12 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Autonomous Travel Operator
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe tu viaje — el agente planifica, simula, decide y audita.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder='Ej: "Viaje a Tokio 10 días en abril, presupuesto medio, desde Madrid"'
          className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-zinc-400"
        />
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-zinc-600">
            Preferencias para esta ejecución
          </p>
          <label className="block text-xs text-zinc-600">
            Presupuesto máximo (USD, opcional)
            <input
              type="number"
              min={0}
              step={50}
              value={maxPriceUsd}
              onChange={(e) => setMaxPriceUsd(e.target.value)}
              placeholder="ej. 500"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Priorizar precio</span>
              <span>Priorizar confort</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={priceComfortSlider}
              onChange={(e) => setPriceComfortSlider(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Pesos: precio {Math.round((1 - priceComfortSlider / 100) * 100)}% · confort{" "}
              {Math.round((priceComfortSlider / 100) * 100)}%
            </p>
          </div>
          {sessionIdForNext && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500 truncate font-mono">
                Sesión: {sessionIdForNext.slice(0, 8)}…
              </span>
              <button
                type="button"
                onClick={() => {
                  setSessionIdForNext(null);
                  setResponse(null);
                  setSlotDraft({});
                }}
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                Nueva sesión
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">⌘ + Enter para enviar</span>
          <button
            onClick={() => void submit()}
            disabled={primaryDisabled}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading"
              ? "Procesando…"
              : awaitingInput
                ? "Continuar con el plan"
                : "Ejecutar ATO"}
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <svg
            className="h-4 w-4 animate-spin text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Planificando, simulando y ejecutando pasos automáticos…
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {status === "done" && response && (
        <div className="flex flex-col gap-4">
          {/* Resumen */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {response.summary}
          </div>

          {response.phase === "awaiting_input" && response.assistantMessage && (
            <section className="rounded-xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-violet-700">
                Datos pendientes
              </h2>
              <p className="text-sm text-violet-950">{response.assistantMessage}</p>
              {response.missingSlots && response.missingSlots.length > 0 && (
                <div className="mt-4 space-y-3">
                  {response.missingSlots.map((slot) => (
                    <label key={slot.id} className="block text-xs text-zinc-700">
                      <span className="font-medium text-zinc-800">{slot.label}</span>
                      {slot.role === "destination" ? (
                        <input
                          type="text"
                          value={slotDraft[slot.id] ?? ""}
                          onChange={(e) =>
                            setSlotDraft((d) => ({ ...d, [slot.id]: e.target.value }))
                          }
                          placeholder="Ciudad o destino"
                          className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
                        />
                      ) : (
                        <input
                          type="date"
                          value={slotDraft[slot.id] ?? ""}
                          onChange={(e) =>
                            setSlotDraft((d) => ({ ...d, [slot.id]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-mono"
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-violet-800">
                Pulsa «Continuar con el plan» arriba cuando hayas rellenado los campos.
              </p>
            </section>
          )}

          {response.phase === "blocked" && response.assistantMessage && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-800">
                Búsqueda de vuelos detenida
              </h2>
              <p className="text-sm text-amber-950">{response.assistantMessage}</p>
              <p className="mt-3 text-xs text-amber-900">
                Ajusta origen, destino o fechas en el mensaje y vuelve a ejecutar el ATO. No se ha
                pasado a hoteles.
              </p>
            </section>
          )}

          {response.phase === "awaiting_selection" &&
            response.pendingSelections &&
            response.pendingSelections.length > 0 && (
              <PendingSelectionsSection
                items={response.pendingSelections}
                sessionId={response.sessionId}
                graphVersionId={response.adgGraphVersionId}
                preferences={buildPreferencesBody(priceComfortSlider, maxPriceUsd)}
                onResumed={(r) => {
                  setResponse(r);
                  setSessionIdForNext(r.sessionId);
                  setStatus("done");
                }}
              />
            )}

          {(response.adgGraphId ?? response.adgGraphVersionId) && showPlanPhase && (
            <p className="text-xs text-zinc-500 font-mono">
              ADG: graph={response.adgGraphId ?? "—"} · versión=
              {response.adgGraphVersionId ?? "—"}
            </p>
          )}

          {/* Plan */}
          {showPlanPhase && <PlanSection plan={response.plan} />}

          {/* Simulación */}
          <SimulationSection sim={response.simulation} phase={response.phase} />

          {/* Aprobaciones pendientes */}
          {showPlanPhase && (
            <ApprovalsSection approvals={response.pendingApprovals} />
          )}

          {/* Decisiones */}
          {showPlanPhase && (
            <DecisionsSection
              decisions={response.decisions}
              sessionId={response.sessionId}
              graphVersionId={response.adgGraphVersionId}
              onChoiceConfirmed={(decisionId, chosenOptionId) => {
                setResponse((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    decisions: prev.decisions.map((d) =>
                      d.id === decisionId ? { ...d, userChosenId: chosenOptionId } : d,
                    ),
                  };
                });
              }}
            />
          )}

          {/* Audit trail */}
          <AuditSection
            events={response.auditEvents}
            sessionId={response.sessionId}
          />
        </div>
      )}
    </div>
  );
}
