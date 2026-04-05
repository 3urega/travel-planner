"use client";

import * as React from "react";
import { useMemo, useState } from "react";

import {
  buildTripHeaderMeta,
  buildTripStatusBadge,
} from "./adapters";
import { WorkspaceShell } from "./layout/WorkspaceShell";
import { WorkspaceHeader } from "./layout/WorkspaceHeader";
import { StageProgressRail } from "./layout/StageProgressRail";
import { TripContextSidebar } from "./sidebar/TripContextSidebar";
import { WorkspaceHero } from "./center/WorkspaceHero";
import { GoalComposer } from "./center/GoalComposer";
import { OptionsStage } from "./center/OptionsStage";
import { SimulationPanel } from "./center/SimulationPanel";
import { PlanStrip } from "./center/PlanStrip";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { useWorkspaceAgent } from "./hooks/useWorkspaceAgent";
import { useWorkspaceWorkflow } from "./workflow/useWorkspaceWorkflow";
import { CenterStageHost, MutedStageFold } from "./center/CenterStageHost";
import { NextBestActionBar } from "./center/NextBestActionBar";
import { ApprovalStagePanel } from "./center/ApprovalStagePanel";
import { ExecuteStagePanel } from "./center/ExecuteStagePanel";
import { ReviewTradeoffsPanel } from "./center/ReviewTradeoffsPanel";
import { StageLoadingSkeleton } from "./center/StageLoadingSkeleton";
import type { PendingSelectionItem } from "@/contexts/travel/trip/domain/GraphExecutionCheckpoint";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { FlightRefinementFilters } from "@/contexts/travel/trip/application/flights/flightRefinementTypes";
import { findDecisionForCategory } from "./workflow/deriveWorkflowState";

function flightChosenSummary(response: ATOResponse | null): string {
  if (!response) return "";
  const d = findDecisionForCategory(response.decisions, "flight");
  if (!d) return "Aún sin vuelo cerrado.";
  const id = d.userChosenId ?? d.chosenId;
  const o = d.options.find((x) => x.id === id);
  return o?.label ?? "Vuelo registrado.";
}

export function ATOWorkspacePage(): React.ReactElement {
  const {
    response,
    status,
    error,
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
    selectCatalogOption,
    refineFlightSelection,
    flightStopsPreference,
    setFlightStopsPreference,
    flightTimePreference,
    setFlightTimePreference,
  } = useWorkspaceAgent();

  const [optionBusy, setOptionBusy] = useState<string | null>(null);

  const slotsComplete = Boolean(
    response?.missingSlots?.every((s) => slotDraft[s.id]?.trim()),
  );

  const workflow = useWorkspaceWorkflow(
    response,
    goalMessage.trim().length > 0,
    slotsComplete,
  );

  const trip = useMemo(() => buildTripHeaderMeta(response), [response]);
  const badge = useMemo(() => buildTripStatusBadge(response), [response]);

  const onSelectOption = async (
    item: PendingSelectionItem,
    optionId: string,
  ): Promise<void> => {
    const k = `${item.selectionRequestLogicalId}:${optionId}`;
    setOptionBusy(k);
    try {
      await selectCatalogOption(item, optionId);
    } finally {
      setOptionBusy(null);
    }
  };

  const onRefineFlight = async (
    item: PendingSelectionItem,
    filters: FlightRefinementFilters,
  ): Promise<void> => {
    const k = `refine:${item.selectionRequestLogicalId}`;
    setOptionBusy(k);
    try {
      await refineFlightSelection(item, filters);
    } finally {
      setOptionBusy(null);
    }
  };

  const selectionFilter =
    workflow.currentStage === "select_flight"
      ? ("flight" as const)
      : workflow.currentStage === "select_hotel"
        ? ("hotel" as const)
        : null;

  const showPlanStrip =
    response &&
    response.phase !== "awaiting_input" &&
    response.plan.steps.length > 0;

  return (
    <WorkspaceShell
      header={<WorkspaceHeader trip={trip} statusBadge={badge} />}
      belowHeader={
        <StageProgressRail
          currentStage={workflow.currentStage}
          response={response}
        />
      }
      sidebar={
        <TripContextSidebar
          response={response}
          workflow={workflow}
          priceComfortSlider={priceComfortSlider}
          onPriceComfortChange={setPriceComfortSlider}
          maxPriceUsd={maxPriceUsd}
          onMaxPriceChange={setMaxPriceUsd}
          flightStopsPreference={flightStopsPreference}
          onFlightStopsPreferenceChange={setFlightStopsPreference}
          flightTimePreference={flightTimePreference}
          onFlightTimePreferenceChange={setFlightTimePreference}
        />
      }
      center={
        <CenterStageHost stageKey={workflow.currentStage}>
          <WorkspaceHero
            response={response}
            stage={workflow.currentStage}
          />

          <NextBestActionBar workflow={workflow} />

          {status === "loading" && (
            <StageLoadingSkeleton stage={workflow.currentStage} />
          )}

          {status !== "loading" &&
            workflow.currentStage === "define_trip" && (
              <GoalComposer
                goalMessage={goalMessage}
                onGoalChange={setGoalMessage}
                onSubmit={runFromGoal}
                status={status}
                response={response}
                slotDraft={slotDraft}
                onSlotChange={(id, v) =>
                  setSlotDraft((d) => ({ ...d, [id]: v }))
                }
                onContinueSlots={continueSlots}
              />
            )}

          {status !== "loading" &&
            (workflow.currentStage === "select_flight" ||
              workflow.currentStage === "select_hotel") && (
              <>
                <OptionsStage
                  response={response}
                  busyKey={optionBusy}
                  onSelectOption={onSelectOption}
                  onRefineFlight={onRefineFlight}
                  filterKind={selectionFilter}
                  showDecisionMemorial={false}
                />
                <MutedStageFold
                  title="Tu objetivo"
                  description="Recordatorio del briefing"
                  defaultOpen={false}
                >
                  <p className="text-sm text-muted-foreground">
                    {(response?.plan.goal ?? goalMessage) || "—"}
                  </p>
                </MutedStageFold>
                {workflow.currentStage === "select_hotel" && response && (
                  <MutedStageFold
                    title="Vuelo elegido"
                    description="Contexto para la estancia"
                    defaultOpen={false}
                  >
                    <p className="text-sm text-foreground/90">
                      {flightChosenSummary(response)}
                    </p>
                  </MutedStageFold>
                )}
              </>
            )}

          {status !== "loading" &&
            workflow.currentStage === "review_trip" &&
            response && (
              <>
                <SimulationPanel simulation={response.simulation} />
                <ReviewTradeoffsPanel decisions={response.decisions} />
                {showPlanStrip && (
                  <MutedStageFold
                    title="Estructura del plan"
                    defaultOpen={false}
                  >
                    <PlanStrip plan={response.plan} />
                  </MutedStageFold>
                )}
                <MutedStageFold
                  title="Catálogo y decisiones previas"
                  defaultOpen={false}
                >
                  <OptionsStage
                    response={response}
                    busyKey={optionBusy}
                    onSelectOption={onSelectOption}
                    onRefineFlight={onRefineFlight}
                    filterKind={null}
                    showDecisionMemorial={true}
                  />
                </MutedStageFold>
              </>
            )}

          {status !== "loading" &&
            workflow.currentStage === "approve" &&
            response && (
              <>
                <ApprovalStagePanel response={response} />
                <MutedStageFold title="Simulación" defaultOpen={false}>
                  <SimulationPanel
                    simulation={response.simulation}
                    compact
                  />
                </MutedStageFold>
              </>
            )}

          {status !== "loading" &&
            workflow.currentStage === "execute_ready" &&
            response && (
              <>
                <ExecuteStagePanel response={response} />
                {showPlanStrip && (
                  <MutedStageFold title="Plan" defaultOpen={false}>
                    <PlanStrip plan={response.plan} />
                  </MutedStageFold>
                )}
                <MutedStageFold title="Simulación" defaultOpen={false}>
                  <SimulationPanel
                    simulation={response.simulation}
                    compact
                  />
                </MutedStageFold>
              </>
            )}

          {error && status === "error" && (
            <div
              className="rounded-2xl border border-[color-mix(in_srgb,var(--destructive)_28%,var(--border))] bg-destructive-subtle px-5 py-4 font-ato-display text-sm font-medium text-destructive shadow-[var(--shadow-soft)]"
              role="alert"
            >
              {error}
            </div>
          )}
        </CenterStageHost>
      }
      inspector={
        <InspectorPanel
          response={response}
          currentStage={workflow.currentStage}
        />
      }
    />
  );
}
