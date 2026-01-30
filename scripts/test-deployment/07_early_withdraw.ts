import { ethers } from "hardhat";
import { loadContracts, formatUSDC, fastForward, isLocalNetwork, parseUSDC } from "./helpers";

async function main() {
  console.log("\n⚠️ Early Withdraw Test\n");

  const { usdc, tokenVault, interestVault, savingsBank, deployer } = await loadContracts();

  const planId = 2;
  const amount = parseUSDC("10000");
  let userBalance = await usdc.balanceOf(deployer.address);
  if (userBalance < amount) {
    await (await usdc.mint(deployer.address, amount)).wait();
  }
  await (await usdc.connect(deployer).approve(await tokenVault.getAddress(), amount)).wait();
  await (await savingsBank.connect(deployer).openDeposit(planId, amount, false)).wait();

  const nextDepositId = await savingsBank.nextDepositId();
  const tokenId = nextDepositId - 1n;

  if (isLocalNetwork()) {
    await fastForward(15);
  }

  const [, principal, , maturityTime] = await savingsBank.getDepositDetails(tokenId);
  const plan = await savingsBank.savingPlans(planId);
  const penalty = (principal * BigInt(plan.earlyWithdrawPenaltyBps.toString())) / 10_000n;
  const userReceives = principal - penalty;

  const userBefore = await usdc.balanceOf(deployer.address);
  await (await savingsBank.connect(deployer).earlyWithdraw(tokenId)).wait();
  const userAfter = await usdc.balanceOf(deployer.address);

  const received = userAfter - userBefore;
  console.log("Early withdraw:");
  console.log("  Principal:", formatUSDC(principal), "USDC");
  console.log("  Penalty (" + Number(plan.earlyWithdrawPenaltyBps) / 100 + "%):", formatUSDC(penalty), "USDC");
  console.log("  User received:", formatUSDC(received), "USDC");
  console.log("✅ Early withdraw done\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
