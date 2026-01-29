# Test Scripts - DeFi Savings Protocol

Complete guide for testing the deployed protocol with **new architecture** (TokenVault + InterestVault + SavingsBank).

---

## 🚀 Quick Start

### 1. Deploy Contracts

```bash
npx hardhat deploy --reset
```

This will:
- Deploy MockUSDC, TokenVault, InterestVault, MockDepositNFT, SavingsBank
- Transfer ownership to SavingsBank
- Fund InterestVault with 100,000 USDC
- Create 3 saving plans (7, 30, 90 days)

### 2. Run Test Scripts

```bash
# Check deployment status
npx hardhat run scripts/01_check_deployment.ts

# Open a deposit
npx hardhat run scripts/02_open_deposit.ts

# Check interest
npx hardhat run scripts/03_check_interest.ts

# Withdraw at maturity
npx hardhat run scripts/04_withdraw_matured.ts

# OR early withdraw
npx hardhat run scripts/05_early_withdraw.ts

# OR renew deposit
npx hardhat run scripts/06_renew_deposit.ts

# Check vault health
npx hardhat run scripts/07_check_vault_health.ts
```

---

## 📋 Script Details

### Script 01: Check Deployment ✅

**Purpose:** Verify all contracts deployed and configured correctly

```bash
npx hardhat run scripts/01_check_deployment.ts
```

**Shows:**
- Contract addresses
- Ownership configuration
- Vault balances
- Available plans
- System status

**Use when:** After deployment to verify everything is ready

---

### Script 02: Open Deposit 💵

**Purpose:** Open a new savings deposit

```bash
npx hardhat run scripts/02_open_deposit.ts
```

**What it does:**
- Mints USDC to user if needed
- Approves TokenVault
- Opens deposit with chosen plan
- Mints NFT to user
- Shows deposit details

**Customize in script:**
```typescript
const planId = 2; // 1=7days, 2=30days, 3=90days
const depositAmount = ethers.parseUnits("1000", 6); // Amount in USDC
const enableAutoRenew = false; // Auto renew on maturity
```

**Architecture verification:**
- ✅ Principal → TokenVault
- ✅ Interest reserved → InterestVault
- ✅ NFT minted

---

### Script 03: Check Interest 📊

**Purpose:** Check accrued interest for a deposit

```bash
# Check deposit ID 1 (default)
npx hardhat run scripts/03_check_interest.ts

# Check specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/03_check_interest.ts
```

**Shows:**
- Time progress (elapsed/remaining days)
- Current accrued interest
- Full interest at maturity
- Withdrawal options comparison

---

### Script 04: Withdraw Matured 💸

**Purpose:** Withdraw principal + interest at maturity

```bash
# Withdraw deposit ID 1 (default)
npx hardhat run scripts/04_withdraw_matured.ts

# Withdraw specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/04_withdraw_matured.ts
```

**Requirements:**
- Deposit must be ACTIVE
- Must have reached maturity

**Architecture verification:**
- ✅ Principal paid from TokenVault
- ✅ Interest paid from InterestVault
- ✅ Reserved funds released
- ✅ NFT burned

---

### Script 05: Early Withdraw ⚠️

**Purpose:** Withdraw before maturity (with penalty)

```bash
# Early withdraw deposit ID 1 (default)
npx hardhat run scripts/05_early_withdraw.ts

# Early withdraw specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/05_early_withdraw.ts
```

**What happens:**
- User receives: Principal - Penalty
- No interest paid (early withdrawal)
- Penalty goes to InterestVault (boosts liquidity)

**Architecture verification:**
- ✅ Principal minus penalty from TokenVault
- ✅ Penalty to InterestVault
- ✅ Reserved interest released
- ✅ NFT burned

---

### Script 06: Renew Deposit ♻️

**Purpose:** Renew matured deposit (compound interest)

```bash
# Auto-renew (keep locked rate)
npx hardhat run scripts/06_renew_deposit.ts

# Manual renew (use current rate)
USE_CURRENT_RATE=true npx hardhat run scripts/06_renew_deposit.ts

# Renew to different plan
NEW_PLAN_ID=3 npx hardhat run scripts/06_renew_deposit.ts

# Renew specific deposit
DEPOSIT_ID=2 npx hardhat run scripts/06_renew_deposit.ts
```

**Architecture flow:**
1. Old interest released from InterestVault
2. Interest transferred to TokenVault (joins principal)
3. New principal = old principal + interest
4. New interest reserved in InterestVault
5. Old NFT burned, new NFT minted

**Auto vs Manual:**
- **Auto (`useCurrentRate=false`):** Keep original locked APR
- **Manual (`useCurrentRate=true`):** Use current plan APR

---

### Script 07: Check Vault Health 🏥

**Purpose:** Monitor system health and liquidity

```bash
npx hardhat run scripts/07_check_vault_health.ts
```

**Shows:**
- TokenVault balance (principal)
- InterestVault balance/reserved/available
- Utilization rate
- Total TVL (Total Value Locked)
- Capital efficiency
- Active plans
- Recommendations

---

## 🎯 Common Workflows

### Workflow 1: Complete User Journey

```bash
# 1. Check system ready
npx hardhat run scripts/01_check_deployment.ts

# 2. Open deposit
npx hardhat run scripts/02_open_deposit.ts

# 3. Check interest anytime
npx hardhat run scripts/03_check_interest.ts

# 4. Withdraw at maturity
npx hardhat run scripts/04_withdraw_matured.ts
```

### Workflow 2: Test Early Withdrawal

```bash
# 1. Open deposit
npx hardhat run scripts/02_open_deposit.ts

# 2. Wait some time (or fast-forward in test)

# 3. Early withdraw
npx hardhat run scripts/05_early_withdraw.ts
```

### Workflow 3: Test Renewal

```bash
# 1. Open deposit
npx hardhat run scripts/02_open_deposit.ts

# 2. Wait until maturity (or fast-forward)

# 3. Renew deposit
npx hardhat run scripts/06_renew_deposit.ts

# 4. Check new deposit
DEPOSIT_ID=2 npx hardhat run scripts/03_check_interest.ts
```

### Workflow 4: Monitor System

```bash
# Check vault health regularly
npx hardhat run scripts/07_check_vault_health.ts
```

---

## 💡 Tips & Tricks

### Using Environment Variables

```bash
# Specify deposit ID
DEPOSIT_ID=3 npx hardhat run scripts/03_check_interest.ts

# Manual renew with current rate
DEPOSIT_ID=2 USE_CURRENT_RATE=true npx hardhat run scripts/06_renew_deposit.ts

# Renew to different plan
DEPOSIT_ID=1 NEW_PLAN_ID=3 npx hardhat run scripts/06_renew_deposit.ts
```

### Fast Forward Time (Testing Only)

Add to any script for testing:

```typescript
// Fast forward 7 days
await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
await ethers.provider.send("evm_mine", []);
```

### Network Selection

```bash
# Local hardhat network (default)
npx hardhat run scripts/01_check_deployment.ts

# Localhost (hardhat node)
npx hardhat run scripts/01_check_deployment.ts --network localhost

# Sepolia testnet
npx hardhat run scripts/01_check_deployment.ts --network sepolia
```

---

## 🏗️ Architecture Verification

All scripts verify the new architecture:

### openDeposit (Script 02)
- ✅ Principal → TokenVault
- ✅ Interest reserved → InterestVault
- ✅ NFT minted

### withdraw (Script 04)
- ✅ Principal ← TokenVault
- ✅ Interest ← InterestVault
- ✅ Reserves released
- ✅ NFT burned

### earlyWithdraw (Script 05)
- ✅ Principal - penalty ← TokenVault
- ✅ Penalty → InterestVault
- ✅ Reserves released
- ✅ NFT burned

### renew (Script 06)
- ✅ Interest: InterestVault → TokenVault
- ✅ New principal = old + interest (in TokenVault)
- ✅ New interest reserved
- ✅ Old NFT burned, new NFT minted

---

## 🐛 Troubleshooting

### "Deposit not found"
- Check deposit ID exists
- Use script 01 to see all deposits

### "Deposit not active"
- Deposit already withdrawn/renewed
- Check status with script 03

### "Not yet matured"
- Use script 05 for early withdrawal
- Or wait until maturity

### "Already matured"
- Use script 04 for normal withdrawal
- Don't use early withdrawal

### "Insufficient balance"
- InterestVault needs more funds
- Contact admin to fund vault

---

## ✅ Test Checklist

After deployment, verify:

- [ ] Script 01: System deployed correctly
- [ ] Script 02: Deposit opens successfully
- [ ] Script 03: Interest calculates correctly
- [ ] Script 04: Normal withdrawal works
- [ ] Script 05: Early withdrawal with penalty works
- [ ] Script 06: Renewal compounds correctly
- [ ] Script 07: Vault health check passes

---

## 📚 Related Documentation

- `../deploy/` - Deployment scripts
- `../docs/REFACTOR_SUMMARY.md` - Architecture overview
- `../docs/TESTNET_DEPLOYMENT_GUIDE.md` - Testnet deployment

---

*Scripts for New Architecture (TokenVault + InterestVault + SavingsBank) - Production Ready*
