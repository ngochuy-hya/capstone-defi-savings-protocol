import { ethers, deployments } from "hardhat";

/**
 * Script 3: Open a Savings Deposit
 * 
 * METHOD 2: Principal goes to SavingsBank, interest reserved in VaultManager
 */
async function main() {
  console.log("\n💵 SCRIPT 3: Open Savings Deposit\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get contracts
  const MockUSDC = await deployments.get("MockUSDC");
  const SavingsBank = await deployments.get("SavingsBank");
  const VaultManager = await deployments.get("VaultManager");
  
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);
  const vaultManager = await ethers.getContractAt("VaultManager", VaultManager.address);

  console.log("📌 MockUSDC:", await mockUSDC.getAddress());
  console.log("📌 SavingsBank:", await savingsBank.getAddress());
  console.log("📌 VaultManager:", await vaultManager.getAddress());

  // Check user balance
  const userBalance = await mockUSDC.balanceOf(deployer.address);
  console.log("\n💵 User USDC balance:", ethers.formatUnits(userBalance, 6), "USDC");

  // Deposit parameters
  const planId = 2; // 30-day plan
  const depositAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  const enableAutoRenew = false;

  console.log("\n📋 Deposit Parameters:");
  console.log("   Plan ID:", planId);
  console.log("   Amount:", ethers.formatUnits(depositAmount, 6), "USDC");
  console.log("   Auto Renew:", enableAutoRenew);

  // Get plan info
  const plan = await savingsBank.getPlan(planId);
  console.log("\n📊 Plan Info:");
  console.log("   Tenor:", plan.tenorDays.toString(), "days");
  console.log("   APR:", Number(plan.aprBps) / 100, "%");

  // Calculate expected interest
  const expectedInterest = (depositAmount * BigInt(plan.aprBps) * BigInt(plan.tenorDays) * 86400n) / (365n * 86400n * 10000n);
  console.log("   Expected Interest:", ethers.formatUnits(expectedInterest, 6), "USDC");

  // Check balances before
  const sbBalanceBefore = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmReservesBefore = await vaultManager.reservedFunds();

  console.log("\n📊 Balances BEFORE:");
  console.log("   SavingsBank Balance:", ethers.formatUnits(sbBalanceBefore, 6), "USDC");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesBefore, 6), "USDC");

  // METHOD 2: Approve SavingsBank (not VaultManager!)
  console.log("\n⏳ Approving SavingsBank to spend USDC...");
  const approveTx = await mockUSDC.approve(await savingsBank.getAddress(), depositAmount);
  await approveTx.wait();
  console.log("✅ Approved");

  // Open deposit
  console.log("⏳ Opening deposit...");
  const tx = await savingsBank.openDeposit(planId, depositAmount, enableAutoRenew);
  const receipt = await tx.wait();
  console.log("✅ Deposit opened!");

  // Get deposit ID from event
  const depositOpenedEvent = receipt?.logs.find((log: any) => {
    try {
      const parsed = savingsBank.interface.parseLog(log);
      return parsed?.name === "DepositOpened";
    } catch {
      return false;
    }
  });

  let depositId = 1n;
  if (depositOpenedEvent) {
    const parsed = savingsBank.interface.parseLog(depositOpenedEvent);
    depositId = parsed?.args[0];
  }

  console.log("\n📝 Deposit ID:", depositId.toString());

  // Get deposit info
  const deposit = await savingsBank.getDeposit(depositId);
  console.log("\n📊 Deposit Certificate:");
  console.log("   Owner:", deposit.owner);
  console.log("   Plan ID:", deposit.planId.toString());
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Start:", new Date(Number(deposit.startAt) * 1000).toLocaleString());
  console.log("   Maturity:", new Date(Number(deposit.maturityAt) * 1000).toLocaleString());
  console.log("   Status:", ["ACTIVE", "WITHDRAWN", "AUTORENEWED", "MANUALRENEWED"][Number(deposit.status)]);
  console.log("   Locked APR:", Number(deposit.lockedAprBps) / 100, "%");

  // Check balances after
  const sbBalanceAfter = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmReservesAfter = await vaultManager.reservedFunds();

  console.log("\n📊 Balances AFTER:");
  console.log("   SavingsBank Balance:", ethers.formatUnits(sbBalanceAfter, 6), "USDC");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesAfter, 6), "USDC");

  console.log("\n💡 METHOD 2 Architecture Verification:");
  console.log("   Principal increase (SavingsBank):", ethers.formatUnits(sbBalanceAfter - sbBalanceBefore, 6), "USDC ✅");
  console.log("   Interest reserved (VaultManager):", ethers.formatUnits(vmReservesAfter - vmReservesBefore, 6), "USDC ✅");

  // Calculate days until maturity
  const now = Math.floor(Date.now() / 1000);
  const daysUntilMaturity = Math.ceil((Number(deposit.maturityAt) - now) / 86400);
  console.log("\n⏰ Time until maturity:", daysUntilMaturity, "days");

  console.log("\n✅ Deposit opened successfully!");
  console.log("💡 Use deposit ID", depositId.toString(), "for withdraw/renew operations\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
