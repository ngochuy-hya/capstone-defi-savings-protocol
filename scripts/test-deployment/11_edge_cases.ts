import { loadContracts, formatUSDC, parseUSDC } from "./helpers";

function estimateInterest(principal: bigint, aprBps: bigint, durationDays: bigint): bigint {
  return (principal * aprBps * durationDays) / (365n * 10_000n);
}

async function main() {
  console.log("\n🔬 Edge Cases\n");

  const { usdc, tokenVault, interestVault, savingsBank, deployer } = await loadContracts();
  const planId = 1;
  const plan = await savingsBank.savingPlans(planId);

  await (await usdc.mint(deployer.address, parseUSDC("100000"))).wait();

  await savingsBank.connect(deployer).openDeposit(999, parseUSDC("1000"), false).catch((e: any) => {
    console.log("✅ openDeposit(planId=999) reverted:", (e?.reason ?? e?.message ?? "").slice(0, 60));
  });

  await savingsBank.connect(deployer).openDeposit(planId, plan.minDeposit - 1n, false).catch((e: any) => {
    console.log("✅ openDeposit(below min) reverted:", (e?.reason ?? e?.message ?? "").slice(0, 60));
  });

  const estimatedInterest = estimateInterest(
    plan.minDeposit,
    BigInt(plan.aprBps.toString()),
    BigInt(plan.durationDays.toString())
  );
  const available = await interestVault.availableBalance();
  if (available < estimatedInterest) {
    console.log("⚠️  Skipping openDeposit(minDeposit): InterestVault available", formatUSDC(available), "USDC < required", formatUSDC(estimatedInterest), "USDC");
    console.log("   Run 03_vault_funding.ts first.");
  } else {
    await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), plan.minDeposit)).wait();
    try {
      await (await savingsBank.connect(deployer).openDeposit(planId, plan.minDeposit, false)).wait();
      console.log("✅ openDeposit(minDeposit) succeeded");
    } catch (e: any) {
      const msg = e?.reason ?? e?.shortMessage ?? e?.message ?? String(e);
      console.log("⚠️  openDeposit(minDeposit) reverted:", msg.slice(0, 80));
    }
  }

  console.log("\n✅ Edge cases test done\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
