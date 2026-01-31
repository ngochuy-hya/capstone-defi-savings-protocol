# 🎬 SaveVault Demo Scripts - Complete Flow

Full demonstration scripts cho SaveVault protocol trên localhost.

---

## 🚀 Quick Start

### 1. Start Hardhat Node
```bash
# Terminal 1
npx hardhat node
```

### 2. Deploy Contracts
```bash
# Terminal 2  
npx hardhat deploy --network localhost
```

### 3. Run Demo Flow
```bash
# Run scripts theo thứ tự 00 → 07
```

---

## 📋 Complete Demo Flow

### **Script 00: Check Deployment** ✅
```bash
npx hardhat run scripts/demo-local/00_check_deployment.ts --network localhost
```

**Mục đích:**
- Verify tất cả contracts deployed
- Check ownership (vaults → SavingsBank)
- Display contract addresses

**Output:**
- ✅ All contracts loaded
- ✅ Ownership correct
- Contract addresses

---

### **Script 01: Create Plans** 📋
```bash
npx hardhat run scripts/demo-local/01_create_plans.ts --network localhost
```

**Mục đích:**
- **Tạo saving plans** cho local testing
- Plans: 7 Days (5%), 30 Days (8%), 90 Days (10%)

**Output:**
- 3 plans created
- Plan details displayed

---

### **Script 02: Check Plans** 📊
```bash
npx hardhat run scripts/demo-local/02_check_plans.ts --network localhost
```

**Mục đích:**
- Display tất cả saving plans
- Show APR, duration, penalty

**Output:**
- List of plans
- Plan details (APR, min/max, penalty)

---

### **Script 03: Check Vaults** 💰
```bash
npx hardhat run scripts/demo-local/03_check_vaults.ts --network localhost
```

**Mục đích:**
- Check TokenVault balance
- Check InterestVault balance + reserved
- Health check

**Output:**
- TokenVault balance
- InterestVault: total, reserved, available
- Health status

---

### **Script 04: Fund Vault (Admin)** 💵
```bash
npx hardhat run scripts/demo-local/04_fund_vault.ts --network localhost
```

**Mục đích:**
- Admin nạp liquidity vào InterestVault
- Ensure có đủ tiền trả lãi

**Output:**
- Vault balance before/after
- Funding amount

---

### **Script 05: Open Deposit** 🏦
```bash
npx hardhat run scripts/demo-local/05_open_deposit.ts --network localhost
```

**Mục đích:**
- User opens saving deposit
- Mint NFT ownership proof

**Output:**
- Deposit ID
- Principal, expected interest
- Maturity date

---

### **Script 06: Check Interest** 💎
```bash
npx hardhat run scripts/demo-local/06_check_interest.ts --network localhost
```

**Mục đích:**
- Show all user's active deposits
- Calculate current interest

**Output:**
- List of deposits
- Interest calculation for each

---

### **Script 07: Withdraw (Matured)** 💸
```bash
npx hardhat run scripts/demo-local/07_withdraw.ts --network localhost
```

**Mục đích:**
- Withdraw deposit after maturity
- **Auto fast-forward** time on localhost

**Output:**
- Principal + interest received
- NFT burned

---

### **Script 08: Early Withdraw** ⚠️
```bash
npx hardhat run scripts/demo-local/08_early_withdraw.ts --network localhost
```

**Mục đích:**
- Demo early withdrawal
- Show penalty vs normal withdraw

**Output:**
- Penalty calculation
- Comparison with normal withdraw
- Loss amount

---

## 🎯 Recommended Demo Sequences

### **Sequence A: Happy Path (10 mins)**
```bash
# 1. Verify setup
npx hardhat run scripts/demo-local/00_check_deployment.ts --network localhost

# 2. Create plans (IMPORTANT!)
npx hardhat run scripts/demo-local/01_create_plans.ts --network localhost

# 3. Show available plans
npx hardhat run scripts/demo-local/02_check_plans.ts --network localhost

# 4. Check vault health
npx hardhat run scripts/demo-local/03_check_vaults.ts --network localhost

# 5. Fund vault
npx hardhat run scripts/demo-local/04_fund_vault.ts --network localhost

# 6. Open deposit
npx hardhat run scripts/demo-local/05_open_deposit.ts --network localhost

# 7. Check interest
npx hardhat run scripts/demo-local/06_check_interest.ts --network localhost

# 8. Fast-forward + withdraw
npx hardhat run scripts/demo-local/07_withdraw.ts --network localhost
```

**Kết quả:** User nhận principal + interest ✅

---

### **Sequence B: Penalty Demo (5 mins)**
```bash
# Skip to early withdraw (auto opens deposit)
npx hardhat run scripts/demo-local/07_early_withdraw.ts --network localhost
```

**Kết quả:** Show penalty impact ⚠️

---

### **Sequence C: Interest Tracking (3 mins)**
```bash
# 1. Open deposit
npx hardhat run scripts/demo-local/04_open_deposit.ts --network localhost

# 2. Check interest anytime
npx hardhat run scripts/demo-local/06_check_interest.ts --network localhost
```

---

## 🎤 Presentation Timeline (10 mins)

```
00:00 - Giới thiệu architecture
02:00 - Run script 00 (check deployment)
02:30 - Run script 01 (show plans)
03:00 - Run script 02 (check vaults)
03:30 - Giải thích admin funding
04:00 - Run script 03 (fund vault)
04:30 - Giải thích open deposit flow
05:00 - Run script 04 (open deposit)
05:30 - Explain interest calculation
06:00 - Run script 05 (withdraw với fast-forward)
07:00 - Compare với early withdraw
07:30 - Run script 07 (early withdraw demo)
08:30 - Show script 06 (check interest)
09:00 - Q&A
```

---

## ⏰ Fast-Forward Magic

Scripts tự động detect localhost và **fast-forward time**:

```typescript
if (isLocalNetwork()) {
  await fastForward(7); // Skip 7 days instantly
}
```

**Chỉ hoạt động trên:**
- ✅ hardhat network
- ✅ localhost

**KHÔNG hoạt động:**
- ❌ Sepolia/testnets
- ❌ Mainnet

---

## 🔧 Customization

### Change Plan
Edit trong scripts:
```typescript
const planId = 1; // Change to 1, 2, or 3
```

### Change Amount
```typescript
const amount = parseUSDC("100"); // Change amount
```

### Change Deposit ID
```typescript
const depositId = 1n; // Your deposit ID
```

---

## 📊 Expected Outputs

### Script 00 - Check Deployment
```
🔍 ===== DEMO: CHECK DEPLOYMENT =====

✅ All contracts loaded successfully!

📋 Contract Addresses:
   MockUSDC: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   TokenVault: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   ...

🔐 Ownership Check:
   ✅ Ownership correctly set to SavingsBank
```

### Script 04 - Open Deposit
```
🏦 ===== DEMO: OPEN DEPOSIT =====

✅ ===== DEPOSIT OPENED SUCCESSFULLY =====

🎯 Deposit Details:
   Deposit ID: 1
   Principal: 100.0 USDC
   Expected interest: 1.37 USDC
   Total at maturity: 101.37 USDC
```

### Script 05 - Withdraw
```
💸 ===== DEMO: WITHDRAW (MATURED) =====

⏰ Fast-forwarded 8 days...

✅ ===== WITHDRAW SUCCESSFUL =====

💰 You received: 101.37 USDC

📊 Breakdown:
   Principal: 100.0 USDC
   Interest: 1.37 USDC
```

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "No active deposit found" | Run script 04 first |
| "Contract not found" | Run `npx hardhat deploy --network localhost` |
| "Not owner of deposit" | Check deployer address |
| "Deposit not matured" | Use localhost (for fast-forward) |
| "Insufficient liquidity" | Run script 03 (fund vault) |

---

## 💡 Pro Tips

1. **Always run 00 first** → verify setup
2. **Fund vault generously** → avoid liquidity issues
3. **Use fast-forward** → don't wait real time
4. **Check interest often** → show accumulation
5. **Compare scenarios** → script 05 vs 07

---

## 📁 File Structure

```
scripts/demo-local/
├── 00_check_deployment.ts   # Verify setup
├── 01_check_plans.ts         # Show plans
├── 02_check_vaults.ts        # Check balances
├── 03_fund_vault.ts          # Admin fund
├── 04_open_deposit.ts        # Open deposit
├── 05_withdraw.ts            # Withdraw matured
├── 06_check_interest.ts      # Check interest
├── 07_early_withdraw.ts      # Early withdraw
├── helpers.ts                # Utilities
└── README.md                 # This file
```

---

**Chúc bạn demo thành công! 🚀**

Nếu có lỗi, check lại README hoặc run script 00 để verify setup.
