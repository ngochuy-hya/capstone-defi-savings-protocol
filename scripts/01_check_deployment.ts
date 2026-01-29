import { ethers, deployments } from "hardhat";

/**
 * Script 1: Check Deployment Status
 * 
 * Verify all contracts are deployed and configured correctly
 */
async function main() {
  console.log("\n📊 SCRIPT 1: Check Deployment Status\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get deployed contracts
  const MockUSDC = await deployments.get("MockUSDC");
  const TokenVault = await deployments.get("TokenVault");
  const InterestVault = await deployments.get("InterestVault");
  const MockDepositNFT = await deployments.get("MockDepositNFT");
  const SavingsBank = await deployments.get("SavingsBank");

  console.log("\n📌 Deployed Contracts:");
  console.log("   MockUSDC:", MockUSDC.address);
  console.log("   TokenVault:", TokenVault.address);
  console.log("   InterestVault:", InterestVault.address);
  console.log("   MockDepositNFT:", MockDepositNFT.address);
  console.log("   SavingsBank (Proxy):", SavingsBank.address);

  // Get contract instances
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const tokenVault = await ethers.getContractAt("TokenVault", TokenVault.address);
  const interestVault = await ethers.getContractAt("InterestVault", InterestVault.address);
  const mockDepositNFT = await ethers.getContractAt("MockDepositNFT", MockDepositNFT.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);

  // Check ownership
  console.log("\n🔒 Ownership Check:");
  const tokenVaultOwner = await tokenVault.owner();
  const interestVaultOwner = await interestVault.owner();
  const nftOwner = await mockDepositNFT.owner();
  const savingsBankOwner = await savingsBank.owner();

  console.log("   TokenVault owner:", tokenVaultOwner);
  console.log("   InterestVault owner:", interestVaultOwner);
  console.log("   MockDepositNFT owner:", nftOwner);
  console.log("   SavingsBank owner:", savingsBankOwner);

  const isOwnershipCorrect = 
    tokenVaultOwner === SavingsBank.address &&
    interestVaultOwner === SavingsBank.address &&
    nftOwner === SavingsBank.address;

  console.log("   ✅ Ownership:", isOwnershipCorrect ? "CORRECT" : "⚠️  INCORRECT");

  // Check vault balances
  console.log("\n💰 Vault Balances:");
  const tokenVaultBalance = await tokenVault.balance();
  const interestVaultBalance = await interestVault.balance();
  const interestVaultAvailable = await interestVault.availableBalance();
  const interestVaultReserved = await interestVault.totalReserved();

  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultBalance, 6), "USDC");
  console.log("   InterestVault Balance:", ethers.formatUnits(interestVaultBalance, 6), "USDC");
  console.log("   InterestVault Available:", ethers.formatUnits(interestVaultAvailable, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReserved, 6), "USDC");

  // Check saving plans
  console.log("\n📋 Saving Plans:");
  const nextPlanId = await savingsBank.nextPlanId();
  const totalPlans = Number(nextPlanId) - 1;
  console.log("   Total Plans:", totalPlans);

  if (totalPlans > 0) {
    for (let i = 1; i <= totalPlans; i++) {
      const plan = await savingsBank.savingPlans(i);
      console.log(`\n   Plan ${i}: ${plan.name}`);
      console.log(`      Duration: ${plan.durationDays} days`);
      console.log(`      APR: ${Number(plan.aprBps) / 100}%`);
      console.log(`      Min Deposit: ${ethers.formatUnits(plan.minDeposit, 6)} USDC`);
      console.log(`      Max Deposit: ${plan.maxDeposit === ethers.MaxUint256 ? "No limit" : ethers.formatUnits(plan.maxDeposit, 6) + " USDC"}`);
      console.log(`      Penalty: ${Number(plan.earlyWithdrawPenaltyBps) / 100}%`);
      console.log(`      Active: ${plan.isActive}`);
    }
  }

  // Check contract status
  console.log("\n⚙️  Contract Status:");
  const isPaused = await savingsBank.paused();
  console.log("   Paused:", isPaused);

  // Summary
  console.log("\n✅ Deployment Status Summary:");
  console.log("   Contracts Deployed:", "✅");
  console.log("   Ownership Configured:", isOwnershipCorrect ? "✅" : "⚠️");
  console.log("   InterestVault Funded:", interestVaultBalance > 0 ? "✅" : "⚠️");
  console.log("   Plans Created:", totalPlans > 0 ? `✅ (${totalPlans} plans)` : "⚠️");
  console.log("   Contract Active:", !isPaused ? "✅" : "⚠️");

  const isReady = isOwnershipCorrect && interestVaultBalance > 0 && totalPlans > 0 && !isPaused;
  console.log("\n🎉 System Status:", isReady ? "READY FOR DEPOSITS! ✅" : "⚠️  NEEDS CONFIGURATION");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
