import { ethers, deployments } from "hardhat";

/**
 * Script 6: Renew Deposit
 * 
 * Renew matured deposit (compound interest into principal)
 * 
 * Architecture:
 * - Old interest released from InterestVault
 * - Interest transferred to TokenVault (joins principal)
 * - New interest reserved in InterestVault
 * - New NFT minted, old NFT burned
 */
async function main() {
  console.log("\n♻️  SCRIPT 6: Renew Deposit\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get deposit ID from environment or use default
  const depositId = process.env.DEPOSIT_ID ? BigInt(process.env.DEPOSIT_ID) : 1n;
  const useCurrentRate = process.env.USE_CURRENT_RATE === "true";
  const newPlanId = process.env.NEW_PLAN_ID ? BigInt(process.env.NEW_PLAN_ID) : 0n;

  console.log("🔍 Renewing Deposit ID:", depositId.toString());
  console.log("📋 Use Current Rate:", useCurrentRate);
  console.log("📋 New Plan ID:", newPlanId === 0n ? "Same plan" : newPlanId.toString());

  // Get contracts
  const TokenVault = await deployments.get("TokenVault");
  const InterestVault = await deployments.get("InterestVault");
  const SavingsBank = await deployments.get("SavingsBank");
  
  const tokenVault = await ethers.getContractAt("TokenVault", TokenVault.address);
  const interestVault = await ethers.getContractAt("InterestVault", InterestVault.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);

  console.log("\n📌 Contracts:");
  console.log("   SavingsBank:", SavingsBank.address);
  console.log("   TokenVault:", TokenVault.address);
  console.log("   InterestVault:", InterestVault.address);

  // Get deposit details
  const [planId, principal, startTime, maturityTime, lockedAprBps, isAutoRenewEnabled, status] = 
    await savingsBank.getDepositDetails(depositId);

  console.log("\n📊 Old Deposit Information:");
  console.log("   Deposit ID:", depositId.toString());
  console.log("   Principal:", ethers.formatUnits(principal, 6), "USDC");
  console.log("   Locked APR:", Number(lockedAprBps) / 100, "%");
  console.log("   Maturity:", new Date(Number(maturityTime) * 1000).toLocaleString());
  console.log("   Auto Renew:", isAutoRenewEnabled);
  console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(status)]);

  // Check if deposit is active
  if (status !== 0n) {
    console.log("\n⚠️  Deposit is not active!");
    return;
  }

  // Check if matured
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(maturityTime)) {
    const daysRemaining = Math.ceil((Number(maturityTime) - now) / 86400);
    console.log("\n⚠️  Deposit not yet matured!");
    console.log("   Days remaining:", daysRemaining);
    return;
  }

  // Calculate interest
  const interest = await savingsBank.calculateInterest(depositId);
  const newPrincipal = principal + interest;

  console.log("\n💰 Renewal Calculation:");
  console.log("   Old Principal:", ethers.formatUnits(principal, 6), "USDC");
  console.log("   Interest Earned:", ethers.formatUnits(interest, 6), "USDC");
  console.log("   New Principal:", ethers.formatUnits(newPrincipal, 6), "USDC");

  // Get new plan info
  const targetPlanId = newPlanId === 0n ? planId : newPlanId;
  const newPlan = await savingsBank.savingPlans(targetPlanId);
  
  console.log("\n📋 New Plan:");
  console.log("   Plan ID:", targetPlanId.toString());
  console.log("   Name:", newPlan.name);
  console.log("   Duration:", newPlan.durationDays.toString(), "days");
  
  if (useCurrentRate) {
    console.log("   APR:", Number(newPlan.aprBps) / 100, "% (current rate)");
  } else {
    console.log("   APR:", Number(lockedAprBps) / 100, "% (locked rate)");
  }

  // Check balances before
  const tokenVaultBefore = await tokenVault.balance();
  const interestVaultBefore = await interestVault.balance();
  const interestVaultReservedBefore = await interestVault.totalReserved();

  console.log("\n📊 Balances BEFORE:");
  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultBefore, 6), "USDC");
  console.log("   InterestVault Balance:", ethers.formatUnits(interestVaultBefore, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReservedBefore, 6), "USDC");

  // Renew deposit
  console.log("\n⏳ Processing renewal...");
  const tx = await savingsBank.renew(depositId, useCurrentRate, newPlanId);
  const receipt = await tx.wait();
  console.log("✅ Renewal successful!");

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
    newDepositId = parsed?.args[1]; // newDepositId is second arg
  }

  console.log("\n📝 New Deposit ID:", newDepositId.toString());

  // Get new deposit details
  const [newPlanIdRet, newPrincipalRet, newStartTime, newMaturityTime, newLockedAprBps, newIsAutoRenewEnabled, newStatus] = 
    await savingsBank.getDepositDetails(newDepositId);

  console.log("\n📊 New Deposit Information:");
  console.log("   Deposit ID:", newDepositId.toString());
  console.log("   Principal:", ethers.formatUnits(newPrincipalRet, 6), "USDC");
  console.log("   Locked APR:", Number(newLockedAprBps) / 100, "%");
  console.log("   Maturity:", new Date(Number(newMaturityTime) * 1000).toLocaleString());
  console.log("   Auto Renew:", newIsAutoRenewEnabled);
  console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(newStatus)]);

  // Check balances after
  const tokenVaultAfter = await tokenVault.balance();
  const interestVaultAfter = await interestVault.balance();
  const interestVaultReservedAfter = await interestVault.totalReserved();

  console.log("\n📊 Balances AFTER:");
  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultAfter, 6), "USDC");
  console.log("   InterestVault Balance:", ethers.formatUnits(interestVaultAfter, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReservedAfter, 6), "USDC");

  console.log("\n💡 Architecture Verification:");
  console.log("   Interest moved to TokenVault:", ethers.formatUnits(tokenVaultAfter - tokenVaultBefore, 6), "USDC ✅");
  console.log("   Interest paid from InterestVault:", ethers.formatUnits(interestVaultBefore - interestVaultAfter, 6), "USDC ✅");

  // Verify old deposit status
  const [,,,,, , oldStatus] = await savingsBank.getDepositDetails(depositId);
  console.log("\n📝 Old Deposit Status:");
  console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(oldStatus)]);

  console.log("\n✅ Renewal complete!");
  console.log("💰 New principal:", ethers.formatUnits(newPrincipalRet, 6), "USDC");
  console.log("🆕 Use deposit ID", newDepositId.toString(), "for future operations");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
