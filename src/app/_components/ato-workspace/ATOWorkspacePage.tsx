"use client";

import * as React from "react";
import { useMemo, useState } from "react";

import {
  buildTripHeaderMeta,
  buildTripStatusBadge,
  deriveProgressStages,
} from "./adapters";
import { WorkspaceShell } from "./layout/WorkspaceShell";
import { WorkspaceHeader } from "./layout/WorkspaceHeader";
import { TripContextSidebar } from "./sidebar/TripContextSidebar";
import { WorkspaceHero } from "./center/WorkspaceHero";
import { GoalComposer } from "./center/GoalComposer";
import { OptionsStage } from "./center/OptionsStage";
import { SimulationPanel } from "./center/SimulationPanel";
import { PlanStrip } from "./center/PlanStrip";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { useWorkspaceAgent } from "./hooks/useWorkspaceAgent";
import type { PendingSelectionItem } from "@/contexts/travel/trip/domain/GraphExecutionCheckpoint";

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
  } = useWorkspaceAgent();

  const [optionBusy, setOptionBusy] = useState<string | null>(null);

  const trip = useMemo(() => buildTripHeaderMeta(response), [response]);
  const badge = useMemo(() => buildTripStatusBadge(response), [response]);
  const stages = useMemo(() => deriveProgressStages(response), [response]);

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

  const showPlanStrip =
    response &&
    response.phase !== "awaiting_input" &&
    response.plan.steps.length > 0;

  return (
    <WorkspaceShell
      header={<WorkspaceHeader trip={trip} statusBadge={badge} />}
      sidebar={
        <TripContextSidebar
          response={response}
          stages={stages}
          priceComfortSlider={priceComfortSlider}
          onPriceComfortChange={setPriceComfortSlider}
          maxPriceUsd={maxPriceUsd}
          onMaxPriceChange={setMaxPriceUsd}
        />
      }
      center={
        <div className="flex flex-col gap-8 md:gap-10">
          <WorkspaceHero response={response} />
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
          <OptionsStage
            response={response}
            busyKey={optionBusy}
            onSelectOption={onSelectOption}
          />
          <SimulationPanel simulation={response?.simulation ?? null} />
          {showPlanStrip && <PlanStrip plan={response!.plan} />}
          {error && status === "error" && (
            <div
              className="rounded-2xl border border-[color-mix(in_srgb,var(--destructive)_28%,var(--border))] bg-destructive-subtle px-5 py-4 font-ato-display text-sm font-medium text-destructive shadow-[var(--shadow-soft)]"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      }
      inspector={<InspectorPanel response={response} />}
    />
  );
}
