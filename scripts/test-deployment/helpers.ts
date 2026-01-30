import { ethers, deployments } from "hardhat";

const DECIMALS = 6;

export function formatUSDC(amount: bigint | number): string {
  return ethers.formatUnits(BigInt(amount), DECIMALS);
}

export function parseUSDC(amount: string): bigint {
  return ethers.parseUnits(amount, DECIMALS);
}

export function formatBps(bps: bigint): string {
  return (Number(bps) / 100).toFixed(2) + "%";
}

export async function fastForward(days: number): Promise<void> {
  const seconds = days * 24 * 60 * 60;
  await (ethers.provider as any).send("evm_increaseTime", [seconds]);
  await (ethers.provider as any).send("evm_mine", []);
  console.log(`⏰ Fast-forwarded ${days} days`);
}

export function isLocalNetwork(): boolean {
  const name = (ethers.provider as any)._network?.name ?? process.env.HARDHAT_NETWORK ?? "";
  return name === "hardhat" || name === "localhost" || name === "undefined";
}

export async function loadContracts(): Promise<{
  usdc: any;
  tokenVault: any;
  interestVault: any;
  depositNFT: any;
  savingsBank: any;
  deployer: any;
  addresses: Record<string, string>;
}> {
  const [deployer] = await ethers.getSigners();
  const MockUSDC = await deployments.get("MockUSDC");
  const TokenVault = await deployments.get("TokenVault");
  const InterestVault = await deployments.get("InterestVault");
  const MockDepositNFT = await deployments.get("MockDepositNFT");
  const SavingsBank = await deployments.get("SavingsBank");

  const usdc = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const tokenVault = await ethers.getContractAt("TokenVault", TokenVault.address);
  const interestVault = await ethers.getContractAt("InterestVault", InterestVault.address);
  const depositNFT = await ethers.getContractAt("MockDepositNFT", MockDepositNFT.address);
  const savingsBank = await ethers.getContractAt("SavingsBank", SavingsBank.address);

  return {
    usdc,
    tokenVault,
    interestVault,
    depositNFT,
    savingsBank,
    deployer,
    addresses: {
      MockUSDC: MockUSDC.address,
      TokenVault: TokenVault.address,
      InterestVault: InterestVault.address,
      MockDepositNFT: MockDepositNFT.address,
      SavingsBank: SavingsBank.address,
    },
  };
}

export const STATUS = ["ACTIVE", "WITHDRAWN", "EARLY_WITHDRAWN", "RENEWED"];
