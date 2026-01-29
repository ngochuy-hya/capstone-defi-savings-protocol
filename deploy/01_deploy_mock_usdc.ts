import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy MockUSDC for testing
 * 
 * Features:
 * - ERC20 with 6 decimals (like real USDC)
 * - Public mint function for easy testing
 */
const deployMockUSDC: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("==========================================");
  log("01: Deploying MockUSDC...");
  log("==========================================");

  const mockUSDC = await deploy("MockUSDC", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  log(`✅ MockUSDC deployed at: ${mockUSDC.address}`);
  log("");
};

export default deployMockUSDC;
deployMockUSDC.tags = ["MockUSDC", "all"];
