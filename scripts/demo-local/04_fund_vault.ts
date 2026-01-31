import { loadContracts, formatUSDC, parseUSDC } from "./helpers";

/**
 * Demo Script 04: Fund Vault (Admin)
 * 
 * Purpose: Admin funds InterestVault with liquidity
 */

async function main() {
    console.log("\n💵 ===== DEMO: FUND VAULT (ADMIN) =====\n");

    const { usdc, interestVault, savingsBank, deployer } = await loadContracts();

    const fundAmount = parseUSDC("50000"); // 50k USDC

    console.log("📋 Funding Configuration:");
    console.log("   Amount:", formatUSDC(fundAmount), "USDC");
    console.log("   Admin:", deployer.address);
    console.log("");

    // Check current balance
    const beforeBalance = await interestVault.balance();
    console.log("💰 InterestVault before:");
    console.log("   Balance:", formatUSDC(beforeBalance), "USDC");
    console.log("");

    // Mint USDC for admin
    console.log("🪙 Minting USDC for admin...");
    await (await usdc.mint(deployer.address, fundAmount)).wait();

    // Approve InterestVault (not SavingsBank!)
    // Because InterestVault.deposit() will transferFrom msg.sender
    console.log("🔓 Approving InterestVault...");
    await (await usdc.approve(await interestVault.getAddress(), fundAmount)).wait();

    // Fund vault through SavingsBank
    console.log("💸 Funding vault...");
    await (await savingsBank.fundVault(fundAmount)).wait();

    const afterBalance = await interestVault.balance();
    console.log("\n✅ ===== FUNDING SUCCESSFUL =====");
    console.log("");
    console.log("💰 InterestVault after:");
    console.log("   Balance:", formatUSDC(afterBalance), "USDC");
    console.log("   Increase:", formatUSDC(afterBalance - beforeBalance), "USDC");
    console.log("");
    console.log("💡 Vault now has more liquidity to pay interest!");
    console.log("   Next: Run 05_open_deposit.ts to open a deposit\n");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Error:", e.message);
        process.exit(1);
    });
