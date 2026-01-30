import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { get, log } = deployments;

  const savingsBank = await get("SavingsBank");
  const tokenVault = await get("TokenVault");
  const interestVault = await get("InterestVault");
  const depositNFT = await get("MockDepositNFT");

  const TokenVault = await ethers.getContractAt("TokenVault", tokenVault.address);
  const InterestVault = await ethers.getContractAt("InterestVault", interestVault.address);
  const DepositNFT = await ethers.getContractAt("MockDepositNFT", depositNFT.address);

  if ((await TokenVault.owner()) !== savingsBank.address) {
    await (await TokenVault.transferOwnership(savingsBank.address)).wait();
    log("06: TokenVault ownership -> SavingsBank");
  }
  if ((await InterestVault.owner()) !== savingsBank.address) {
    await (await InterestVault.transferOwnership(savingsBank.address)).wait();
    log("06: InterestVault ownership -> SavingsBank");
  }
  if ((await DepositNFT.owner()) !== savingsBank.address) {
    await (await DepositNFT.transferOwnership(savingsBank.address)).wait();
    log("06: MockDepositNFT ownership -> SavingsBank");
  }
  log("06 Setup ownership: done");
};

export default deploy;
deploy.tags = ["Setup", "all"];
deploy.dependencies = ["SavingsBank"];
