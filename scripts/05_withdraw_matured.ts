import { ethers, deployments } from "hardhat";

/**
 * Script 5: Withdraw Matured Deposit
 * 
 * METHOD 2: Principal from SavingsBank, Interest from VaultManager
 */
async function main() {
  console.log("\n💸 SCRIPT 5: Withdraw Matured Deposit\n");

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
  console.log("\n🔍 Withdrawing deposit ID:", depositId.toString());

  // Get deposit info
  const deposit = await savingsBank.getDeposit(depositId);
  
  if (deposit.status !== 0n) {
    console.log("❌ Deposit is not ACTIVE (status:", deposit.status, ")");
    return;
  }

  console.log("\n📊 Deposit Info:");
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Maturity:", new Date(Number(deposit.maturityAt) * 1000).toLocaleString());

  // Check if matured
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(deposit.maturityAt)) {
    console.log("\n❌ Deposit has NOT matured yet!");
    console.log("⏰ Time until maturity:", Math.ceil((Number(deposit.maturityAt) - now) / 86400), "days");
    console.log("💡 Use script 06_early_withdraw.ts for early withdrawal");
    return;
  }

  console.log("✅ Deposit has matured!");

  // Calculate interest
  const interest = await savingsBank.calculateInterest(depositId);
  console.log("\n💰 Withdrawal Details:");
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Interest:", ethers.formatUnits(interest, 6), "USDC");
  console.log("   Total:", ethers.formatUnits(deposit.principal + interest, 6), "USDC");

  // Check balances before
  const userBalanceBefore = await mockUSDC.balanceOf(deployer.address);
  const sbBalanceBefore = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmBalanceBefore = await vaultManager.totalBalance();
  const vmReservesBefore = await vaultManager.reservedFunds();

  console.log("\n📊 Balances BEFORE:");
  console.log("   User:", ethers.formatUnits(userBalanceBefore, 6), "USDC");
  console.log("   SavingsBank:", ethers.formatUnits(sbBalanceBefore, 6), "USDC");
  console.log("   VaultManager Total:", ethers.formatUnits(vmBalanceBefore, 6), "USDC");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesBefore, 6), "USDC");

  // Withdraw
  console.log("\n⏳ Processing withdrawal...");
  const tx = await savingsBank.withdraw(depositId);
  await tx.wait();
  console.log("✅ Withdrawal complete!");

  // Check balances after
  const userBalanceAfter = await mockUSDC.balanceOf(deployer.address);
  const sbBalanceAfter = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmBalanceAfter = await vaultManager.totalBalance();
  const vmReservesAfter = await vaultManager.reservedFunds();

  console.log("\n📊 Balances AFTER:");
  console.log("   User:", ethers.formatUnits(userBalanceAfter, 6), "USDC (+", ethers.formatUnits(userBalanceAfter - userBalanceBefore, 6), ")");
  console.log("   SavingsBank:", ethers.formatUnits(sbBalanceAfter, 6), "USDC (-", ethers.formatUnits(sbBalanceBefore - sbBalanceAfter, 6), ")");
  console.log("   VaultManager Total:", ethers.formatUnits(vmBalanceAfter, 6), "USDC (-", ethers.formatUnits(vmBalanceBefore - vmBalanceAfter, 6), ")");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesAfter, 6), "USDC (-", ethers.formatUnits(vmReservesBefore - vmReservesAfter, 6), ")");

  console.log("\n💡 METHOD 2 Architecture Verification:");
  console.log("   Principal paid from SavingsBank:", ethers.formatUnits(sbBalanceBefore - sbBalanceAfter, 6), "USDC ✅");
  console.log("   Interest paid from VaultManager:", ethers.formatUnits(vmBalanceBefore - vmBalanceAfter, 6), "USDC ✅");
  console.log("   Reserved funds released:", ethers.formatUnits(vmReservesBefore - vmReservesAfter, 6), "USDC ✅");

  // Verify deposit status
  const depositAfter = await savingsBank.getDeposit(depositId);
  console.log("\n📝 Deposit Status:", ["ACTIVE", "WITHDRAWN", "AUTORENEWED", "MANUALRENEWED"][Number(depositAfter.status)]);

  console.log("\n✅ Withdrawal successful!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
