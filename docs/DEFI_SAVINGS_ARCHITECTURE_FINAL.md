# 🏗️ DeFi Savings Protocol - Architecture & Workflow (FINAL)

> **Version:** 2.1  
> **Date:** 29/01/2026  
> **Status:** Ready for Implementation  
> **Changelog (v2.1):** Early withdraw = principal − penalty only, no interest; penalty → InterestVault. Renew: Auto (locked params) vs Manual same/different plan. Events: DepositOpened(planId, maturityAt), Withdrawn(owner, isEarly), Renewed(newPrincipal).

---

## 📐 SYSTEM ARCHITECTURE

### **High-Level Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                    DeFi Savings Ecosystem                        │
└─────────────────────────────────────────────────────────────────┘

                         MockUSDC.sol
                    (ERC20 - 6 decimals)
                    Đồng tiền, không thuộc hệ thống
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ TokenVault   │ │InterestVault │ │ SavingsBank  │
      │              │ │              │ │              │
      │ DUMB         │ │ DUMB         │ │ SMART        │
      │ Holds        │ │ Holds        │ │ Pure Logic   │
      │ Principal    │ │ Interest     │ │ No Tokens    │
      └──────▲───────┘ └──────▲───────┘ └──────┬───────┘
             │                │                 │
             │                │                 │
             └────────────────┴─────────────────┘
                              │
                              │ mint/burn/read
                              ▼
                     ┌──────────────────┐
                     │   DepositNFT     │
                     │                  │
                     │ ERC721Enumerable │
                     │ + Metadata       │
                     │ + Data URI       │
                     └──────────────────┘
```

---

## 🎯 CONTRACT RESPONSIBILITIES

| Contract | Holds Token? | Logic | NFT | Access Control |
|----------|--------------|-------|-----|----------------|
| **MockUSDC** | ✅ (everyone) | ❌ | ❌ | Public |
| **TokenVault** | ✅ (principal) | ❌ | ❌ | onlyOwner (SavingsBank) |
| **InterestVault** | ✅ (interest) | ❌ | ❌ | onlyOwner (SavingsBank) |
| **SavingsBank** | ❌ | ✅ | ❌ | Admin + User |
| **DepositNFT** | ❌ | ❌ | ✅ | onlyOwner (SavingsBank) |

---

## 📦 CONTRACT DETAILS

### **1. MockUSDC.sol**
```
Type: ERC20 (6 decimals)
Purpose: Stablecoin for testing
Owner: N/A (public token)

Functions:
- transfer(to, amount)
- transferFrom(from, to, amount)
- approve(spender, amount)
- balanceOf(account)
- mint(to, amount) - For testing only
```

---

### **2. TokenVault.sol**
```
Type: Simple vault contract
Purpose: Holds user deposits (principal)
Owner: SavingsBank

State Variables:
- IERC20 public usdc
- mapping(uint256 => uint256) public reserved  // depositId → amount

Functions:
- deposit(address from, uint256 amount) onlyOwner
  → transferFrom(from, this, amount)
  
- withdraw(address to, uint256 amount) onlyOwner
  → transfer(to, amount)
  
- balance() view returns (uint256)
  → usdc.balanceOf(address(this))

Events:
- Deposited(address indexed from, uint256 amount)
- Withdrawn(address indexed to, uint256 amount)
```

---

### **3. InterestVault.sol**
```
Type: Simple vault contract
Purpose: Holds admin liquidity for interest payments; also receives early-withdraw penalty
Owner: SavingsBank

State Variables:
- IERC20 public usdc

Functions:
- deposit(address from, uint256 amount) onlyOwner
  → transferFrom(from, this, amount)
  
- withdraw(address to, uint256 amount) onlyOwner
  → transfer(to, amount)
  
- balance() view returns (uint256)
  → usdc.balanceOf(address(this))

Notes:
- Penalty from early withdraw: TokenVault → InterestVault (TokenVault.withdraw(InterestVault, penalty)).
  Penalty boosts liquidity for future interest payments.

Events:
- Funded(address indexed from, uint256 amount)
- Withdrawn(address indexed to, uint256 amount)
```

---

### **4. SavingsBank.sol**
```
Type: Core business logic contract
Purpose: Orchestrate all operations
Owner: Admin

Dependencies:
- TokenVault tokenVault
- InterestVault interestVault
- DepositNFT depositNFT
- IERC20 usdc

State Variables:
- mapping(uint256 => SavingPlan) public savingPlans
- mapping(uint256 => DepositCertificate) public deposits
- uint256 public nextPlanId
- uint256 public nextDepositId
- uint256 public totalReservedInterest
- address public admin
- address public feeReceiver  // optional; early-withdraw penalty goes to InterestVault, not here
- bool public paused

Structs:
struct SavingPlan {
    string name;
    uint256 durationDays;
    uint256 minDeposit;
    uint256 maxDeposit;
    uint256 aprBps;
    uint256 earlyWithdrawPenaltyBps;
    bool isActive;
}

struct DepositCertificate {
    uint256 planId;
    uint256 principal;
    uint256 startTime;
    uint256 maturityTime;
    uint256 lockedAprBps;
    bool isAutoRenewEnabled;
    uint8 status;  // 0=Active, 1=Withdrawn, 2=EarlyWithdrawn, 3=Renewed
}

Admin Functions:
- createPlan(name, duration, min, max, apr, penalty)
- updatePlan(planId, apr, penalty)
- enablePlan(planId, enabled)
- fundVault(amount)
- withdrawVault(amount)
- setFeeReceiver(address)  // optional; penalty → InterestVault, not feeReceiver
- pause()
- unpause()

User Functions:
- openDeposit(planId, amount, enableAutoRenew)
- withdraw(tokenId)
- earlyWithdraw(tokenId)
- renew(tokenId, useCurrentRate, newPlanId)
  // useCurrentRate=false → auto: same plan, locked params (ignore admin edits)
  // useCurrentRate=true, newPlanId=0 or same planId → manual same plan: use current plan params
  // useCurrentRate=true, newPlanId!=planId → manual different plan: use new plan params
- setAutoRenew(tokenId, enabled)

View Functions:
- calculateInterest(tokenId) returns (uint256)
- calculateEarlyWithdrawAmount(tokenId) returns (uint256 principalMinusPenalty, uint256 penalty)
  // User receives only principal - penalty; no interest on early withdraw
- availableVaultBalance() returns (uint256)
- getUserDeposits(user) returns (uint256[])

Events:
- PlanCreated(uint256 planId, string name)
- PlanUpdated(uint256 planId)
- DepositOpened(uint256 indexed depositId, address indexed owner, uint256 planId, uint256 principal, uint256 maturityAt)
- Withdrawn(uint256 indexed depositId, address indexed owner, uint256 principal, uint256 interest, bool isEarly)
- Renewed(uint256 indexed oldDepositId, uint256 indexed newDepositId, uint256 newPrincipal)
- VaultFunded(uint256 amount)
- VaultWithdrawn(uint256 amount)
```

---

### **5. DepositNFT.sol**
```
Type: ERC721Enumerable + On-chain metadata
Purpose: Represent deposit ownership
Owner: SavingsBank

Dependencies:
- ISavingsBank savingsBank (interface)

State Variables:
- uint256 private _nextTokenId

Functions:
- mint(address to) onlyOwner returns (uint256)
  → Mint new NFT, return tokenId
  
- burn(uint256 tokenId) onlyOwner
  → Burn NFT
  
- tokenURI(uint256 tokenId) view returns (string)
  → Generate on-chain metadata (Data URI)
  
- refreshMetadata(uint256 tokenId)
  → Emit event for marketplace refresh

Metadata Generation:
- Read deposit data from SavingsBank
- Generate JSON metadata
- Generate SVG image (on-chain)
- Base64 encode
- Return: "data:application/json;base64,..."

SVG Components:
- Gradient background
- Certificate border
- Deposit ID
- Plan name
- Principal amount
- Locked APR
- Progress bar (time elapsed)
- Status badge
- Maturity date

Events:
- DepositNFTMinted(uint256 tokenId, address owner)
- DepositNFTBurned(uint256 tokenId)
- MetadataUpdated(uint256 tokenId)
```

---

## 🔄 COMPLETE WORKFLOWS

### **DEPLOYMENT FLOW**

```
Step 1: Deploy MockUSDC
  → MockUSDC address: 0xAAA...

Step 2: Deploy TokenVault
  → Constructor(usdcAddress)
  → TokenVault address: 0xBBB...

Step 3: Deploy InterestVault
  → Constructor(usdcAddress)
  → InterestVault address: 0xCCC...

Step 4: Deploy SavingsBank
  → Constructor(
      usdcAddress,
      tokenVaultAddress,
      interestVaultAddress,
      adminAddress,
      feeReceiverAddress   // optional; penalty → InterestVault
    )
  → SavingsBank address: 0xDDD...

Step 5: Transfer ownership of vaults
  → TokenVault.transferOwnership(savingsBankAddress)
  → InterestVault.transferOwnership(savingsBankAddress)

Step 6: Deploy DepositNFT
  → Constructor(savingsBankAddress)
  → DepositNFT address: 0xEEE...

Step 7: Set DepositNFT in SavingsBank
  → SavingsBank.setDepositNFT(depositNFTAddress)

Step 8: Create saving plans
  → SavingsBank.createPlan("Flexible 30D", 30, 100e6, 1000000e6, 500, 100)
  → SavingsBank.createPlan("Standard 90D", 90, 500e6, 5000000e6, 800, 50)
  → SavingsBank.createPlan("Premium 180D", 180, 1000e6, 10000000e6, 1200, 25)

Step 9: Fund interest vault
  → MockUSDC.approve(SavingsBank, 100000e6)
  → SavingsBank.fundVault(100000e6)
```

---

### **USER WORKFLOW: OPEN DEPOSIT**

```
Initial State:
- User: 1000 USDC
- TokenVault: 0 USDC
- InterestVault: 100,000 USDC (admin funded)
- User NFTs: 0

Step 1: User approves TokenVault
  User → MockUSDC.approve(TokenVault, 1000e6)

Step 2: User opens deposit
  User → SavingsBank.openDeposit(planId=1, amount=1000e6, enableAutoRenew=true)

Step 3: SavingsBank processes
  ├─ Validate plan exists and active
  ├─ Validate amount >= minDeposit && <= maxDeposit
  ├─ maturityAt = block.timestamp + (plan.tenorDays * 1 days)
  ├─ Calculate estimated interest: 1000 * 5% * 30/365 = 4.11 USDC
  ├─ Reserve interest: totalReservedInterest += 4.11e6
  ├─ TokenVault.deposit(user, 1000e6)
  │    └─> MockUSDC.transferFrom(user, TokenVault, 1000e6)
  ├─ depositId = nextDepositId++
  ├─ deposits[depositId] = DepositCertificate({
  │     planId: 1,
  │     principal: 1000e6,
  │     startTime: block.timestamp,
  │     maturityTime: maturityAt,
  │     lockedAprBps: 500,
  │     isAutoRenewEnabled: true,
  │     status: 0
  │  })
  ├─ tokenId = DepositNFT.mint(user)
  └─ emit DepositOpened(depositId, user, 1, 1000e6, maturityAt)

Final State:
- User: 0 USDC, 1 NFT (tokenId #1)
- TokenVault: 1000 USDC
- InterestVault: 100,000 USDC
- totalReservedInterest: 4.11 USDC
- deposits[1]: {principal: 1000, status: Active, ...}
```

---

### **USER WORKFLOW: WITHDRAW (AT MATURITY)**

```
Initial State:
- User: NFT #1 (30 days passed)
- TokenVault: 1000 USDC
- InterestVault: 100,000 USDC
- totalReservedInterest: 4.11 USDC

Step 1: User calls withdraw
  User → SavingsBank.withdraw(tokenId=1)

Step 2: SavingsBank processes
  ├─ owner = DepositNFT.ownerOf(1)
  ├─ require(owner == msg.sender)
  ├─ deposit = deposits[1]
  ├─ require(block.timestamp >= deposit.maturityTime)
  ├─ require(deposit.status == 0) // Active
  ├─ interest = calculateInterest(1) = 4.11e6
  ├─ totalReservedInterest -= interest
  ├─ TokenVault.withdraw(user, 1000e6)
  │    └─> MockUSDC.transfer(user, 1000e6)
  ├─ InterestVault.withdraw(user, 4.11e6)
  │    └─> MockUSDC.transfer(user, 4.11e6)
  ├─ deposits[1].status = 1 // Withdrawn
  ├─ DepositNFT.burn(1)
  └─ emit Withdrawn(1, user, 1000e6, 4.11e6, false)

Final State:
- User: 1004.11 USDC, 0 NFT
- TokenVault: 0 USDC
- InterestVault: 99,995.89 USDC
- totalReservedInterest: 0
- NFT #1: burned
```

---

### **USER WORKFLOW: EARLY WITHDRAW**

```
Business rule: User receives ONLY principal - penalty. No interest on early withdraw.
Penalty flows into InterestVault (not feeReceiver).

Initial State:
- User: NFT #1 (only 15 days passed, need 30)
- TokenVault: 1000 USDC
- InterestVault: 100,000 USDC

Step 1: User calls early withdraw
  User → SavingsBank.earlyWithdraw(tokenId=1)

Step 2: SavingsBank processes
  ├─ owner = DepositNFT.ownerOf(1)
  ├─ require(owner == msg.sender)
  ├─ deposit = deposits[1]
  ├─ require(block.timestamp < deposit.maturityTime)
  ├─ penalty = principal * penaltyBps / 10000 = 1000 * 1% = 10e6
  ├─ totalReservedInterest -= 4.11e6 (release reserved; no interest paid to user)
  ├─ TokenVault.withdraw(user, 1000e6 - 10e6)     // user receives principal - penalty
  ├─ TokenVault.withdraw(InterestVault, 10e6)      // penalty → InterestVault
  ├─ deposits[1].status = 2 // EarlyWithdrawn
  ├─ DepositNFT.burn(1)
  └─ emit Withdrawn(1, owner, 1000e6, 0, true)

Final State:
- User: 990 USDC (principal - penalty only), 0 NFT
- TokenVault: 0 USDC
- InterestVault: 100,010 USDC (+10 from penalty)
```

---

### **RENEW TYPES**

| Type | Trigger | Plan | Params (APR, duration, …) |
|------|--------|------|---------------------------|
| **Auto renew** | User does nothing; keeper (or user) calls `renew(tokenId, false, 0)` at maturity when `isAutoRenewEnabled` | Same plan | **Locked** (original). Ignore admin edits. |
| **Manual same plan** | User calls `renew(tokenId, true, 0)` or `renew(tokenId, true, planId)` | Same plan | **Current** plan (after admin updates). |
| **Manual different plan** | User calls `renew(tokenId, true, newPlanId)` | New plan | **New** plan params. |

- `useCurrentRate = false` → auto: always same plan, locked APR/duration.
- `useCurrentRate = true`, `newPlanId = 0` or same `planId` → manual same plan: use `savingPlans[planId]` **now**.
- `useCurrentRate = true`, `newPlanId != planId` → manual different plan: use `savingPlans[newPlanId]`.

---

### **USER WORKFLOW: RENEW (AUTO)**

```
Auto renew: same plan, locked params. Admin may have changed the plan; we ignore.

Initial State:
- User: NFT #1 (30 days passed, matured), isAutoRenewEnabled = true
- TokenVault: 1000 USDC
- deposits[1]: {principal: 1000, planId: 1, lockedAprBps: 500}
- Admin has since updated plan 1 to 4% APR; we still use 5%.

Step 1: Keeper or user calls renew (auto)
  → SavingsBank.renew(tokenId=1, useCurrentRate=false, newPlanId=0)

Step 2: SavingsBank processes
  ├─ owner = DepositNFT.ownerOf(1)
  ├─ require(owner == msg.sender)
  ├─ deposit = deposits[1]
  ├─ require(block.timestamp >= deposit.maturityTime)
  ├─ interest = 4.11e6 (locked APR 5%, original duration)
  ├─ newPrincipal = 1000e6 + 4.11e6 = 1004.11e6
  ├─ totalReservedInterest -= 4.11e6 (release old)
  ├─ newInterest = 1004.11 * 5% * 30/365 = 4.13e6  // locked rate, same duration
  ├─ totalReservedInterest += 4.13e6 (reserve new)
  ├─ InterestVault.withdraw(address(this), 4.11e6)
  ├─ TokenVault.deposit(address(this), 4.11e6)
  ├─ deposits[1].status = 3 // Renewed
  ├─ DepositNFT.burn(1)
  ├─ newDepositId = nextDepositId++
  ├─ deposits[newDepositId] = DepositCertificate({
  │     planId: 1,                              // same plan
  │     principal: 1004.11e6,
  │     startTime: block.timestamp,
  │     maturityTime: block.timestamp + 30 days, // original duration
  │     lockedAprBps: 500,                      // keep old rate
  │     isAutoRenewEnabled: true,
  │     status: 0
  │  })
  ├─ newTokenId = DepositNFT.mint(user)
  └─ emit Renewed(1, newDepositId, 1004.11e6)

Final State:
- User: 0 USDC, 1 NFT (tokenId #2)
- TokenVault: 1004.11 USDC
- deposits[2]: {principal: 1004.11, lockedApr: 5%, planId: 1, ...}
- NFT #1: burned, NFT #2: minted
```

---

### **USER WORKFLOW: RENEW (MANUAL - SAME PLAN, CURRENT PARAMS)**

```
Manual same plan: use current plan params (after admin edits).

Step 1: Admin lowered plan 1 APR from 5% to 4%
  Admin → SavingsBank.updatePlan(planId=1, newApr=400, ...)

Step 2: User renews manually, same plan
  User → SavingsBank.renew(tokenId=1, useCurrentRate=true, newPlanId=0)

Step 3: SavingsBank processes
  ├─ Same flow as auto BUT:
  ├─ planId stays 1; use savingPlans[1] as of now (APR 4%, duration, ...)
  ├─ lockedAprBps = savingPlans[1].aprBps  // 400
  └─ newInterest = 1004.11 * 4% * 30/365 = 3.30e6

Final State:
- New deposit: planId 1, locked APR 4%, duration 30 days.
```

---

### **USER WORKFLOW: RENEW (MANUAL - DIFFERENT PLAN)**

```
Manual different plan: user chooses new plan.

Step 1: User renews into plan 2 (e.g. 90-day)
  User → SavingsBank.renew(tokenId=1, useCurrentRate=true, newPlanId=2)

Step 2: SavingsBank processes
  ├─ Validate plan 2 exists and is active
  ├─ interest = 4.11e6 (from old deposit)
  ├─ newPrincipal = 1000e6 + 4.11e6 = 1004.11e6
  ├─ Validate newPrincipal >= minDeposit(plan 2) && <= maxDeposit(plan 2)
  ├─ Use savingPlans[2]: duration 90 days, current APR, ...
  ├─ lockedAprBps = savingPlans[2].aprBps
  ├─ newInterest = 1004.11 * plan2.aprBps * 90/365 (reserve)
  ├─ Create new deposit with planId = 2, new duration, new locked APR
  └─ emit Renewed(1, newDepositId, 1004.11e6)

Final State:
- New deposit: planId 2, 90-day tenor, current plan-2 APR.
```

---

### **ADMIN WORKFLOW: FUND VAULT**

```
Step 1: Admin approves
  Admin → MockUSDC.approve(SavingsBank, 50000e6)

Step 2: Admin funds
  Admin → SavingsBank.fundVault(50000e6)

Step 3: SavingsBank processes
  ├─ InterestVault.deposit(admin, 50000e6)
  │    └─> MockUSDC.transferFrom(admin, InterestVault, 50000e6)
  └─ emit VaultFunded(50000e6)

Final State:
- Admin: -50,000 USDC
- InterestVault: +50,000 USDC
```

---

### **ADMIN WORKFLOW: WITHDRAW VAULT**

```
Step 1: Admin checks available
  Admin → SavingsBank.availableVaultBalance()
  Returns: InterestVault.balance() - totalReservedInterest
  Example: 50,000 - 100 = 49,900 USDC

Step 2: Admin withdraws
  Admin → SavingsBank.withdrawVault(20000e6)

Step 3: SavingsBank processes
  ├─ available = availableVaultBalance()
  ├─ require(amount <= available)
  ├─ InterestVault.withdraw(admin, 20000e6)
  │    └─> MockUSDC.transfer(admin, 20000e6)
  └─ emit VaultWithdrawn(20000e6)

Final State:
- Admin: +20,000 USDC
- InterestVault: 30,000 USDC
- Reserved: 100 USDC (untouched)
```

---

### **NFT TRANSFER WORKFLOW**

```
Initial State:
- UserA: owns NFT #1
- deposits[1]: {principal: 1000, ...}

Step 1: UserA transfers NFT to UserB
  UserA → DepositNFT.transferFrom(UserA, UserB, tokenId=1)

Step 2: ERC721 processes
  ├─ _owners[1] = UserB
  └─ emit Transfer(UserA, UserB, 1)

Final State:
- UserB: owns NFT #1
- deposits[1]: unchanged
- TokenVault: unchanged

Step 3: UserB withdraws (if matured)
  UserB → SavingsBank.withdraw(1)
  ├─ owner = DepositNFT.ownerOf(1) = UserB ✓
  ├─ require(owner == msg.sender) ✓
  └─ Process withdrawal normally

Result:
- UserB receives 1000 + interest USDC
- UserA lost the right to withdraw
```

---

## 🔐 SECURITY CONSIDERATIONS

### **Access Control Matrix**

| Function | Who Can Call | Modifier |
|----------|--------------|----------|
| **SavingsBank** | | |
| createPlan | Admin | onlyAdmin |
| updatePlan | Admin | onlyAdmin |
| fundVault | Admin | onlyAdmin |
| withdrawVault | Admin | onlyAdmin |
| pause/unpause | Admin | onlyAdmin |
| openDeposit | Anyone | whenNotPaused |
| withdraw | NFT owner | whenNotPaused |
| earlyWithdraw | NFT owner | whenNotPaused |
| renew | NFT owner | whenNotPaused |
| **TokenVault** | | |
| deposit | SavingsBank | onlyOwner |
| withdraw | SavingsBank | onlyOwner |
| **InterestVault** | | |
| deposit | SavingsBank | onlyOwner |
| withdraw | SavingsBank | onlyOwner |
| **DepositNFT** | | |
| mint | SavingsBank | onlyOwner |
| burn | SavingsBank | onlyOwner |
| transferFrom | NFT owner | ERC721 standard |

### **Re-entrancy Protection**

```
All state-changing functions in SavingsBank:
- Use OpenZeppelin ReentrancyGuard
- nonReentrant modifier

Order of operations (Checks-Effects-Interactions):
1. Checks (require statements)
2. Effects (state changes)
3. Interactions (external calls)
```

### **Pausability**

```
SavingsBank implements Pausable:
- pause() → Stops all user functions
- unpause() → Resume operations
- Admin functions still work when paused
```

---

## 💰 INTEREST CALCULATION

### **Simple Interest Formula**

```
interest = principal * aprBps * durationSeconds / (365 days * 10000)

Example:
- principal = 1000 USDC (1000e6)
- aprBps = 500 (5%)
- duration = 30 days

interest = 1000e6 * 500 * (30 * 86400) / (365 * 86400 * 10000)
         = 1000e6 * 500 * 2592000 / 315360000000
         = 4109589 (≈ 4.11 USDC)
```

### **Reserved Interest Tracking**

```
When user deposits:
  estimatedInterest = calculate with locked APR
  totalReservedInterest += estimatedInterest

When user withdraws at maturity:
  actualInterest = calculate final interest
  totalReservedInterest -= actualInterest

When user early withdraws:
  totalReservedInterest -= estimatedInterest (release reserved; no interest paid)
  Penalty → InterestVault (TokenVault → InterestVault).

Available for admin withdraw:
  available = InterestVault.balance() - totalReservedInterest
```

---

## 📊 STATE TRANSITIONS

### **Deposit Status**

```
0 = Active       → User can withdraw/renew when matured
1 = Withdrawn    → Completed, NFT burned
2 = EarlyWithdrawn → Completed with penalty, NFT burned
3 = Renewed      → Old deposit renewed, NFT burned, new deposit created
```

### **Status Flow**

```
openDeposit()
     ↓
  Active (0)
     ↓
  ┌──┴──┐
  │     │
  ▼     ▼
withdraw() OR earlyWithdraw() OR renew()
  │     │           │
  ▼     ▼           ▼
Withdrawn  EarlyWithdrawn  Renewed
  (1)        (2)            (3)
                            │
                            ▼
                       New Active (0)
```

---

## 🎨 NFT METADATA STRUCTURE

### **Data URI Format**

```
data:application/json;base64,<base64-encoded-json>
```

### **JSON Schema**

```json
{
  "name": "Deposit Certificate #123",
  "description": "DeFi Savings Protocol - On-chain savings deposit",
  "image": "data:image/svg+xml;base64,<svg-base64>",
  "attributes": [
    {"trait_type": "Plan", "value": "Flexible 30D"},
    {"trait_type": "Principal (USDC)", "value": "1000.00"},
    {"trait_type": "Locked APR", "value": "5.00%"},
    {"trait_type": "Duration (Days)", "value": 30},
    {"trait_type": "Days Elapsed", "value": 15},
    {"trait_type": "Days Remaining", "value": 15},
    {"trait_type": "Status", "value": "Active"},
    {"trait_type": "Auto-Renew", "value": "Enabled"},
    {"trait_type": "Maturity Date", "value": "2026-02-28"}
  ]
}
```

### **SVG Components**

```
- Gradient background (purple-blue)
- Certificate border (white)
- Title: "Deposit Certificate"
- Certificate ID: "#123"
- Plan name: "Flexible 30D"
- Principal amount: "1,000 USDC"
- Locked APR: "5.00% APY"
- Progress bar (visual timeline)
- Status badge (Active/Matured/etc)
- Maturity date
- Auto-renew indicator
```

---

## ⚙️ GAS OPTIMIZATION

### **Storage Packing**

```solidity
struct DepositCertificate {
    uint256 planId;           // slot 0
    uint256 principal;        // slot 1
    uint256 startTime;        // slot 2
    uint256 maturityTime;     // slot 3
    uint256 lockedAprBps;     // slot 4
    bool isAutoRenewEnabled;  // slot 5 (packed)
    uint8 status;             // slot 5 (packed)
}
```

### **View Functions (Free)**

```
- calculateInterest() → view (no gas)
- availableVaultBalance() → view (no gas)
- tokenURI() → view (no gas for reading)
```

---

## ✅ TESTING CHECKLIST

### **Unit Tests**

- [ ] MockUSDC: mint, transfer, approve
- [ ] TokenVault: deposit, withdraw, balance
- [ ] InterestVault: deposit, withdraw, balance
- [ ] SavingsBank: createPlan, updatePlan
- [ ] SavingsBank: openDeposit (success, fail cases)
- [ ] SavingsBank: withdraw (matured)
- [ ] SavingsBank: earlyWithdraw (principal − penalty only; penalty → InterestVault)
- [ ] SavingsBank: renew (auto locked, manual same plan, manual different plan)
- [ ] SavingsBank: fundVault, withdrawVault
- [ ] DepositNFT: mint, burn, tokenURI
- [ ] Interest calculation accuracy
- [ ] Reserved interest tracking

### **Integration Tests**

- [ ] Full deposit → withdraw flow
- [ ] Full deposit → early withdraw flow
- [ ] Full deposit → renew flow
- [ ] NFT transfer → new owner withdraw
- [ ] Multiple users, multiple deposits
- [ ] Admin vault management
- [ ] Pause/unpause emergency

### **Edge Cases**

- [ ] Zero amount deposit (should fail)
- [ ] Below minDeposit (should fail)
- [ ] Above maxDeposit (should fail)
- [ ] Withdraw before maturity (should fail)
- [ ] Double withdraw (should fail)
- [ ] Withdraw with transferred NFT
- [ ] Insufficient vault balance
- [ ] Reserved interest overflow

---

## 🚀 DEPLOYMENT SCRIPT TEMPLATE

```typescript
// scripts/deploy.ts

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  // 2. Deploy TokenVault
  const TokenVault = await ethers.getContractFactory("TokenVault");
  const tokenVault = await TokenVault.deploy(await usdc.getAddress());
  await tokenVault.waitForDeployment();
  console.log("TokenVault:", await tokenVault.getAddress());

  // 3. Deploy InterestVault
  const InterestVault = await ethers.getContractFactory("InterestVault");
  const interestVault = await InterestVault.deploy(await usdc.getAddress());
  await interestVault.waitForDeployment();
  console.log("InterestVault:", await interestVault.getAddress());

  // 4. Deploy SavingsBank
  const SavingsBank = await ethers.getContractFactory("SavingsBank");
  const savingsBank = await SavingsBank.deploy(
    await usdc.getAddress(),
    await tokenVault.getAddress(),
    await interestVault.getAddress(),
    deployer.address, // admin
    deployer.address  // feeReceiver (optional; penalty → InterestVault)
  );
  await savingsBank.waitForDeployment();
  console.log("SavingsBank:", await savingsBank.getAddress());

  // 5. Transfer vault ownerships
  await tokenVault.transferOwnership(await savingsBank.getAddress());
  await interestVault.transferOwnership(await savingsBank.getAddress());
  console.log("Vaults ownership transferred");

  // 6. Deploy DepositNFT
  const DepositNFT = await ethers.getContractFactory("DepositNFT");
  const depositNFT = await DepositNFT.deploy(await savingsBank.getAddress());
  await depositNFT.waitForDeployment();
  console.log("DepositNFT:", await depositNFT.getAddress());

  // 7. Set DepositNFT in SavingsBank
  await savingsBank.setDepositNFT(await depositNFT.getAddress());
  console.log("DepositNFT set in SavingsBank");

  // 8. Create plans
  await savingsBank.createPlan(
    "Flexible 30D",
    30,
    ethers.parseUnits("100", 6),
    ethers.parseUnits("1000000", 6),
    500,  // 5%
    100   // 1% penalty
  );
  console.log("Plan 1 created");

  // 9. Fund vault
  await usdc.mint(deployer.address, ethers.parseUnits("100000", 6));
  await usdc.approve(await savingsBank.getAddress(), ethers.parseUnits("100000", 6));
  await savingsBank.fundVault(ethers.parseUnits("100000", 6));
  console.log("Vault funded with 100,000 USDC");

  console.log("\n=== Deployment Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 📖 SUMMARY

### **Key Principles**

1. **Separation of Concerns**
   - TokenVault = holds principal (dumb)
   - InterestVault = holds interest (dumb)
   - SavingsBank = all business logic (smart)
   - DepositNFT = ownership + metadata (NFT)

2. **No Token in Logic Contract**
   - SavingsBank NEVER holds tokens
   - Only coordinates transfers
   - Cleaner, safer architecture

3. **NFT = Ownership**
   - 1 deposit = 1 unique NFT
   - Transfer NFT = transfer deposit rights
   - Burn NFT on withdrawal

4. **On-chain Metadata**
   - 100% on-chain (no IPFS)
   - Data URI + SVG
   - Dynamic, always up-to-date

5. **Early Withdraw & Penalty**
   - User receives only principal − penalty (no interest).
   - Penalty flows into InterestVault (not feeReceiver).

6. **Renew: Auto vs Manual**
   - Auto: same plan, locked params; ignore admin edits.
   - Manual same plan: use current plan params.
   - Manual different plan: renew into new plan.

7. **Security First**
   - ReentrancyGuard
   - Pausable
   - AccessControl
   - Checks-Effects-Interactions

---

**Ready to code!** 🚀
