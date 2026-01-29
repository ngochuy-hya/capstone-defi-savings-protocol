import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy SavingsBank (without proxy)
 * 
 * Architecture:
 * - SavingsBank: direct deployment (immutable)
 * - Vaults remain immutable (safe)
 * 
 * Note: Contract is immutable - cannot be upgraded after deployment
 */
const deploySavingsBank: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { log, get, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  log("==========================================");
  log("03: Deploying SavingsBank...");
  log("==========================================");

  // Get deployed addresses
  const mockUSDC = await get("MockUSDC");
  const tokenVault = await get("TokenVault");
  const interestVault = await get("InterestVault");

  log(`Using MockUSDC: ${mockUSDC.address}`);
  log(`Using TokenVault: ${tokenVault.address}`);
  log(`Using InterestVault: ${interestVault.address}`);

  // Deploy MockDepositNFT first (simple mock for testing)
  log("\nDeploying MockDepositNFT...");
  const mockDepositNFT = await deploy("MockDepositNFT", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  log(`✅ MockDepositNFT deployed at: ${mockDepositNFT.address}`);

  // Deploy SavingsBank
  log("\nDeploying SavingsBank...");
  const savingsBank = await deploy("SavingsBank", {
    from: deployer,
    args: [
      mockUSDC.address,
      tokenVault.address,
      interestVault.address,
      mockDepositNFT.address,
    ],
    log: true,
    waitConfirmations: 1,
  });

  log(`✅ SavingsBank deployed at: ${savingsBank.address}`);

  log("\n✅ SavingsBank deployed successfully!");
  log("📝 Note: Contract is IMMUTABLE and cannot be upgraded");
  log("📝 Next: Transfer ownership of vaults & NFT to SavingsBank");
  log("");
};

export default deploySavingsBank;
deploySavingsBank.tags = ["SavingsBank", "all"];
deploySavingsBank.dependencies = ["Vaults"];
