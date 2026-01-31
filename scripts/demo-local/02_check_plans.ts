import { loadContracts, formatBps, formatUSDC } from "./helpers";

/**
 * Demo Script 02: Check Plans
 * 
 * Purpose: Display all available saving plans
 */

async function main() {
    console.log("\n📊 ===== DEMO: CHECK SAVING PLANS =====\n");

    const { savingsBank } = await loadContracts();

    const nextPlanId = await savingsBank.nextPlanId();
    const totalPlans = Number(nextPlanId) - 1;

    if (totalPlans === 0) {
        console.log("⚠️ No plans found!");
        console.log("   Run 01_create_plans.ts first!\n");
        return;
    }

    console.log(`Found ${totalPlans} saving plan(s):\n`);

    for (let i = 1; i <= totalPlans; i++) {
        const plan = await savingsBank.savingPlans(i);

        console.log(`📋 Plan ${i}: ${plan.name}`);
        console.log("   Duration:", plan.durationDays.toString(), "days");
        console.log("   APR:", formatBps(plan.aprBps));
        console.log("   Min deposit:", formatUSDC(plan.minDeposit), "USDC");
        console.log("   Max deposit:", formatUSDC(plan.maxDeposit), "USDC");
        console.log("   Early withdraw penalty:", formatBps(plan.earlyWithdrawPenaltyBps));
        console.log("   Status:", plan.isActive ? "✅ Active" : "❌ Disabled");
        console.log("");
    }

    console.log("💡 Next: Run 03_check_vaults.ts to check vault balances\n");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
