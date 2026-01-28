import { ethers, deployments } from "hardhat";

/**
 * Script 2: Create Saving Plans
 * 
 * Creates 4 saving plans with different tenors and APRs
 */
async function main() {
  console.log("\n📋 SCRIPT 2: Create Saving Plans\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  const SavingsBank = await deployments.get("SavingsBank");
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);
  console.log("📌 SavingsBank:", await savingsBank.getAddress());

  // Check if plans already exist
  const nextPlanId = await savingsBank.nextPlanId();
  console.log("\n📊 Current nextPlanId:", nextPlanId.toString());

  if (nextPlanId > 1n) {
    console.log("ℹ️  Plans already exist. Displaying existing plans...\n");
    for (let i = 1; i < Number(nextPlanId); i++) {
      const plan = await savingsBank.getPlan(i);
      console.log(`\n📋 Plan ${i}:`);
      console.log("   Tenor:", plan.tenorDays.toString(), "days");
      console.log("   APR:", Number(plan.aprBps) / 100, "%");
      console.log("   Min Deposit:", ethers.formatUnits(plan.minDeposit, 6), "USDC");
      console.log("   Max Deposit:", plan.maxDeposit === 0n ? "No limit" : ethers.formatUnits(plan.maxDeposit, 6) + " USDC");
      console.log("   Early Penalty:", Number(plan.earlyWithdrawPenaltyBps) / 100, "%");
      console.log("   Enabled:", plan.enabled);
    }
    return;
  }

  // Plan configurations
  const plans = [
    {
      name: "7-Day Plan",
      tenorDays: 7,
      aprBps: 500, // 5%
      minDeposit: ethers.parseUnits("100", 6),
      maxDeposit: ethers.parseUnits("10000", 6),
      penaltyBps: 300, // 3%
    },
    {
      name: "30-Day Plan",
      tenorDays: 30,
      aprBps: 800, // 8%
      minDeposit: ethers.parseUnits("500", 6),
      maxDeposit: ethers.parseUnits("50000", 6),
      penaltyBps: 500, // 5%
    },
    {
      name: "90-Day Plan",
      tenorDays: 90,
      aprBps: 1000, // 10%
      minDeposit: ethers.parseUnits("1000", 6),
      maxDeposit: 0, // No limit
      penaltyBps: 700, // 7%
    },
    {
      name: "180-Day Plan",
      tenorDays: 180,
      aprBps: 1200, // 12%
      minDeposit: ethers.parseUnits("2000", 6),
      maxDeposit: 0, // No limit
      penaltyBps: 1000, // 10%
    },
  ];

  console.log("\n⏳ Creating saving plans...\n");

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    console.log(`📋 Creating ${plan.name}...`);
    console.log(`   Tenor: ${plan.tenorDays} days`);
    console.log(`   APR: ${plan.aprBps / 100}%`);
    console.log(`   Min: ${ethers.formatUnits(plan.minDeposit, 6)} USDC`);
    console.log(`   Max: ${plan.maxDeposit === 0 ? "No limit" : ethers.formatUnits(plan.maxDeposit, 6) + " USDC"}`);
    console.log(`   Penalty: ${plan.penaltyBps / 100}%`);

    const tx = await savingsBank.createPlan(
      plan.tenorDays,
      plan.aprBps,
      plan.minDeposit,
      plan.maxDeposit,
      plan.penaltyBps
    );
    const receipt = await tx.wait();
    console.log(`✅ Created! (Plan ID: ${i + 1})\n`);
  }

  // Verify plans
  console.log("📊 Verifying created plans...\n");
  for (let i = 1; i <= plans.length; i++) {
    const plan = await savingsBank.getPlan(i);
    console.log(`Plan ${i}:`, plan.tenorDays.toString(), "days @", Number(plan.aprBps) / 100, "% APR");
  }

  console.log("\n✅ All saving plans created successfully!");
  console.log("💡 Users can now open deposits\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
