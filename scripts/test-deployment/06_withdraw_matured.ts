import { ethers } from "hardhat";
import { loadContracts, formatUSDC, fastForward, isLocalNetwork, STATUS } from "./helpers";

async function main() {
  console.log("\n💸 Withdraw Matured\n");

  const { usdc, tokenVault, interestVault, savingsBank, depositNFT, deployer } = await loadContracts();
  const tokenId = 1n;

  const [, principal, , maturityTime, , , status] = await savingsBank.getDepositDetails(tokenId);
  if (principal === 0n) {
    console.log("No active deposit for token ID", tokenId.toString());
    return;
  }

  const owner = await depositNFT.ownerOf(tokenId);
  if (owner !== deployer.address) {
    console.log("Not owner of NFT. Owner:", owner);
    return;
  }

  if (isLocalNetwork()) {
    const planId = (await savingsBank.getDepositDetails(tokenId))[0];
    const plan = await savingsBank.savingPlans(planId);
    await fastForward(Number(plan.durationDays) + 1);
  }

  const block = await ethers.provider.getBlock("latest");
  const matured = block != null && block.timestamp >= Number(maturityTime);
  if (!matured) {
    console.log("Deposit not matured yet. Run on localhost for time fast-forward.");
    return;
  }

  const userBefore = await usdc.balanceOf(deployer.address);
  const interest = await savingsBank.calculateInterest(tokenId);

  await (await savingsBank.connect(deployer).withdraw(tokenId)).wait();

  const userAfter = await usdc.balanceOf(deployer.address);
  const received = userAfter - userBefore;

  console.log("Withdrawn:");
  console.log("  Principal:", formatUSDC(principal), "USDC");
  console.log("  Interest:", formatUSDC(interest), "USDC");
  console.log("  Total received:", formatUSDC(received), "USDC");
  console.log("✅ Withdraw successful\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
