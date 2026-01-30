import { loadContracts, formatUSDC, formatBps, STATUS } from "./helpers";

async function main() {
  console.log("\n📊 Check Interest\n");

  const { savingsBank } = await loadContracts();
  const depositId = 1n;

  const [planId, principal, startTime, maturityTime, lockedAprBps, , status] =
    await savingsBank.getDepositDetails(depositId);

  if (principal === 0n) {
    console.log("No deposit found for ID", depositId.toString());
    return;
  }

  const plan = await savingsBank.savingPlans(planId);
  const fullInterest = await savingsBank.calculateInterest(depositId);

  const now = Math.floor(Date.now() / 1000);
  const elapsed = Number(maturityTime) - Number(startTime);
  const remaining = Math.max(0, Number(maturityTime) - now);
  const elapsedDays = Math.floor((now - Number(startTime)) / 86400);
  const totalDays = Number(plan.durationDays);
  const progress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

  console.log("Deposit #" + depositId.toString());
  console.log("  Plan:", plan.name, "(" + formatBps(lockedAprBps) + " APR)");
  console.log("  Principal:", formatUSDC(principal), "USDC");
  console.log("  Start:", new Date(Number(startTime) * 1000).toISOString());
  console.log("  Maturity:", new Date(Number(maturityTime) * 1000).toISOString());
  console.log("  Status:", STATUS[Number(status)] ?? status);
  console.log("\nTime:");
  console.log("  Elapsed:", elapsedDays, "days (" + progress.toFixed(1) + "%)");
  console.log("  Remaining:", Math.ceil(remaining / 86400), "days");
  console.log("\nInterest:");
  console.log("  Full interest at maturity:", formatUSDC(fullInterest), "USDC");
  console.log("  Total at maturity:", formatUSDC(principal + fullInterest), "USDC");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
