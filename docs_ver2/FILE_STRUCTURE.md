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
│   └── 📄 MockDepositNFT.sol            (minimal ERC721Enumerable for deployments)
│
├── 📄 TokenVault.sol                   (immutable) holds principal
├── 📄 InterestVault.sol                (immutable) holds interest + penalties
├── 📄 DepositNFT.sol                   (production) on-chain metadata
├── 📄 SavingsBank.sol                  (direct deployment) logic + state
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
├── SavingsBank:        ~600 lines (direct deployment)
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
├── 📄 01_deploy_mock_usdc.ts           ← Deploy MockUSDC
├── 📄 02_deploy_vaults.ts              ← Deploy TokenVault + InterestVault
├── 📄 03_deploy_savings_bank.ts        ← Deploy MockDepositNFT + SavingsBank (constructor wires deps)
├── 📄 04_setup_ownership.ts            ← Transfer vault/NFT ownership to SavingsBank
└── 📄 05_configure_system.ts           ← Fund InterestVault + create initial plans
```

---

## 🔧 SCRIPTS DIRECTORY

```
scripts/
│
├── 📄 01_check_deployment.ts           ← Check ownership/balances/plans
├── 📄 02_open_deposit.ts               ← Open deposit
├── 📄 03_check_interest.ts             ← Check interest
├── 📄 04_withdraw_matured.ts           ← Withdraw matured
├── 📄 05_early_withdraw.ts             ← Early withdraw
├── 📄 06_renew_deposit.ts              ← Renew deposit
└── 📄 07_check_vault_health.ts         ← Vault health overview
    User functions:
    - usdc.approve(tokenVault, amount)
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
├── 📄 DEFI_SAVINGS_ARCHITECTURE_FINAL.md ← Canonical architecture/workflows (current)
├── 📄 FILE_STRUCTURE.md                ← This File
│   - Complete directory tree
│   - File organization
│
├── 📄 IMPLEMENTATION_PLAN_VER2.md       ← Implementation plan (current)
├── 📄 TASKS_VER2.md                     ← Task checklist (current)
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
├── (deployments files are generated by hardhat-deploy and ignored by git)
└── 📄 deployment-info.json
```

---

## ⚙️ CONFIG FILES

### **hardhat.config.ts**
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
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
    "verify": "hardhat --version"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.0",
    "@openzeppelin/contracts-upgradeable": "^5.0.0"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
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
✅ SavingsBank orchestrates logic + state (direct deployment)
```

### **Benefits:**
- ✅ **50% fewer contracts** (6 vs 10)
- ✅ **50% less deployment cost**
- ✅ **Easier to audit** (~1,150 lines vs ~1,800 lines)
- ⚠️ **Upgradeability** (optional later via proxy layer)
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
   - SavingsBank.sol

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
