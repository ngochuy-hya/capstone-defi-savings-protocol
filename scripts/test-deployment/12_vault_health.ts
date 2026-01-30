import { loadContracts, formatUSDC } from "./helpers";

async function main() {
  console.log("\n🏥 Vault Health\n");

  const { tokenVault, interestVault, savingsBank } = await loadContracts();

  const ivBalance = await interestVault.balance();
  const ivReserved = await interestVault.totalReserved();
  const ivAvailable = await interestVault.availableBalance();
  const tvBalance = await tokenVault.balance();

  const ratio = ivReserved > 0n ? Number((ivBalance * 100n) / ivReserved) : 0;
  const utilization = ivBalance > 0n ? Number((ivReserved * 100n) / ivBalance) : 0;

  console.log("InterestVault:");
  console.log("  Balance:", formatUSDC(ivBalance), "USDC");
  console.log("  Reserved:", formatUSDC(ivReserved), "USDC");
  console.log("  Available:", formatUSDC(ivAvailable), "USDC");
  console.log("  Reserve ratio:", ratio + "%");
  console.log("  Utilization:", utilization + "%");

  console.log("\nTokenVault:");
  console.log("  Balance (principal):", formatUSDC(tvBalance), "USDC");

  const nextDepositId = await savingsBank.nextDepositId();
  console.log("\nActive deposits (next ID - 1):", (nextDepositId - 1n).toString());
  console.log("\n✅ Vault health report done\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
