import { ethers, deployments } from "hardhat";

/**
 * Mint Test Tokens
 * 
 * Mints MockUSDC for test accounts
 */

// Test Account Addresses
const DEPLOYER_ADDRESS = "0x7Fd5E1B5954B00027cA0C2FC152449411089BF1d";
const USER1_ADDRESS = "0x19b790aac5BC48Bc162A98bC199CA84fA75CEb04";
const USER2_ADDRESS = "0x9610138d37A061b29b5f1c0793f385bD1b799Eac";

// Mint Amounts
const DEPLOYER_MINT_AMOUNT = ethers.parseUnits("100000", 6); // 100,000 USDC
const USER_MINT_AMOUNT = ethers.parseUnits("50000", 6);      // 50,000 USDC

async function main() {
  console.log("\n💰 Minting Test Tokens\n");
  console.log("=" .repeat(60));

  const [deployer] = await ethers.getSigners();

  console.log("📝 Test Accounts:");
  console.log("   Deployer:", DEPLOYER_ADDRESS);
  console.log("   User 1:", USER1_ADDRESS);
  console.log("   User 2:", USER2_ADDRESS);

  // Get MockUSDC contract
  const MockUSDC = await deployments.get("MockUSDC");
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);
  
  console.log("\n📌 MockUSDC:", await mockUSDC.getAddress());

  // Check ETH balances first
  console.log("\n💎 ETH Balances:");
  
  const deployerEthBalance = await ethers.provider.getBalance(DEPLOYER_ADDRESS);
  console.log("   Deployer:", ethers.formatEther(deployerEthBalance), "ETH");
  
  const user1EthBalance = await ethers.provider.getBalance(USER1_ADDRESS);
  console.log("   User 1:", ethers.formatEther(user1EthBalance), "ETH");
  if (user1EthBalance < ethers.parseEther("0.01")) {
    console.log("   ⚠️  User 1 needs more ETH! Get from https://sepoliafaucet.com/");
  }
  
  const user2EthBalance = await ethers.provider.getBalance(USER2_ADDRESS);
  console.log("   User 2:", ethers.formatEther(user2EthBalance), "ETH");
  if (user2EthBalance < ethers.parseEther("0.01")) {
    console.log("   ⚠️  User 2 needs more ETH! Get from https://sepoliafaucet.com/");
  }

  console.log("\n💵 Minting USDC...");

  // Mint for deployer
  console.log("\n1️⃣  Minting for Deployer...");
  const currentDeployerBalance = await mockUSDC.balanceOf(DEPLOYER_ADDRESS);
  console.log("   Current balance:", ethers.formatUnits(currentDeployerBalance, 6), "USDC");
  
  const tx1 = await mockUSDC.mint(DEPLOYER_ADDRESS, DEPLOYER_MINT_AMOUNT);
  await tx1.wait();
  
  const newDeployerBalance = await mockUSDC.balanceOf(DEPLOYER_ADDRESS);
  console.log("   ✅ Minted:", ethers.formatUnits(DEPLOYER_MINT_AMOUNT, 6), "USDC");
  console.log("   New balance:", ethers.formatUnits(newDeployerBalance, 6), "USDC");

  // Mint for user1
  console.log("\n2️⃣  Minting for User 1...");
  const currentUser1Balance = await mockUSDC.balanceOf(USER1_ADDRESS);
  console.log("   Current balance:", ethers.formatUnits(currentUser1Balance, 6), "USDC");
  
  const tx2 = await mockUSDC.mint(USER1_ADDRESS, USER_MINT_AMOUNT);
  await tx2.wait();
  
  const newUser1Balance = await mockUSDC.balanceOf(USER1_ADDRESS);
  console.log("   ✅ Minted:", ethers.formatUnits(USER_MINT_AMOUNT, 6), "USDC");
  console.log("   New balance:", ethers.formatUnits(newUser1Balance, 6), "USDC");

  // Mint for user2
  console.log("\n3️⃣  Minting for User 2...");
  const currentUser2Balance = await mockUSDC.balanceOf(USER2_ADDRESS);
  console.log("   Current balance:", ethers.formatUnits(currentUser2Balance, 6), "USDC");
  
  const tx3 = await mockUSDC.mint(USER2_ADDRESS, USER_MINT_AMOUNT);
  await tx3.wait();
  
  const newUser2Balance = await mockUSDC.balanceOf(USER2_ADDRESS);
  console.log("   ✅ Minted:", ethers.formatUnits(USER_MINT_AMOUNT, 6), "USDC");
  console.log("   New balance:", ethers.formatUnits(newUser2Balance, 6), "USDC");

  // Final summary
  console.log("\n" + "=" .repeat(60));
  console.log("✅ Minting Complete!");
  console.log("=" .repeat(60));

  console.log("\n📊 Final USDC Balances:");
  const finalDeployerBalance = await mockUSDC.balanceOf(DEPLOYER_ADDRESS);
  const finalUser1Balance = await mockUSDC.balanceOf(USER1_ADDRESS);
  const finalUser2Balance = await mockUSDC.balanceOf(USER2_ADDRESS);
  
  console.log("   Deployer:", ethers.formatUnits(finalDeployerBalance, 6), "USDC");
  console.log("   User 1:", ethers.formatUnits(finalUser1Balance, 6), "USDC");
  console.log("   User 2:", ethers.formatUnits(finalUser2Balance, 6), "USDC");

  console.log("\n🎉 Ready to test deposits!");
  console.log("\n💡 Next step:");
  console.log("   npx hardhat run scripts/03_open_deposit.ts --network sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
