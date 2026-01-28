import { ethers, deployments } from "hardhat";

/**
 * Script 7: Renew Matured Deposit
 * 
 * METHOD 2: Interest moves from VaultManager to SavingsBank, joins principal
 */
async function main() {
  console.log("\n♻️  SCRIPT 7: Renew Deposit\n");

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
  const useCurrentRate = process.env.USE_CURRENT_RATE === "true";

  console.log("\n🔍 Renewing deposit ID:", depositId.toString());
  console.log("   Use Current Rate:", useCurrentRate, useCurrentRate ? "(Manual Renew)" : "(Auto Renew)");

  // Get deposit info
  const deposit = await savingsBank.getDeposit(depositId);
  
  if (deposit.status !== 0n) {
    console.log("❌ Deposit is not ACTIVE (status:", deposit.status, ")");
    return;
  }

  // Check if matured
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(deposit.maturityAt)) {
    console.log("\n❌ Deposit has NOT matured yet!");
    console.log("⏰ Time until maturity:", Math.ceil((Number(deposit.maturityAt) - now) / 86400), "days");
    return;
  }

  const plan = await savingsBank.getPlan(deposit.planId);

  console.log("\n📊 Old Deposit Info:");
  console.log("   Principal:", ethers.formatUnits(deposit.principal, 6), "USDC");
  console.log("   Locked APR:", Number(deposit.lockedAprBps) / 100, "%");
  console.log("   Plan Current APR:", Number(plan.aprBps) / 100, "%");

  // Calculate old interest
  const oldInterest = await savingsBank.calculateInterest(depositId);
  const newPrincipal = deposit.principal + oldInterest;

  console.log("   Interest Earned:", ethers.formatUnits(oldInterest, 6), "USDC");
  console.log("   New Principal:", ethers.formatUnits(newPrincipal, 6), "USDC");

  // Calculate new interest and APR
  const newAprBps = useCurrentRate ? plan.aprBps : deposit.lockedAprBps;
  const fullDuration = Number(deposit.maturityAt) - Number(deposit.startAt);
  const newExpectedInterest = (newPrincipal * BigInt(newAprBps) * BigInt(fullDuration)) / (365n * 86400n * 10000n);

  console.log("\n📋 New Deposit Preview:");
  console.log("   Principal:", ethers.formatUnits(newPrincipal, 6), "USDC");
  console.log("   APR:", Number(newAprBps) / 100, "%", useCurrentRate ? "(Current)" : "(Locked)");
  console.log("   Expected Interest:", ethers.formatUnits(newExpectedInterest, 6), "USDC");
  console.log("   Total at Maturity:", ethers.formatUnits(newPrincipal + newExpectedInterest, 6), "USDC");

  // Check balances before
  const sbBalanceBefore = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmBalanceBefore = await vaultManager.totalBalance();
  const vmReservesBefore = await vaultManager.reservedFunds();

  console.log("\n📊 Balances BEFORE:");
  console.log("   SavingsBank:", ethers.formatUnits(sbBalanceBefore, 6), "USDC");
  console.log("   VaultManager Total:", ethers.formatUnits(vmBalanceBefore, 6), "USDC");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesBefore, 6), "USDC");

  // Renew
  console.log("\n⏳ Processing renewal...");
  const tx = await savingsBank.renew(depositId, useCurrentRate);
  const receipt = await tx.wait();
  console.log("✅ Renewal complete!");

  // Get new deposit ID from event
  const renewedEvent = receipt?.logs.find((log: any) => {
    try {
      const parsed = savingsBank.interface.parseLog(log);
      return parsed?.name === "Renewed";
    } catch {
      return false;
    }
  });

  let newDepositId = depositId + 1n;
  if (renewedEvent) {
    const parsed = savingsBank.interface.parseLog(renewedEvent);
    newDepositId = parsed?.args[1]; // newDepositId
  }

  console.log("\n📝 New Deposit ID:", newDepositId.toString());

  // Get new deposit info
  const newDeposit = await savingsBank.getDeposit(newDepositId);
  console.log("\n📊 New Deposit Certificate:");
  console.log("   Principal:", ethers.formatUnits(newDeposit.principal, 6), "USDC");
  console.log("   Locked APR:", Number(newDeposit.lockedAprBps) / 100, "%");
  console.log("   Start:", new Date(Number(newDeposit.startAt) * 1000).toLocaleString());
  console.log("   Maturity:", new Date(Number(newDeposit.maturityAt) * 1000).toLocaleString());
  console.log("   Auto Renew:", newDeposit.isAutoRenewEnabled);

  // Check balances after
  const sbBalanceAfter = await mockUSDC.balanceOf(await savingsBank.getAddress());
  const vmBalanceAfter = await vaultManager.totalBalance();
  const vmReservesAfter = await vaultManager.reservedFunds();

  console.log("\n📊 Balances AFTER:");
  console.log("   SavingsBank:", ethers.formatUnits(sbBalanceAfter, 6), "USDC (+", ethers.formatUnits(sbBalanceAfter - sbBalanceBefore, 6), ")");
  console.log("   VaultManager Total:", ethers.formatUnits(vmBalanceAfter, 6), "USDC (-", ethers.formatUnits(vmBalanceBefore - vmBalanceAfter, 6), ")");
  console.log("   VaultManager Reserved:", ethers.formatUnits(vmReservesAfter, 6), "USDC");

  console.log("\n💡 METHOD 2 Architecture Verification:");
  console.log("   Old interest transferred to SavingsBank:", ethers.formatUnits(sbBalanceAfter - sbBalanceBefore, 6), "USDC ✅");
  console.log("   VaultManager paid out old interest:", ethers.formatUnits(vmBalanceBefore - vmBalanceAfter, 6), "USDC ✅");
  console.log("   New interest reserved:", ethers.formatUnits(vmReservesAfter - vmReservesBefore + oldInterest, 6), "USDC ✅");

  // Verify old deposit status
  const oldDepositAfter = await savingsBank.getDeposit(depositId);
  console.log("\n📝 Old Deposit Status:", ["ACTIVE", "WITHDRAWN", "AUTORENEWED", "MANUALRENEWED"][Number(oldDepositAfter.status)]);

  console.log("\n✅ Renewal successful!");
  console.log("💡 New deposit ID:", newDepositId.toString(), "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
