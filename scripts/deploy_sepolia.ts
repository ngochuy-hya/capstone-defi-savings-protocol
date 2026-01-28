import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("\n🚀 Starting Sepolia Testnet Deployment...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 ETH Balance:", ethers.formatEther(balance), "ETH\n");

    if (parseFloat(ethers.formatEther(balance)) < 0.1) {
        console.error("❌ Insufficient ETH! Need at least 0.1 ETH for deployment.");
        console.log("Get Sepolia ETH from: https://sepoliafaucet.com/");
        process.exit(1);
    }

    // Step 1: Deploy MockUSDC
    console.log("📦 Step 1/4: Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("✅ MockUSDC deployed:", usdcAddress);

    // Step 2: Deploy VaultManager
    console.log("\n📦 Step 2/4: Deploying VaultManager...");
    const feeReceiver = deployer.address; // Use deployer as fee receiver
    const minHealthRatioBps = 12000; // 120%

    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = await VaultManager.deploy(
        usdcAddress,
        feeReceiver,
        minHealthRatioBps
    );
    await vaultManager.waitForDeployment();
    const vaultManagerAddress = await vaultManager.getAddress();
    console.log("✅ VaultManager deployed:", vaultManagerAddress);

    // Step 3: Deploy SavingsBank
    console.log("\n📦 Step 3/4: Deploying SavingsBank...");
    const admin = deployer.address; // Use deployer as admin

    const SavingsBank = await ethers.getContractFactory("SavingsBank");
    const savingsBank = await SavingsBank.deploy(
        usdcAddress,
        vaultManagerAddress,
        feeReceiver,
        admin
    );
    await savingsBank.waitForDeployment();
    const savingsBankAddress = await savingsBank.getAddress();
    console.log("✅ SavingsBank deployed:", savingsBankAddress);

    // Step 4: Setup VaultManager
    console.log("\n🔧 Step 4/4: Setting up VaultManager...");
    const setSavingsBankTx = await vaultManager.setSavingsBank(savingsBankAddress);
    await setSavingsBankTx.wait();
    console.log("✅ VaultManager configured with SavingsBank");

    // Fund VaultManager with USDC for interest payments
    console.log("\n💰 Funding VaultManager with USDC...");
    const fundingAmount = ethers.parseUnits("100000", 6); // 100,000 USDC

    // Mint USDC to deployer
    const mintTx = await usdc.mint(deployer.address, fundingAmount);
    await mintTx.wait();
    console.log("✅ Minted", ethers.formatUnits(fundingAmount, 6), "USDC to deployer");

    // Approve VaultManager
    const approveTx = await usdc.approve(vaultManagerAddress, fundingAmount);
    await approveTx.wait();
    console.log("✅ Approved VaultManager to spend USDC");

    // Fund vault
    const fundTx = await vaultManager.fundVault(fundingAmount);
    await fundTx.wait();
    console.log("✅ VaultManager funded with", ethers.formatUnits(fundingAmount, 6), "USDC");

    // Create saving plans
    console.log("\n📋 Creating Saving Plans...");

    const plans = [
        { name: "7 Days", tenorDays: 7, aprBps: 500, minDeposit: 100, maxDeposit: 100000, penalty: 200 },  // 5% APR, 2% penalty
        { name: "30 Days", tenorDays: 30, aprBps: 800, minDeposit: 100, maxDeposit: 100000, penalty: 300 },  // 8% APR, 3% penalty
        { name: "90 Days", tenorDays: 90, aprBps: 1200, minDeposit: 100, maxDeposit: 100000, penalty: 500 },  // 12% APR, 5% penalty
        { name: "180 Days", tenorDays: 180, aprBps: 1500, minDeposit: 100, maxDeposit: 100000, penalty: 800 },  // 15% APR, 8% penalty
    ];

    for (const plan of plans) {
        const tx = await savingsBank.createPlan(
            plan.tenorDays,
            plan.aprBps,
            ethers.parseUnits(plan.minDeposit.toString(), 6),
            ethers.parseUnits(plan.maxDeposit.toString(), 6),
            plan.penalty
        );
        await tx.wait();
        console.log(`✅ Created ${plan.name} plan (${plan.aprBps / 100}% APR)`);
    }

    // Save deployment info
    const deploymentInfo = {
        network: "sepolia",
        chainId: 11155111,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            mockUSDC: usdcAddress,
            vaultManager: vaultManagerAddress,
            savingsBank: savingsBankAddress,
        },
        config: {
            feeReceiver,
            admin,
            minHealthRatioBps,
            initialVaultFunding: ethers.formatUnits(fundingAmount, 6),
        },
        plans: plans.length,
        etherscan: {
            mockUSDC: `https://sepolia.etherscan.io/address/${usdcAddress}`,
            vaultManager: `https://sepolia.etherscan.io/address/${vaultManagerAddress}`,
            savingsBank: `https://sepolia.etherscan.io/address/${savingsBankAddress}`,
        },
    };

    // Save to file
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `sepolia-deployment-${timestamp}.json`;
    const filepath = path.join(deploymentsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

    // Also save as latest
    const latestFilepath = path.join(deploymentsDir, "sepolia-latest.json");
    fs.writeFileSync(latestFilepath, JSON.stringify(deploymentInfo, null, 2));

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("\n📄 Contract Addresses:");
    console.log("  MockUSDC:      ", usdcAddress);
    console.log("  VaultManager:  ", vaultManagerAddress);
    console.log("  SavingsBank:   ", savingsBankAddress);
    console.log("\n🔗 Etherscan Links:");
    console.log("  MockUSDC:      ", deploymentInfo.etherscan.mockUSDC);
    console.log("  VaultManager:  ", deploymentInfo.etherscan.vaultManager);
    console.log("  SavingsBank:   ", deploymentInfo.etherscan.savingsBank);
    console.log("\n💾 Deployment saved to:");
    console.log("  ", filepath);
    console.log("\n📋 Created Plans:", plans.length);
    plans.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}: ${p.aprBps / 100}% APR, ${p.penalty / 100}% penalty`);
    });
    console.log("\n💰 Vault Funded:", ethers.formatUnits(fundingAmount, 6), "USDC");

    console.log("\n🔍 Next Steps:");
    console.log("  1. Verify contracts on Etherscan:");
    console.log(`     npx hardhat verify --network sepolia ${usdcAddress}`);
    console.log(`     npx hardhat verify --network sepolia ${vaultManagerAddress} ${usdcAddress} ${feeReceiver} ${minHealthRatioBps}`);
    console.log(`     npx hardhat verify --network sepolia ${savingsBankAddress} ${usdcAddress} ${vaultManagerAddress} ${feeReceiver} ${admin}`);
    console.log("\n  2. Update .env file:");
    console.log(`     USDC_ADDRESS=${usdcAddress}`);
    console.log(`     VAULT_MANAGER_ADDRESS=${vaultManagerAddress}`);
    console.log(`     SAVINGS_BANK_ADDRESS=${savingsBankAddress}`);
    console.log("\n  3. Test deployment:");
    console.log("     npx hardhat run scripts/helpers/verify_deployment.ts --network sepolia");
    console.log("\n✅ Ready for frontend integration!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
