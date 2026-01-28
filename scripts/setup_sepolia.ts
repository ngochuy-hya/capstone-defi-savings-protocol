import { ethers } from "hardhat";

/**
 * Manual setup script to:
 * 1. Fund VaultManager with USDC
 * 2. Create saving plans
 */

async function main() {
    console.log("🚀 Starting manual setup on Sepolia...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer:", deployer.address);

    // Contract addresses from deployment
    const USDC_ADDRESS = "0xDd5103720e5f6c6E4872f368425e323ae52f5005";
    const VAULT_MANAGER_ADDRESS = "0xD05a5d1b50D729e68F6799Ac8A4Bd36f8eE2CAd3";
    const SAVINGS_BANK_ADDRESS = "0xf634a9B09167D5eDc14BD41A9D8FB47B1992a0a3";

    // Get contracts
    const MockUSDC = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);
    const VaultManager = await ethers.getContractAt("VaultManager", VAULT_MANAGER_ADDRESS);
    const SavingsBank = await ethers.getContractAt("SavingsBank", SAVINGS_BANK_ADDRESS);

    console.log("\n📊 Contract Addresses:");
    console.log("   MockUSDC:", USDC_ADDRESS);
    console.log("   VaultManager:", VAULT_MANAGER_ADDRESS);
    console.log("   SavingsBank:", SAVINGS_BANK_ADDRESS);

    // 1. Check and mint USDC if needed
    console.log("\n💰 Step 1: Checking USDC balance...");
    let balance = await MockUSDC.balanceOf(deployer.address);
    console.log("   Current balance:", ethers.formatUnits(balance, 6), "USDC");

    if (balance < ethers.parseUnits("200000", 6)) {
        console.log("   Minting 1,000,000 USDC...");
        const tx = await MockUSDC.mint(deployer.address, ethers.parseUnits("1000000", 6));
        await tx.wait();
        balance = await MockUSDC.balanceOf(deployer.address);
        console.log("   ✅ New balance:", ethers.formatUnits(balance, 6), "USDC");
    }

    // 2. Fund VaultManager
    console.log("\n🏦 Step 2: Funding VaultManager...");
    const vaultBalance = await MockUSDC.balanceOf(VAULT_MANAGER_ADDRESS);
    console.log("   Current vault balance:", ethers.formatUnits(vaultBalance, 6), "USDC");

    const fundAmount = ethers.parseUnits("100000", 6); // 100K USDC
    if (vaultBalance < fundAmount) {
        console.log("   Approving USDC...");
        let tx = await MockUSDC.approve(VAULT_MANAGER_ADDRESS, fundAmount);
        await tx.wait();

        console.log("   Funding vault with 100,000 USDC...");
        tx = await VaultManager.fundVault(fundAmount);
        await tx.wait();

        const newVaultBalance = await MockUSDC.balanceOf(VAULT_MANAGER_ADDRESS);
        console.log("   ✅ Vault funded! New balance:", ethers.formatUnits(newVaultBalance, 6), "USDC");
    } else {
        console.log("   ✅ Vault already funded");
    }

    // 3. Create saving plans
    console.log("\n📋 Step 3: Creating saving plans...");

    const plans = [
        {
            tenorDays: 7,
            aprBps: 500,   // 5%
            minDeposit: ethers.parseUnits("100", 6),
            maxDeposit: ethers.parseUnits("10000", 6),
            earlyWithdrawPenaltyBps: 200, // 2%
            name: "7-Day Plan"
        },
        {
            tenorDays: 30,
            aprBps: 800,   // 8%
            minDeposit: ethers.parseUnits("500", 6),
            maxDeposit: ethers.parseUnits("50000", 6),
            earlyWithdrawPenaltyBps: 200,
            name: "30-Day Plan"
        },
        {
            tenorDays: 90,
            aprBps: 1200,  // 12%
            minDeposit: ethers.parseUnits("1000", 6),
            maxDeposit: ethers.parseUnits("100000", 6),
            earlyWithdrawPenaltyBps: 200,
            name: "90-Day Plan"
        },
        {
            tenorDays: 180,
            aprBps: 1500,  // 15%
            minDeposit: ethers.parseUnits("5000", 6),
            maxDeposit: ethers.parseUnits("500000", 6),
            earlyWithdrawPenaltyBps: 200,
            name: "180-Day Plan"
        }
    ];

    for (let i = 0; i < plans.length; i++) {
        try {
            const plan = plans[i];

            // Check if plan already exists
            try {
                const existingPlan = await SavingsBank.plans(i);
                if (existingPlan.enabled) {
                    console.log(`   ✅ ${plan.name} already exists (ID: ${i})`);
                    continue;
                }
            } catch (e) {
                // Plan doesn't exist, will create it
            }

            console.log(`   Creating ${plan.name}...`);
            const tx = await SavingsBank.createPlan(
                plan.tenorDays,
                plan.aprBps,
                plan.minDeposit,
                plan.maxDeposit,
                plan.earlyWithdrawPenaltyBps
            );
            await tx.wait();
            console.log(`   ✅ ${plan.name} created (ID: ${i})`);
        } catch (error: any) {
            console.log(`   ⚠️  ${plans[i].name}: ${error.message}`);
        }
    }

    console.log("\n✅ Setup complete!");
    console.log("\n📝 Summary:");
    console.log("   - VaultManager funded with interest pool");
    console.log("   - 4 saving plans created");
    console.log("   - Frontend ready to use!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
