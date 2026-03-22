"use client";

import { useState } from "react";
import type { ATOResponse, PendingApprovalItem } from "@/contexts/travel/trip/domain/ATOResponse";
import type { DecisionRecord } from "@/contexts/travel/trip/domain/DecisionRecord";
import type { AuditEvent } from "@/contexts/travel/trip/domain/AuditEvent";
import type { Plan, PlanStep } from "@/contexts/travel/trip/domain/Plan";
import type { SimulationResult } from "@/contexts/travel/trip/domain/SimulationResult";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
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

function SimulationSection({ sim }: { sim: SimulationResult }): React.ReactElement {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Simulación
      </h2>
      <div className={cx(
        "mb-3 rounded-lg px-4 py-2 text-sm",
        sim.feasible ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800",
      )}>
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

// ─── Decisions section ────────────────────────────────────────────────────────

function DecisionsSection({
  decisions,
}: {
  decisions: DecisionRecord[];
}): React.ReactElement {
  if (decisions.length === 0) return <></>;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Decisiones automáticas (scoring)
      </h2>
      <div className="space-y-4">
        {decisions.map((d) => (
          <DecisionCard key={d.id} decision={d} />
        ))}
      </div>
    </section>
  );
}

function DecisionCard({
  decision,
}: {
  decision: DecisionRecord;
}): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize text-zinc-700">
          {decision.category === "flight" ? "✈️ Vuelo" : "🏨 Hotel"}
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-blue-600 hover:underline"
        >
          {open ? "Ocultar ranking" : "Ver ranking completo"}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{decision.justification}</p>
      {open && (
        <div className="mt-3 space-y-1">
          {decision.options.map((opt) => (
            <div
              key={opt.id}
              className={cx(
                "flex items-center justify-between rounded px-2 py-1 text-xs",
                opt.chosen
                  ? "bg-emerald-100 text-emerald-900 font-semibold"
                  : "text-zinc-600",
              )}
            >
              <span>{opt.label}</span>
              <span className="tabular-nums">
                {opt.chosen && "★ "}score: {opt.totalScore}
              </span>
            </div>
          ))}
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

  const submit = async (): Promise<void> => {
    if (!message.trim() || status === "loading") return;
    setStatus("loading");
    setResponse(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? `Error ${res.status}`);
      }

      const data = (await res.json()) as ATOResponse;
      setResponse(data);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void submit();
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">⌘ + Enter para enviar</span>
          <button
            onClick={() => void submit()}
            disabled={status === "loading" || !message.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Procesando…" : "Ejecutar ATO"}
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

          {/* Plan */}
          <PlanSection plan={response.plan} />

          {/* Simulación */}
          <SimulationSection sim={response.simulation} />

          {/* Aprobaciones pendientes */}
          <ApprovalsSection approvals={response.pendingApprovals} />

          {/* Decisiones */}
          <DecisionsSection decisions={response.decisions} />

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
