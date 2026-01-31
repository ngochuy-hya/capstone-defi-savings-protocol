import { ethers } from "hardhat";
import { loadContracts, formatUSDC, fastForward, isLocalNetwork } from "./helpers";

/**
 * Demo Script 07: Withdraw (Matured)
 * 
 * Purpose: Demonstrate withdrawing a deposit after maturity
 * Network: localhost (hardhat node)
 * 
 * This script:
 * 1. Checks if deposit exists and is owned by user
 * 2. Fast-forwards time if on local network
 * 3. Withdraws principal + interest
 * 4. Shows amounts received
 */

async function main() {
    console.log("\n💸 ===== DEMO: WITHDRAW (MATURED) =====\n");

    const { usdc, savingsBank, depositNFT, deployer } = await loadContracts();

    // Configuration - change this to your deposit ID
    const depositId = 1n;

    console.log("📋 Checking deposit ID:", depositId.toString());

    // Check if deposit exists
    const [planId, principal, , maturityTime, , , status] = await savingsBank.getDepositDetails(depositId);
    if (principal === 0n) {
        console.log("❌ No active deposit found for ID:", depositId.toString());
        console.log("   Run 05_open_deposit.ts first!");
        return;
    }

    // Check ownership
    const owner = await depositNFT.ownerOf(depositId);
    if (owner !== deployer.address) {
        console.log("❌ Not owner of this deposit");
        console.log("   Owner:", owner);
        console.log("   You:", deployer.address);
        return;
    }

    console.log("✅ Deposit found and owned by you");
    console.log("");

    // Fast-forward time if local
    if (isLocalNetwork()) {
        const plan = await savingsBank.savingPlans(planId);
        const days = Number(plan.durationDays);
        console.log(`⏰ Fast-forwarding ${days} days...`);
        await fastForward(days + 1);
        console.log("");
    }

    // Check if matured
    const block = await ethers.provider.getBlock("latest");
    const matured = block != null && block.timestamp >= Number(maturityTime);
    if (!matured) {
        console.log("⚠️ Deposit not matured yet!");
        console.log("   Current time:", new Date(block!.timestamp * 1000).toLocaleString());
        console.log("   Maturity time:", new Date(Number(maturityTime) * 1000).toLocaleString());
        console.log("");
        console.log("💡 Run this on localhost to use fast-forward");
        console.log("   Or run 08_early_withdraw.ts (will incur penalty)");
        return;
    }

    console.log("✅ Deposit has matured!");
    console.log("");

    // Calculate amounts
    const interest = await savingsBank.calculateInterest(depositId);
    const userBefore = await usdc.balanceOf(deployer.address);

    console.log("📊 Amounts:");
    console.log("   Principal:", formatUSDC(principal), "USDC");
    console.log("   Interest:", formatUSDC(interest), "USDC");
    console.log("   Total:", formatUSDC(principal + interest), "USDC");
    console.log("");

    // Withdraw
    console.log("💸 Withdrawing...");
    await (await savingsBank.connect(deployer).withdraw(depositId)).wait();

    const userAfter = await usdc.balanceOf(deployer.address);
    const received = userAfter - userBefore;

    console.log("\n✅ ===== WITHDRAW SUCCESSFUL =====");
    console.log("");
    console.log("💰 You received:", formatUSDC(received), "USDC");
    console.log("");
    console.log("📊 Breakdown:");
    console.log("   Principal:", formatUSDC(principal), "USDC");
    console.log("   Interest:", formatUSDC(interest), "USDC");
    console.log("");
    console.log("🎉 Deposit closed, NFT burned");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
