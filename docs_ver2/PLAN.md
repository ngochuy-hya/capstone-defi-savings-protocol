# 📋 DeFi Savings Protocol - Implementation Plan (Pragmatic SOLID)

> **Version:** 3.0 - Pragmatic SOLID  
> **Contracts:** 6 total (~1,150 lines)  
> **Timeline:** 6-8 days  
> **Last Updated:** 2026-01-29

---

## 🎯 OVERVIEW

### **Architecture:**
```
6 Contracts:
├── MockUSDC.sol (100 lines)
├── TokenVault.sol (50 lines) - IMMUTABLE
├── InterestVault.sol (70 lines) - IMMUTABLE  
├── DepositNFT.sol (300 lines) - IMMUTABLE
├── SavingsBank.sol (600 lines) - UUPS UPGRADEABLE
└── InterestCalculator.sol (30 lines) - Library
```

---

## 📅 PHASE 1: Core Contracts (2-3 days)

### **Day 1: Vaults & Mocks**

#### **1.1 MockUSDC.sol** ⏱️ 30 phút

**File:** `contracts/mocks/MockUSDC.sol`

**Dependencies:**
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**Implementation:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

**Test Checklist:**
- [ ] Can mint tokens
- [ ] Decimals = 6
- [ ] Can transfer
- [ ] Can approve/transferFrom

---

#### **1.2 InterestCalculator.sol** ⏱️ 30 phút

**File:** `contracts/libraries/InterestCalculator.sol`

**Implementation:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library InterestCalculator {
    uint256 constant SECONDS_PER_YEAR = 365 days;
    uint256 constant BPS_DENOMINATOR = 10000;
    
    function calculateInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 durationDays
    ) internal pure returns (uint256) {
        return (principal * aprBps * durationDays) / (365 * BPS_DENOMINATOR);
    }
    
    function calculatePenalty(
        uint256 principal,
        uint256 penaltyBps
    ) internal pure returns (uint256) {
        return (principal * penaltyBps) / BPS_DENOMINATOR;
    }
}
```

**Test Checklist:**
- [ ] Interest calculation accurate (1000 USDC, 5% APR, 90 days = 12.32 USDC)
- [ ] Penalty calculation accurate (1000 USDC, 2% = 20 USDC)
- [ ] Handles edge cases (zero amounts, max values)

---

#### **1.3 TokenVault.sol** ⏱️ 1 giờ

**File:** `contracts/core/TokenVault.sol`

**Dependencies:**
```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
```

**Implementation:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVault is Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable usdc;
    
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "TokenVault: Invalid USDC");
        usdc = IERC20(_usdc);
    }
    
    function deposit(address from, uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(from, address(this), amount);
        emit Deposited(from, amount);
    }
    
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(amount <= balance(), "TokenVault: Insufficient balance");
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
    
    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
```

**Interface:** `contracts/interfaces/ITokenVault.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITokenVault {
    function deposit(address from, uint256 amount) external;
    function withdraw(address to, uint256 amount) external;
    function balance() external view returns (uint256);
}
```

**Test Checklist:**
- [ ] Can deposit tokens (owner only)
- [ ] Can withdraw tokens (owner only)
- [ ] Balance tracking correct
- [ ] Cannot withdraw more than balance
- [ ] Non-owner cannot deposit/withdraw
- [ ] Events emitted correctly

---

#### **1.4 InterestVault.sol** ⏱️ 1 giờ

**File:** `contracts/core/InterestVault.sol`

**Implementation:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InterestVault is Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable usdc;
    uint256 public totalReserved;
    
    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Reserved(uint256 amount);
    event Released(uint256 amount);
    
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "InterestVault: Invalid USDC");
        usdc = IERC20(_usdc);
    }
    
    function deposit(address from, uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(from, address(this), amount);
        emit Funded(from, amount);
    }
    
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(amount <= balance(), "InterestVault: Insufficient balance");
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
    
    function reserve(uint256 amount) external onlyOwner {
        require(amount <= availableBalance(), "InterestVault: Insufficient available");
        totalReserved += amount;
        emit Reserved(amount);
    }
    
    function release(uint256 amount) external onlyOwner {
        require(amount <= totalReserved, "InterestVault: Invalid release");
        totalReserved -= amount;
        emit Released(amount);
    }
    
    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    function availableBalance() public view returns (uint256) {
        uint256 total = balance();
        return total > totalReserved ? total - totalReserved : 0;
    }
}
```

**Interface:** `contracts/interfaces/IInterestVault.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInterestVault {
    function deposit(address from, uint256 amount) external;
    function withdraw(address to, uint256 amount) external;
    function reserve(uint256 amount) external;
    function release(uint256 amount) external;
    function balance() external view returns (uint256);
    function availableBalance() external view returns (uint256);
}
```

**Test Checklist:**
- [ ] Reserve decreases available balance
- [ ] Release increases available balance
- [ ] Cannot reserve more than available
- [ ] Cannot release more than reserved
- [ ] Cannot withdraw reserved amount
- [ ] Deposit/withdraw work correctly

---

### **Day 2: NFT Contract**

#### **1.5 DepositNFT.sol** ⏱️ 3-4 giờ

**File:** `contracts/core/DepositNFT.sol`

**Dependencies:**
```solidity
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../interfaces/ISavingsBank.sol";
```

**Key Features:**
1. ERC721Enumerable
2. OnlyOwner mint/burn
3. Dynamic tokenURI (Data URI)
4. SVG certificate generation
5. OpenSea-compatible JSON

**Implementation Steps:**
```solidity
// 1. Basic structure
contract DepositNFT is ERC721Enumerable, Ownable {
    ISavingsBank public savingsBank;
    
    constructor() ERC721("DeFi Savings Certificate", "DSC") Ownable(msg.sender) {}
}

// 2. Admin functions
function setSavingsBank(address _savingsBank) external onlyOwner { }
function mint(address to, uint256 tokenId) external onlyOwner { }
function burn(uint256 tokenId) external onlyOwner { }

// 3. Metadata generation
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    // Get data from SavingsBank
    // Generate SVG
    // Generate JSON
    // Return Data URI
}

// 4. Helper functions
function _generateSVG(...) internal pure returns (string memory) { }
function _generateJSON(...) internal pure returns (string memory) { }
function _formatAmount(uint256) internal pure returns (string memory) { }
function _formatBps(uint256) internal pure returns (string memory) { }
```

**SVG Template:**
```xml
<svg width="400" height="600">
  <!-- Gradient background -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="400" height="600" fill="url(#bg)"/>
  
  <!-- White card -->
  <rect x="20" y="20" width="360" height="560" fill="white" rx="10"/>
  
  <!-- Header -->
  <text x="200" y="60" text-anchor="middle" font-size="24" fill="#1f2937">
    Savings Certificate
  </text>
  <text x="200" y="90" text-anchor="middle" font-size="16" fill="#6b7280">
    #{depositId}
  </text>
  
  <!-- Details -->
  <text x="40" y="130">Plan: {planName}</text>
  <text x="40" y="160">Principal: {principal} USDC</text>
  <text x="40" y="190">APR: {apr}%</text>
  
  <!-- Progress bar -->
  <rect x="40" y="240" width="320" height="20" fill="#e5e7eb" rx="10"/>
  <rect x="40" y="240" width="{progress}" height="20" fill="#10b981" rx="10"/>
  
  <!-- Status badge -->
  <rect x="140" y="290" width="120" height="30" fill="{statusColor}" rx="5"/>
  <text x="200" y="310" text-anchor="middle" fill="white">{status}</text>
</svg>
```

**Test Checklist:**
- [ ] Only owner can mint/burn
- [ ] TokenURI returns valid Data URI
- [ ] SVG renders correctly
- [ ] JSON follows OpenSea standard
- [ ] Progress bar updates dynamically
- [ ] Status colors correct

---

### **Day 3: SavingsBank (Part 1)**

#### **1.6 SavingsBank.sol - Setup & State** ⏱️ 2 giờ

**File:** `contracts/SavingsBank.sol`

**Dependencies:**
```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITokenVault.sol";
import "./interfaces/IInterestVault.sol";
import "./interfaces/IDepositNFT.sol";
import "./libraries/InterestCalculator.sol";
```

**Step 1: Contract declaration & state**
```solidity
contract SavingsBank is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using InterestCalculator for uint256;
    
    // State variables
    IERC20 public usdc;
    ITokenVault public tokenVault;
    IInterestVault public interestVault;
    IDepositNFT public depositNFT;
    
    struct SavingPlan {
        string name;
        uint256 durationDays;
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 aprBps;
        uint256 penaltyBps;
        bool isActive;
    }
    
    struct DepositCertificate {
        uint256 planId;
        uint256 principal;
        uint256 startTime;
        uint256 maturityTime;
        uint256 lockedAprBps;
        bool isAutoRenewEnabled;
        uint8 status; // 0=Active, 1=Withdrawn, 2=EarlyWithdrawn, 3=Renewed
    }
    
    mapping(uint256 => SavingPlan) public savingPlans;
    mapping(uint256 => DepositCertificate) public deposits;
    
    uint256 public nextPlanId;
    uint256 public nextDepositId;
    uint256 public totalReservedInterest;
    
    // Events
    event PlanCreated(uint256 indexed planId, string name);
    event PlanUpdated(uint256 indexed planId);
    event DepositOpened(uint256 indexed depositId, address indexed user, uint256 planId);
    event Withdrawn(uint256 indexed depositId, address indexed user, uint256 amount);
    event EarlyWithdrawn(uint256 indexed depositId, address indexed user, uint256 penalty);
    event Renewed(uint256 indexed oldDepositId, uint256 indexed newDepositId);
}
```

**Step 2: Initializer & Upgrade**
```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}

function initialize(
    address _usdc,
    address _tokenVault,
    address _interestVault,
    address _depositNFT
) external initializer {
    __Ownable_init(msg.sender);
    __Pausable_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
    
    usdc = IERC20(_usdc);
    tokenVault = ITokenVault(_tokenVault);
    interestVault = IInterestVault(_interestVault);
    depositNFT = IDepositNFT(_depositNFT);
    
    nextPlanId = 1;
    nextDepositId = 1;
}

function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

---

#### **1.7 SavingsBank.sol - Admin Functions** ⏱️ 1 giờ

```solidity
function createPlan(
    string memory name,
    uint256 durationDays,
    uint256 minDeposit,
    uint256 maxDeposit,
    uint256 aprBps,
    uint256 penaltyBps
) external onlyOwner returns (uint256) {
    uint256 planId = nextPlanId++;
    
    savingPlans[planId] = SavingPlan({
        name: name,
        durationDays: durationDays,
        minDeposit: minDeposit,
        maxDeposit: maxDeposit,
        aprBps: aprBps,
        penaltyBps: penaltyBps,
        isActive: true
    });
    
    emit PlanCreated(planId, name);
    return planId;
}

function updatePlan(uint256 planId, uint256 aprBps, uint256 penaltyBps) external onlyOwner {
    savingPlans[planId].aprBps = aprBps;
    savingPlans[planId].penaltyBps = penaltyBps;
    emit PlanUpdated(planId);
}

function enablePlan(uint256 planId, bool enabled) external onlyOwner {
    savingPlans[planId].isActive = enabled;
}

function fundVault(uint256 amount) external onlyOwner {
    interestVault.deposit(msg.sender, amount);
}

function withdrawVault(uint256 amount) external onlyOwner {
    require(amount <= interestVault.availableBalance(), "Exceeds available");
    interestVault.withdraw(msg.sender, amount);
}
```

---

### **Day 4: SavingsBank (Part 2)**

#### **1.8 SavingsBank.sol - openDeposit** ⏱️ 1 giờ

```solidity
function openDeposit(
    uint256 planId,
    uint256 amount,
    bool enableAutoRenew
) external nonReentrant whenNotPaused returns (uint256) {
    // 1. Validate
    SavingPlan memory plan = savingPlans[planId];
    require(plan.isActive, "Plan not active");
    require(amount >= plan.minDeposit && amount <= plan.maxDeposit, "Invalid amount");
    
    // 2. Calculate
    uint256 maturityTime = block.timestamp + (plan.durationDays * 1 days);
    uint256 estimatedInterest = amount.calculateInterest(plan.aprBps, plan.durationDays);
    
    // 3. Transfer to TokenVault
    tokenVault.deposit(msg.sender, amount);
    
    // 4. Reserve interest
    interestVault.reserve(estimatedInterest);
    totalReservedInterest += estimatedInterest;
    
    // 5. Create deposit record
    uint256 depositId = nextDepositId++;
    deposits[depositId] = DepositCertificate({
        planId: planId,
        principal: amount,
        startTime: block.timestamp,
        maturityTime: maturityTime,
        lockedAprBps: plan.aprBps,
        isAutoRenewEnabled: enableAutoRenew,
        status: 0
    });
    
    // 6. Mint NFT
    depositNFT.mint(msg.sender, depositId);
    
    emit DepositOpened(depositId, msg.sender, planId);
    return depositId;
}
```

**Test Checklist:**
- [ ] Validates plan is active
- [ ] Validates amount in range
- [ ] Transfers principal to TokenVault
- [ ] Reserves interest correctly
- [ ] Creates deposit record
- [ ] Mints NFT to user
- [ ] Emits event

---

#### **1.9 SavingsBank.sol - withdraw** ⏱️ 1 giờ

```solidity
function withdraw(uint256 depositId) external nonReentrant whenNotPaused {
    // 1. Validate ownership via NFT
    require(depositNFT.ownerOf(depositId) == msg.sender, "Not owner");
    
    DepositCertificate storage cert = deposits[depositId];
    require(cert.status == 0, "Not active");
    require(block.timestamp >= cert.maturityTime, "Not matured");
    
    // 2. Calculate interest
    uint256 duration = cert.maturityTime - cert.startTime;
    uint256 durationDays = duration / 1 days;
    uint256 interest = cert.principal.calculateInterest(cert.lockedAprBps, durationDays);
    
    // 3. Release reserved interest
    interestVault.release(interest);
    totalReservedInterest -= interest;
    
    // 4. Transfer principal + interest
    tokenVault.withdraw(msg.sender, cert.principal);
    interestVault.withdraw(msg.sender, interest);
    
    // 5. Update state
    cert.status = 1; // Withdrawn
    
    // 6. Burn NFT
    depositNFT.burn(depositId);
    
    emit Withdrawn(depositId, msg.sender, cert.principal + interest);
}
```

**Test Checklist:**
- [ ] Only NFT owner can withdraw
- [ ] Cannot withdraw before maturity
- [ ] Cannot withdraw twice
- [ ] Interest calculated correctly
- [ ] Reserved interest released
- [ ] Principal + interest transferred
- [ ] NFT burned

---

#### **1.10 SavingsBank.sol - earlyWithdraw** ⏱️ 1 giờ

```solidity
function earlyWithdraw(uint256 depositId) external nonReentrant whenNotPaused {
    require(depositNFT.ownerOf(depositId) == msg.sender, "Not owner");
    
    DepositCertificate storage cert = deposits[depositId];
    require(cert.status == 0, "Not active");
    require(block.timestamp < cert.maturityTime, "Already matured");
    
    SavingPlan memory plan = savingPlans[cert.planId];
    
    // Calculate penalty
    uint256 penalty = cert.principal.calculatePenalty(plan.penaltyBps);
    uint256 toUser = cert.principal - penalty;
    
    // Release reserved interest (no interest paid)
    uint256 duration = cert.maturityTime - cert.startTime;
    uint256 reservedInterest = cert.principal.calculateInterest(
        cert.lockedAprBps, 
        duration / 1 days
    );
    interestVault.release(reservedInterest);
    totalReservedInterest -= reservedInterest;
    
    // Transfer principal - penalty to user
    tokenVault.withdraw(msg.sender, toUser);
    
    // Transfer penalty to InterestVault (boost liquidity)
    tokenVault.withdraw(address(interestVault), penalty);
    
    // Update state
    cert.status = 2; // EarlyWithdrawn
    
    // Burn NFT
    depositNFT.burn(depositId);
    
    emit EarlyWithdrawn(depositId, msg.sender, penalty);
}
```

**Test Checklist:**
- [ ] Cannot early withdraw after maturity
- [ ] Penalty calculated correctly
- [ ] User receives principal - penalty
- [ ] Penalty goes to InterestVault
- [ ] No interest paid
- [ ] Reserved interest released

---

### **Day 5: SavingsBank (Part 3)**

#### **1.11 SavingsBank.sol - renew** ⏱️ 2 giờ

```solidity
function renew(
    uint256 depositId,
    bool useCurrentRate,
    uint256 newPlanId
) external nonReentrant whenNotPaused returns (uint256) {
    require(depositNFT.ownerOf(depositId) == msg.sender, "Not owner");
    
    DepositCertificate storage oldCert = deposits[depositId];
    require(oldCert.status == 0, "Not active");
    require(block.timestamp >= oldCert.maturityTime, "Not matured");
    
    // Calculate accrued interest
    uint256 duration = oldCert.maturityTime - oldCert.startTime;
    uint256 interest = oldCert.principal.calculateInterest(
        oldCert.lockedAprBps,
        duration / 1 days
    );
    
    // Release old reserved interest
    interestVault.release(interest);
    totalReservedInterest -= interest;
    
    // New principal = old principal + interest (compound)
    uint256 newPrincipal = oldCert.principal + interest;
    
    // Transfer interest to TokenVault
    interestVault.withdraw(address(tokenVault), interest);
    
    // Determine new plan params
    uint256 targetPlanId;
    uint256 newAprBps;
    uint256 newDuration;
    
    if (!useCurrentRate) {
        // Auto: use locked params
        targetPlanId = oldCert.planId;
        newAprBps = oldCert.lockedAprBps;
        newDuration = (oldCert.maturityTime - oldCert.startTime) / 1 days;
    } else {
        // Manual: use current params
        targetPlanId = (newPlanId == 0) ? oldCert.planId : newPlanId;
        SavingPlan memory newPlan = savingPlans[targetPlanId];
        require(newPlan.isActive, "Plan not active");
        newAprBps = newPlan.aprBps;
        newDuration = newPlan.durationDays;
    }
    
    // Create new deposit
    uint256 newDepositId = nextDepositId++;
    uint256 newMaturityTime = block.timestamp + (newDuration * 1 days);
    uint256 newEstimatedInterest = newPrincipal.calculateInterest(newAprBps, newDuration);
    
    // Reserve new interest
    interestVault.reserve(newEstimatedInterest);
    totalReservedInterest += newEstimatedInterest;
    
    deposits[newDepositId] = DepositCertificate({
        planId: targetPlanId,
        principal: newPrincipal,
        startTime: block.timestamp,
        maturityTime: newMaturityTime,
        lockedAprBps: newAprBps,
        isAutoRenewEnabled: oldCert.isAutoRenewEnabled,
        status: 0
    });
    
    // Update old deposit
    oldCert.status = 3; // Renewed
    
    // Burn old NFT, mint new NFT
    depositNFT.burn(depositId);
    depositNFT.mint(msg.sender, newDepositId);
    
    emit Renewed(depositId, newDepositId);
    return newDepositId;
}
```

**Test Checklist:**
- [ ] Auto renew uses locked APR
- [ ] Manual renew uses current APR
- [ ] Can switch to different plan
- [ ] Interest compounded correctly
- [ ] Old NFT burned, new NFT minted
- [ ] Reserved interest updated correctly

---

#### **1.12 SavingsBank.sol - View Functions** ⏱️ 30 phút

```solidity
function getDepositDetails(uint256 depositId) external view returns (
    uint256 planId,
    uint256 principal,
    uint256 startTime,
    uint256 maturityTime,
    uint256 apr,
    bool autoRenew,
    uint8 status
) {
    DepositCertificate memory d = deposits[depositId];
    return (
        d.planId,
        d.principal,
        d.startTime,
        d.maturityTime,
        d.lockedAprBps,
        d.isAutoRenewEnabled,
        d.status
    );
}

function getPlanName(uint256 planId) external view returns (string memory) {
    return savingPlans[planId].name;
}

function getUserDeposits(address user) external view returns (uint256[] memory) {
    uint256 balance = depositNFT.balanceOf(user);
    uint256[] memory depositIds = new uint256[](balance);
    
    for (uint256 i = 0; i < balance; i++) {
        depositIds[i] = depositNFT.tokenOfOwnerByIndex(user, i);
    }
    
    return depositIds;
}
```

---

## 📅 PHASE 2: Testing (2-3 days)

### **Day 6: Unit Tests**

#### **2.1 Unit Tests** ⏱️ Full day

**Files to create:**
```
test/unit/
├── MockUSDC.test.ts
├── TokenVault.test.ts
├── InterestVault.test.ts
├── DepositNFT.test.ts
├── SavingsBank.test.ts
└── InterestCalculator.test.ts
```

**SavingsBank.test.ts Structure:**
```typescript
describe("SavingsBank", () => {
  describe("Initialization", () => {
    it("Should initialize correctly");
    it("Should set correct dependencies");
  });
  
  describe("Plan Management", () => {
    it("Should create plan");
    it("Should update plan");
    it("Should enable/disable plan");
  });
  
  describe("Deposit Operations", () => {
    it("Should open deposit");
    it("Should validate amount range");
    it("Should reserve interest");
    it("Should mint NFT");
  });
  
  describe("Withdraw Operations", () => {
    it("Should withdraw at maturity");
    it("Should pay interest");
    it("Should burn NFT");
    it("Should early withdraw with penalty");
    it("Should send penalty to InterestVault");
  });
  
  describe("Renewal Operations", () => {
    it("Should auto renew with locked APR");
    it("Should manual renew with current APR");
    it("Should compound interest");
  });
  
  describe("Upgradeability", () => {
    it("Should upgrade to V2");
    it("Should preserve storage");
  });
});
```

---

### **Day 7: Integration Tests**

#### **2.2 Integration Tests** ⏱️ Full day

```
test/integration/
├── FullFlow.test.ts
├── Upgradeability.test.ts
└── NFTMetadata.test.ts
```

**Test Scenarios:**
- [ ] Complete user journey (approve → deposit → withdraw)
- [ ] Multi-user concurrent deposits
- [ ] Vault balance management
- [ ] Upgrade mid-operation
- [ ] NFT transfer → new owner withdraws

---

## 📅 PHASE 3: Deployment (1 day)

### **Day 8: Deployment Scripts & Deploy**

#### **3.1 Deployment Scripts** ⏱️ Half day

```
deploy/
├── 01_deploy_mock.ts
├── 02_deploy_vaults.ts
├── 03_deploy_nft.ts
├── 04_deploy_savings_bank.ts  // UUPS Proxy!
├── 05_setup_ownership.ts
├── 06_configure_system.ts
└── 07_initialize_data.ts
```

**04_deploy_savings_bank.ts Example:**
```typescript
import { ethers, upgrades } from "hardhat";

export default async function () {
  const [deployer] = await ethers.getSigners();
  
  // Get deployed addresses
  const usdc = "0x...";
  const tokenVault = "0x...";
  const interestVault = "0x...";
  const depositNFT = "0x...";
  
  // Deploy with UUPS proxy
  const SavingsBank = await ethers.getContractFactory("SavingsBank");
  const savingsBank = await upgrades.deployProxy(
    SavingsBank,
    [usdc, tokenVault, interestVault, depositNFT],
    { kind: "uups" }
  );
  
  await savingsBank.waitForDeployment();
  console.log("SavingsBank Proxy:", await savingsBank.getAddress());
}
```

#### **3.2 Deploy to Sepolia** ⏱️ Half day

```bash
# Deploy all
yarn deploy:sepolia

# Verify contracts
yarn verify
```

**Checklist:**
- [ ] All contracts deployed
- [ ] Ownership transferred
- [ ] System configured
- [ ] Plans created
- [ ] Vault funded
- [ ] Verified on Etherscan

---

## ✅ COMPLETION CHECKLIST

### **Contracts:**
- [ ] MockUSDC.sol
- [ ] TokenVault.sol + ITokenVault.sol
- [ ] InterestVault.sol + IInterestVault.sol
- [ ] DepositNFT.sol + IDepositNFT.sol
- [ ] SavingsBank.sol + ISavingsBank.sol
- [ ] InterestCalculator.sol

### **Tests:**
- [ ] 6 unit test files, all passing
- [ ] 3 integration test files, all passing
- [ ] 100% function coverage
- [ ] Edge cases covered

### **Deployment:**
- [ ] Deployed to localhost
- [ ] Deployed to Sepolia
- [ ] All contracts verified
- [ ] System initialized

### **Documentation:**
- [ ] README updated
- [ ] Deployment guide  
- [ ] User guide

---

## 🚀 READY TO START!

**Bắt đầu từ:**
1. `contracts/mocks/MockUSDC.sol`
2. `contracts/libraries/InterestCalculator.sol`
3. `contracts/core/TokenVault.sol`

Làm từng file một, test kỹ, rồi tiếp tục file tiếp theo!

**Last Updated:** 2026-01-29 14:56
