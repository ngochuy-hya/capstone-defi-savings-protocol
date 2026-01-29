# 📁 DeFi Savings Protocol - File Structure (Pragmatic SOLID)

> **Version:** 3.0 - Pragmatic SOLID  
> **Last Updated:** 2026-01-29  
> **Contracts:** 6 total (~1,130 lines)

---

## 📂 ROOT STRUCTURE

```
capstone-defi-savings-protocol/
├── 📁 contracts/              ← Smart contracts (6 files)
├── 📁 test/                   ← Test files
├── 📁 deploy/                 ← Deployment scripts
├── 📁 scripts/                ← Utility scripts
├── 📁 docs_ver2/              ← Documentation (current)
├── 📁 data/                   ← Generated data, ABIs
├── 📁 artifacts/              ← Hardhat compilation
├── 📁 cache/                  ← Hardhat cache
├── 📁 typechain/              ← TypeChain types
├── 📄 hardhat.config.ts
├── 📄 package.json
├── 📄 .env
└── 📄 README.md
```

---

## 📦 CONTRACTS DIRECTORY (Pragmatic SOLID)

```
contracts/
│
├── 📁 mocks/                           ← Test Mocks
│   └── 📄 MockUSDC.sol                 (100 lines) ERC20, 6 decimals, mint
│
├── 📁 core/                            ← Core Immutable Contracts
│   ├── 📄 TokenVault.sol               (50 lines) Immutable vault giữ deposits
│   ├── 📄 InterestVault.sol            (70 lines) Immutable vault giữ interest pool
│   └── 📄 DepositNFT.sol               (300 lines) ERC721, Data URI metadata
│
├── � SavingsBank.sol                  (600 lines) UUPS Upgradeable Logic + State
│
├── � interfaces/
│   ├── 📄 ITokenVault.sol
│   ├── � IInterestVault.sol
│   ├── 📄 IDepositNFT.sol
│   └── 📄 ISavingsBank.sol
│
└── 📁 libraries/
    └── 📄 InterestCalculator.sol       (30 lines) Pure math functions
```

### **Contract Summary:**
```
Total: 6 contracts
├── MockUSDC:           ~100 lines (test only)
├── TokenVault:         ~50  lines (IMMUTABLE)
├── InterestVault:      ~70  lines (IMMUTABLE)
├── DepositNFT:         ~300 lines (IMMUTABLE)
├── SavingsBank:        ~600 lines (UPGRADEABLE via UUPS)
└── InterestCalculator: ~30  lines (library)
                        ─────
Total LOC:              ~1,150 lines
```

---

## 🧪 TEST DIRECTORY

```
test/
│
├── 📁 unit/                            ← Unit Tests (Isolated)
│   ├── 📄 MockUSDC.test.ts
│   ├── 📄 TokenVault.test.ts
│   ├── 📄 InterestVault.test.ts
│   ├── 📄 DepositNFT.test.ts
│   ├── 📄 SavingsBank.test.ts
│   │   ├── Plan management
│   │   ├── Deposit operations
│   │   ├── Withdraw operations
│   │   ├── Renewal operations
│   │   └── Admin functions
│   └── 📄 InterestCalculator.test.ts
│
├── 📁 integration/                     ← Integration Tests (E2E)
│   ├── 📄 FullFlow.test.ts
│   │   ├── Deposit → Withdraw
│   │   ├── Deposit → Early Withdraw
│   │   ├── Deposit → Renew → Withdraw
│   │   └── Multi-user scenarios
│   │
│   ├── 📄 Upgradeability.test.ts
│   │   ├── Deploy V1
│   │   ├── Create deposits
│   │   ├── Upgrade to V2
│   │   ├── Verify state preserved
│   │   └── Continue operations
│   │
│   └── 📄 NFTMetadata.test.ts
│       ├── TokenURI generation
│       ├── SVG rendering
│       └── OpenSea compatibility
│
└── 📁 fixtures/
    └── 📄 setup.ts                     ← Reusable test helpers
```

---

## 🚀 DEPLOY DIRECTORY

```
deploy/
│
├── 📄 01_deploy_mock.ts                ← Deploy MockUSDC
│   - Deploy MockUSDC(name, symbol, decimals)
│   - Mint initial supply for testing
│
├── 📄 02_deploy_vaults.ts              ← Deploy Immutable Vaults
│   - Deploy TokenVault(usdc)
│   - Deploy InterestVault(usdc)
│
├── 📄 03_deploy_nft.ts                 ← Deploy DepositNFT
│   - Deploy DepositNFT()
│
├── 📄 04_deploy_savings_bank.ts        ← Deploy SavingsBank (UUPS Proxy)
│   - Deploy SavingsBank Implementation
│   - Encode initialize(usdc, tokenVault, interestVault, depositNFT)
│   - Deploy ERC1967Proxy(implementation, initData)
│   - Save proxy address as SavingsBank
│
├── 📄 05_setup_ownership.ts            ← Transfer Ownership
│   - tokenVault.transferOwnership(savingsBank)
│   - interestVault.transferOwnership(savingsBank)
│   - depositNFT.transferOwnership(savingsBank)
│
├── 📄 06_configure_system.ts           ← Configure Connections
│   - depositNFT.setSavingsBank(savingsBank)
│   - Verify all connections
│
└── 📄 07_initialize_data.ts            ← Create Plans & Fund
    - savingsBank.createPlan("3 Months", 90, ...)
    - savingsBank.createPlan("6 Months", 180, ...)
    - savingsBank.createPlan("12 Months", 365, ...)
    - savingsBank.fundVault(1000000 * 1e6)
    - Log all addresses
```

---

## 🔧 SCRIPTS DIRECTORY

```
scripts/
│
├── 📄 verify.ts                        ← Verify on Etherscan
│   - Verify all deployed contracts
│   - Pass constructor/init arguments
│
├── 📄 upgrade.ts                       ← Upgrade SavingsBank
│   - Deploy SavingsBankV2
│   - savingsBank.upgradeTo(v2Address)
│   - Test upgrade success
│   - Verify state preserved
│
├── 📄 fund-vault.ts                    ← Fund InterestVault
│   - Admin funds interest pool
│   - Check available balance
│
├── 📄 create-plan.ts                   ← Create New Plan
│   - Helper to create/update plans
│   - Validate parameters
│
└── 📄 interact.ts                      ← Manual Interaction
    User functions:
    - usdc.approve(savingsBank, amount)
    - savingsBank.openDeposit(planId, amount, autoRenew)
    - savingsBank.withdraw(depositId)
    - savingsBank.earlyWithdraw(depositId)
    - savingsBank.renew(depositId, useCurrentRate, newPlanId)
    
    Admin functions:
    - savingsBank.createPlan(...)
    - savingsBank.updatePlan(...)
    - savingsBank.fundVault(amount)
    - savingsBank.withdrawVault(amount)
    - savingsBank.pause() / unpause()
```

---

## 📚 DOCS_VER2 DIRECTORY

```
docs_ver2/
│
├── 📄 ARCHITECTURE_V3_FINAL.md         ← Main Architecture (THIS DOC)
│   - 6-contract Pragmatic SOLID design
│   - UUPS proxy pattern
│   - Complete contract code
│   - Deployment & upgrade flows
│
├── 📄 FILE_STRUCTURE.md                ← This File
│   - Complete directory tree
│   - File organization
│
├── 📄 PLAN.md                          ← Implementation Plan
│   - Phased approach
│   - Task checklist
│   - Timeline estimates
│
├── 📄 DEPLOYMENT_GUIDE.md              ← Deployment Instructions
│   (To be created)
│
├── 📄 UPGRADE_GUIDE.md                 ← Upgrade Instructions
│   (To be created)
│
└── 📄 USER_GUIDE.md                    ← End-User Guide
    (To be created)
```

---

## 💾 DATA DIRECTORY

```
data/
│
├── 📁 abis/                            ← Exported ABIs
│   ├── 📄 MockUSDC.json
│   ├── 📄 TokenVault.json
│   ├── 📄 InterestVault.json
│   ├── 📄 DepositNFT.json
│   ├── 📄 SavingsBank.json
│   └── 📄 InterestCalculator.json
│
├── 📄 addresses.json                   ← Deployed Addresses
│   {
│     "sepolia": {
│       "MockUSDC": "0x...",
│       "TokenVault": "0x...",
│       "InterestVault": "0x...",
│       "DepositNFT": "0x...",
│       "SavingsBank": "0x...",        // Proxy address!
│       "SavingsBank_Implementation": "0x..."
│     }
│   }
│
└── 📄 deployment-info.json
```

---

## ⚙️ CONFIG FILES

### **hardhat.config.ts**
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";  // For UUPS proxy
import "hardhat-deploy";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};

export default config;
```

### **package.json**
```json
{
  "name": "capstone-defi-savings-protocol",
  "version": "3.0.0",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "test:unit": "hardhat test test/unit/**/*.test.ts",
    "test:integration": "hardhat test test/integration/**/*.test.ts",
    "deploy:local": "hardhat deploy --network hardhat",
    "deploy:sepolia": "hardhat deploy --network sepolia",
    "upgrade": "hardhat run scripts/upgrade.ts --network sepolia",
    "verify": "hardhat run scripts/verify.ts --network sepolia"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.0",
    "@openzeppelin/contracts-upgradeable": "^5.0.0"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@openzeppelin/hardhat-upgrades": "^3.0.0",
    "hardhat": "^2.19.0",
    "hardhat-deploy": "^0.11.45"
  }
}
```

---

## 📊 FILE COUNT SUMMARY

```
Total Files: ~35

Contracts:          6 core + 4 interfaces + 1 library = 11 files
  - mocks:          1 (MockUSDC)
  - core:           3 (vaults + NFT)
  - main:           1 (SavingsBank)
  - interfaces:     4
  - libraries:      1

Tests:              9 files
  - unit:           6
  - integration:    3
  - fixtures:       1

Deploy:             7 scripts

Scripts:            5 utilities

Docs:               6 documents

Data/Config:        4 files
```

---

## 🎯 KEY DIFFERENCES FROM FULL SOLID

### **Simplified:**
```
❌ Removed: PlanRegistry, DepositRegistry (merged into SavingsBank)
❌ Removed: DepositLogic, WithdrawLogic, RenewalLogic (merged into SavingsBank)
❌ Removed: SavingsCoordinator (SavingsBank IS the coordinator)

✅ Kept: TokenVault, InterestVault (CRITICAL for token safety)
✅ Kept: DepositNFT (CRITICAL for ownership independence)
✅ Upgraded: SavingsBank to UUPS proxy (replaces coordinator + logic contracts)
```

### **Benefits:**
- ✅ **50% fewer contracts** (6 vs 10)
- ✅ **50% less deployment cost**
- ✅ **Easier to audit** (~1,150 lines vs ~1,800 lines)
- ✅ **Still upgradeable** (UUPS proxy)
- ✅ **Still token-safe** (immutable vaults)

---

## ✅ IMPLEMENTATION ORDER

1. **Mocks & Libraries** (30 min)
   - MockUSDC.sol
   - InterestCalculator.sol

2. **Core Immutable** (2 hours)
   - TokenVault.sol
   - InterestVault.sol
   - DepositNFT.sol

3. **Main Logic** (4-5 hours)
   - SavingsBank.sol (UUPS upgradeable)

4. **Interfaces** (30 min)
   - ITokenVault.sol
   - IInterestVault.sol
   - IDepositNFT.sol
   - ISavingsBank.sol

5. **Tests** (2-3 days)
   - Unit tests
   - Integration tests
   - Upgrade tests

6. **Deploy Scripts** (1 day)
   - 7 deployment scripts
   - Verify scripts

---

**Last Updated:** 2026-01-29  
**Version:** 3.0 - Pragmatic SOLID
