import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Setup post-deployment:
 * 1. Fund VaultManager with USDC
 * 2. Create saving plans
 * 
 * Dependencies: MockUSDC, VaultManager, SavingsBank
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("\n🔧 Post-Deployment Setup...");
    console.log("📝 Setup from account:", deployer);

    // Get deployed contracts
    const mockUSDC = await get("MockUSDC");
    const vaultManager = await get("VaultManager");
    const savingsBank = await get("SavingsBank");

    const MockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDC.address);
    const VaultManager = await hre.ethers.getContractAt("VaultManager", vaultManager.address);
    const SavingsBank = await hre.ethers.getContractAt("SavingsBank", savingsBank.address);

    // Step 1: Fund VaultManager with USDC for interest payments
    console.log("\n💰 Step 1/2: Funding VaultManager...");
    const fundingAmount = hre.ethers.parseUnits("100000", 6); // 100,000 USDC

    // Check if vault already funded
    const vaultInfo = await VaultManager.getVaultInfo();
    const currentBalance = vaultInfo[0];

    if (currentBalance < fundingAmount) {
        // Mint USDC to deployer
        console.log("   Minting USDC to deployer...");
        const mintTx = await MockUSDC.mint(deployer, fundingAmount);
        await mintTx.wait();
        console.log("   ✅ Minted", hre.ethers.formatUnits(fundingAmount, 6), "USDC");

        // Approve VaultManager
        console.log("   Approving VaultManager...");
        const approveTx = await MockUSDC.approve(vaultManager.address, fundingAmount);
        await approveTx.wait();
        console.log("   ✅ Approved");

        // Fund vault
        console.log("   Funding vault...");
        const fundTx = await VaultManager.fundVault(fundingAmount);
        await fundTx.wait();
        console.log("   ✅ VaultManager funded with", hre.ethers.formatUnits(fundingAmount, 6), "USDC");
    } else {
        console.log("   ℹ️  VaultManager already funded:", hre.ethers.formatUnits(currentBalance, 6), "USDC");
    }

    // Step 2: Create saving plans
    console.log("\n📋 Step 2/2: Creating Saving Plans...");

    const currentNextPlanId = await SavingsBank.nextPlanId();

    if (currentNextPlanId === 1n) {
        const plans = [
            { name: "7 Days", tenorDays: 7, aprBps: 500, minDeposit: 100, maxDeposit: 100000, penalty: 200 },  // 5% APR, 2% penalty
            { name: "30 Days", tenorDays: 30, aprBps: 800, minDeposit: 100, maxDeposit: 100000, penalty: 300 },  // 8% APR, 3% penalty
            { name: "90 Days", tenorDays: 90, aprBps: 1200, minDeposit: 100, maxDeposit: 100000, penalty: 500 },  // 12% APR, 5% penalty
            { name: "180 Days", tenorDays: 180, aprBps: 1500, minDeposit: 100, maxDeposit: 100000, penalty: 800 },  // 15% APR, 8% penalty
        ];

        for (const plan of plans) {
            const tx = await SavingsBank.createPlan(
                plan.tenorDays,
                plan.aprBps,
                hre.ethers.parseUnits(plan.minDeposit.toString(), 6),
                hre.ethers.parseUnits(plan.maxDeposit.toString(), 6),
                plan.penalty
            );
            await tx.wait();
            console.log(`   ✅ Created ${plan.name} (${plan.aprBps / 100}% APR, ${plan.penalty / 100}% penalty)`);
        }

        console.log(`\n   📊 Total Plans Created: ${plans.length}`);
    } else {
        console.log("   ℹ️  Plans already created. Current nextPlanId:", currentNextPlanId.toString());
    }

    // Display final status
    const finalVaultInfo = await VaultManager.getVaultInfo();
    console.log("\n📊 Final Status:");
    console.log("   VaultManager Balance:", hre.ethers.formatUnits(finalVaultInfo[0], 6), "USDC");
    console.log("   Reserved Funds:", hre.ethers.formatUnits(finalVaultInfo[1], 6), "USDC");
    console.log("   Available Funds:", hre.ethers.formatUnits(finalVaultInfo[2], 6), "USDC");
    console.log("   Total Plans:", (await SavingsBank.nextPlanId() - 1n).toString());

    console.log("\n✅ Post-deployment setup complete!");
    console.log("🎉 Ready for users to open deposits!\n");

    return true;
};

export default func;
func.id = "post_deployment_setup";
func.tags = ["Setup", "04"];
func.dependencies = ["MockUSDC", "VaultManager", "SavingsBank"];
