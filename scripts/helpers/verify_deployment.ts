import { ethers } from "hardhat";

/**
 * Verify Deployment Script
 * 
 * This script verifies that the deployed contracts are working correctly.
 * Run this after deployment to ensure everything is set up properly.
 * 
 * Usage:
 *   SAVINGS_BANK_ADDRESS=0x... npx hardhat run scripts/helpers/verify_deployment.ts --network sepolia
 */

async function main() {
  console.log("🔍 Verifying Deployment...\n");

  const savingsBankAddress = process.env.SAVINGS_BANK_ADDRESS;
  
  if (!savingsBankAddress) {
    console.error("❌ Error: Please set SAVINGS_BANK_ADDRESS environment variable");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Verifier account:", deployer.address, "\n");

  // Get contract instances
  const savingsBank = await ethers.getContractAt("SavingsBank", savingsBankAddress);
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("           VERIFICATION CHECKLIST         ");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  let allPassed = true;

  // 1. Check contract exists
  try {
    const code = await ethers.provider.getCode(savingsBankAddress);
    if (code === "0x") {
      console.log("❌ FAIL: No contract at SavingsBank address");
      allPassed = false;
    } else {
      console.log("✅ PASS: SavingsBank contract exists");
    }
  } catch (error) {
    console.log("❌ FAIL: Cannot access SavingsBank contract");
    allPassed = false;
  }

  // 2. Check ERC721 properties
  try {
    const name = await savingsBank.name();
    const symbol = await savingsBank.symbol();
    
    if (name === "Savings Deposit Certificate" && symbol === "SDC") {
      console.log("✅ PASS: ERC721 properties correct");
      console.log(`   Name: "${name}", Symbol: "${symbol}"`);
    } else {
      console.log("❌ FAIL: Incorrect ERC721 properties");
      allPassed = false;
    }
  } catch (error) {
    console.log("❌ FAIL: Cannot read ERC721 properties");
    allPassed = false;
  }

  // 3. Check deposit token
  try {
    const depositTokenAddress = await savingsBank.depositToken();
    console.log("✅ PASS: Deposit token configured");
    console.log(`   USDC Address: ${depositTokenAddress}`);
    
    // Try to get USDC properties
    const usdc = await ethers.getContractAt("IERC20", depositTokenAddress);
    const decimals = await usdc.decimals();
    console.log(`   Decimals: ${decimals}`);
  } catch (error) {
    console.log("⚠️  WARNING: Cannot verify deposit token");
  }

  // 4. Check admin role
  try {
    const ADMIN_ROLE = await savingsBank.ADMIN_ROLE();
    const hasAdminRole = await savingsBank.hasRole(ADMIN_ROLE, deployer.address);
    
    if (hasAdminRole) {
      console.log("✅ PASS: Deployer has ADMIN_ROLE");
    } else {
      console.log("⚠️  INFO: Deployer does not have ADMIN_ROLE");
      console.log("   (This is OK if admin is a different address)");
    }
  } catch (error) {
    console.log("❌ FAIL: Cannot verify admin role");
    allPassed = false;
  }

  // 5. Check saving plans
  try {
    const nextPlanId = await savingsBank.nextPlanId();
    const planCount = Number(nextPlanId) - 1;
    
    console.log(`✅ PASS: ${planCount} saving plan(s) created`);
    
    if (planCount > 0) {
      console.log("\n📋 Available Plans:");
      for (let i = 1; i <= planCount; i++) {
        const plan = await savingsBank.getPlan(i);
        console.log(`   ${i}. ${plan.tenorDays} days @ ${Number(plan.aprBps) / 100}% APR`);
        console.log(`      Range: ${ethers.formatUnits(plan.minDeposit, 6)}-${plan.maxDeposit === 0n ? "∞" : ethers.formatUnits(plan.maxDeposit, 6)} USDC`);
        console.log(`      Penalty: ${Number(plan.earlyWithdrawPenaltyBps) / 100}%`);
        console.log(`      Status: ${plan.enabled ? "✅ Enabled" : "❌ Disabled"}`);
      }
    }
  } catch (error) {
    console.log("❌ FAIL: Cannot read saving plans");
    allPassed = false;
  }

  // 6. Check vault balance
  try {
    const vaultBalance = await savingsBank.getVaultBalance();
    console.log(`\n✅ PASS: Vault accessible`);
    console.log(`   Balance: ${ethers.formatUnits(vaultBalance, 6)} USDC`);
    
    if (vaultBalance === 0n) {
      console.log("   ⚠️  WARNING: Vault has 0 balance. Fund it before accepting deposits!");
    }
  } catch (error) {
    console.log("❌ FAIL: Cannot read vault balance");
    allPassed = false;
  }

  // 7. Check pause status
  try {
    const isPaused = await savingsBank.paused();
    if (isPaused) {
      console.log("⚠️  WARNING: Contract is PAUSED");
    } else {
      console.log("✅ PASS: Contract is active (not paused)");
    }
  } catch (error) {
    console.log("❌ FAIL: Cannot check pause status");
    allPassed = false;
  }

  // 8. Check next deposit ID
  try {
    const nextDepositId = await savingsBank.nextDepositId();
    console.log("✅ PASS: Deposit system initialized");
    console.log(`   Next deposit ID: ${nextDepositId}`);
  } catch (error) {
    console.log("❌ FAIL: Cannot read deposit ID");
    allPassed = false;
  }

  // ==================== SUMMARY ====================
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (allPassed) {
    console.log("✅ ALL CHECKS PASSED - Deployment Verified!");
  } else {
    console.log("❌ SOME CHECKS FAILED - Please review above");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📌 Next Steps:");
  console.log("1. Fund the vault if balance is 0");
  console.log("2. Test opening a deposit:");
  console.log(`   npx hardhat run scripts/helpers/test_deposit.ts --network ${network.name}`);
  console.log("3. Verify contract on Etherscan (if testnet/mainnet):");
  console.log(`   npx hardhat verify --network ${network.name} ${savingsBankAddress} ${usdcAddress} ${feeReceiver} ${admin}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
