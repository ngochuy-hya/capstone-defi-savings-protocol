import { ethers, deployments } from "hardhat";

/**
 * Script 5: Early Withdraw (Before Maturity)
 * 
 * Withdraw before maturity with penalty
 * 
 * Architecture:
 * - Principal minus penalty from TokenVault
 * - Penalty to InterestVault (boosts liquidity)
 * - No interest paid (early withdrawal)
 * - Reserved interest released
 */
async function main() {
  console.log("\n⚠️  SCRIPT 5: Early Withdraw (with Penalty)\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get deposit ID from environment or use default
  const depositId = process.env.DEPOSIT_ID ? BigInt(process.env.DEPOSIT_ID) : 1n;
  console.log("🔍 Early withdrawing Deposit ID:", depositId.toString());

  // Get contracts
  const MockUSDC = await deployments.get("MockUSDC");
  const TokenVault = await deployments.get("TokenVault");
  const InterestVault = await deployments.get("InterestVault");
  const SavingsBank = await deployments.get("SavingsBank");
  
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const tokenVault = await ethers.getContractAt("TokenVault", TokenVault.address);
  const interestVault = await ethers.getContractAt("InterestVault", InterestVault.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);

  console.log("📌 Contracts:");
  console.log("   SavingsBank:", SavingsBank.address);
  console.log("   TokenVault:", TokenVault.address);
  console.log("   InterestVault:", InterestVault.address);

  // Get deposit details
  const [planId, principal, startTime, maturityTime, lockedAprBps, isAutoRenewEnabled, status] = 
    await savingsBank.getDepositDetails(depositId);

  console.log("\n📊 Deposit Information:");
  console.log("   Deposit ID:", depositId.toString());
  console.log("   Principal:", ethers.formatUnits(principal, 6), "USDC");
  console.log("   Locked APR:", Number(lockedAprBps) / 100, "%");
  console.log("   Maturity:", new Date(Number(maturityTime) * 1000).toLocaleString());
  console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(status)]);

  // Check if deposit is active
  if (status !== 0n) {
    console.log("\n⚠️  Deposit is not active!");
    return;
  }

  // Check if already matured
  const now = Math.floor(Date.now() / 1000);
  if (now >= Number(maturityTime)) {
    console.log("\n⚠️  Deposit is already matured!");
    console.log("   Use script 04_withdraw_matured.ts for normal withdrawal");
    return;
  }

  // Get plan info for penalty
  const plan = await savingsBank.savingPlans(planId);
  const penalty = (principal * BigInt(plan.earlyWithdrawPenaltyBps)) / 10000n;
  const userReceives = principal - penalty;

  // Calculate time elapsed
  const elapsed = now - Number(startTime);
  const elapsedDays = Math.floor(elapsed / 86400);
  const totalDays = Math.floor((Number(maturityTime) - Number(startTime)) / 86400);
  const progress = (elapsed / (Number(maturityTime) - Number(startTime))) * 100;

  console.log("\n⏰ Time Progress:");
  console.log("   Elapsed:", elapsedDays, "/", totalDays, "days");
  console.log("   Progress:", progress.toFixed(2), "%");

  console.log("\n💰 Early Withdrawal Calculation:");
  console.log("   Principal:", ethers.formatUnits(principal, 6), "USDC");
  console.log("   Penalty (" + (Number(plan.earlyWithdrawPenaltyBps) / 100) + "%):", ethers.formatUnits(penalty, 6), "USDC");
  console.log("   You will receive:", ethers.formatUnits(userReceives, 6), "USDC");
  console.log("   ⚠️  No interest paid on early withdrawal");

  // Calculate what you'd receive at maturity
  const fullInterest = await savingsBank.calculateInterest(depositId);
  const fullAmount = principal + fullInterest;
  const loss = fullAmount - userReceives;

  console.log("\n📊 Comparison:");
  console.log("   Early withdraw now:", ethers.formatUnits(userReceives, 6), "USDC");
  console.log("   If waited to maturity:", ethers.formatUnits(fullAmount, 6), "USDC");
  console.log("   Loss from early withdraw:", ethers.formatUnits(loss, 6), "USDC");

  // Ask for confirmation (in real app)
  console.log("\n⚠️  WARNING: Early withdrawal will incur penalty!");
  console.log("⏳ Proceeding with early withdrawal in 3 seconds...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check balances before
  const userBalanceBefore = await mockUSDC.balanceOf(deployer.address);
  const tokenVaultBefore = await tokenVault.balance();
  const interestVaultBefore = await interestVault.balance();
  const interestVaultReservedBefore = await interestVault.totalReserved();

  console.log("\n📊 Balances BEFORE:");
  console.log("   User Balance:", ethers.formatUnits(userBalanceBefore, 6), "USDC");
  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultBefore, 6), "USDC");
  console.log("   InterestVault Balance:", ethers.formatUnits(interestVaultBefore, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReservedBefore, 6), "USDC");

  // Early withdraw
  console.log("\n⏳ Processing early withdrawal...");
  const tx = await savingsBank.earlyWithdraw(depositId);
  const receipt = await tx.wait();
  console.log("✅ Early withdrawal successful!");

  // Check balances after
  const userBalanceAfter = await mockUSDC.balanceOf(deployer.address);
  const tokenVaultAfter = await tokenVault.balance();
  const interestVaultAfter = await interestVault.balance();
  const interestVaultReservedAfter = await interestVault.totalReserved();

  console.log("\n📊 Balances AFTER:");
  console.log("   User Balance:", ethers.formatUnits(userBalanceAfter, 6), "USDC");
  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultAfter, 6), "USDC");
  console.log("   InterestVault Balance:", ethers.formatUnits(interestVaultAfter, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReservedAfter, 6), "USDC");

  console.log("\n💡 Architecture Verification:");
  console.log("   User received:", ethers.formatUnits(userBalanceAfter - userBalanceBefore, 6), "USDC ✅");
  console.log("   TokenVault decreased:", ethers.formatUnits(tokenVaultBefore - tokenVaultAfter, 6), "USDC ✅");
  console.log("   Penalty to InterestVault:", ethers.formatUnits(interestVaultAfter - interestVaultBefore, 6), "USDC ✅");
  console.log("   Reserved released:", ethers.formatUnits(interestVaultReservedBefore - interestVaultReservedAfter, 6), "USDC ✅");

  // Verify deposit status
  const [,,,,, , newStatus] = await savingsBank.getDepositDetails(depositId);
  console.log("\n📝 Deposit Status Updated:");
  console.log("   New Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(newStatus)]);

  console.log("\n✅ Early withdrawal complete!");
  console.log("💰 Amount received:", ethers.formatUnits(userBalanceAfter - userBalanceBefore, 6), "USDC");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
