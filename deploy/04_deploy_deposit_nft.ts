import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const result = await deploy("MockDepositNFT", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  log("MockDepositNFT:", result.address);
};

export default deploy;
deploy.tags = ["MockDepositNFT", "all"];
