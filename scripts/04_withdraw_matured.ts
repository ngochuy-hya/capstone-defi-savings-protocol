import { ethers, deployments } from "hardhat";

/**
 * Script 4: Withdraw Matured Deposit
 * 
 * Withdraw principal + interest at maturity
 * 
 * Architecture:
 * - Principal paid from TokenVault
 * - Interest paid from InterestVault
 * - NFT burned
 */
async function main() {
  console.log("\n💸 SCRIPT 4: Withdraw Matured Deposit\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get deposit ID from environment or use default
  const depositId = process.env.DEPOSIT_ID ? BigInt(process.env.DEPOSIT_ID) : 1n;
  console.log("🔍 Withdrawing Deposit ID:", depositId.toString());

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
    console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(status)]);
    return;
  }

  // Check if matured
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(maturityTime)) {
    const daysRemaining = Math.ceil((Number(maturityTime) - now) / 86400);
    console.log("\n⚠️  Deposit not yet matured!");
    console.log("   Days remaining:", daysRemaining);
    console.log("   Use script 05_early_withdraw.ts for early withdrawal");
    return;
  }

  // Calculate interest
  const interest = await savingsBank.calculateInterest(depositId);
  const totalAmount = principal + interest;

  console.log("\n💰 Withdrawal Amounts:");
  console.log("   Principal:", ethers.formatUnits(principal, 6), "USDC");
  console.log("   Interest:", ethers.formatUnits(interest, 6), "USDC");
  console.log("   Total:", ethers.formatUnits(totalAmount, 6), "USDC");

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

  // Withdraw
  console.log("\n⏳ Processing withdrawal...");
  const tx = await savingsBank.withdraw(depositId);
  const receipt = await tx.wait();
  console.log("✅ Withdrawal successful!");

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
  console.log("   Principal paid (TokenVault):", ethers.formatUnits(tokenVaultBefore - tokenVaultAfter, 6), "USDC ✅");
  console.log("   Interest paid (InterestVault):", ethers.formatUnits(interestVaultBefore - interestVaultAfter, 6), "USDC ✅");
  console.log("   Reserved released:", ethers.formatUnits(interestVaultReservedBefore - interestVaultReservedAfter, 6), "USDC ✅");

  // Verify deposit status
  const [,,,,, , newStatus] = await savingsBank.getDepositDetails(depositId);
  console.log("\n📝 Deposit Status Updated:");
  console.log("   New Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(newStatus)]);

  console.log("\n✅ Withdrawal complete!");
  console.log("💰 Total received:", ethers.formatUnits(userBalanceAfter - userBalanceBefore, 6), "USDC");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
