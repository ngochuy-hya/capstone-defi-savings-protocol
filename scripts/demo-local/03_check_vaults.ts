import { loadContracts, formatUSDC } from "./helpers";

/**
 * Demo Script 03: Check Vaults
 * 
 * Purpose: Display vault balances and health
 */

async function main() {
    console.log("\n💰 ===== DEMO: CHECK VAULTS =====\n");

    const { usdc, tokenVault, interestVault, savingsBank } = await loadContracts();

    // TokenVault balance
    const tvBalance = await tokenVault.balance();
    console.log("🏦 TokenVault (Principal Storage):");
    console.log("   Balance:", formatUSDC(tvBalance), "USDC");
    console.log("   Purpose: Holds user deposits (principal)");
    console.log("");

    // InterestVault balances
    const ivBalance = await interestVault.balance();
    const ivReserved = await interestVault.totalReserved();
    const ivAvailable = await interestVault.availableBalance();

    console.log("💎 InterestVault (Interest + Penalties):");
    console.log("   Total balance:", formatUSDC(ivBalance), "USDC");
    console.log("   Reserved for active deposits:", formatUSDC(ivReserved), "USDC");
    console.log("   Available (unreserved):", formatUSDC(ivAvailable), "USDC");
    console.log("   Purpose: Pays interest, receives penalties");
    console.log("");

    // Health check
    const healthy = ivAvailable > 0n;
    if (healthy) {
        console.log("✅ System healthy - sufficient liquidity");
    } else {
        console.log("⚠️ Low liquidity - may need admin funding");
    }
    console.log("");

    console.log("💡 Next: Run 04_fund_vault.ts to add liquidity (admin)\n");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
