import { ethers, deployments } from "hardhat";

/**
 * Script 8: Check VaultManager Health
 * 
 * Monitor vault solvency and reserves
 */
async function main() {
  console.log("\n🏥 SCRIPT 8: VaultManager Health Check\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get contracts
  const MockUSDC = await deployments.get("MockUSDC");
  const SavingsBank = await deployments.get("SavingsBank");
  const VaultManager = await deployments.get("VaultManager");
  
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);
  const vaultManager = await ethers.getContractAt("VaultManager", VaultManager.address);

  console.log("📌 VaultManager:", await vaultManager.getAddress());

  // Get vault info
  const vaultInfo = await vaultManager.getVaultInfo();
  const totalBalance = vaultInfo[0];
  const reservedFunds = vaultInfo[1];
  const availableFunds = vaultInfo[2];
  const healthRatio = vaultInfo[3];
  const isHealthy = vaultInfo[4];

  const minHealthRatio = await vaultManager.minHealthRatioBps();

  console.log("\n💰 Vault Balances:");
  console.log("   Total Balance:", ethers.formatUnits(totalBalance, 6), "USDC");
  console.log("   Reserved Funds:", ethers.formatUnits(reservedFunds, 6), "USDC");
  console.log("   Available Funds:", ethers.formatUnits(availableFunds, 6), "USDC");

  console.log("\n📊 Vault Health:");
  console.log("   Current Ratio:", (Number(healthRatio) / 100).toFixed(2), "%");
  console.log("   Minimum Required:", (Number(minHealthRatio) / 100).toFixed(2), "%");
  console.log("   Status:", isHealthy ? "✅ HEALTHY" : "⚠️  UNHEALTHY");

  if (!isHealthy) {
    console.log("\n⚠️  WARNING: Vault is UNHEALTHY!");
    console.log("💡 Action required: Fund the vault to improve health ratio");
    const needed = (reservedFunds * minHealthRatio / 10000n) - totalBalance;
    console.log("   Minimum to fund:", ethers.formatUnits(needed, 6), "USDC");
  }

  // Calculate utilization
  const utilization = reservedFunds > 0n ? (reservedFunds * 10000n / totalBalance) : 0n;
  console.log("\n📈 Utilization:");
  console.log("   Reserved / Total:", (Number(utilization) / 100).toFixed(2), "%");
  console.log("   Available / Total:", (Number(10000n - utilization) / 100).toFixed(2), "%");

  // Get SavingsBank summary
  const summary = await savingsBank.getContractSummary();
  const principalHeld = summary[0];
  const totalDeposits = summary[4];

  console.log("\n🏦 SavingsBank Summary:");
  console.log("   Principal Held:", ethers.formatUnits(principalHeld, 6), "USDC");
  console.log("   Total Deposits:", totalDeposits.toString());

  // Calculate total value locked
  const tvl = principalHeld + totalBalance;
  console.log("\n💎 Protocol TVL:");
  console.log("   Principal (SavingsBank):", ethers.formatUnits(principalHeld, 6), "USDC");
  console.log("   Interest Pool (VaultManager):", ethers.formatUnits(totalBalance, 6), "USDC");
  console.log("   ─────────────────────────────────");
  console.log("   Total Value Locked:", ethers.formatUnits(tvl, 6), "USDC");

  // Calculate capital efficiency
  if (principalHeld > 0n) {
    const efficiency = (totalBalance * 10000n) / principalHeld;
    console.log("\n💡 Capital Efficiency:");
    console.log("   Interest Pool / Principal:", (Number(efficiency) / 100).toFixed(2), "%");
    console.log("   (Lower is better - Method 2 advantage!)");
  }

  // Get active deposits count
  let activeDeposits = 0;
  for (let i = 1n; i < totalDeposits + 1n; i++) {
    try {
      const deposit = await savingsBank.getDeposit(i);
      if (deposit.status === 0n) { // ACTIVE
        activeDeposits++;
      }
    } catch (e) {
      // Skip invalid deposits
    }
  }

  console.log("\n📋 Deposit Statistics:");
  console.log("   Total Deposits Created:", totalDeposits.toString());
  console.log("   Active Deposits:", activeDeposits);
  console.log("   Closed/Renewed:", (Number(totalDeposits) - activeDeposits).toString());

  // Recommendations
  console.log("\n💡 Recommendations:");
  
  if (isHealthy) {
    console.log("   ✅ Vault is healthy");
    if (utilization < 5000n) { // < 50% utilization
      console.log("   💡 Low utilization - consider withdrawing excess funds");
    }
  } else {
    console.log("   ⚠️  Fund the vault immediately!");
  }

  if (availableFunds < reservedFunds / 10n) { // < 10% available
    console.log("   ⚠️  Low available funds - may not support new deposits");
    console.log("   💡 Fund the vault to enable new deposits");
  }

  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
