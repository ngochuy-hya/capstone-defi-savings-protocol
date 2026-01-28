import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy SavingsBank contract and link it with VaultManager
 * 
 * This is the main contract for the DeFi savings protocol.
 * It manages savings plans, deposits, and withdrawals.
 * 
 * Dependencies: MockUSDC, VaultManager
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("\n🚀 Deploying SavingsBank...");
    console.log("📝 Deploying from account:", deployer);

    // Get deployed contract addresses
    const mockUSDC = await get("MockUSDC");
    const vaultManager = await get("VaultManager");

    console.log("📌 Using MockUSDC at:", mockUSDC.address);
    console.log("📌 Using VaultManager at:", vaultManager.address);

    // Deploy SavingsBank
    // Constructor parameters:
    // - _depositToken: MockUSDC address
    // - _vaultManager: VaultManager address
    // - _feeReceiver: deployer address (receives early withdrawal penalties)
    // - _admin: deployer address (admin role)
    const savingsBank = await deploy("SavingsBank", {
        from: deployer,
        args: [
            mockUSDC.address,      // _depositToken
            vaultManager.address,  // _vaultManager
            deployer,               // _feeReceiver
            deployer                // _admin
        ],
        log: true,
        autoMine: true,
    });

    console.log("✅ SavingsBank deployed to:", savingsBank.address);

    // Link VaultManager to SavingsBank
    console.log("\n🔗 Linking VaultManager to SavingsBank...");
    const VaultManager = await hre.ethers.getContractAt("VaultManager", vaultManager.address);

    // Check if already linked
    const currentSavingsBank = await VaultManager.savingsBank();
    if (currentSavingsBank === hre.ethers.ZeroAddress) {
        const tx = await VaultManager.setSavingsBank(savingsBank.address);
        await tx.wait();
        console.log("✅ VaultManager linked to SavingsBank");
    } else {
        console.log("ℹ️  VaultManager already linked to:", currentSavingsBank);
    }

    // Display SavingsBank info
    const SavingsBank = await hre.ethers.getContractAt("SavingsBank", savingsBank.address);
    console.log("\n📊 SavingsBank Properties:");
    console.log("   Deposit Token:", await SavingsBank.depositToken());
    console.log("   VaultManager:", await SavingsBank.vaultManager());
    console.log("   Fee Receiver:", await SavingsBank.feeReceiver());
    console.log("   Next Plan ID:", (await SavingsBank.nextPlanId()).toString());
    console.log("   Next Deposit ID:", (await SavingsBank.nextDepositId()).toString());

    console.log("\n💡 Next Steps:");
    console.log("1. Fund VaultManager:");
    console.log("   await mockUSDC.approve(vaultManager.address, amount)");
    console.log("   await vaultManager.fundVault(amount)");
    console.log("");
    console.log("2. Create saving plans:");
    console.log("   await savingsBank.createPlan(tenorDays, aprBps, minDeposit, maxDeposit, penaltyBps)");
    console.log("");
    console.log("3. Users can now open deposits!");

    console.log("\n✅ SavingsBank deployment complete\n");

    return true;
};

export default func;
func.id = "deploy_savings_bank";
func.tags = ["SavingsBank", "03"];
func.dependencies = ["MockUSDC", "VaultManager"];
