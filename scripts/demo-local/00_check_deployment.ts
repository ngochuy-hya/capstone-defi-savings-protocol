import { loadContracts } from "./helpers";

/**
 * Demo Script 00: Check Deployment
 * 
 * Purpose: Verify all contracts are deployed correctly
 * Run this FIRST to ensure setup is complete
 */

async function main() {
    console.log("\n🔍 ===== DEMO: CHECK DEPLOYMENT =====\n");

    try {
        const { usdc, tokenVault, interestVault, depositNFT, savingsBank, deployer, addresses } = await loadContracts();

        console.log("✅ All contracts loaded successfully!\n");

        console.log("📋 Contract Addresses:");
        console.log("   MockUSDC:", addresses.MockUSDC);
        console.log("   TokenVault:", addresses.TokenVault);
        console.log("   InterestVault:", addresses.InterestVault);
        console.log("   DepositNFT:", addresses.MockDepositNFT);
        console.log("   SavingsBank:", addresses.SavingsBank);
        console.log("");

        console.log("🔐 Ownership Check:");
        const tvOwner = await tokenVault.owner();
        const ivOwner = await interestVault.owner();
        const nftOwner = await depositNFT.owner();

        console.log("   TokenVault owner:", tvOwner);
        console.log("   InterestVault owner:", ivOwner);
        console.log("   DepositNFT owner:", nftOwner);
        console.log("   SavingsBank address:", addresses.SavingsBank);

        const ownershipOk =
            tvOwner === addresses.SavingsBank &&
            ivOwner === addresses.SavingsBank &&
            nftOwner === addresses.SavingsBank;

        if (ownershipOk) {
            console.log("   ✅ Ownership correctly set to SavingsBank");
        } else {
            console.log("   ⚠️ Ownership mismatch!");
        }
        console.log("");

        console.log("👤 Your Address:", deployer.address);
        console.log("");

        console.log("✅ Deployment check complete!");
        console.log("💡 Next: Run 01_check_plans.ts to verify saving plans\n");

    } catch (error: any) {
        console.log("❌ Deployment check failed!");
        console.log("Error:", error.message);
        console.log("\n💡 Make sure you ran: npx hardhat deploy --network localhost\n");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
