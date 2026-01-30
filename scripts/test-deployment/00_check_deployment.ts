import { ethers } from "hardhat";
import { loadContracts, formatUSDC } from "./helpers";

async function main() {
  console.log("\n🎉 Deployment Verification\n");

  const { addresses, savingsBank, usdc, tokenVault, interestVault, depositNFT } = await loadContracts();

  const code = (addr: string) => ethers.provider.getCode(addr);
  const hasCode = async (addr: string) => (await code(addr)) !== "0x";

  const checks = await Promise.all([
    hasCode(addresses.MockUSDC),
    hasCode(addresses.TokenVault),
    hasCode(addresses.InterestVault),
    hasCode(addresses.MockDepositNFT),
    hasCode(addresses.SavingsBank),
  ]);

  console.log("┌─────────────────┬────────────────────────────────────────────┐");
  console.log("│ Contract        │ Address                                    │");
  console.log("├─────────────────┼────────────────────────────────────────────┤");
  for (const [name, addr] of Object.entries(addresses)) {
    const ok = name === "MockUSDC" ? checks[0] : name === "TokenVault" ? checks[1] : name === "InterestVault" ? checks[2] : name === "MockDepositNFT" ? checks[3] : checks[4];
    console.log(`│ ${name.padEnd(15)} │ ${addr} │ ${ok ? "✅" : "❌"}`);
  }
  console.log("└─────────────────┴────────────────────────────────────────────┘");

  const sbUsdc = await savingsBank.usdc();
  const sbTokenVault = await savingsBank.tokenVault();
  const sbInterestVault = await savingsBank.interestVault();
  const sbDepositNFT = await savingsBank.depositNFT();

  const connectionsOk =
    sbUsdc === addresses.MockUSDC &&
    sbTokenVault === addresses.TokenVault &&
    sbInterestVault === addresses.InterestVault &&
    sbDepositNFT === addresses.MockDepositNFT;

  if (connectionsOk) console.log("\n✅ SavingsBank connections correct");
  else console.log("\n⚠️ SavingsBank connection mismatch");

  const allOk = checks.every(Boolean) && connectionsOk;
  console.log(allOk ? "\n✅ All contracts deployed successfully!\n" : "\n❌ Some checks failed\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
