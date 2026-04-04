import { spawn } from "child_process";
import path from "path";

import { Service } from "diod";

import { FlightSearchPort } from "../../../domain/FlightSearchPort";
import type { FlightSearchQuery } from "../../../domain/FlightSearchQuery";
import type { NormalizedFlightOffer } from "../../../domain/NormalizedFlightOffer";

const BRIDGE_RELATIVE =
  "src/contexts/travel/trip/infrastructure/flights/fli/fli_search_bridge.py";

type BridgeOk = {
  ok: true;
  offers: NormalizedFlightOffer[];
};

type BridgeErr = {
  ok: false;
  code: string;
  message: string;
};

function bridgeScriptPath(): string {
  const override = process.env.FLI_BRIDGE_SCRIPT;
  if (override && override.length > 0) return path.resolve(override);
  return path.join(process.cwd(), BRIDGE_RELATIVE);
}

function pythonBinary(): string {
  return process.env.FLIGHT_SEARCH_PYTHON?.trim() || "python3";
}

function parseOffers(raw: unknown): NormalizedFlightOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedFlightOffer[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const airline = typeof o.airline === "string" ? o.airline : "";
    const priceUsd = typeof o.priceUsd === "number" ? o.priceUsd : Number(o.priceUsd);
    if (!id || !airline || Number.isNaN(priceUsd)) continue;
    out.push({
      id,
      airline,
      priceUsd,
      departureTime: String(o.departureTime ?? ""),
      arrivalTime: String(o.arrivalTime ?? ""),
      stops: typeof o.stops === "number" ? o.stops : Number(o.stops) || 0,
      durationMinutes:
        o.durationMinutes !== undefined
          ? Number(o.durationMinutes)
          : undefined,
      originCode: String(o.originCode ?? ""),
      destinationCode: String(o.destinationCode ?? ""),
      displayLabel: String(o.displayLabel ?? `${airline} · $${priceUsd}`),
      providerTag:
        typeof o.providerTag === "string" ? o.providerTag : undefined,
      queriedAt: typeof o.queriedAt === "string" ? o.queriedAt : undefined,
    });
  }
  return out;
}

function runBridgeProcess(
  py: string,
  script: string,
  stdinPayload: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(py, [script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Tiempo de espera agotado al consultar vuelos"));
    }, timeoutMs);

    const onCleanup = () => clearTimeout(timer);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      onCleanup();
      reject(err);
    });

    child.on("close", (code) => {
      onCleanup();
      const text = stdout.trim();
      if (!text) {
        const hint = stderr.trim() || `código ${code ?? "desconocido"}`;
        reject(new Error(`Puente de vuelos sin salida (${hint})`));
        return;
      }
      resolve(text);
    });

    child.stdin.write(stdinPayload);
    child.stdin.end();
  });
}

@Service()
export class FliFlightSearchAdapter extends FlightSearchPort {
  override async search(q: FlightSearchQuery): Promise<NormalizedFlightOffer[]> {
    const script = bridgeScriptPath();
    const py = pythonBinary();
    const payload = JSON.stringify({
      from: q.from,
      to: q.to,
      date: q.date,
      budget: q.budgetUsd,
      adults: q.adults,
      nonStop: q.nonStop ?? false,
      cabin: q.cabin,
      topN: 8,
    });

    const timeoutMs = Math.max(
      5_000,
      Number(process.env.FLI_BRIDGE_TIMEOUT_MS) || 60_000,
    );

    try {
      const text = await runBridgeProcess(py, script, payload, timeoutMs);
      const parsed = JSON.parse(text) as BridgeOk | BridgeErr;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Formato de respuesta inválido del puente");
      }

      if ("ok" in parsed && parsed.ok === false) {
        const code = "code" in parsed ? String(parsed.code) : "provider_error";
        const msg =
          "message" in parsed && typeof parsed.message === "string"
            ? parsed.message
            : "Error del proveedor de vuelos";
        if (code === "invalid_input") {
          throw new Error(`Entrada inválida: ${msg}`);
        }
        throw new Error(`Proveedor no disponible: ${msg}`);
      }

      if (!("offers" in parsed) || !Array.isArray(parsed.offers)) {
        throw new Error("Respuesta del puente sin lista offers");
      }

      return parseOffers(parsed.offers);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error("Error de formato en la salida del puente de vuelos");
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("Proveedor no disponible") ||
        msg.includes("Entrada inválida") ||
        msg.includes("Puente de vuelos") ||
        msg.includes("Formato de respuesta") ||
        msg.includes("Tiempo de espera agotado")
      ) {
        throw e instanceof Error ? e : new Error(msg);
      }
      throw new Error(`Proveedor no disponible: ${msg}`);
    }
  }
}
