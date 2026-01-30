import { loadContracts, formatUSDC, formatBps, parseUSDC } from "./helpers";

async function main() {
  console.log("\n🏦 Open Deposit\n");

  const { usdc, tokenVault, savingsBank, deployer } = await loadContracts();

  const planId = 2;
  const amount = parseUSDC("10000");
  const enableAutoRenew = false;

  let userBalance = await usdc.balanceOf(deployer.address);
  if (userBalance < amount) {
    await (await usdc.mint(deployer.address, amount)).wait();
    userBalance = await usdc.balanceOf(deployer.address);
  }

  const plan = await savingsBank.savingPlans(planId);
  console.log("Plan:", plan.name, `(${formatBps(plan.aprBps)} APR)`);
  console.log("Amount:", formatUSDC(amount), "USDC");
  console.log("Auto-renew:", enableAutoRenew);

  await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), amount)).wait();
  const tx = await savingsBank.connect(deployer).openDeposit(planId, amount, enableAutoRenew);
  const receipt = await tx.wait();

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

  const [, principal, , maturityTime, lockedAprBps, isAutoRenewEnabled, status] =
    await savingsBank.getDepositDetails(depositId);
  const expectedInterest = await savingsBank.calculateInterest(depositId);

  console.log("\n✅ Deposit opened!");
  console.log("   Deposit ID:", depositId.toString());
  console.log("   Principal:", formatUSDC(principal), "USDC");
  console.log("   Maturity:", new Date(Number(maturityTime) * 1000).toISOString());
  console.log("   Locked APR:", formatBps(lockedAprBps));
  console.log("   Expected interest:", formatUSDC(expectedInterest), "USDC");
  console.log("   Auto-renew:", isAutoRenewEnabled);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
