# Method 2 Architecture - Separated Principal & Interest

## 🏗️ Overview

Method 2 là kiến trúc tách biệt rõ ràng giữa **principal (user funds)** và **interest pool (protocol funds)**.

### Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                    METHOD 2 ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐          ┌────────────────────┐    │
│  │   SavingsBank      │          │   VaultManager     │    │
│  │                    │          │                    │    │
│  │  Holds:            │          │  Holds:            │    │
│  │  - User Principal  │          │  - Interest Pool   │    │
│  │  - User Deposits   │          │  - Reserved Funds  │    │
│  │                    │          │                    │    │
│  │  Functions:        │          │  Functions:        │    │
│  │  - openDeposit()   │◄────────►│  - reserveFunds()  │    │
│  │  - withdraw()      │          │  - releaseFunds()  │    │
│  │  - earlyWithdraw() │          │  - transferOut()   │    │
│  │  - renew()         │          │  - fundVault()     │    │
│  └────────────────────┘          └────────────────────┘    │
│           │                                │                │
│           │                                │                │
│           ▼                                ▼                │
│    User Principal                  Interest Payments       │
│    (USDC held)                     (USDC for yields)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Flow Details

### 1. openDeposit() - User mở sổ tiết kiệm

```solidity
┌─────────────┐
│    User     │
└──────┬──────┘
       │ 1. Approve USDC
       │ 2. Call openDeposit(planId, 10000 USDC, enableAutoRenew)
       ▼
┌─────────────────────────────────────────────────────┐
│                  SavingsBank                        │
│                                                     │
│  Step 1: Transfer 10000 USDC FROM user TO contract │◄── Principal stays here
│          (depositToken.safeTransferFrom)            │
│                                                     │
│  Step 2: Calculate expected interest                │
│          expectedInterest = 197.26 USDC             │
│          (10000 * 8% * 90days / 365days)            │
│                                                     │
│  Step 3: Reserve interest in VaultManager           │─────┐
│          vaultManager.reserveFunds(197.26)          │     │
│                                                     │     │
│  Step 4: Create DepositCertificate                  │     │
│  Step 5: Mint NFT                                   │     │
└─────────────────────────────────────────────────────┘     │
                                                             │
                                                             ▼
                                              ┌─────────────────────────┐
                                              │     VaultManager        │
                                              │                         │
                                              │ reservedFunds += 197.26 │◄── Interest reserved
                                              │                         │
                                              └─────────────────────────┘
```

**Result:**
- SavingsBank holds: 10,000 USDC (principal)
- VaultManager reserved: 197.26 USDC (interest obligation)

---

### 2. withdraw() - Rút tiền đúng hạn

```solidity
┌─────────────┐
│    User     │
└──────┬──────┘
       │ Call withdraw(depositId)
       ▼
┌─────────────────────────────────────────────────────┐
│                  SavingsBank                        │
│                                                     │
│  Step 1: Validate maturity reached                  │
│  Step 2: Calculate interest = 197.26 USDC           │
│                                                     │
│  Step 3: Release reserved funds                     │─────┐
│          vaultManager.releaseFunds(197.26)          │     │
│                                                     │     │
│  Step 4: Transfer principal FROM SavingsBank        │     │
│          depositToken.safeTransfer(user, 10000)     │     │
│                                                     │     │
│  Step 5: Transfer interest FROM VaultManager        │     │
│          vaultManager.transferOut(user, 197.26)     │◄────┤
│                                                     │     │
│  Step 6: Update status = WITHDRAWN                  │     │
└─────────────────────────────────────────────────────┘     │
       │                                                     │
       ▼                                                     ▼
┌─────────────┐                              ┌─────────────────────────┐
│    User     │                              │     VaultManager        │
│             │                              │                         │
│ Receives:   │                              │ reservedFunds -= 197.26 │
│ 10,000 USDC │◄─── From SavingsBank         │ totalBalance -= 197.26  │
│    197 USDC │◄─── From VaultManager        │                         │
│ Total: 10,197                              └─────────────────────────┘
└─────────────┘
```

**Key Point:** 
- Principal payment: SavingsBank → User
- Interest payment: VaultManager → User

---

### 3. earlyWithdraw() - Rút sớm với penalty

```solidity
Scenario:
- Principal: 10,000 USDC
- Plan: 90 days, 8% APR, 5% penalty
- Reserved interest at open: 197.26 USDC
- Withdraw after 45 days

┌─────────────┐
│    User     │
└──────┬──────┘
       │ Call earlyWithdraw(depositId)
       ▼
┌─────────────────────────────────────────────────────┐
│                  SavingsBank                        │
│                                                     │
│  Step 1: Calculate full interest (reserved)         │
│          fullInterest = 197.26 USDC                 │
│                                                     │
│  Step 2: Calculate pro-rata interest (45/90 days)   │
│          proRataInterest = 98.63 USDC               │
│                                                     │
│  Step 3: Calculate penalty (5% of principal)        │
│          penalty = 500 USDC                         │
│                                                     │
│  Step 4: Calculate unused interest reserves         │
│          unusedInterest = 197.26 - 98.63 = 98.63   │
│                                                     │
│  Step 5: Release unused reserves                    │─────┐
│          vaultManager.releaseFunds(98.63)           │     │
│                                                     │     │
│  Step 6: Transfer penalty to feeReceiver            │     │
│          depositToken.safeTransfer(feeReceiver, 500)│     │
│                                                     │     │
│  Step 7: Transfer (principal - penalty) to user     │     │
│          depositToken.safeTransfer(user, 9500)      │     │
│                                                     │     │
│  Step 8: Transfer pro-rata interest to user         │     │
│          vaultManager.transferOut(user, 98.63)      │◄────┤
└─────────────────────────────────────────────────────┘     │
       │                                                     │
       ▼                                                     ▼
┌─────────────┐                              ┌─────────────────────────┐
│    User     │                              │     VaultManager        │
│             │                              │                         │
│ Receives:   │                              │ reservedFunds -= 197.26 │
│  9,500 USDC │◄─── From SavingsBank         │  (full amount released) │
│     98 USDC │◄─── From VaultManager        │ totalBalance -= 98.63   │
│ Total: 9,598                               │  (only pro-rata paid)   │
└─────────────┘                              └─────────────────────────┘
       
┌─────────────┐
│ FeeReceiver │
│             │
│ Receives:   │
│    500 USDC │◄─── From SavingsBank
└─────────────┘
```

**Key Points:**
- Penalty deducted from principal (in SavingsBank)
- Unused interest reserves released back to VaultManager
- Pro-rata interest paid from VaultManager

---

### 4. renew() - Gia hạn sổ tiết kiệm

```solidity
Scenario:
- Old deposit: 10,000 USDC principal, 197.26 USDC interest earned
- Auto renew with same 8% APR

┌─────────────┐
│    User     │
└──────┬──────┘
       │ Call renew(depositId, useCurrentRate=false)
       ▼
┌─────────────────────────────────────────────────────┐
│                  SavingsBank                        │
│                                                     │
│  Step 1: Calculate interest from old deposit        │
│          interest = 197.26 USDC                     │
│                                                     │
│  Step 2: Release old reserved interest              │─────┐
│          vaultManager.releaseFunds(197.26)          │     │
│                                                     │     │
│  Step 3: Transfer interest TO SavingsBank           │     │
│          vaultManager.transferOut(this, 197.26)     │◄────┤
│          (Interest moves from VaultManager          │     │
│           to SavingsBank to join principal)         │     │
│                                                     │     │
│  Step 4: Calculate new principal                    │     │
│          newPrincipal = 10000 + 197.26 = 10197.26   │     │
│          (Both now in SavingsBank)                  │     │
│                                                     │     │
│  Step 5: Calculate new expected interest            │     │
│          newExpectedInterest = 200.04 USDC          │     │
│          (10197.26 * 8% * 90days / 365days)         │     │
│                                                     │     │
│  Step 6: Reserve new interest                       │     │
│          vaultManager.reserveFunds(200.04)          │─────┤
│                                                     │     │
│  Step 7: Create new DepositCertificate              │     │
│          principal: 10197.26 USDC                   │     │
│  Step 8: Mint new NFT                               │     │
└─────────────────────────────────────────────────────┘     │
                                                             │
                                                             ▼
                                              ┌─────────────────────────┐
                                              │     VaultManager        │
                                              │                         │
                                              │ Old: -197.26 (released) │
                                              │ Paid: -197.26 (to SB)   │
                                              │ New: +200.04 (reserved) │
                                              │                         │
                                              │ Net change: +2.78       │
                                              └─────────────────────────┘
```

**Result:**
- Old principal (10,000) + Old interest (197.26) = New principal (10,197.26)
- All principal now in SavingsBank
- New interest (200.04) reserved in VaultManager

---

## 💰 Balance Tracking

### SavingsBank Balance
```solidity
// Total principal held in SavingsBank
function getTotalPrincipalHeld() returns (uint256) {
    return depositToken.balanceOf(address(this));
}

// This should equal: Sum of all ACTIVE deposits' principals
```

### VaultManager Balance
```solidity
// Total interest pool
function totalBalance() returns (uint256)

// Reserved for existing deposits
function reservedFunds() returns (uint256)

// Available to reserve for new deposits
function getAvailableFunds() returns (uint256) {
    return totalBalance - reservedFunds;
}
```

### Invariants (Must Always Hold)

```solidity
// 1. SavingsBank balance = Sum of all ACTIVE deposits
SavingsBank.balance ≈ Σ(deposit[i].principal) where status == ACTIVE

// 2. VaultManager reserved = Sum of expected interest for all ACTIVE deposits
VaultManager.reserved ≈ Σ(expectedInterest[i]) where status == ACTIVE

// 3. No principal in VaultManager (only interest)
VaultManager.totalBalance = Interest pool only (no user principals)
```

---

## 🔄 Comparison: Old vs Method 2

### Old Method (Mixed Funds)
```
User deposits 10,000 USDC
└─► VaultManager holds 10,000 USDC (principal + future interest)
    └─► reservedFunds += 10,197.26 (principal + interest)

When withdraw:
└─► VaultManager pays 10,197.26 to user
```

**Problem:** Principal and interest mixed together, harder to track protocol obligations.

### Method 2 (Separated Funds)
```
User deposits 10,000 USDC
├─► SavingsBank holds 10,000 USDC (principal)
└─► VaultManager reserves 197.26 USDC (interest only)

When withdraw:
├─► SavingsBank pays 10,000 (principal)
└─► VaultManager pays 197.26 (interest)
```

**Benefits:**
1. Clear separation: user funds vs protocol obligations
2. VaultManager only needs interest reserves (smaller amount)
3. Easier to calculate protocol solvency
4. More transparent accounting

---

## 🎯 Benefits of Method 2

### 1. **Clearer Accounting**
- SavingsBank balance = User deposits (always safe)
- VaultManager balance = Protocol interest pool (protocol risk)

### 2. **Better Risk Management**
- User principal never at risk of protocol insolvency
- Only interest payments depend on VaultManager liquidity
- Admin can't accidentally withdraw user principal

### 3. **Easier Auditing**
```solidity
// Simple checks:
assert(SavingsBank.balance == Σ active principals);
assert(VaultManager.reserved == Σ expected interest);
assert(VaultManager.available >= 0); // Can fund new deposits?
```

### 4. **Scalability**
- VaultManager only needs to hold ~2-10% of total TVL (interest portion)
- Not 100-110% like old method
- More capital efficient for protocol

---

## 🧪 Testing Strategy

### Test Scenarios for Method 2

1. **Basic Deposit & Withdraw**
   - Verify principal stays in SavingsBank
   - Verify only interest reserved in VaultManager
   - Verify correct amounts transferred from both contracts

2. **Early Withdrawal**
   - Verify penalty deducted from principal (SavingsBank)
   - Verify unused interest released (VaultManager)
   - Verify pro-rata interest paid correctly

3. **Renewal**
   - Verify interest transfers from VaultManager to SavingsBank
   - Verify new principal = old principal + interest
   - Verify new reserves calculated correctly

4. **Balance Invariants**
   - Check `getTotalPrincipalHeld()` matches sum of active deposits
   - Check VaultManager reserves match expected interest obligations

5. **Edge Cases**
   - Multiple deposits and withdrawals
   - Insufficient VaultManager liquidity (should revert)
   - Large principal, small interest pool

---

## 📝 Migration Notes

### Breaking Changes from Old Implementation

1. **`openDeposit()`**
   - OLD: Transfers full amount to VaultManager
   - NEW: Transfers principal to SavingsBank, reserves only interest

2. **`withdraw()`**
   - OLD: Single transfer from VaultManager
   - NEW: Two transfers (principal from SB, interest from VM)

3. **`earlyWithdraw()`**
   - OLD: All funds from VaultManager
   - NEW: Penalty and principal from SB, interest from VM

4. **`renew()`**
   - OLD: No actual token movement
   - NEW: Interest transfers from VM to SB, then re-reserve

### Test Updates Required

All tests need to account for:
- Principal balance in SavingsBank
- Interest reserves in VaultManager
- Two-step withdrawals
- Balance checking in both contracts

---

## 🚀 Summary

**Method 2** provides a **production-grade architecture** with:
- ✅ Clear separation of user funds and protocol funds
- ✅ Better risk management and transparency
- ✅ Easier auditing and compliance
- ✅ More capital efficient
- ✅ Follows best practices for DeFi protocols

This is the architecture recommended for mainnet deployment.

---

*Document created: 2026-01-28*
*Author: Nguyễn Ngọc Huy - Blockchain Senior Developer*
