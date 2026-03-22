"use client";

import { useState, useRef } from "react";
import type { AgentResponse, ToolTrace } from "@/contexts/travel/trip/domain/TravelPlan";

type Status = "idle" | "loading" | "done" | "error";

function ApprovalBadge({ status }: { status: ToolTrace["approvalStatus"] }): React.ReactElement {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        ✓ Aprobado
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        ⏳ Pendiente de aprobación
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      ✗ Bloqueado
    </span>
  );
}

function ToolTraceCard({ trace }: { trace: ToolTrace }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-zinc-500">{trace.toolName}</span>
        <div className="flex items-center gap-2">
          {trace.estimatedCost !== undefined && (
            <span className="text-xs text-zinc-400">${trace.estimatedCost}</span>
          )}
          <ApprovalBadge status={trace.approvalStatus} />
        </div>
      </div>
      {trace.approvalReason && (
        <p className="mt-1 text-xs text-amber-700">{trace.approvalReason}</p>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-2 text-xs text-blue-600 hover:underline"
      >
        {open ? "Ocultar detalle" : "Ver detalle"}
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700">
          {JSON.stringify({ args: trace.args, result: trace.result }, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function TravelAgentChat(): React.ReactElement {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        const errBody = await res.json() as { error?: string };
        throw new Error(errBody.error ?? `Error ${res.status}`);
      }

      const data = await res.json() as AgentResponse;
      setResponse(data);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void submit();
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto py-12 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          AI Travel Agent
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe tu viaje y el agente te propondrá un plan con pasos concretos.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder='Ej: "Organiza un viaje a Japón de 10 días en marzo, presupuesto medio"'
          className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-zinc-400"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">⌘ + Enter para enviar</span>
          <button
            onClick={() => void submit()}
            disabled={status === "loading" || !message.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Planificando…" : "Planificar"}
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          El agente está procesando tu petición…
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {status === "done" && response && (
        <div className="flex flex-col gap-4">
          {response.plan.requiresApproval && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                ⚠️ Este plan incluye acciones que requieren tu aprobación antes de ejecutarse:
              </p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {response.plan.pendingApprovals.map((reason, i) => (
                  <li key={i} className="text-xs text-amber-700">{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">
              Plan para: {response.plan.destination}
            </h2>
            {response.plan.totalEstimatedCost > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Coste estimado total: ${response.plan.totalEstimatedCost}
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
              {response.plan.summary}
            </p>
          </div>

          {response.plan.steps.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-zinc-700">Herramientas utilizadas</h3>
              {response.plan.steps.map((step) =>
                step.toolTrace ? (
                  <ToolTraceCard key={step.id} trace={step.toolTrace} />
                ) : null,
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
