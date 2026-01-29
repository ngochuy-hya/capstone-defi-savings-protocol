import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Setup Ownership:
 * Transfer ownership of vaults and NFT to SavingsBank
 * 
 * This is critical for security:
 * - Only SavingsBank can control the vaults
 * - Only SavingsBank can mint/burn NFTs
 */
const setupOwnership: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { log, get } = deployments;

  log("==========================================");
  log("04: Setting up Ownership...");
  log("==========================================");

  // Get deployed contracts
  const savingsBank = await get("SavingsBank");
  const tokenVault = await get("TokenVault");
  const interestVault = await get("InterestVault");
  const mockDepositNFT = await get("MockDepositNFT");

  log(`SavingsBank: ${savingsBank.address}`);
  log(`TokenVault: ${tokenVault.address}`);
  log(`InterestVault: ${interestVault.address}`);
  log(`MockDepositNFT: ${mockDepositNFT.address}`);

  // Get contract instances
  const TokenVault = await ethers.getContractAt("TokenVault", tokenVault.address);
  const InterestVault = await ethers.getContractAt("InterestVault", interestVault.address);
  const MockDepositNFT = await ethers.getContractAt("MockDepositNFT", mockDepositNFT.address);

  // Check current ownership
  const tokenVaultOwner = await TokenVault.owner();
  const interestVaultOwner = await InterestVault.owner();
  const nftOwner = await MockDepositNFT.owner();

  log("\nCurrent Ownership:");
  log(`  TokenVault owner: ${tokenVaultOwner}`);
  log(`  InterestVault owner: ${interestVaultOwner}`);
  log(`  MockDepositNFT owner: ${nftOwner}`);

  // Transfer ownership if not already transferred
  log("\nTransferring ownership to SavingsBank...");

  if (tokenVaultOwner !== savingsBank.address) {
    log("  Transferring TokenVault ownership...");
    const tx1 = await TokenVault.transferOwnership(savingsBank.address);
    await tx1.wait();
    log("  ✅ TokenVault ownership transferred");
  } else {
    log("  ℹ️  TokenVault already owned by SavingsBank");
  }

  if (interestVaultOwner !== savingsBank.address) {
    log("  Transferring InterestVault ownership...");
    const tx2 = await InterestVault.transferOwnership(savingsBank.address);
    await tx2.wait();
    log("  ✅ InterestVault ownership transferred");
  } else {
    log("  ℹ️  InterestVault already owned by SavingsBank");
  }

  if (nftOwner !== savingsBank.address) {
    log("  Transferring MockDepositNFT ownership...");
    const tx3 = await MockDepositNFT.transferOwnership(savingsBank.address);
    await tx3.wait();
    log("  ✅ MockDepositNFT ownership transferred");
  } else {
    log("  ℹ️  MockDepositNFT already owned by SavingsBank");
  }

  // Verify final ownership
  const finalTokenVaultOwner = await TokenVault.owner();
  const finalInterestVaultOwner = await InterestVault.owner();
  const finalNFTOwner = await MockDepositNFT.owner();

  log("\nFinal Ownership:");
  log(`  TokenVault owner: ${finalTokenVaultOwner}`);
  log(`  InterestVault owner: ${finalInterestVaultOwner}`);
  log(`  MockDepositNFT owner: ${finalNFTOwner}`);

  if (
    finalTokenVaultOwner === savingsBank.address &&
    finalInterestVaultOwner === savingsBank.address &&
    finalNFTOwner === savingsBank.address
  ) {
    log("\n✅ All ownership transfers complete!");
    log("📝 SavingsBank now controls all vaults and NFT contract");
  } else {
    log("\n⚠️  Warning: Some ownership transfers may have failed");
  }

  log("");
};

export default setupOwnership;
setupOwnership.tags = ["Setup", "all"];
setupOwnership.dependencies = ["SavingsBank"];
