import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploy MockUSDC contract
 * 
 * This script deploys a mock USDC token for testing purposes.
 * On mainnet, you would use the actual USDC contract address.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n🚀 Deploying MockUSDC...");
  console.log("📝 Deploying from account:", deployer);

  const mockUSDC = await deploy("MockUSDC", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log("✅ MockUSDC deployed to:", mockUSDC.address);

  // Verify contract properties
  const MockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDC.address);
  const name = await MockUSDC.name();
  const symbol = await MockUSDC.symbol();
  const decimals = await MockUSDC.decimals();

  console.log("\n📊 MockUSDC Properties:");
  console.log("   Name:", name);
  console.log("   Symbol:", symbol);
  console.log("   Decimals:", decimals);

  // Mint initial supply for deployer (1M USDC)
  const initialMintAmount = hre.ethers.parseUnits("1000000", 6);
  console.log("\n💰 Minting initial supply for deployer...");
  const mintTx = await MockUSDC.mint(deployer, initialMintAmount);
  await mintTx.wait();
  console.log("✅ Minted:", hre.ethers.formatUnits(initialMintAmount, 6), "USDC");

  const deployerBalance = await MockUSDC.balanceOf(deployer);
  console.log("   Deployer balance:", hre.ethers.formatUnits(deployerBalance, 6), "USDC");

  console.log("\n✅ MockUSDC deployment complete\n");

  return true;
};

export default func;
func.id = "deploy_mock_usdc";
func.tags = ["MockUSDC", "01"];
