import { ethers, deployments } from "hardhat";

/**
 * Script 2: Open a Savings Deposit
 * 
 * New Architecture:
 * - Principal goes to TokenVault
 * - Interest reserved in InterestVault
 * - NFT minted to user
 */
async function main() {
  console.log("\n💵 SCRIPT 2: Open Savings Deposit\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

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
  console.log("   MockUSDC:", MockUSDC.address);
  console.log("   SavingsBank:", SavingsBank.address);
  console.log("   TokenVault:", TokenVault.address);
  console.log("   InterestVault:", InterestVault.address);

  // Check user balance
  let userBalance = await mockUSDC.balanceOf(deployer.address);
  console.log("\n💵 User USDC balance:", ethers.formatUnits(userBalance, 6), "USDC");

  // Deposit parameters
  const planId = 2; // 30-day plan (change as needed)
  const depositAmount = ethers.parseUnits("1000", 6); // 1,000 USDC
  const enableAutoRenew = false;

  // Mint USDC if user doesn't have enough
  if (userBalance < depositAmount) {
    console.log("⏳ Minting USDC to user...");
    const mintTx = await mockUSDC.mint(deployer.address, depositAmount);
    await mintTx.wait();
    userBalance = await mockUSDC.balanceOf(deployer.address);
    console.log("✅ Minted! New balance:", ethers.formatUnits(userBalance, 6), "USDC");
  }

  console.log("\n📋 Deposit Parameters:");
  console.log("   Plan ID:", planId);
  console.log("   Amount:", ethers.formatUnits(depositAmount, 6), "USDC");
  console.log("   Auto Renew:", enableAutoRenew);

  // Get plan info
  const plan = await savingsBank.savingPlans(planId);
  console.log("\n📊 Plan Info:");
  console.log("   Name:", plan.name);
  console.log("   Duration:", plan.durationDays.toString(), "days");
  console.log("   APR:", Number(plan.aprBps) / 100, "%");
  console.log("   Penalty:", Number(plan.earlyWithdrawPenaltyBps) / 100, "%");

  // Ước tính interest lý thuyết cho minh hoạ (không gọi contract)
  const durationDays = BigInt(plan.durationDays);
  const aprBps = BigInt(plan.aprBps);
  const expectedInterest = (depositAmount * aprBps * durationDays) / (365n * 10_000n);
  console.log(
    "   Estimated Interest (theoretical):",
    ethers.formatUnits(expectedInterest, 6),
    "USDC"
  );

  // Check balances before
  const tokenVaultBefore = await tokenVault.balance();
  const interestVaultReservedBefore = await interestVault.totalReserved();

  console.log("\n📊 Balances BEFORE:");
  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultBefore, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReservedBefore, 6), "USDC");

  // Approve TokenVault to spend USDC (principal goes there)
  console.log("\n⏳ Approving TokenVault to spend USDC...");
  const approveTx = await mockUSDC.approve(TokenVault.address, depositAmount);
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
    depositId = parsed?.args[0]; // depositId is first arg
  }

  console.log("\n📝 Deposit ID:", depositId.toString());

  // Get deposit details
  const [planIdRet, principal, startTime, maturityTime, lockedAprBps, isAutoRenewEnabled, status] = 
    await savingsBank.getDepositDetails(depositId);

  console.log("\n📊 Deposit Certificate:");
  console.log("   Deposit ID:", depositId.toString());
  console.log("   Plan ID:", planIdRet.toString());
  console.log("   Principal:", ethers.formatUnits(principal, 6), "USDC");
  console.log("   Start:", new Date(Number(startTime) * 1000).toLocaleString());
  console.log("   Maturity:", new Date(Number(maturityTime) * 1000).toLocaleString());
  console.log("   Locked APR:", Number(lockedAprBps) / 100, "%");
  console.log("   Auto Renew:", isAutoRenewEnabled);
  console.log("   Status:", ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"][Number(status)]);

  // Check balances after
  const tokenVaultAfter = await tokenVault.balance();
  const interestVaultReservedAfter = await interestVault.totalReserved();

  console.log("\n📊 Balances AFTER:");
  console.log("   TokenVault Balance:", ethers.formatUnits(tokenVaultAfter, 6), "USDC");
  console.log("   InterestVault Reserved:", ethers.formatUnits(interestVaultReservedAfter, 6), "USDC");

  console.log("\n💡 Architecture Verification:");
  console.log("   Principal added (TokenVault):", ethers.formatUnits(tokenVaultAfter - tokenVaultBefore, 6), "USDC ✅");
  console.log("   Interest reserved (InterestVault):", ethers.formatUnits(interestVaultReservedAfter - interestVaultReservedBefore, 6), "USDC ✅");

  // Calculate days until maturity
  const now = Math.floor(Date.now() / 1000);
  const daysUntilMaturity = Math.ceil((Number(maturityTime) - now) / 86400);
  console.log("\n⏰ Time until maturity:", daysUntilMaturity, "days");

  console.log("\n✅ Deposit opened successfully!");
  console.log("💡 Use deposit ID", depositId.toString(), "for checking interest/withdraw/renew");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
