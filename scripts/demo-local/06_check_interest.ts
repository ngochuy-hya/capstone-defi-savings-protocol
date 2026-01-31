import { loadContracts, formatUSDC } from "./helpers";

/**
 * Demo Script 06: Check Interest
 * 
 * Purpose: Calculate and display interest for active deposits
 */

async function main() {
    console.log("\n💎 ===== DEMO: CHECK INTEREST =====\n");

    const { savingsBank, depositNFT, deployer } = await loadContracts();

    // Get user's deposits
    const balance = await depositNFT.balanceOf(deployer.address);

    if (balance === 0n) {
        console.log("❌ You have no active deposits");
        console.log("   Run 04_open_deposit.ts first!\n");
        return;
    }

    console.log(`Found ${balance.toString()} deposit(s):\n`);

    for (let i = 0; i < Number(balance); i++) {
        const tokenId = await depositNFT.tokenOfOwnerByIndex(deployer.address, i);

        const [planId, principal, , maturityTime, lockedAprBps, , status] =
            await savingsBank.getDepositDetails(tokenId);

        if (principal === 0n) continue; // Skip withdrawn deposits

        const plan = await savingsBank.savingPlans(planId);
        const interest = await savingsBank.calculateInterest(tokenId);
        const total = principal + interest;

        console.log(`📋 Deposit #${tokenId.toString()}:`);
        console.log("   Plan:", plan.name);
        console.log("   Principal:", formatUSDC(principal), "USDC");
        console.log("   Locked APR:", (Number(lockedAprBps) / 100).toFixed(2) + "%");
        console.log("");
        console.log("   💰 Expected Interest:", formatUSDC(interest), "USDC");
        console.log("   💵 Total at maturity:", formatUSDC(total), "USDC");
        console.log("");
        console.log("   🕐 Maturity:", new Date(Number(maturityTime) * 1000).toLocaleString());
        console.log("");
    }

    console.log("💡 Next: Run 07_withdraw.ts to withdraw matured deposits\n");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
