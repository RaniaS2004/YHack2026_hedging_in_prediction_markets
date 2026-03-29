export type { SagaState, Saga, SagaLeg } from "@/types";

export const SPENDING_CAP_USD = 25;
export const LEG_TIMEOUT_MS = 30_000; // 30 seconds per leg
export const ROLLBACK_TIMEOUT_MS = 15_000; // 15 seconds for rollback limit order
export const STUCK_THRESHOLD_MS = 3 * 60_000; // 3 minutes, then cron triggers rollback
export const ROLLBACK_PRICE_OFFSET = 0.02; // 2% worse than fill price
