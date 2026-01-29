import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Configure System:
 * 1. Fund InterestVault with USDC liquidity
 * 2. Create initial saving plans
 * 
 * This prepares the system for users to start depositing.
 */
const configureSystem: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hre;
  const { log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  log("==========================================");
  log("05: Configuring System...");
  log("==========================================");

  // Get deployed contracts
  const mockUSDC = await get("MockUSDC");
  const interestVault = await get("InterestVault");
  const savingsBank = await get("SavingsBank");

  log(`MockUSDC: ${mockUSDC.address}`);
  log(`InterestVault: ${interestVault.address}`);
  log(`SavingsBank: ${savingsBank.address}`);

  // Get contract instances
  const MockUSDC = await ethers.getContractAt("MockUSDC", mockUSDC.address);
  const InterestVault = await ethers.getContractAt("InterestVault", interestVault.address);
  const SavingsBank = await ethers.getContractAt("SavingsBank", savingsBank.address);

  // Step 1: Fund InterestVault with USDC
  log("\n💰 Step 1/2: Funding InterestVault...");
  const fundingAmount = ethers.parseUnits("100000", 6); // 100,000 USDC

  // Check current balance
  const currentBalance = await InterestVault.balance();
  log(`  Current InterestVault balance: ${ethers.formatUnits(currentBalance, 6)} USDC`);

  if (currentBalance < fundingAmount) {
    // Mint USDC to deployer
    log("  Minting USDC to deployer...");
    const mintTx = await MockUSDC.mint(deployer, fundingAmount);
    await mintTx.wait();
    log(`  ✅ Minted ${ethers.formatUnits(fundingAmount, 6)} USDC`);

    // Approve InterestVault
    log("  Approving InterestVault...");
    const approveTx = await MockUSDC.approve(interestVault.address, fundingAmount);
    await approveTx.wait();
    log("  ✅ Approved");

    // Fund vault via SavingsBank
    log("  Funding InterestVault via SavingsBank...");
    const fundTx = await SavingsBank.fundVault(fundingAmount);
    await fundTx.wait();
    log(`  ✅ InterestVault funded with ${ethers.formatUnits(fundingAmount, 6)} USDC`);
  } else {
    log(`  ℹ️  InterestVault already funded: ${ethers.formatUnits(currentBalance, 6)} USDC`);
  }

  // Step 2: Create saving plans
  log("\n📋 Step 2/2: Creating Saving Plans...");

  const currentNextPlanId = await SavingsBank.nextPlanId();
  log(`  Current nextPlanId: ${currentNextPlanId}`);

  if (currentNextPlanId === 1n) {
    const plans = [
      {
        name: "7 Days",
        durationDays: 7,
        minDeposit: ethers.parseUnits("100", 6),
        maxDeposit: ethers.parseUnits("10000", 6),
        aprBps: 500, // 5% APR
        penaltyBps: 300, // 3% penalty
      },
      {
        name: "30 Days",
        durationDays: 30,
        minDeposit: ethers.parseUnits("500", 6),
        maxDeposit: ethers.parseUnits("50000", 6),
        aprBps: 800, // 8% APR
        penaltyBps: 500, // 5% penalty
      },
      {
        name: "90 Days",
        durationDays: 90,
        minDeposit: ethers.parseUnits("1000", 6),
        maxDeposit: ethers.MaxUint256, // No limit
        aprBps: 1000, // 10% APR
        penaltyBps: 500, // 5% penalty
      },
    ];

    for (const plan of plans) {
      log(`  Creating plan: ${plan.name}...`);
      const tx = await SavingsBank.createPlan(
        plan.name,
        plan.durationDays,
        plan.minDeposit,
        plan.maxDeposit,
        plan.aprBps,
        plan.penaltyBps
      );
      await tx.wait();
      log(`  ✅ ${plan.name}: ${plan.aprBps / 100}% APR, ${plan.penaltyBps / 100}% penalty`);
    }

    log(`\n  📊 Total Plans Created: ${plans.length}`);
  } else {
    log(`  ℹ️  Plans already created. Current nextPlanId: ${currentNextPlanId}`);
  }

  // Display final status
  const finalBalance = await InterestVault.balance();
  const availableBalance = await InterestVault.availableBalance();
  const reservedBalance = await InterestVault.totalReserved();
  const totalPlans = (await SavingsBank.nextPlanId()) - 1n;

  log("\n📊 Final System Status:");
  log(`  InterestVault Balance: ${ethers.formatUnits(finalBalance, 6)} USDC`);
  log(`  Available Balance: ${ethers.formatUnits(availableBalance, 6)} USDC`);
  log(`  Reserved Balance: ${ethers.formatUnits(reservedBalance, 6)} USDC`);
  log(`  Total Plans: ${totalPlans}`);

  log("\n✅ System configuration complete!");
  log("🎉 Ready for users to open deposits!");
  log("");
};

export default configureSystem;
configureSystem.tags = ["Configure", "all"];
configureSystem.dependencies = ["Setup"];
