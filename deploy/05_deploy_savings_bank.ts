import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const usdc = await get("MockUSDC");
  const tokenVault = await get("TokenVault");
  const interestVault = await get("InterestVault");
  const depositNFT = await get("MockDepositNFT");

  const result = await deploy("SavingsBank", {
    from: deployer,
    args: [usdc.address, tokenVault.address, interestVault.address, depositNFT.address],
    log: true,
    waitConfirmations: 1,
  });
  log("SavingsBank:", result.address);
};

export default deploy;
deploy.tags = ["SavingsBank", "all"];
deploy.dependencies = ["TokenVault", "InterestVault", "MockDepositNFT"];
