import { ethers } from "hardhat";
import { loadContracts } from "./helpers";

/**
 * Admin script: tạo plan mới.
 * Chỉ owner của SavingsBank mới gọi được.
 *
 * Cách dùng:
 * 1. Sửa các hằng số bên dưới (name, durationDays, minDeposit, maxDeposit, aprBps, penaltyBps)
 * 2. Chạy: npx hardhat run scripts/test-deployment/create_plan.ts --network sepolia
 */

const PLAN_NAME = "60 Days";
const DURATION_DAYS = 60;
const MIN_DEPOSIT_USDC = "500";
const MAX_DEPOSIT_USDC: string = "100000"; // đổi "0" = no limit
const APR_BPS = 900; // 9% = 900 bps
const PENALTY_BPS = 500; // 5% = 500 bps

async function main() {
  console.log("\n📋 Create Plan (Admin)\n");

  const { savingsBank, deployer } = await loadContracts();

  const owner = await savingsBank.owner();
  if (owner !== deployer.address) {
    console.log("❌ Chỉ owner mới tạo được plan. Owner:", owner);
    process.exit(1);
  }

  const minDeposit = ethers.parseUnits(MIN_DEPOSIT_USDC, 6);
  const maxDepositStr: string = MAX_DEPOSIT_USDC;
  const noLimit = maxDepositStr === "0" || maxDepositStr === "";
  const maxDeposit = noLimit ? ethers.MaxUint256 : ethers.parseUnits(maxDepositStr, 6);

  console.log("Plan:");
  console.log("  Name:", PLAN_NAME);
  console.log("  Duration:", DURATION_DAYS, "days");
  console.log("  Min:", MIN_DEPOSIT_USDC, "USDC");
  console.log("  Max:", noLimit ? "No limit" : maxDepositStr, "USDC");
  console.log("  APR:", APR_BPS / 100 + "%");
  console.log("  Penalty:", PENALTY_BPS / 100 + "%");

  const tx = await savingsBank
    .connect(deployer)
    .createPlan(PLAN_NAME, DURATION_DAYS, minDeposit, maxDeposit, APR_BPS, PENALTY_BPS);
  const receipt = await tx.wait();

  const planId = await savingsBank.nextPlanId().then((id: bigint) => id - 1n);
  console.log("\n✅ Plan created! Plan ID:", planId.toString());
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
