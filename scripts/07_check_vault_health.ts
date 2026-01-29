import { ethers, deployments } from "hardhat";

/**
 * Script 7: Check Vault Health
 * 
 * Monitor system health and liquidity
 */
async function main() {
  console.log("\n🏥 SCRIPT 7: Check Vault Health\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get contracts
  const TokenVault = await deployments.get("TokenVault");
  const InterestVault = await deployments.get("InterestVault");
  const SavingsBank = await deployments.get("SavingsBank");
  
  const tokenVault = await ethers.getContractAt("TokenVault", TokenVault.address);
  const interestVault = await ethers.getContractAt("InterestVault", InterestVault.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);

  console.log("📌 Contracts:");
  console.log("   TokenVault:", TokenVault.address);
  console.log("   InterestVault:", InterestVault.address);
  console.log("   SavingsBank:", SavingsBank.address);

  // TokenVault status
  console.log("\n💼 TokenVault (Principal Storage):");
  const tokenVaultBalance = await tokenVault.balance();
  console.log("   Balance:", ethers.formatUnits(tokenVaultBalance, 6), "USDC");
  console.log("   Purpose: Holds all user principal deposits");

  // InterestVault status
  console.log("\n💰 InterestVault (Interest & Penalty Pool):");
  const interestVaultBalance = await interestVault.balance();
  const interestVaultAvailable = await interestVault.availableBalance();
  const interestVaultReserved = await interestVault.totalReserved();
  
  console.log("   Total Balance:", ethers.formatUnits(interestVaultBalance, 6), "USDC");
  console.log("   Reserved:", ethers.formatUnits(interestVaultReserved, 6), "USDC");
  console.log("   Available:", ethers.formatUnits(interestVaultAvailable, 6), "USDC");

  // Calculate utilization
  const utilizationRate = interestVaultBalance > 0n 
    ? Number((interestVaultReserved * 10000n) / interestVaultBalance) / 100
    : 0;
  
  console.log("   Utilization Rate:", utilizationRate.toFixed(2), "%");

  // Health check
  console.log("\n🏥 Health Status:");
  if (interestVaultBalance >= interestVaultReserved) {
    console.log("   ✅ Healthy: Sufficient funds to cover all reserves");
  } else {
    console.log("   ⚠️  Warning: Reserved exceeds balance (should not happen!)");
  }

  if (interestVaultAvailable > interestVaultBalance / 10n) {
    console.log("   ✅ Good liquidity: Can accept new deposits");
  } else {
    console.log("   ⚠️  Low liquidity: May need additional funding");
  }

  // SavingsBank status
  console.log("\n📊 SavingsBank Status:");
  const nextDepositId = await savingsBank.nextDepositId();
  const nextPlanId = await savingsBank.nextPlanId();
  const isPaused = await savingsBank.paused();
  
  console.log("   Total Deposits Created:", (Number(nextDepositId) - 1).toString());
  console.log("   Total Plans:", (Number(nextPlanId) - 1).toString());
  console.log("   Contract Paused:", isPaused);

  // Calculate total TVL (Total Value Locked)
  const totalTVL = tokenVaultBalance + interestVaultBalance;
  console.log("\n💎 Protocol Metrics:");
  console.log("   Total Value Locked (TVL):", ethers.formatUnits(totalTVL, 6), "USDC");
  console.log("   Principal Locked:", ethers.formatUnits(tokenVaultBalance, 6), "USDC");
  console.log("   Interest Pool:", ethers.formatUnits(interestVaultBalance, 6), "USDC");

  // Capital efficiency
  if (totalTVL > 0n) {
    const efficiency = Number((tokenVaultBalance * 10000n) / totalTVL) / 100;
    console.log("   Capital Efficiency:", efficiency.toFixed(2), "% (principal / TVL)");
  }

  // List active plans
  console.log("\n📋 Available Plans:");
  for (let i = 1; i < Number(nextPlanId); i++) {
    const plan = await savingsBank.savingPlans(i);
    if (plan.isActive) {
      console.log(`   Plan ${i}: ${plan.name}`);
      console.log(`      ${plan.durationDays} days @ ${Number(plan.aprBps) / 100}% APR`);
      console.log(`      Min: ${ethers.formatUnits(plan.minDeposit, 6)} USDC, Max: ${plan.maxDeposit === ethers.MaxUint256 ? "No limit" : ethers.formatUnits(plan.maxDeposit, 6) + " USDC"}`);
    }
  }

  // Recommendations
  console.log("\n💡 Recommendations:");
  if (interestVaultAvailable < interestVaultBalance / 10n) {
    console.log("   ⚠️  Consider funding InterestVault for new deposits");
  }
  if (utilizationRate > 90) {
    console.log("   ⚠️  High utilization - monitor closely");
  }
  if (utilizationRate < 10 && interestVaultBalance > 0n) {
    console.log("   ✅ Low utilization - good capacity for new deposits");
  }
  if (!isPaused && interestVaultBalance > 0n) {
    console.log("   ✅ System operational - ready for deposits");
  }

  console.log("\n✅ Health check complete!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
