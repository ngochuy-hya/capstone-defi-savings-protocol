import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const FUND_AMOUNT = "100000"; // 100k USDC (6 decimals)

const plans = [
  { name: "7 Days", durationDays: 7, minDeposit: "100", maxDeposit: "10000", aprBps: 500, penaltyBps: 300 },
  { name: "30 Days", durationDays: 30, minDeposit: "500", maxDeposit: "50000", aprBps: 800, penaltyBps: 500 },
  { name: "90 Days", durationDays: 90, minDeposit: "1000", maxDeposit: "100000000", aprBps: 1000, penaltyBps: 500 },
];

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hre;
  const { get, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const mockUSDC = await get("MockUSDC");
  const interestVault = await get("InterestVault");
  const savingsBank = await get("SavingsBank");

  const USDC = await ethers.getContractAt("MockUSDC", mockUSDC.address);
  const SavingsBank = await ethers.getContractAt("SavingsBank", savingsBank.address);

  const fundAmountWei = ethers.parseUnits(FUND_AMOUNT, 6);
  const vaultBalance = await (await ethers.getContractAt("InterestVault", interestVault.address)).balance();

  if (vaultBalance < fundAmountWei) {
    await (await USDC.mint(deployer, fundAmountWei)).wait();
    await (await USDC.approve(interestVault.address, fundAmountWei)).wait();
    await (await SavingsBank.fundVault(fundAmountWei)).wait();
    log(`07: InterestVault funded ${FUND_AMOUNT} USDC`);
  } else {
    log("07: InterestVault already funded");
  }

  const nextPlanId = await SavingsBank.nextPlanId();
  if (nextPlanId === 1n) {
    for (const p of plans) {
      await (
        await SavingsBank.createPlan(
          p.name,
          p.durationDays,
          ethers.parseUnits(p.minDeposit, 6),
          ethers.parseUnits(p.maxDeposit, 6),
          p.aprBps,
          p.penaltyBps
        )
      ).wait();
      log(`07: Plan created: ${p.name}`);
    }
    log("07 Configure system: done");
  } else {
    log("07: Plans already exist, skip");
  }
};

export default deploy;
deploy.tags = ["Configure", "all"];
deploy.dependencies = ["Setup"];
