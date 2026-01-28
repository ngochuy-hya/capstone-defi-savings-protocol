import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy VaultManager contract
 * 
 * This contract manages the liquidity vault for the SavingsBank.
 * It handles fund reserves, health monitoring, and transfers.
 * 
 * Dependencies: MockUSDC
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("\n🚀 Deploying VaultManager...");
    console.log("📝 Deploying from account:", deployer);

    // Get MockUSDC address from previous deployment
    const mockUSDC = await get("MockUSDC");
    console.log("📌 Using MockUSDC at:", mockUSDC.address);

    // Deploy VaultManager
    // Constructor parameters:
    // - _depositToken: MockUSDC address
    // - _feeReceiver: deployer address (can be changed later)
    // - _minHealthRatioBps: 12000 = 120% (vault must have 120% of reserved funds)
    const vaultManager = await deploy("VaultManager", {
        from: deployer,
        args: [
            mockUSDC.address,  // _depositToken
            deployer,           // _feeReceiver
            12000               // _minHealthRatioBps (120%)
        ],
        log: true,
        autoMine: true,
    });

    console.log("✅ VaultManager deployed to:", vaultManager.address);

    // Get contract instance
    const VaultManager = await hre.ethers.getContractAt("VaultManager", vaultManager.address);

    // Display vault info
    const info = await VaultManager.getVaultInfo();
    console.log("\n📊 VaultManager Properties:");
    console.log("   Deposit Token:", mockUSDC.address);
    console.log("   Fee Receiver:", await VaultManager.feeReceiver());
    console.log("   Min Health Ratio:", (await VaultManager.minHealthRatioBps()).toString(), "bps (120%)");
    console.log("   Total Balance:", hre.ethers.formatUnits(info[0], 6), "USDC");
    console.log("   Reserved Funds:", hre.ethers.formatUnits(info[1], 6), "USDC");
    console.log("   Available Funds:", hre.ethers.formatUnits(info[2], 6), "USDC");

    console.log("\n💡 Next Step: Fund the vault using VaultManager.fundVault()");
    console.log("   Example: await vaultManager.fundVault(parseUnits('100000', 6))");

    console.log("\n✅ VaultManager deployment complete\n");

    return true;
};

export default func;
func.id = "deploy_vault_manager";
func.tags = ["VaultManager", "02"];
func.dependencies = ["MockUSDC"];
