import { ethers, deployments } from "hardhat";

/**
 * Script 3: Check Interest for Deposit
 * 
 * Calculate current accrued interest for a deposit
 */
async function main() {
  console.log("\n📊 SCRIPT 3: Check Deposit Interest\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get deposit ID from environment or use default
  const depositId = process.env.DEPOSIT_ID ? BigInt(process.env.DEPOSIT_ID) : 1n;
  console.log("🔍 Checking Deposit ID:", depositId.toString());

  // Get contracts
  const SavingsBank = await deployments.get("SavingsBank");
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);

  console.log("📌 SavingsBank:", SavingsBank.address);

  // Get deposit details
  try {
    const [planId, principal, startTime, maturityTime, lockedAprBps, isAutoRenewEnabled, status] = 
      await savingsBank.getDepositDetails(depositId);

    console.log("\n📊 Deposit Information:");
    console.log("   Deposit ID:", depositId.toString());
    console.log("   Plan ID:", planId.toString());
    console.log("   Principal:", ethers.formatUnits(principal, 6), "USDC");
    console.log("   Locked APR:", Number(lockedAprBps) / 100, "%");
    console.log("   Auto Renew:", isAutoRenewEnabled);
    console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(status)]);

    if (status !== 0n) {
      console.log("\n⚠️  Deposit is not active (status:", status, ")");
      console.log("   Cannot calculate interest for non-active deposits");
      return;
    }

    // Get plan info
    const plan = await savingsBank.savingPlans(planId);
    console.log("\n📋 Plan Details:");
    console.log("   Name:", plan.name);
    console.log("   Duration:", plan.durationDays.toString(), "days");
    console.log("   Early Penalty:", Number(plan.earlyWithdrawPenaltyBps) / 100, "%");

    // Time calculations
    const now = Math.floor(Date.now() / 1000);
    const totalDuration = Number(maturityTime) - Number(startTime);
    const elapsed = now - Number(startTime);
    const remaining = Number(maturityTime) - now;

    const elapsedDays = Math.floor(elapsed / 86400);
    const remainingDays = Math.max(0, Math.ceil(remaining / 86400));
    const progress = Math.min(100, (elapsed / totalDuration) * 100);

    console.log("\n⏰ Time Progress:");
    console.log("   Start:", new Date(Number(startTime) * 1000).toLocaleString());
    console.log("   Maturity:", new Date(Number(maturityTime) * 1000).toLocaleString());
    console.log("   Current:", new Date(now * 1000).toLocaleString());
    console.log("   Elapsed:", elapsedDays, "days");
    console.log("   Remaining:", remainingDays, "days");
    console.log("   Progress:", progress.toFixed(2), "%");

    // Calculate current interest
    const currentInterest = await savingsBank.calculateInterest(depositId);
    console.log("\n💰 Interest Calculation:");
    console.log("   Current Interest:", ethers.formatUnits(currentInterest, 6), "USDC");

    // Calculate full interest at maturity
    const duration = Number(maturityTime) - Number(startTime);
    const durationDays = Math.floor(duration / 86400);
    const fullInterest = (principal * BigInt(lockedAprBps) * BigInt(durationDays)) / (365n * 10000n);
    console.log("   Full Interest (at maturity):", ethers.formatUnits(fullInterest, 6), "USDC");
    console.log("   Total at Maturity:", ethers.formatUnits(principal + fullInterest, 6), "USDC");

    // Show withdrawal options
    if (remaining > 0) {
      console.log("\n💡 Withdrawal Options:");
      console.log("   1. Wait", remainingDays, "days for maturity");
      console.log("      → Receive:", ethers.formatUnits(principal + fullInterest, 6), "USDC");
      
      // Calculate early withdrawal
      const penalty = (principal * BigInt(plan.earlyWithdrawPenaltyBps)) / 10000n;
      const earlyAmount = principal + currentInterest - penalty;
      console.log("   2. Early withdraw now");
      console.log("      → Penalty:", ethers.formatUnits(penalty, 6), "USDC");
      console.log("      → Receive:", ethers.formatUnits(earlyAmount, 6), "USDC");
    } else {
      console.log("\n✅ Deposit is matured! Ready to withdraw.");
      console.log("   Use script 04_withdraw_matured.ts to withdraw");
    }

  } catch (error: any) {
    if (error.message.includes("Deposit not found")) {
      console.log("\n⚠️  Deposit ID", depositId.toString(), "does not exist");
      console.log("   Please check the deposit ID and try again");
    } else {
      throw error;
    }
  }

  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
