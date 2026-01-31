/**
 * Fund InterestVault with USDC
 * Usage: npx hardhat run scripts/helpers/fund_vault.ts --network localhost
 */

import { ethers } from "hardhat";
import { parseUSDC, formatUSDC } from "./formatters";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Funding InterestVault...");
  console.log("Admin:", deployer.address);
  
  // Get contracts
  const savingsBankAddr = "0x3B6e54bb5B36a89838435EC504cE78B3B7Fd29DC";
  const usdcAddr = "0xF38A9Ed7840aB6eef41DF9d88b19fFf7443AA656";
  const interestVaultAddr = "0x5a17868C3d6E1d3f19Ea56c483eA10aE5050051F";
  
  const SavingsBank = await ethers.getContractAt("SavingsBank", savingsBankAddr);
  const USDC = await ethers.getContractAt("MockUSDC", usdcAddr);
  const InterestVault = await ethers.getContractAt("InterestVault", interestVaultAddr);
  
  // Check current balance
  const currentBalance = await InterestVault.balance();
  const totalReserved = await InterestVault.totalReserved();
  const availableBalance = await InterestVault.availableBalance();
  
  console.log("\n=== Current Status ===");
  console.log("Total Balance:", formatUSDC(currentBalance));
  console.log("Total Reserved:", formatUSDC(totalReserved));
  console.log("Available Balance:", formatUSDC(availableBalance));
  
  // Fund amount
  const fundAmount = parseUSDC("1000"); // Fund 1000 USDC
  
  console.log("\n=== Funding ===");
  console.log("Amount to fund:", formatUSDC(fundAmount));
  
  // Check admin USDC balance
  const adminBalance = await USDC.balanceOf(deployer.address);
  console.log("Admin USDC balance:", formatUSDC(adminBalance));
  
  if (adminBalance < fundAmount) {
    console.log("\n❌ Admin doesn't have enough USDC!");
    console.log("Minting USDC to admin...");
    const mintTx = await USDC.mint(deployer.address, fundAmount);
    await mintTx.wait();
    console.log("✅ Minted", formatUSDC(fundAmount), "USDC to admin");
  }
  
  // Approve
  console.log("\nApproving USDC...");
  const approveTx = await USDC.approve(interestVaultAddr, fundAmount);
  await approveTx.wait();
  console.log("✅ Approved");
  
  // Fund vault
  console.log("\nFunding vault...");
  const fundTx = await SavingsBank.fundVault(fundAmount);
  await fundTx.wait();
  console.log("✅ Funded!");
  
  // Check new balance
  const newBalance = await InterestVault.balance();
  const newAvailable = await InterestVault.availableBalance();
  
  console.log("\n=== New Status ===");
  console.log("Total Balance:", formatUSDC(newBalance));
  console.log("Available Balance:", formatUSDC(newAvailable));
  console.log("\n✅ Done! Vault is funded with", formatUSDC(fundAmount), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
