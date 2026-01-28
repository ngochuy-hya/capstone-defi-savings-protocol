import { ethers, deployments } from "hardhat";

/**
 * Script 1: Fund Vault with USDC
 * 
 * METHOD 2: VaultManager chỉ cần funds để trả interest (không cần hold principal)
 * Estimate: ~2-10% of expected TVL
 */
async function main() {
  console.log("\n💰 SCRIPT 1: Fund VaultManager\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Get deployed contracts
  const MockUSDC = await deployments.get("MockUSDC");
  const VaultManager = await deployments.get("VaultManager");
  
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  const vaultManager = await ethers.getContractAt("VaultManager", VaultManager.address);

  console.log("📌 MockUSDC:", await mockUSDC.getAddress());
  console.log("📌 VaultManager:", await vaultManager.getAddress());

  // Check deployer USDC balance
  const deployerBalance = await mockUSDC.balanceOf(deployer.address);
  console.log("\n💵 Deployer USDC balance:", ethers.formatUnits(deployerBalance, 6), "USDC");

  // Fund amount (100,000 USDC for interest pool)
  const fundAmount = ethers.parseUnits("100000", 6);
  console.log("💰 Funding amount:", ethers.formatUnits(fundAmount, 6), "USDC");

  // Approve VaultManager to spend USDC
  console.log("\n⏳ Approving VaultManager...");
  const approveTx = await mockUSDC.approve(await vaultManager.getAddress(), fundAmount);
  await approveTx.wait();
  console.log("✅ Approved");

  // Fund the vault
  console.log("⏳ Funding VaultManager...");
  const fundTx = await vaultManager.fundVault(fundAmount);
  await fundTx.wait();
  console.log("✅ Funded!");

  // Check vault info
  const vaultInfo = await vaultManager.getVaultInfo();
  console.log("\n📊 VaultManager Status:");
  console.log("   Total Balance:", ethers.formatUnits(vaultInfo[0], 6), "USDC");
  console.log("   Reserved Funds:", ethers.formatUnits(vaultInfo[1], 6), "USDC");
  console.log("   Available Funds:", ethers.formatUnits(vaultInfo[2], 6), "USDC");
  console.log("   Health Ratio:", vaultInfo[3].toString(), "bps");
  console.log("   Is Healthy:", vaultInfo[4]);

  console.log("\n✅ VaultManager funded successfully!");
  console.log("💡 Ready for users to open deposits\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
