import { ethers } from "hardhat";
import { loadContracts, formatUSDC, parseUSDC } from "./helpers";

/**
 * Demo Script 08: Early Withdraw
 * 
 * Purpose: Demonstrate early withdrawal with penalty
 * Network: localhost (hardhat node)
 * 
 * This script:
 * 1. Opens a NEW deposit
 * 2. Immediately withdraws (before maturity)
 * 3. Shows penalty calculation
 * 4. Compares with normal withdraw
 */

async function main() {
    console.log("\n⚠️ ===== DEMO: EARLY WITHDRAW (WITH PENALTY) =====\n");

    const { usdc, tokenVault, savingsBank, deployer } = await loadContracts();

    // Configuration
    const planId = 2; // Using plan 2 for demo
    const amount = parseUSDC("100"); // 100 USDC

    console.log("📋 Opening a NEW deposit for early withdraw demo...");
    console.log("   Plan ID:", planId);
    console.log("   Amount:", formatUSDC(amount), "USDC");
    console.log("");

    // Mint and approve
    let userBalance = await usdc.balanceOf(deployer.address);
    if (userBalance < amount) {
        await (await usdc.mint(deployer.address, amount)).wait();
    }
    await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), amount)).wait();

    // Open deposit
    await (await savingsBank.connect(deployer).openDeposit(planId, amount, false)).wait();

    const nextDepositId = await savingsBank.nextDepositId();
    const depositId = nextDepositId - 1n;

    console.log("✅ Deposit opened (ID:", depositId.toString() + ")");
    console.log("");

    // Get deposit and plan details
    const [, principal, , maturityTime] = await savingsBank.getDepositDetails(depositId);
    const plan = await savingsBank.savingPlans(planId);

    const penalty = (principal * BigInt(plan.earlyWithdrawPenaltyBps.toString())) / 10_000n;
    const userReceives = principal - penalty;
    const interest = await savingsBank.calculateInterest(depositId);

    console.log("📊 Comparison:");
    console.log("");
    console.log("   If you wait until maturity:");
    console.log("      Principal:", formatUSDC(principal), "USDC");
    console.log("      Interest:", formatUSDC(interest), "USDC");
    console.log("      Total: " + formatUSDC(principal + interest), "USDC ✅");
    console.log("");
    console.log("   If you early withdraw NOW:");
    console.log("      Principal:", formatUSDC(principal), "USDC");
    console.log("      Penalty (" + Number(plan.earlyWithdrawPenaltyBps) / 100 + "%):", formatUSDC(penalty), "USDC ❌");
    console.log("      You receive:", formatUSDC(userReceives), "USDC ⚠️");
    console.log("      No interest");
    console.log("");
    console.log("💸 Loss:", formatUSDC(penalty + interest), "USDC");
    console.log("");

    // Early withdraw
    console.log("⚠️ Proceeding with early withdraw...");
    const userBefore = await usdc.balanceOf(deployer.address);
    await (await savingsBank.connect(deployer).earlyWithdraw(depositId)).wait();
    const userAfter = await usdc.balanceOf(deployer.address);

    const received = userAfter - userBefore;

    console.log("\n✅ ===== EARLY WITHDRAW COMPLETED =====");
    console.log("");
    console.log("💰 You received:", formatUSDC(received), "USDC");
    console.log("");
    console.log("📊 Breakdown:");
    console.log("   Original principal:", formatUSDC(principal), "USDC");
    console.log("   Penalty deducted:", formatUSDC(penalty), "USDC");
    console.log("   Net received:", formatUSDC(received), "USDC");
    console.log("");
    console.log("⚠️ Penalty goes to InterestVault (boosts liquidity)");
    console.log("🎉 Deposit closed, NFT burned");
    console.log("");
    console.log("💡 Key takeaway:");
    console.log("   Early withdraw costs you " + formatUSDC(penalty + interest), "USDC");
    console.log("   Always better to wait until maturity!");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
