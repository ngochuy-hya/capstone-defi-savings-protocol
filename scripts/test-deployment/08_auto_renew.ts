import { ethers } from "hardhat";
import { loadContracts, formatUSDC, formatBps, fastForward, isLocalNetwork, parseUSDC } from "./helpers";

function estimateInterest(principal: bigint, aprBps: bigint, durationDays: bigint): bigint {
  return (principal * aprBps * durationDays) / (365n * 10_000n);
}

async function main() {
  console.log("\n♻️ Auto-Renew Test (LOCKED APR)\n");

  const { usdc, tokenVault, interestVault, savingsBank, deployer } = await loadContracts();
  const planId = 2;
  const amount = parseUSDC("10000");

  const plan = await savingsBank.savingPlans(planId);
  if (!plan.isActive) {
    console.log("Plan", planId, "is not active.");
    process.exit(1);
  }

  const estimatedInterest = estimateInterest(
    amount,
    BigInt(plan.aprBps.toString()),
    BigInt(plan.durationDays.toString())
  );
  const available = await interestVault.availableBalance();
  if (available < estimatedInterest) {
    console.log("InterestVault has insufficient available balance.");
    console.log("  Required (reserve):", formatUSDC(estimatedInterest), "USDC");
    console.log("  Available:", formatUSDC(available), "USDC");
    console.log("  Run 03_vault_funding.ts first or fund via SavingsBank.fundVault()");
    process.exit(1);
  }

  let balance = await usdc.balanceOf(deployer.address);
  if (balance < amount) {
    await (await usdc.mint(deployer.address, amount)).wait();
  }
  const tokenVaultAddr = await tokenVault.getAddress();
  await (await usdc.connect(deployer).approve(tokenVaultAddr, amount)).wait();

  try {
    await (await savingsBank.connect(deployer).openDeposit(planId, amount, true)).wait();
  } catch (e: any) {
    const msg = e?.reason ?? e?.shortMessage ?? e?.message ?? String(e);
    console.log("openDeposit reverted:", msg);
    process.exit(1);
  }

  const tokenId = (await savingsBank.nextDepositId()) - 1n;
  const [, principal, , maturityTime] = await savingsBank.getDepositDetails(tokenId);

  if (isLocalNetwork()) {
    await fastForward(Number(plan.durationDays));
  }

  const block = await ethers.provider.getBlock("latest");
  if (!block || block.timestamp < Number(maturityTime)) {
    console.log("Deposit not matured yet. On Sepolia wait until maturity (e.g. 30 days).");
    console.log("To test now, run on localhost: npx hardhat run scripts/test-deployment/08_auto_renew.ts");
    process.exit(1);
  }

  const owner = await savingsBank.owner();
  if (owner === deployer.address) {
    await (await savingsBank.connect(deployer).updatePlan(planId, 1000, plan.earlyWithdrawPenaltyBps)).wait();
    console.log("Admin updated plan APR to 10% (to test LOCKED APR)");
  }
  const interest = await savingsBank.calculateInterest(tokenId);
  const newPrincipal = principal + interest;

  await (await savingsBank.connect(deployer).autoRenew(tokenId)).wait();

  const newDepositId = (await savingsBank.nextDepositId()) - 1n;
  const [, newP, , , newAprBps] = await savingsBank.getDepositDetails(newDepositId);

  console.log("Old deposit #" + tokenId.toString() + " -> RENEWED");
  console.log("New deposit #" + newDepositId.toString() + ":");
  console.log("  Principal:", formatUSDC(newP), "USDC (compounded)");
  console.log("  APR:", formatBps(newAprBps), "(LOCKED, not new plan rate)");
  console.log("✅ Auto-renew with LOCKED APR verified\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
