import { loadContracts, formatUSDC } from "./helpers";

async function main() {
  console.log("\n🔐 Ownership Verification\n");

  const { tokenVault, interestVault, depositNFT, savingsBank, deployer } = await loadContracts();
  const sbAddr = await savingsBank.getAddress();

  const tvOwner = await tokenVault.owner();
  const ivOwner = await interestVault.owner();
  const nftOwner = await depositNFT.owner();
  const sbOwner = await savingsBank.owner();

  if (tvOwner === sbAddr) console.log("✅ TokenVault owned by SavingsBank");
  else console.log("❌ TokenVault owner:", tvOwner);

  if (ivOwner === sbAddr) console.log("✅ InterestVault owned by SavingsBank");
  else console.log("❌ InterestVault owner:", ivOwner);

  if (nftOwner === sbAddr) console.log("✅ MockDepositNFT owned by SavingsBank");
  else console.log("❌ MockDepositNFT owner:", nftOwner);

  if (sbOwner === deployer.address) console.log("✅ SavingsBank owned by Deployer");
  else console.log("❌ SavingsBank owner:", sbOwner);

  const nextPlanId = await savingsBank.nextPlanId();
  const nextDepositId = await savingsBank.nextDepositId();
  const balance = await interestVault.balance();
  const reserved = await interestVault.totalReserved();
  const available = await interestVault.availableBalance();

  console.log("\n📊 Initial State");
  console.log("   Next Plan ID:", nextPlanId.toString(), `(${Number(nextPlanId) - 1} plans created)`);
  console.log("   Next Deposit ID:", nextDepositId.toString());
  console.log("   InterestVault Balance:", formatUSDC(balance), "USDC");
  console.log("   InterestVault Reserved:", formatUSDC(reserved), "USDC");
  console.log("   InterestVault Available:", formatUSDC(available), "USDC");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
