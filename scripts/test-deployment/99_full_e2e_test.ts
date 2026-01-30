import { ethers } from "hardhat";
import { loadContracts, formatUSDC, parseUSDC, fastForward, isLocalNetwork } from "./helpers";

function estimateInterest(principal: bigint, aprBps: bigint, durationDays: bigint): bigint {
  return (principal * aprBps * durationDays) / (365n * 10_000n);
}

async function main() {
  console.log("\n🚀 Full E2E Test\n");

  const { usdc, tokenVault, interestVault, savingsBank, deployer } = await loadContracts();
  const planId = 2;
  const plan = await savingsBank.savingPlans(planId);

  await (await usdc.mint(deployer.address, parseUSDC("500000"))).wait();
  await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), parseUSDC("500000"))).wait();

  const amount1 = parseUSDC("10000");
  const estimatedInterest1 = estimateInterest(
    amount1,
    BigInt(plan.aprBps.toString()),
    BigInt(plan.durationDays.toString())
  );
  const available = await interestVault.availableBalance();
  if (available < estimatedInterest1) {
    console.log("⚠️  InterestVault insufficient. Required:", formatUSDC(estimatedInterest1), "USDC, available:", formatUSDC(available));
    console.log("   Run 03_vault_funding.ts first.");
    process.exit(1);
  }

  console.log("1. Open deposit (User A)...");
  try {
    await (await savingsBank.connect(deployer).openDeposit(planId, amount1, false)).wait();
  } catch (e: any) {
    const msg = e?.reason ?? e?.shortMessage ?? e?.message ?? String(e);
    console.log("   openDeposit reverted:", msg.slice(0, 100));
    process.exit(1);
  }
  const depositId1 = (await savingsBank.nextDepositId()) - 1n;
  console.log("   Deposit ID:", depositId1.toString());

  if (!isLocalNetwork()) {
    console.log("\n⚠️  On Sepolia: cannot fast-forward time. E2E withdraw/auto-renew steps skipped.");
    console.log("   Run on localhost for full E2E: npx hardhat run scripts/test-deployment/99_full_e2e_test.ts");
    console.log("\n✅ E2E test (deposit only) done\n");
    return;
  }

  await fastForward(30);

  console.log("2. Withdraw matured...");
  const balBefore = await usdc.balanceOf(deployer.address);
  await (await savingsBank.connect(deployer).withdraw(depositId1)).wait();
  const balAfter = await usdc.balanceOf(deployer.address);
  console.log("   Received:", formatUSDC(balAfter - balBefore), "USDC");

  const amount2 = parseUSDC("5000");
  const estimatedInterest2 = estimateInterest(
    amount2,
    BigInt(plan.aprBps.toString()),
    BigInt(plan.durationDays.toString())
  );
  const available2 = await interestVault.availableBalance();
  if (available2 < estimatedInterest2) {
    console.log("⚠️  Skipping step 3: vault insufficient for second deposit.");
  } else {
    console.log("3. Open deposit with auto-renew...");
    await (await savingsBank.connect(deployer).openDeposit(planId, amount2, true)).wait();
    const depositId2 = (await savingsBank.nextDepositId()) - 1n;

    await fastForward(30);

    const [, , , maturityTime] = await savingsBank.getDepositDetails(depositId2);
    const block = await ethers.provider.getBlock("latest");
    if (block && block.timestamp >= Number(maturityTime)) {
      console.log("4. Auto-renew...");
      await (await savingsBank.connect(deployer).autoRenew(depositId2)).wait();
      const newId = (await savingsBank.nextDepositId()) - 1n;
      const [, newPrincipal] = await savingsBank.getDepositDetails(newId);
      console.log("   New deposit #" + newId.toString() + ", principal:", formatUSDC(newPrincipal), "USDC");
    }
  }

  console.log("\n✅ E2E test complete\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
