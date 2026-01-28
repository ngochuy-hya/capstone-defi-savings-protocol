# Scripts Guide - DeFi Savings Protocol (Method 2)

Complete guide for deploying and testing the DeFi Savings Protocol with Method 2 architecture.

---

## 🚀 Quick Start

### 1. Deploy Contracts

```bash
# Deploy all contracts
npx hardhat deploy

# Or deploy individually
npx hardhat deploy --tags MockUSDC
npx hardhat deploy --tags VaultManager  
npx hardhat deploy --tags SavingsBank
```

### 2. Run Test Scripts in Order

```bash
# Complete setup and testing flow
npx hardhat run scripts/01_fund_vault.ts
npx hardhat run scripts/02_create_plans.ts
npx hardhat run scripts/03_open_deposit.ts
npx hardhat run scripts/04_check_interest.ts

# After maturity (or fast-forward in test)
npx hardhat run scripts/05_withdraw_matured.ts

# Or test early withdrawal
npx hardhat run scripts/06_early_withdraw.ts

# Or test renewal
npx hardhat run scripts/07_renew_deposit.ts

# Monitor vault health
npx hardhat run scripts/08_check_vault_health.ts

# Run complete test suite
npx hardhat run scripts/09_full_test_suite.ts
```

---

## 📋 Script Details

### Script 01: Fund Vault 💰
**File:** `01_fund_vault.ts`

**Purpose:** Fund VaultManager with USDC for interest payments

**Method 2 Note:** VaultManager only needs ~2-10% of expected TVL (for interest, not principal)

```bash
npx hardhat run scripts/01_fund_vault.ts
```

**What it does:**
- Checks deployer USDC balance
- Approves VaultManager
- Funds 100,000 USDC to VaultManager
- Displays vault health status

---

### Script 02: Create Plans 📋
**File:** `02_create_plans.ts`

**Purpose:** Create 4 saving plans with different terms

```bash
npx hardhat run scripts/02_create_plans.ts
```

**Plans Created:**
1. **7-Day:** 5% APR, 3% penalty
2. **30-Day:** 8% APR, 5% penalty
3. **90-Day:** 10% APR, 7% penalty
4. **180-Day:** 12% APR, 10% penalty

---

### Script 03: Open Deposit 💵
**File:** `03_open_deposit.ts`

**Purpose:** Open a savings deposit (defaults to 10,000 USDC @ 30-day plan)

```bash
npx hardhat run scripts/03_open_deposit.ts
```

**Method 2 Verification:**
- ✅ Principal goes to SavingsBank
- ✅ Interest reserved in VaultManager
- ✅ Shows both balances

**Edit script to customize:**
```typescript
const planId = 2; // Change plan
const depositAmount = ethers.parseUnits("10000", 6); // Change amount
const enableAutoRenew = false; // Enable auto-renew
```

---

### Script 04: Check Interest 📊
**File:** `04_check_interest.ts`

**Purpose:** Check accrued interest for a deposit

```bash
# Check deposit ID 1 (default)
npx hardhat run scripts/04_check_interest.ts

# Check specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/04_check_interest.ts
```

**Shows:**
- Time elapsed / remaining
- Current interest accrued
- Full interest at maturity
- Progress percentage
- Early withdrawal preview (if not matured)

---

### Script 05: Withdraw Matured 💸
**File:** `05_withdraw_matured.ts`

**Purpose:** Withdraw deposit at maturity (full principal + interest)

```bash
# Withdraw deposit ID 1 (default)
npx hardhat run scripts/05_withdraw_matured.ts

# Withdraw specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/05_withdraw_matured.ts
```

**Method 2 Verification:**
- ✅ Principal paid from SavingsBank
- ✅ Interest paid from VaultManager
- ✅ Reserved funds released

**Requirements:**
- Deposit must be ACTIVE
- Must have reached maturity

---

### Script 06: Early Withdraw ⚠️
**File:** `06_early_withdraw.ts`

**Purpose:** Withdraw before maturity (with penalty)

```bash
# Early withdraw deposit ID 1 (default)
npx hardhat run scripts/06_early_withdraw.ts

# Early withdraw specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/06_early_withdraw.ts
```

**Method 2 Verification:**
- ✅ Principal - penalty from SavingsBank
- ✅ Penalty to feeReceiver (from SavingsBank)
- ✅ Pro-rata interest from VaultManager
- ✅ Unused interest reserves released

**Example:**
- Principal: 10,000 USDC
- After 15 days (50% of 30-day term)
- Pro-rata interest: ~32.88 USDC
- Penalty (5%): 500 USDC
- User receives: 10,000 - 500 + 32.88 = **9,532.88 USDC**

---

### Script 07: Renew Deposit ♻️
**File:** `07_renew_deposit.ts`

**Purpose:** Renew matured deposit (compound interest into principal)

```bash
# Auto-renew (keep locked rate)
npx hardhat run scripts/07_renew_deposit.ts

# Manual renew (use current plan rate)
USE_CURRENT_RATE=true npx hardhat run scripts/07_renew_deposit.ts

# Renew specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/07_renew_deposit.ts
```

**Method 2 Flow:**
1. Old interest released from VaultManager
2. Interest transferred to SavingsBank
3. New principal = old principal + interest (both in SavingsBank)
4. New interest reserved in VaultManager

**Auto vs Manual Renew:**
- **Auto (`useCurrentRate=false`):** Keep original locked APR
- **Manual (`useCurrentRate=true`):** Use current plan APR

**Requirements:**
- Deposit must be ACTIVE
- Must have reached maturity

---

### Script 08: Check Vault Health 🏥
**File:** `08_check_vault_health.ts`

**Purpose:** Monitor VaultManager health and reserves

```bash
npx hardhat run scripts/08_check_vault_health.ts
```

**Shows:**
- Total balance, reserved, available funds
- Health ratio (current vs minimum required)
- Utilization rate
- SavingsBank principal held
- Protocol TVL (total value locked)
- Capital efficiency (Method 2 advantage)
- Active deposits statistics
- Recommendations

---

### Script 09: Full Test Suite 🧪
**File:** `09_full_test_suite.ts`

**Purpose:** Complete end-to-end test of all features

```bash
npx hardhat run scripts/09_full_test_suite.ts
```

**Tests:**
1. ✅ Setup and initial balances
2. ✅ Multiple users open deposits
3. ✅ Interest calculation over time
4. ✅ Early withdrawal with penalty
5. ✅ Normal withdrawal at maturity
6. ✅ Deposit renewal with compounding
7. ✅ Final vault health check

**Perfect for:**
- Testing after deployment
- Verifying Method 2 architecture
- Demonstrating all features
- Integration testing

---

## 🎯 Common Workflows

### Workflow 1: Initial Setup
```bash
# 1. Deploy
npx hardhat deploy

# 2. Fund vault
npx hardhat run scripts/01_fund_vault.ts

# 3. Create plans
npx hardhat run scripts/02_create_plans.ts

# 4. Ready for users!
```

### Workflow 2: User Opens Deposit
```bash
# 1. Open deposit
npx hardhat run scripts/03_open_deposit.ts

# 2. Check interest anytime
npx hardhat run scripts/04_check_interest.ts

# 3. Withdraw when matured
npx hardhat run scripts/05_withdraw_matured.ts
```

### Workflow 3: Testing All Features
```bash
# Run comprehensive test suite
npx hardhat run scripts/09_full_test_suite.ts
```

### Workflow 4: Monitor Protocol
```bash
# Check vault health regularly
npx hardhat run scripts/08_check_vault_health.ts
```

---

## 💡 Tips

### Using Environment Variables

```bash
# Withdraw specific deposit
DEPOSIT_ID=5 npx hardhat run scripts/05_withdraw_matured.ts

# Renew with current rate
DEPOSIT_ID=3 USE_CURRENT_RATE=true npx hardhat run scripts/07_renew_deposit.ts
```

### Network Selection

```bash
# Local hardhat network (default)
npx hardhat run scripts/01_fund_vault.ts

# Localhost (hardhat node)
npx hardhat run scripts/01_fund_vault.ts --network localhost

# Sepolia testnet
npx hardhat run scripts/01_fund_vault.ts --network sepolia
```

### Fast Forward Time (Testing)

In scripts, use:
```typescript
// Fast forward 15 days
await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]);
await ethers.provider.send("evm_mine", []);
```

---

## 🔍 Method 2 Architecture Verification

All scripts verify Method 2 architecture:

### openDeposit
- ✅ Principal → SavingsBank
- ✅ Interest reserved → VaultManager

### withdraw
- ✅ Principal ← SavingsBank
- ✅ Interest ← VaultManager
- ✅ Reserves released

### earlyWithdraw
- ✅ Principal - penalty ← SavingsBank
- ✅ Penalty → feeReceiver (from SavingsBank)
- ✅ Pro-rata interest ← VaultManager
- ✅ Unused reserves released

### renew
- ✅ Old interest: VaultManager → SavingsBank
- ✅ New principal = old principal + interest (in SavingsBank)
- ✅ New interest reserved in VaultManager

---

## 🐛 Troubleshooting

### "Deposit not active"
- Deposit already withdrawn/renewed
- Check deposit status: `await savingsBank.getDeposit(id)`

### "Not yet matured"
- Use script 06 for early withdrawal
- Or wait until maturity date

### "Already matured"
- Use script 05 for normal withdrawal
- Don't use early withdrawal script

### "Insufficient balance"
- VaultManager needs more funds
- Run script 01 to fund vault
- Check health with script 08

### "Insufficient available funds"
- All vault funds are reserved
- Fund the vault to enable new deposits
- Check with script 08

---

## 📚 Related Documentation

- [METHOD2_ARCHITECTURE.md](../docs/METHOD2_ARCHITECTURE.md) - Detailed architecture
- [METHOD2_REFACTOR_SUMMARY.md](../docs/METHOD2_REFACTOR_SUMMARY.md) - Refactor summary
- [DEPLOYMENT_SUCCESS.md](../docs/DEPLOYMENT_SUCCESS.md) - Testnet deployment guide

---

## ✅ Test Checklist

After deployment, verify:

- [ ] Scripts 01-02: Setup complete
- [ ] Script 03: Deposit opens successfully
- [ ] Script 04: Interest calculates correctly
- [ ] Script 05: Normal withdrawal works
- [ ] Script 06: Early withdrawal with penalty works
- [ ] Script 07: Renewal compounds correctly
- [ ] Script 08: Vault healthy
- [ ] Script 09: Full E2E test passes

---

*Scripts for Method 2 Architecture - Production Ready*
