import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Script 00: One-Click Deploy & Setup
 * 
 * Deploys contracts and runs initial setup in one go
 */
async function main() {
  console.log("\n🚀 ONE-CLICK DEPLOY & SETUP\n");
  console.log("=" .repeat(60));
  console.log("This script will:");
  console.log("1. Deploy all contracts (MockUSDC, VaultManager, SavingsBank)");
  console.log("2. Fund VaultManager with 100,000 USDC");
  console.log("3. Create 4 saving plans");
  console.log("4. Run health check");
  console.log("=" .repeat(60) + "\n");

  try {
    // Step 1: Deploy contracts
    console.log("📦 STEP 1: Deploying contracts...\n");
    const { stdout: deployOutput } = await execAsync("npx hardhat deploy");
    console.log(deployOutput);
    console.log("✅ Contracts deployed!\n");

    // Step 2: Fund vault
    console.log("💰 STEP 2: Funding VaultManager...\n");
    const { stdout: fundOutput } = await execAsync("npx hardhat run scripts/01_fund_vault.ts");
    console.log(fundOutput);

    // Step 3: Create plans
    console.log("📋 STEP 3: Creating saving plans...\n");
    const { stdout: plansOutput } = await execAsync("npx hardhat run scripts/02_create_plans.ts");
    console.log(plansOutput);

    // Step 4: Health check
    console.log("🏥 STEP 4: Running health check...\n");
    const { stdout: healthOutput } = await execAsync("npx hardhat run scripts/08_check_vault_health.ts");
    console.log(healthOutput);

    console.log("\n" + "=" .repeat(60));
    console.log("✅ SETUP COMPLETE!");
    console.log("=" .repeat(60));
    console.log("\n💡 Next Steps:");
    console.log("1. Open a deposit:");
    console.log("   npx hardhat run scripts/03_open_deposit.ts");
    console.log("");
    console.log("2. Or run complete test suite:");
    console.log("   npx hardhat run scripts/09_full_test_suite.ts");
    console.log("");
    console.log("3. Check vault health anytime:");
    console.log("   npx hardhat run scripts/08_check_vault_health.ts\n");

  } catch (error: any) {
    console.error("\n❌ Error during setup:", error.message);
    console.error("\nPlease run scripts manually:");
    console.error("1. npx hardhat deploy");
    console.error("2. npx hardhat run scripts/01_fund_vault.ts");
    console.error("3. npx hardhat run scripts/02_create_plans.ts");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
