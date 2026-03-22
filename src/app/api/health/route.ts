import "reflect-metadata";

import { NextResponse } from "next/server";

import { PingPostgres } from "@/contexts/shared/application/health/PingPostgres";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";

const pingPostgres = container.get(PingPostgres);

export async function GET(): Promise<NextResponse> {
  const db = await pingPostgres.ping();

  return HttpNextResponse.json({
    status: "ok",
    db,
  });
}
