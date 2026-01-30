import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const usdc = await get("MockUSDC");
  const result = await deploy("TokenVault", {
    from: deployer,
    args: [usdc.address],
    log: true,
    waitConfirmations: 1,
  });
  log("TokenVault:", result.address);
};

export default deploy;
deploy.tags = ["TokenVault", "all"];
deploy.dependencies = ["MockUSDC"];
