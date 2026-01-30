import { ethers } from "hardhat";
import { loadContracts, formatUSDC, formatBps } from "./helpers";

async function main() {
  console.log("\n📋 Plan Management\n");

  const { savingsBank, deployer } = await loadContracts();
  const nextPlanId = await savingsBank.nextPlanId();
  const totalPlans = Number(nextPlanId) - 1;

  if (totalPlans === 0) {
    console.log("No plans created yet.");
    return;
  }

  console.log("Existing Plans:");
  console.log("┌────┬─────────────┬──────────┬────────────┬────────────┬─────┬─────────┬────────┐");
  console.log("│ ID │ Name        │ Duration │ Min        │ Max        │ APR │ Penalty │ Active │");
  console.log("├────┼─────────────┼──────────┼────────────┼────────────┼─────┼─────────┼────────┤");

  for (let i = 1; i <= totalPlans; i++) {
    const p = await savingsBank.savingPlans(i);
    const maxStr = p.maxDeposit === ethers.MaxUint256 ? "No limit" : formatUSDC(p.maxDeposit);
    const active = p.isActive ? "✅" : "❌";
    console.log(
      `│ ${String(i).padEnd(2)} │ ${(p.name as string).padEnd(11)} │ ${String(p.durationDays).padEnd(8)} │ ${formatUSDC(p.minDeposit).padEnd(10)} │ ${maxStr.padEnd(10)} │ ${formatBps(p.aprBps).padEnd(3)} │ ${formatBps(p.earlyWithdrawPenaltyBps).padEnd(7)} │ ${active.padEnd(6)} │`
    );
  }
  console.log("└────┴─────────────┴──────────┴────────────┴────────────┴─────┴─────────┴────────┘");

  console.log("\n✅ Plan list complete\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
