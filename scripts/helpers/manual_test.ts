import { ethers } from "hardhat";

/**
 * Manual Testing Script for Deployed Contracts
 * 
 * Interactive testing of SavingsBank on testnet
 * 
 * Usage:
 *   SAVINGS_BANK_ADDRESS=0x... npx hardhat run scripts/helpers/manual_test.ts --network sepolia
 */

async function main() {
  console.log("🧪 Manual Testing Script\n");

  const savingsBankAddress = process.env.SAVINGS_BANK_ADDRESS;
  
  if (!savingsBankAddress) {
    console.error("❌ Error: Set SAVINGS_BANK_ADDRESS environment variable");
    console.log("   Usage: SAVINGS_BANK_ADDRESS=0x... npx hardhat run scripts/helpers/manual_test.ts --network sepolia");
    process.exit(1);
  }

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📝 Test Info:");
  console.log("   Network:", network.name);
  console.log("   User:", user.address);
  console.log("   SavingsBank:", savingsBankAddress);
  console.log("");

  // Get contracts
  const savingsBank = await ethers.getContractAt("SavingsBank", savingsBankAddress);
  const usdcAddress = await savingsBank.depositToken();
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

  console.log("📦 Contracts:");
  console.log("   USDC:", usdcAddress);
  console.log("");

  // ==================== TEST MENU ====================
  
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║           MANUAL TEST MENU                ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");
  console.log("Available Tests:");
  console.log("1. Check Balances");
  console.log("2. Mint Test USDC");
  console.log("3. View Available Plans");
  console.log("4. Open New Deposit");
  console.log("5. View My Deposits");
  console.log("6. Calculate Interest");
  console.log("7. Early Withdraw");
  console.log("8. Withdraw at Maturity");
  console.log("9. Transfer NFT");
  console.log("10. Renew Deposit");
  console.log("");

  // Auto-run all tests for convenience
  await runAllTests(savingsBank, usdc, user);
}

async function runAllTests(savingsBank: any, usdc: any, user: any) {
  console.log("🚀 Running All Tests...\n");

  // TEST 1: Check Balances
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 1: Check Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const ethBalance = await ethers.provider.getBalance(user.address);
  const usdcBalance = await usdc.balanceOf(user.address);
  const vaultBalance = await savingsBank.getVaultBalance();

  console.log("💰 Balances:");
  console.log("   User ETH:", ethers.formatEther(ethBalance), "ETH");
  console.log("   User USDC:", ethers.formatUnits(usdcBalance, 6), "USDC");
  console.log("   Vault USDC:", ethers.formatUnits(vaultBalance, 6), "USDC");
  console.log("");

  // TEST 2: Mint USDC if needed
  if (usdcBalance < ethers.parseUnits("1000", 6)) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 2: Mint Test USDC");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    try {
      const mintAmount = ethers.parseUnits("10000", 6);
      console.log("⏳ Minting 10,000 USDC...");
      const mintTx = await usdc.mint(user.address, mintAmount);
      await mintTx.wait();
      console.log("✅ Minted 10,000 USDC");
      console.log("   Tx:", mintTx.hash);
      console.log("");
    } catch (error: any) {
      console.log("⚠️  Cannot mint (not owner or not MockUSDC)");
      console.log("   Using existing balance");
      console.log("");
    }
  }

  // TEST 3: View Plans
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 3: Available Saving Plans");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const nextPlanId = await savingsBank.nextPlanId();
  const planCount = Number(nextPlanId) - 1;

  for (let i = 1; i <= planCount; i++) {
    const plan = await savingsBank.getPlan(i);
    console.log(`📋 Plan ${i}:`);
    console.log(`   Tenor: ${plan.tenorDays} days`);
    console.log(`   APR: ${Number(plan.aprBps) / 100}%`);
    console.log(`   Range: ${ethers.formatUnits(plan.minDeposit, 6)}-${plan.maxDeposit === 0n ? "∞" : ethers.formatUnits(plan.maxDeposit, 6)} USDC`);
    console.log(`   Penalty: ${Number(plan.earlyWithdrawPenaltyBps) / 100}%`);
    console.log(`   Status: ${plan.enabled ? "✅ Enabled" : "❌ Disabled"}`);
    console.log("");
  }

  // TEST 4: Open Deposit
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 4: Open New Deposit");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const depositAmount = ethers.parseUnits("1000", 6);
  const planId = 1; // 7-day plan

  console.log("💼 Opening deposit:");
  console.log("   Amount: 1,000 USDC");
  console.log("   Plan: 1 (7-day @ 5% APR)");
  console.log("   Auto-renew: No");
  console.log("");

  // Approve
  console.log("⏳ Approving USDC...");
  const approveTx = await usdc.approve(await savingsBank.getAddress(), depositAmount);
  await approveTx.wait();
  console.log("✅ Approved");

  // Open
  console.log("⏳ Opening deposit...");
  const openTx = await savingsBank.openDeposit(planId, depositAmount, false);
  const openReceipt = await openTx.wait();
  console.log("✅ Deposit opened!");
  console.log("   Tx:", openTx.hash);

  // Get deposit ID from event
  const depositOpenedEvent = openReceipt.logs.find((log: any) => {
    try {
      const parsed = savingsBank.interface.parseLog(log);
      return parsed?.name === "DepositOpened";
    } catch {
      return false;
    }
  });

  let depositId = 0;
  if (depositOpenedEvent) {
    const parsed = savingsBank.interface.parseLog(depositOpenedEvent);
    depositId = Number(parsed?.args[0]);
    console.log("   Deposit ID:", depositId);
  }
  console.log("");

  // TEST 5: View Deposits
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 5: View My Deposits");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const userDeposits = await savingsBank.getUserDeposits(user.address);
  console.log(`📊 Total deposits: ${userDeposits.length}`);
  console.log("");

  for (const depId of userDeposits) {
    const deposit = await savingsBank.getDeposit(depId);
    const statusNames = ["ACTIVE", "WITHDRAWN", "AUTORENEWED", "MANUALRENEWED"];
    
    console.log(`🎫 Deposit #${depId}:`);
    console.log(`   Owner: ${deposit.owner}`);
    console.log(`   Principal: ${ethers.formatUnits(deposit.principal, 6)} USDC`);
    console.log(`   Locked APR: ${Number(deposit.lockedAprBps) / 100}%`);
    console.log(`   Opened: ${new Date(Number(deposit.openedAt) * 1000).toLocaleString()}`);
    console.log(`   Maturity: ${new Date(Number(deposit.maturityAt) * 1000).toLocaleString()}`);
    console.log(`   Status: ${statusNames[Number(deposit.status)]}`);
    console.log(`   Auto-renew: ${deposit.isAutoRenewEnabled ? "✅ Enabled" : "❌ Disabled"}`);
    console.log("");
  }

  // TEST 6: Calculate Interest
  if (depositId > 0) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 6: Calculate Interest");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const interest = await savingsBank.calculateInterest(depositId);
    console.log(`📊 Deposit #${depositId}:`);
    console.log(`   Current interest: ${ethers.formatUnits(interest, 6)} USDC`);
    console.log(`   Expected at maturity: ~0.96 USDC (7 days @ 5% APR)`);
    console.log("");
  }

  // Final Summary
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║        MANUAL TESTING COMPLETE! ✅        ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  console.log("📝 Summary:");
  console.log("   ✅ Checked balances");
  console.log("   ✅ Minted test USDC (if needed)");
  console.log("   ✅ Viewed available plans");
  console.log("   ✅ Opened new deposit");
  console.log("   ✅ Viewed user deposits");
  console.log("   ✅ Calculated interest");
  console.log("");

  console.log("⏰ Next Steps:");
  console.log("   1. Wait for maturity (7 days on testnet)");
  console.log("   2. Test early withdraw:");
  console.log(`      await savingsBank.earlyWithdraw(${depositId})`);
  console.log("   3. Or test full withdraw at maturity:");
  console.log(`      await savingsBank.withdraw(${depositId})`);
  console.log("   4. Test NFT transfer:");
  console.log(`      await savingsBank.transferFrom(from, to, ${depositId})`);
  console.log("");

  console.log("🔗 View on Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${await savingsBank.getAddress()}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
