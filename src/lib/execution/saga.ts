import { supabase } from "../db/supabase";
import {
  SPENDING_CAP_USD,
  LEG_TIMEOUT_MS,
  ROLLBACK_PRICE_OFFSET,
} from "./types";
import { executePolymarketOrder, rollbackPolymarketOrder } from "./polymarket-executor";
import { executeSimulatedOrder } from "./simulated-executor";
import { REAL_PLATFORMS, SagaLeg, SagaState } from "@/types";

export interface CreateSagaInput {
  legs: {
    platform: string;
    marketId: string;
    marketTitle: string;
    side: "YES" | "NO";
    size: number;
    price: number;
  }[];
}

export async function createSaga(input: CreateSagaInput): Promise<string> {
  // Calculate total cost
  const totalCost = input.legs.reduce(
    (sum, leg) => sum + leg.size * leg.price,
    0
  );

  // Spending cap check
  if (totalCost > SPENDING_CAP_USD) {
    throw new Error(
      `Total cost $${totalCost.toFixed(2)} exceeds spending cap of $${SPENDING_CAP_USD}`
    );
  }

  // Create saga
  const { data: saga, error: sagaErr } = await supabase
    .from("sagas")
    .insert({
      status: "PENDING",
      total_cost_usd: totalCost,
      spending_cap_usd: SPENDING_CAP_USD,
    })
    .select("id")
    .single();

  if (sagaErr || !saga) {
    throw new Error(`Failed to create saga: ${sagaErr?.message}`);
  }

  // Create legs
  const legRows = input.legs.map((leg) => ({
    saga_id: saga.id,
    platform: leg.platform,
    market_id: leg.marketId,
    market_title: leg.marketTitle,
    side: leg.side,
    size: leg.size,
    price: leg.price,
    status: "PENDING",
    simulated: !REAL_PLATFORMS.includes(leg.platform as typeof REAL_PLATFORMS[number]),
  }));

  const { error: legsErr } = await supabase.from("saga_legs").insert(legRows);

  if (legsErr) {
    throw new Error(`Failed to create saga legs: ${legsErr.message}`);
  }

  await logSagaEvent(saga.id, "CREATED", { totalCost, legCount: input.legs.length });

  return saga.id;
}

export async function executeSaga(sagaId: string): Promise<void> {
  await updateSagaStatus(sagaId, "EXECUTING");
  await logSagaEvent(sagaId, "EXECUTING", {});

  // Fetch legs
  const { data: legs, error } = await supabase
    .from("saga_legs")
    .select("*")
    .eq("saga_id", sagaId)
    .order("created_at");

  if (error || !legs) {
    await failSaga(sagaId, "Failed to fetch legs");
    return;
  }

  const filledLegs: SagaLeg[] = [];

  // Execute legs sequentially
  for (const leg of legs) {
    try {
      await updateLegStatus(leg.id, "EXECUTING");

      if (leg.simulated) {
        await executeSimulatedOrder(leg);
        await updateLegFilled(leg.id, leg.price);
      } else if (leg.platform === "polymarket") {
        const fillPrice = await executePolymarketOrder(leg);
        await updateLegFilled(leg.id, fillPrice);
      } else {
        // Other real platforms: simulate for now
        await executeSimulatedOrder(leg);
        await updateLegFilled(leg.id, leg.price);
      }

      filledLegs.push(leg);
      await logSagaEvent(sagaId, "LEG_FILLED", {
        legId: leg.id,
        platform: leg.platform,
        simulated: leg.simulated,
      });
    } catch (err) {
      console.error(`[Saga ${sagaId}] Leg ${leg.id} failed:`, err);
      await updateLegStatus(leg.id, "FAILED");
      await logSagaEvent(sagaId, "LEG_FAILED", {
        legId: leg.id,
        error: String(err),
      });

      // Rollback all filled legs
      await rollbackSaga(sagaId, filledLegs);
      return;
    }
  }

  await updateSagaStatus(sagaId, "COMPLETED");
  await logSagaEvent(sagaId, "COMPLETED", {
    filledLegs: filledLegs.length,
  });
}

async function rollbackSaga(
  sagaId: string,
  filledLegs: SagaLeg[]
): Promise<void> {
  await updateSagaStatus(sagaId, "ROLLING_BACK");
  await logSagaEvent(sagaId, "ROLLING_BACK", {
    legsToRollback: filledLegs.length,
  });

  let rollbackFailed = false;

  for (const leg of filledLegs) {
    try {
      await updateLegStatus(leg.id, "ROLLING_BACK");

      if (leg.simulated) {
        // Simulated legs: just mark as cancelled
        await updateLegStatus(leg.id, "CANCELLED");
      } else if (leg.platform === "polymarket") {
        const fillPrice = leg.fillPrice ?? leg.price ?? 0;
        const rollbackPrice =
          leg.side === "YES"
            ? fillPrice * (1 - ROLLBACK_PRICE_OFFSET) // sell lower
            : fillPrice * (1 + ROLLBACK_PRICE_OFFSET); // buy back higher

        await rollbackPolymarketOrder(leg, rollbackPrice);
        await updateLegStatus(leg.id, "ROLLED_BACK");
      } else {
        await updateLegStatus(leg.id, "CANCELLED");
      }

      await logSagaEvent(sagaId, "LEG_ROLLED_BACK", { legId: leg.id });
    } catch (err) {
      console.error(`[Saga ${sagaId}] Rollback failed for leg ${leg.id}:`, err);
      rollbackFailed = true;
      await logSagaEvent(sagaId, "LEG_ROLLBACK_FAILED", {
        legId: leg.id,
        error: String(err),
      });
    }
  }

  if (rollbackFailed) {
    await updateSagaStatus(sagaId, "FAILED");
    await logSagaEvent(sagaId, "FAILED", {
      reason: "Rollback incomplete. Manual action may be needed.",
    });
  } else {
    await updateSagaStatus(sagaId, "ROLLED_BACK");
    await logSagaEvent(sagaId, "ROLLED_BACK", {});
  }
}

async function failSaga(sagaId: string, reason: string): Promise<void> {
  await updateSagaStatus(sagaId, "FAILED");
  await logSagaEvent(sagaId, "FAILED", { reason });
}

async function updateSagaStatus(
  sagaId: string,
  status: SagaState
): Promise<void> {
  await supabase
    .from("sagas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sagaId);
}

async function updateLegStatus(legId: string, status: string): Promise<void> {
  await supabase
    .from("saga_legs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", legId);
}

async function updateLegFilled(
  legId: string,
  fillPrice: number
): Promise<void> {
  await supabase
    .from("saga_legs")
    .update({
      status: "FILLED",
      fill_price: fillPrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", legId);
}

async function logSagaEvent(
  sagaId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await supabase.from("saga_events").insert({
    saga_id: sagaId,
    event_type: eventType,
    payload,
  });
}

export async function getSagaWithLegs(sagaId: string) {
  const [sagaResult, legsResult] = await Promise.all([
    supabase.from("sagas").select("*").eq("id", sagaId).single(),
    supabase
      .from("saga_legs")
      .select("*")
      .eq("saga_id", sagaId)
      .order("created_at"),
  ]);

  if (sagaResult.error || !sagaResult.data) {
    return null;
  }

  return {
    ...sagaResult.data,
    legs: legsResult.data || [],
  };
}
