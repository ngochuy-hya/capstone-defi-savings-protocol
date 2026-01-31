import { ethers, deployments } from "hardhat";

/**
 * Mint MockUSDC tới một địa chỉ cố định (local hoặc Sepolia)
 *
 * Cách dùng:
 *   - Sửa `TARGET_ADDRESS` thành địa chỉ ví cần nhận USDC
 *   - (Tuỳ chọn) sửa `AMOUNT_USDC` nếu muốn
 *   - Chạy:
 *       npx hardhat run scripts/helpers/mint_to_address.ts --network sepolia
 */

// TODO: ĐỔI THÀNH ĐỊA CHỈ CỦA BẠN
const TARGET_ADDRESS = "0x7Fd5E1B5954B00027cA0C2FC152449411089BF1d";

// Số USDC muốn mint (ví dụ "1000" = 1000 USDC)
const AMOUNT_USDC = "100000000";

async function main() {
  console.log("\n💰 Mint MockUSDC to Fixed Address\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Using admin (owner):", deployer.address);

  if (!ethers.isAddress(TARGET_ADDRESS)) {
    console.log("⚠️  TARGET_ADDRESS trong file hiện chưa phải địa chỉ hợp lệ.");
    console.log("   Hãy sửa hằng số TARGET_ADDRESS thành ví Sepolia của bạn rồi chạy lại.");
    process.exit(1);
  }

  const amount = ethers.parseUnits(AMOUNT_USDC, 6);

  let MockUSDC: { address: string };
  try {
    MockUSDC = await deployments.get("MockUSDC");
  } catch {
    console.log("⚠️  MockUSDC chưa deploy trên network này. Chạy deploy trước:");
    console.log("   npx hardhat deploy --network sepolia");
    process.exit(1);
  }
  const mockUSDC = await ethers.getContractAt("MockUSDC", MockUSDC.address);

  console.log("\n📌 MockUSDC:", MockUSDC.address);
  console.log("🎯 Target address:", TARGET_ADDRESS);
  console.log("💵 Amount:", AMOUNT_USDC, "USDC");

  const before = await mockUSDC.balanceOf(TARGET_ADDRESS);
  console.log("\n📊 Balance BEFORE:", ethers.formatUnits(before, 6), "USDC");

  console.log("\n⏳ Minting...");
  const tx = await mockUSDC.mint(TARGET_ADDRESS, amount);
  await tx.wait();
  console.log("✅ Minted successfully!");

  const after = await mockUSDC.balanceOf(TARGET_ADDRESS);
  console.log("\n📊 Balance AFTER:", ethers.formatUnits(after, 6), "USDC");

  console.log(
    "\n✅ Done. Minted",
    AMOUNT_USDC,
    "USDC to",
    TARGET_ADDRESS,
    "\n"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

