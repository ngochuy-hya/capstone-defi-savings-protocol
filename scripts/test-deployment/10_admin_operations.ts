import { loadContracts, formatUSDC, parseUSDC } from "./helpers";

async function main() {
  console.log("\n🔐 Admin Operations\n");

  const { interestVault, savingsBank, deployer } = await loadContracts();

  const owner = (await savingsBank.owner()).toLowerCase();
  const deployerAddr = deployer.address.toLowerCase();
  const isOwner = owner === deployerAddr;

  if (!isOwner) {
    console.log("⚠️  Deployer is not owner. Owner:", await savingsBank.owner());
    console.log("   Skipping pause/unpause (only owner can call).");
  } else {
    try {
      console.log("Pause...");
      await (await savingsBank.connect(deployer).pause()).wait();
      console.log("✅ Paused");

      await savingsBank.connect(deployer).openDeposit(1, parseUSDC("1000"), false).catch((e: any) => {
        console.log("  openDeposit while paused (expected revert):", (e?.reason ?? e?.message ?? "").slice(0, 60));
      });

      console.log("Unpause...");
      await (await savingsBank.connect(deployer).unpause()).wait();
      console.log("✅ Unpaused");
    } catch (e: any) {
      const msg = e?.reason ?? e?.shortMessage ?? e?.message ?? String(e);
      console.log("⚠️  Pause/unpause failed (maybe not owner or already paused):", msg.slice(0, 80));
    }
  }

  const balance = await interestVault.balance();
  const available = await interestVault.availableBalance();
  console.log("\nVault:");
  console.log("  Balance:", formatUSDC(balance), "USDC");
  console.log("  Available:", formatUSDC(available), "USDC");

  console.log("\n✅ Admin operations test done\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
