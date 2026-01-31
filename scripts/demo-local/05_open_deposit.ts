import { loadContracts, formatUSDC, formatBps, parseUSDC } from "./helpers";

/**
 * Demo Script 05: Open Deposit
 * 
 * Purpose: Demonstrate opening a new savings deposit
 * Network: localhost (hardhat node)
 * 
 * This script:
 * 1. Mints USDC if needed
 * 2. Approves SavingsBank to spend USDC
 * 3. Opens a new deposit
 * 4. Shows deposit details
 */

async function main() {
    console.log("\n🏦 ===== DEMO: OPEN DEPOSIT =====\n");

    const { usdc, tokenVault, savingsBank, deployer } = await loadContracts();

    // Configuration
    const planId = 1; // Change this to test different plans
    const amount = parseUSDC("100"); // 100 USDC
    const enableAutoRenew = false;

    console.log("📋 Deposit Configuration:");
    console.log("   Plan ID:", planId);
    console.log("   Amount:", formatUSDC(amount), "USDC");
    console.log("   Auto-renew:", enableAutoRenew);
    console.log("");

    // Check and mint USDC if needed
    let userBalance = await usdc.balanceOf(deployer.address);
    if (userBalance < amount) {
        console.log("💵 Minting USDC...");
        await (await usdc.mint(deployer.address, amount)).wait();
        userBalance = await usdc.balanceOf(deployer.address);
        console.log("   Balance now:", formatUSDC(userBalance), "USDC");
    }

    // Get plan details
    const plan = await savingsBank.savingPlans(planId);
    console.log("\n📊 Plan Details:");
    console.log("   Name:", plan.name);
    console.log("   Duration:", plan.durationDays.toString(), "days");
    console.log("   APR:", formatBps(plan.aprBps));
    console.log("   Early withdraw penalty:", formatBps(plan.earlyWithdrawPenaltyBps));

    // Approve and open deposit
    console.log("\n🔓 Approving USDC...");
    await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), amount)).wait();

    console.log("📝 Opening deposit...");
    const tx = await savingsBank.connect(deployer).openDeposit(planId, amount, enableAutoRenew);
    const receipt = await tx.wait();

    // Extract deposit ID from event
    let depositId = 1n;
    const log = receipt?.logs.find((l: any) => {
        try {
            const p = savingsBank.interface.parseLog(l);
            return p?.name === "DepositOpened";
        } catch {
            return false;
        }
    });
    if (log) {
        const p = savingsBank.interface.parseLog(log);
        depositId = p?.args[0] ?? 1n;
    }

    // Show deposit details
    const [, principal, , maturityTime, lockedAprBps, isAutoRenewEnabled, status] =
        await savingsBank.getDepositDetails(depositId);
    const expectedInterest = await savingsBank.calculateInterest(depositId);

    console.log("\n✅ ===== DEPOSIT OPENED SUCCESSFULLY =====");
    console.log("");
    console.log("🎯 Deposit Details:");
    console.log("   Deposit ID:", depositId.toString());
    console.log("   Principal:", formatUSDC(principal), "USDC");
    console.log("   Expected interest:", formatUSDC(expectedInterest), "USDC");
    console.log("   Total at maturity:", formatUSDC(principal + expectedInterest), "USDC");
    console.log("");
    console.log("📅 Timeline:");
    console.log("   Maturity:", new Date(Number(maturityTime) * 1000).toLocaleString());
    console.log("");
    console.log("⚙️ Settings:");
    console.log("   Locked APR:", formatBps(lockedAprBps));
    console.log("   Auto-renew:", isAutoRenewEnabled);
    console.log("");
    console.log("💡 Next steps:");
    console.log("   - Run 06_check_interest.ts to see interest details");
    console.log("   - Run 07_withdraw.ts after maturity");
    console.log("   - Or run 08_early_withdraw.ts now (will incur penalty)");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
