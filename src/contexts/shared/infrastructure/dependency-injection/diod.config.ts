import "reflect-metadata";

import { ContainerBuilder } from "diod";

// Shared
import { PostgresPool } from "@/contexts/shared/infrastructure/postgres/PostgresPool";
import { PingPostgres } from "@/contexts/shared/application/health/PingPostgres";

// Travel: AI
import { OpenAIClient } from "@/contexts/travel/trip/infrastructure/ai/OpenAIClient";

// Travel: Postgres repos
import { PostgresSessionRepository } from "@/contexts/travel/trip/infrastructure/postgres/PostgresSessionRepository";
import { PostgresAuditRepository } from "@/contexts/travel/trip/infrastructure/postgres/PostgresAuditRepository";
import { PostgresAdgGraphRepository } from "@/contexts/travel/trip/infrastructure/postgres/PostgresAdgGraphRepository";

// Travel: Domain ports + Application
import { TravelPlanDraftPort } from "@/contexts/travel/trip/domain/TravelPlanDraftPort";
import { OpenAiTravelPlanDraftAdapter } from "@/contexts/travel/trip/infrastructure/ai/OpenAiTravelPlanDraftAdapter";
import { GenerateTravelPlan } from "@/contexts/travel/trip/application/generate-travel-plan/GenerateTravelPlan";
import { SimulationService } from "@/contexts/travel/trip/application/simulate/SimulationService";
import { ApprovalPolicyService } from "@/contexts/travel/trip/application/approve/ApprovalPolicyService";
import { DecisionEngine } from "@/contexts/travel/trip/application/decide/DecisionEngine";
import { AuditLogger } from "@/contexts/travel/trip/application/audit/AuditLogger";
import { ChooseOptionService } from "@/contexts/travel/trip/application/choose/ChooseOptionService";
import { DecisionGraphWriter } from "@/contexts/travel/trip/application/graph/DecisionGraphWriter";
import { GraphExecutor } from "@/contexts/travel/trip/application/graph/GraphExecutor";
import { GraphSelectService } from "@/contexts/travel/trip/application/graph/GraphSelectService";
import { ATOOrchestrator } from "@/contexts/travel/trip/application/orchestrate/ATOOrchestrator";

// Travel: Legacy (mantener para compatibilidad)
import { TravelPlannerUseCase } from "@/contexts/travel/trip/application/plan/TravelPlannerUseCase";

const builder = new ContainerBuilder();

// Shared infrastructure
builder.registerAndUse(PostgresPool);
builder.registerAndUse(PingPostgres);

// AI
builder.registerAndUse(OpenAIClient);
builder
  .register(TravelPlanDraftPort)
  .useClass(OpenAiTravelPlanDraftAdapter);

// Postgres repos (travel)
builder.registerAndUse(PostgresSessionRepository);
builder.registerAndUse(PostgresAuditRepository);
builder.registerAndUse(PostgresAdgGraphRepository);

// Application services (travel)
builder.registerAndUse(GenerateTravelPlan);
builder.registerAndUse(SimulationService);
builder.registerAndUse(ApprovalPolicyService);
builder.registerAndUse(DecisionEngine);
builder.registerAndUse(AuditLogger);
builder.registerAndUse(ChooseOptionService);
builder.registerAndUse(DecisionGraphWriter);
builder.registerAndUse(GraphExecutor);
builder.registerAndUse(GraphSelectService);
builder.registerAndUse(ATOOrchestrator);

// Legacy
builder.registerAndUse(TravelPlannerUseCase);

export const container = builder.build();
