import { ethers } from "hardhat";
import { loadContracts, formatUSDC, formatBps, fastForward, isLocalNetwork, parseUSDC } from "./helpers";

async function main() {
  console.log("\n🔄 Manual Renew Test (NEW APR)\n");

  const { usdc, tokenVault, savingsBank, deployer } = await loadContracts();
  const planId = 2;
  const amount = parseUSDC("10000");

  let balance = await usdc.balanceOf(deployer.address);
  if (balance < amount) {
    await (await usdc.mint(deployer.address, amount)).wait();
  }
  await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), amount)).wait();
  await (await savingsBank.connect(deployer).openDeposit(planId, amount, false)).wait();

  const tokenId = (await savingsBank.nextDepositId()) - 1n;
  const [, principal, , maturityTime] = await savingsBank.getDepositDetails(tokenId);
  const plan = await savingsBank.savingPlans(planId);

  if (isLocalNetwork()) {
    await fastForward(Number(plan.durationDays));
  }

  const block = await ethers.provider.getBlock("latest");
  if (!block || block.timestamp < Number(maturityTime)) {
    console.log("Deposit not matured yet. On Sepolia you must wait until maturity (e.g. 30 days).");
    console.log("To test this flow now, run on localhost: npx hardhat run scripts/test-deployment/09_manual_renew.ts");
    process.exit(1);
  }

  const owner = await savingsBank.owner();
  if (owner === deployer.address) {
    await (await savingsBank.connect(deployer).updatePlan(planId, 1200, plan.earlyWithdrawPenaltyBps)).wait();
  }

  const userBefore = await usdc.balanceOf(deployer.address);
  await (await savingsBank.connect(deployer).withdraw(tokenId)).wait();
  const userAfter = await usdc.balanceOf(deployer.address);
  const withdrawn = userAfter - userBefore;

  console.log("Step 1: Withdraw");
  console.log("  Received:", formatUSDC(withdrawn), "USDC");

  const newPlan = await savingsBank.savingPlans(planId);
  await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), amount)).wait();
  await (await savingsBank.connect(deployer).openDeposit(planId, amount, false)).wait();

  const newDepositId = (await savingsBank.nextDepositId()) - 1n;
  const [, , , , newAprBps] = await savingsBank.getDepositDetails(newDepositId);

  console.log("Step 2: Open new deposit (manual renew)");
  console.log("  New deposit #" + newDepositId.toString());
  console.log("  APR:", formatBps(newAprBps), "(NEW plan rate)");
  console.log("✅ Manual renew = withdraw + openDeposit with current plan\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
