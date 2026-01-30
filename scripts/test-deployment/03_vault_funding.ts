import { loadContracts, formatUSDC } from "./helpers";

async function main() {
  console.log("\n💰 Vault Funding Test\n");

  const { usdc, interestVault, savingsBank, deployer } = await loadContracts();

  const balanceBefore = await interestVault.balance();
  const reservedBefore = await interestVault.totalReserved();
  const availableBefore = await interestVault.availableBalance();

  console.log("Before:");
  console.log("  Balance:", formatUSDC(balanceBefore), "USDC");
  console.log("  Reserved:", formatUSDC(reservedBefore), "USDC");
  console.log("  Available:", formatUSDC(availableBefore), "USDC");

  const fundAmount = 50_000n * 10n ** 6n;
  const deployerBalance = await usdc.balanceOf(deployer.address);
  if (deployerBalance < fundAmount) {
    await (await usdc.mint(deployer.address, fundAmount)).wait();
  }
  await (await usdc.connect(deployer).approve(await interestVault.getAddress(), fundAmount)).wait();
  await (await savingsBank.connect(deployer).fundVault(fundAmount)).wait();

  const balanceAfter = await interestVault.balance();
  const availableAfter = await interestVault.availableBalance();

  console.log("\nFunding 50,000 USDC...");
  console.log("✅ Transaction successful!");
  console.log("\nAfter:");
  console.log("  Balance:", formatUSDC(balanceAfter), "USDC");
  console.log("  Available:", formatUSDC(availableAfter), "USDC");
  console.log("\n✅ Vault funding test done\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
