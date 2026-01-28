import { ethers } from "hardhat";

/**
 * Check Deployer Balance
 * 
 * Verifies that deployer has sufficient ETH for deployment
 * 
 * Usage:
 *   npx hardhat run scripts/helpers/check_balance.ts --network sepolia
 */

async function main() {
  console.log("💰 Checking Deployer Balance...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📝 Network Info:");
  console.log("   Network:", network.name);
  console.log("   Chain ID:", network.chainId);
  console.log("");

  console.log("👤 Deployer:");
  console.log("   Address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceInEth = ethers.formatEther(balance);

  console.log("   Balance:", balanceInEth, "ETH");
  console.log("");

  // Check if sufficient for deployment
  const MINIMUM_BALANCE = ethers.parseEther("0.02"); // 0.02 ETH minimum
  const RECOMMENDED_BALANCE = ethers.parseEther("0.1"); // 0.1 ETH recommended

  if (balance < MINIMUM_BALANCE) {
    console.log("❌ INSUFFICIENT BALANCE");
    console.log("   Minimum required: 0.02 ETH");
    console.log("   Current: " + balanceInEth + " ETH");
    console.log("");
    console.log("🔗 Get Sepolia ETH from faucets:");
    console.log("   1. https://sepoliafaucet.com/ (Alchemy - 0.5 ETH/day)");
    console.log("   2. https://www.infura.io/faucet/sepolia (Infura - 0.5 ETH/day)");
    console.log("   3. https://faucet.quicknode.com/ethereum/sepolia (QuickNode - 0.1 ETH)");
    console.log("");
    process.exit(1);
  } else if (balance < RECOMMENDED_BALANCE) {
    console.log("⚠️  LOW BALANCE");
    console.log("   Recommended: 0.1 ETH");
    console.log("   Current: " + balanceInEth + " ETH");
    console.log("   Status: Can deploy, but may run out");
    console.log("");
  } else {
    console.log("✅ BALANCE OK");
    console.log("   Status: Ready to deploy");
    console.log("");
  }

  // Estimate deployment costs
  console.log("📊 Estimated Deployment Costs:");
  console.log("   MockUSDC deployment: ~0.003 ETH");
  console.log("   SavingsBank deployment: ~0.015 ETH");
  console.log("   Create 4 plans: ~0.004 ETH");
  console.log("   Fund vault: ~0.002 ETH");
  console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Total: ~0.024 ETH");
  console.log("");

  const remaining = balance - ethers.parseEther("0.024");
  console.log("💵 After Deployment:");
  console.log("   Estimated remaining: ~" + ethers.formatEther(remaining) + " ETH");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
