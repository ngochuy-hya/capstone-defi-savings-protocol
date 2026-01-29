import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy TokenVault and InterestVault (IMMUTABLE)
 * 
 * TokenVault: Holds user principal deposits
 * InterestVault: Holds admin-funded liquidity for interest + collects penalties
 * 
 * These vaults are simple "dumb" contracts that only store tokens.
 * They will NEVER be upgraded - this is intentional for security.
 */
const deployVaults: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  log("==========================================");
  log("02: Deploying Vaults (TokenVault & InterestVault)...");
  log("==========================================");

  // Get MockUSDC address
  const mockUSDC = await get("MockUSDC");
  log(`Using MockUSDC at: ${mockUSDC.address}`);

  // Deploy TokenVault (for principal)
  log("\nDeploying TokenVault...");
  const tokenVault = await deploy("TokenVault", {
    from: deployer,
    args: [mockUSDC.address],
    log: true,
    waitConfirmations: 1,
  });
  log(`✅ TokenVault deployed at: ${tokenVault.address}`);

  // Deploy InterestVault (for interest + penalties)
  log("\nDeploying InterestVault...");
  const interestVault = await deploy("InterestVault", {
    from: deployer,
    args: [mockUSDC.address],
    log: true,
    waitConfirmations: 1,
  });
  log(`✅ InterestVault deployed at: ${interestVault.address}`);

  log("\n✅ Both vaults deployed successfully!");
  log("📝 Note: These vaults are IMMUTABLE and will never be upgraded.");
  log("📝 Ownership will be transferred to SavingsBank in next step.");
  log("");
};

export default deployVaults;
deployVaults.tags = ["Vaults", "all"];
deployVaults.dependencies = ["MockUSDC"];
