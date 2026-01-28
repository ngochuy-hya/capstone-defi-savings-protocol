import { ethers, deployments } from "hardhat";

/**
 * Script 4: Check Interest Calculation
 * 
 * Check accrued interest for a deposit
 */
async function main() {
  console.log("\n📊 SCRIPT 4: Check Interest Calculation\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  const SavingsBank = await deployments.get("SavingsBank");
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);
  console.log("📌 SavingsBank:", await savingsBank.getAddress());

  // Get deposit ID (default to 1, or pass as argument)
  const depositId = process.env.DEPOSIT_ID ? BigInt(process.env.DEPOSIT_ID) : 1n;
  console.log("\n🔍 Checking deposit ID:", depositId.toString());

  // Get deposit info
  const deposit = await savingsBank.getDeposit(depositId);
  
  if (deposit.status !== 0n) {
    console.log("❌ Deposit is not ACTIVE (status:", deposit.status, ")");
    return;
  }

  console.log("\n📊 Deposit Info:");
  console.log("   Owner:", deposit.owner);
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Locked APR:", Number(deposit.lockedAprBps) / 100, "%");
  console.log("   Start:", new Date(Number(deposit.startAt) * 1000).toLocaleString());
  console.log("   Maturity:", new Date(Number(deposit.maturityAt) * 1000).toLocaleString());

  // Calculate time elapsed
  const now = Math.floor(Date.now() / 1000);
  const timeElapsed = now - Number(deposit.startAt);
  const daysElapsed = Math.floor(timeElapsed / 86400);
  const hoursElapsed = Math.floor((timeElapsed % 86400) / 3600);

  console.log("\n⏱️  Time Elapsed:");
  console.log("   Days:", daysElapsed);
  console.log("   Hours:", hoursElapsed);
  console.log("   Total seconds:", timeElapsed);

  // Calculate time until maturity
  const timeUntilMaturity = Number(deposit.maturityAt) - now;
  const daysUntilMaturity = Math.floor(timeUntilMaturity / 86400);
  const hoursUntilMaturity = Math.floor((timeUntilMaturity % 86400) / 3600);

  console.log("\n⏰ Time Until Maturity:");
  console.log("   Days:", daysUntilMaturity);
  console.log("   Hours:", hoursUntilMaturity);

  // Get current interest
  const currentInterest = await savingsBank.calculateInterest(depositId);
  console.log("\n💰 Interest Accrued:");
  console.log("   Current:", ethers.formatUnits(currentInterest, 6), "USDC");

  // Calculate full interest at maturity
  const plan = await savingsBank.getPlan(deposit.planId);
  const fullDuration = Number(deposit.maturityAt) - Number(deposit.startAt);
  const fullInterest = (deposit.principal * BigInt(deposit.lockedAprBps) * BigInt(fullDuration)) / (365n * 86400n * 10000n);
  
  console.log("   At Maturity:", ethers.formatUnits(fullInterest, 6), "USDC");
  
  // Progress
  const progress = timeElapsed / fullDuration * 100;
  console.log("\n📈 Progress:", progress.toFixed(2), "%");

  // Calculate effective APY
  const yearlyProjection = (currentInterest * 365n * 86400n) / (deposit.principal * BigInt(timeElapsed));
  console.log("   Current Effective APY:", Number(yearlyProjection) / 100, "%");

  // If matured
  if (now >= Number(deposit.maturityAt)) {
    console.log("\n✅ DEPOSIT HAS MATURED!");
    console.log("💡 You can now withdraw:");
    console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
    console.log("   Interest:", ethers.formatUnits(fullInterest, 6), "USDC");
    console.log("   Total:", ethers.formatUnits(deposit.principal + fullInterest, 6), "USDC");
  } else {
    console.log("\n⏳ Deposit has NOT matured yet");
    console.log("💡 Early withdrawal available with penalty:", Number(plan.earlyWithdrawPenaltyBps) / 100, "%");
    const penalty = (deposit.principal * BigInt(plan.earlyWithdrawPenaltyBps)) / 10000n;
    console.log("   Penalty amount:", ethers.formatUnits(penalty, 6), "USDC");
    console.log("   You would receive:", ethers.formatUnits(deposit.principal + currentInterest - penalty, 6), "USDC");
  }

  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
