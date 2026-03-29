import { SagaLeg } from "@/types";

export async function executeSimulatedOrder(leg: SagaLeg): Promise<void> {
  console.log(
    `[Simulated] ${leg.platform}: ${leg.side} ${leg.size} shares of "${leg.marketTitle}" @ $${leg.price}`
  );

  // Simulate brief delay for realism
  await new Promise((resolve) =>
    setTimeout(resolve, 200 + Math.random() * 300)
  );
}
