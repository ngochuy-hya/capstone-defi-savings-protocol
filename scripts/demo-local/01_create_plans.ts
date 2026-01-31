import { loadContracts, formatBps, formatUSDC, parseUSDC } from "./helpers";

/**
 * Demo Script 01: Create Plans
 * 
 * Purpose: Create saving plans for local testing
 * IMPORTANT: Run this AFTER deployment to setup plans
 */

async function main() {
    console.log("\n📋 ===== DEMO: CREATE SAVING PLANS =====\n");

    const { savingsBank, deployer } = await loadContracts();

    // Check if plans already exist
    const nextPlanId = await savingsBank.nextPlanId();
    if (nextPlanId > 1n) {
        console.log("⚠️ Plans already exist!");
        console.log("   Skipping plan creation");
        console.log("   Run 02_check_plans.ts to view existing plans\n");
        return;
    }

    // Plans for local testing - shorter durations for demo
    const plans = [
        {
            name: "7 Days",
            durationDays: 7,
            minDeposit: "10",
            maxDeposit: "10000",
            aprBps: 500,      // 5% APR
            penaltyBps: 300   // 3% penalty
        },
        {
            name: "30 Days",
            durationDays: 30,
            minDeposit: "100",
            maxDeposit: "50000",
            aprBps: 800,      // 8% APR
            penaltyBps: 500   // 5% penalty
        },
        {
            name: "90 Days",
            durationDays: 90,
            minDeposit: "500",
            maxDeposit: "100000000",
            aprBps: 1000,     // 10% APR
            penaltyBps: 500   // 5% penalty
        },
    ];

    console.log(`Creating ${plans.length} saving plans...\n`);

    for (const p of plans) {
        console.log(`📊 Creating plan: ${p.name}`);
        console.log("   Duration:", p.durationDays, "days");
        console.log("   APR:", formatBps(BigInt(p.aprBps)));
        console.log("   Penalty:", formatBps(BigInt(p.penaltyBps)));
        console.log("   Min:", formatUSDC(parseUSDC(p.minDeposit)), "USDC");
        console.log("   Max:", formatUSDC(parseUSDC(p.maxDeposit)), "USDC");

        await (
            await savingsBank.createPlan(
                p.name,
                p.durationDays,
                parseUSDC(p.minDeposit),
                parseUSDC(p.maxDeposit),
                p.aprBps,
                p.penaltyBps
            )
        ).wait();

        console.log("   ✅ Created!");
        console.log("");
    }

    console.log("✅ ===== ALL PLANS CREATED =====");
    console.log("");
    console.log("💡 Next: Run 02_check_plans.ts to verify plans\n");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
