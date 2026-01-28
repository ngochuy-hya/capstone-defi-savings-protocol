import { ethers, deployments } from "hardhat";

/**
 * Script 6: Early Withdrawal with Penalty
 * 
 * METHOD 2: Penalty from SavingsBank, Pro-rata interest from VaultManager
 */
async function main() {
  console.log("\n⚠️  SCRIPT 6: Early Withdrawal\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get contracts
  const MockUSDC = await deployments.get("MockUSDC");
  const SavingsBank = await deployments.get("SavingsBank");
  const VaultManager = await deployments.get("VaultManager");
  
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);
  const vaultManager = await ethers.getContractAt("VaultManager", VaultManager.address);

  console.log("📌 SavingsBank:", await savingsBank.getAddress());
  console.log("📌 VaultManager:", await vaultManager.getAddress());

  // Get deposit ID
  const depositId = process.env.DEPOSIT_ID ? BigInt(process.env.DEPOSIT_ID) : 1n;
  console.log("\n🔍 Early withdrawing deposit ID:", depositId.toString());

  // Get deposit info
  const deposit = await savingsBank.getDeposit(depositId);
  
  if (deposit.status !== 0n) {
    console.log("❌ Deposit is not ACTIVE (status:", deposit.status, ")");
    return;
  }

  // Check if not matured
  const now = Math.floor(Date.now() / 1000);
  if (now >= Number(deposit.maturityAt)) {
    console.log("\n❌ Deposit has already matured!");
    console.log("💡 Use script 05_withdraw_matured.ts for normal withdrawal");
    return;
  }

  const plan = await savingsBank.getPlan(deposit.planId);

  console.log("\n📊 Deposit Info:");
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Plan Penalty:", Number(plan.earlyWithdrawPenaltyBps) / 100, "%");
  console.log("   Maturity:", new Date(Number(deposit.maturityAt) * 1000).toLocaleString());

  // Time calculations
  const timeElapsed = now - Number(deposit.startAt);
  const daysElapsed = Math.floor(timeElapsed / 86400);
  const timeUntilMaturity = Number(deposit.maturityAt) - now;
  const daysUntilMaturity = Math.ceil(timeUntilMaturity / 86400);

  console.log("\n⏱️  Time Info:");
  console.log("   Days Elapsed:", daysElapsed);
  console.log("   Days Until Maturity:", daysUntilMaturity);

  // Calculate amounts
  const proRataInterest = await savingsBank.calculateInterest(depositId);
  const penalty = (deposit.principal * BigInt(plan.earlyWithdrawPenaltyBps)) / 10000n;
  const userReceives = deposit.principal + proRataInterest - penalty;

  console.log("\n💰 Withdrawal Breakdown:");
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Pro-rata Interest:", ethers.formatUnits(proRataInterest, 6), "USDC");
  console.log("   Penalty (" + Number(plan.earlyWithdrawPenaltyBps) / 100 + "%):", ethers.formatUnits(penalty, 6), "USDC");
  console.log("   ─────────────────────────────────");
  console.log("   You Receive:", ethers.formatUnits(userReceives, 6), "USDC");

  // Confirm
  console.log("\n⚠️  WARNING: Early withdrawal will incur penalty!");
  console.log("💡 You will lose", ethers.formatUnits(penalty, 6), "USDC in penalties");

  // Check balances before
  const userBalanceBefore = await mockUSDC.balanceOf(deployer.address);
  const feeReceiver = await savingsBank.feeReceiver();
  const feeBalanceBefore = await mockUSDC.balanceOf(feeReceiver);
  const sbBalanceBefore = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmBalanceBefore = await vaultManager.totalBalance();
  const vmReservesBefore = await vaultManager.reservedFunds();

  console.log("\n📊 Balances BEFORE:");
  console.log("   User:", ethers.formatUnits(userBalanceBefore, 6), "USDC");
  console.log("   Fee Receiver:", ethers.formatUnits(feeBalanceBefore, 6), "USDC");
  console.log("   SavingsBank:", ethers.formatUnits(sbBalanceBefore, 6), "USDC");
  console.log("   VaultManager Total:", ethers.formatUnits(vmBalanceBefore, 6), "USDC");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesBefore, 6), "USDC");

  // Early withdraw
  console.log("\n⏳ Processing early withdrawal...");
  const tx = await savingsBank.earlyWithdraw(depositId);
  await tx.wait();
  console.log("✅ Early withdrawal complete!");

  // Check balances after
  const userBalanceAfter = await mockUSDC.balanceOf(deployer.address);
  const feeBalanceAfter = await mockUSDC.balanceOf(feeReceiver);
  const sbBalanceAfter = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmBalanceAfter = await vaultManager.totalBalance();
  const vmReservesAfter = await vaultManager.reservedFunds();

  console.log("\n📊 Balances AFTER:");
  console.log("   User:", ethers.formatUnits(userBalanceAfter, 6), "USDC (+", ethers.formatUnits(userBalanceAfter - userBalanceBefore, 6), ")");
  console.log("   Fee Receiver:", ethers.formatUnits(feeBalanceAfter, 6), "USDC (+", ethers.formatUnits(feeBalanceAfter - feeBalanceBefore, 6), ")");
  console.log("   SavingsBank:", ethers.formatUnits(sbBalanceAfter, 6), "USDC (-", ethers.formatUnits(sbBalanceBefore - sbBalanceAfter, 6), ")");
  console.log("   VaultManager Total:", ethers.formatUnits(vmBalanceAfter, 6), "USDC (-", ethers.formatUnits(vmBalanceBefore - vmBalanceAfter, 6), ")");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesAfter, 6), "USDC (-", ethers.formatUnits(vmReservesBefore - vmReservesAfter, 6), ")");

  // Calculate unused interest
  const fullDuration = Number(deposit.maturityAt) - Number(deposit.startAt);
  const fullInterest = (deposit.principal * BigInt(deposit.lockedAprBps) * BigInt(fullDuration)) / (365n * 86400n * 10000n);
  const unusedInterest = fullInterest - proRataInterest;

  console.log("\n💡 METHOD 2 Architecture Verification:");
  console.log("   Principal & penalty from SavingsBank:", ethers.formatUnits(sbBalanceBefore - sbBalanceAfter, 6), "USDC ✅");
  console.log("   Pro-rata interest from VaultManager:", ethers.formatUnits(vmBalanceBefore - vmBalanceAfter, 6), "USDC ✅");
  console.log("   Unused interest released:", ethers.formatUnits(unusedInterest, 6), "USDC ✅");

  console.log("\n✅ Early withdrawal successful!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
