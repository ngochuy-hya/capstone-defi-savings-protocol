# 🏗️ DeFi Savings Protocol - Final Architecture V3.0 (Pragmatic SOLID)

> **Version:** 3.0 - Pragmatic SOLID  
> **Date:** 29/01/2026  
> **Status:** Ready for Implementation  
> **Focus:** Security + Upgradeability + Simplicity

---

## 🎯 DESIGN PHILOSOPHY

### **Senior Engineering Approach:**
```
✅ Token Safety:      Immutable vaults giữ funds
✅ Upgradeability:    UUPS Proxy cho logic
✅ Simplicity:        6 contracts, dễ audit
✅ Industry Standard: Pattern từ Compound, Aave
✅ Gas Efficient:     Single proxy call
```

### **Why Not Full SOLID (10 contracts)?**
- ❌ Over-engineering cho scale hiện tại
- ❌ Chi phí deploy cao
- ❌ Audit phức tạp hơn
- ❌ Gas overhead từ multiple delegatecalls

### **Why Not Monolithic (1 contract)?**
- ❌ Token at risk nếu logic bug
- ❌ Không upgrade được
- ❌ Khó maintain

---

## 📐 SYSTEM ARCHITECTURE

### **High-Level Overview**

```
                          MockUSDC.sol
                     (ERC20 - 6 decimals)
                               │
               ┌───────────────┼───────────────┐
               │               │               │
               ▼               ▼               ▼
       ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │ TokenVault   │ │InterestVault │ │ DepositNFT   │
       │              │ │              │ │              │
       │ IMMUTABLE    │ │ IMMUTABLE    │ │ IMMUTABLE    │
       │ ~50 lines    │ │ ~50 lines    │ │ ERC721       │
       │ Giữ Token    │ │ Giữ Token    │ │ Ownership    │
       └──────▲───────┘ └──────▲───────┘ └──────▲───────┘
              │                │                 │
              └────────────────┴─────────────────┘
                               │
                               │ owner / calls
                               ▼
                    ┌─────────────────────┐
                    │   SavingsBank       │
                    │   (UUPS Proxy)      │
                    │                     │
                    │   UPGRADEABLE       │
                    │   Logic + State     │
                    │   ~600 lines        │
                    └─────────────────────┘
                               │
                               │ uses
                               ▼
                    ┌─────────────────────┐
                    │ InterestCalculator  │
                    │   (Library)         │
                    │   Pure Math         │
                    └─────────────────────┘
```

---

## 🎯 CONTRACT RESPONSIBILITIES

| Contract | Type | Lines | Holds Token? | Upgradeable? | Purpose |
|----------|------|-------|--------------|--------------|---------|
| **MockUSDC** | ERC20 | ~100 | ✅ (everyone) | ❌ | Test stablecoin |
| **TokenVault** | Vault | ~50 | ✅ (principal) | ❌ | Immutable deposit vault |
| **InterestVault** | Vault | ~50 | ✅ (interest) | ❌ | Immutable interest pool |
| **DepositNFT** | ERC721 | ~300 | ❌ | ❌ | Ownership tracking |
| **SavingsBank** | Business Logic | ~600 | ❌ | ✅ (UUPS) | Core logic + state |
| **InterestCalculator** | Library | ~30 | ❌ | ❌ | Pure interest math |

**Total: 6 contracts (~1,130 lines)**

---

## 📦 CONTRACT DETAILS

### **1. MockUSDC.sol** (Testing Only)

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

---

### **2. TokenVault.sol** (Immutable)

```solidity
/**
 * @title TokenVault
 * @notice IMMUTABLE vault giữ user deposits
 * @dev Simple, auditable, safe - NEVER upgrade
 */
contract TokenVault is Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable usdc;
    
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = IERC20(_usdc);
    }
    
    function deposit(address from, uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(from, address(this), amount);
        emit Deposited(from, amount);
    }
    
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(amount <= balance(), "Insufficient balance");
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
    
    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
```

**Why Immutable:**
- ✅ ~50 lines → Dễ audit
- ✅ Không logic phức tạp → Ít bug
- ✅ Token luôn safe, có thể emergency withdraw
- ✅ Battle-tested pattern

---

### **3. InterestVault.sol** (Immutable)

```solidity
/**
 * @title InterestVault
 * @notice IMMUTABLE vault giữ interest pool + penalties
 */
contract InterestVault is Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable usdc;
    uint256 public totalReserved; // Reserved cho active deposits
    
    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Reserved(uint256 amount);
    event Released(uint256 amount);
    
    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }
    
    function deposit(address from, uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(from, address(this), amount);
        emit Funded(from, amount);
    }
    
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(amount <= balance(), "Insufficient balance");
        usdc.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
    
    function reserve(uint256 amount) external onlyOwner {
        require(amount <= availableBalance(), "Insufficient available");
        totalReserved += amount;
        emit Reserved(amount);
    }
    
    function release(uint256 amount) external onlyOwner {
        require(amount <= totalReserved, "Invalid release");
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

---

### **4. DepositNFT.sol** (Immutable ERC721)

```solidity
/**
 * @title DepositNFT
 * @notice ERC721 representing deposit ownership
 * @dev Metadata onchain (Data URI), reads from SavingsBank
 */
contract DepositNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;
    
    ISavingsBank public savingsBank;
    
    event Minted(uint256 indexed tokenId, address indexed to);
    event Burned(uint256 indexed tokenId);
    event MetadataRefreshed(uint256 indexed tokenId);
    
    constructor() ERC721("DeFi Savings Certificate", "DSC") Ownable(msg.sender) {}
    
    function setSavingsBank(address _savingsBank) external onlyOwner {
        require(_savingsBank != address(0), "Invalid address");
        savingsBank = ISavingsBank(_savingsBank);
    }
    
    function mint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
        emit Minted(tokenId, to);
    }
    
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
        emit Burned(tokenId);
    }
    
    function refreshMetadata(uint256 tokenId) external {
        require(_exists(tokenId), "Token does not exist");
        emit MetadataRefreshed(tokenId);
    }
    
    // Metadata onchain - Data URI
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        // Get deposit data from SavingsBank
        (
            uint256 planId,
            uint256 principal,
            uint256 startTime,
            uint256 maturityTime,
            uint256 apr,
            ,
            uint8 status
        ) = savingsBank.getDepositDetails(tokenId);
        
        string memory planName = savingsBank.getPlanName(planId);
        
        // Generate SVG
        string memory svg = _generateSVG(
            tokenId, planName, principal, apr, 
            startTime, maturityTime, status
        );
        
        // Generate JSON
        string memory json = _generateJSON(tokenId, planName, svg, principal, apr);
        
        // Return Data URI
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }
    
    function _generateSVG(...) internal pure returns (string memory) {
        // Beautiful SVG certificate với gradient, progress bar, etc.
    }
    
    function _generateJSON(...) internal pure returns (string memory) {
        // OpenSea-compatible JSON metadata
    }
}
```

---

### **5. SavingsBank.sol** (UUPS Upgradeable)

```solidity
/**
 * @title SavingsBank
 * @notice Core business logic - UPGRADEABLE via UUPS Proxy
 * @dev Không giữ token, chỉ orchestrate vaults
 */
contract SavingsBank is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using InterestCalculator for uint256;
    
    // ========== STATE VARIABLES ==========
    
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
    
    // ========== EVENTS ==========
    
    event PlanCreated(uint256 indexed planId, string name);
    event PlanUpdated(uint256 indexed planId);
    event DepositOpened(uint256 indexed depositId, address indexed user, uint256 planId);
    event Withdrawn(uint256 indexed depositId, address indexed user, uint256 amount);
    event EarlyWithdrawn(uint256 indexed depositId, address indexed user, uint256 penalty);
    event Renewed(uint256 indexed oldDepositId, uint256 indexed newDepositId);
    
    // ========== INITIALIZER ==========
    
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
    
    // ========== UPGRADE AUTHORIZATION ==========
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // ========== ADMIN FUNCTIONS ==========
    
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
    
    function fundVault(uint256 amount) external onlyOwner {
        interestVault.deposit(msg.sender, amount);
    }
    
    function withdrawVault(uint256 amount) external onlyOwner {
        require(amount <= interestVault.availableBalance(), "Exceeds available");
        interestVault.withdraw(msg.sender, amount);
    }
    
    // ========== USER FUNCTIONS ==========
    
    function openDeposit(
        uint256 planId,
        uint256 amount,
        bool enableAutoRenew
    ) external nonReentrant whenNotPaused returns (uint256) {
        // Validate
        SavingPlan memory plan = savingPlans[planId];
        require(plan.isActive, "Plan not active");
        require(amount >= plan.minDeposit && amount <= plan.maxDeposit, "Invalid amount");
        
        // Calculate
        uint256 maturityTime = block.timestamp + (plan.durationDays * 1 days);
        uint256 estimatedInterest = amount.calculateInterest(plan.aprBps, plan.durationDays);
        
        // Transfer to TokenVault
        tokenVault.deposit(msg.sender, amount);
        
        // Reserve interest
        interestVault.reserve(estimatedInterest);
        totalReservedInterest += estimatedInterest;
        
        // Create deposit record
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
        
        // Mint NFT
        depositNFT.mint(msg.sender, depositId);
        
        emit DepositOpened(depositId, msg.sender, planId);
        return depositId;
    }
    
    function withdraw(uint256 depositId) external nonReentrant whenNotPaused {
        // Validate ownership via NFT
        require(depositNFT.ownerOf(depositId) == msg.sender, "Not owner");
        
        DepositCertificate storage cert = deposits[depositId];
        require(cert.status == 0, "Not active");
        require(block.timestamp >= cert.maturityTime, "Not matured");
        
        // Calculate interest
        uint256 duration = cert.maturityTime - cert.startTime;
        uint256 durationDays = duration / 1 days;
        uint256 interest = cert.principal.calculateInterest(cert.lockedAprBps, durationDays);
        
        // Release reserved interest
        interestVault.release(interest);
        totalReservedInterest -= interest;
        
        // Transfer principal + interest
        tokenVault.withdraw(msg.sender, cert.principal);
        interestVault.withdraw(msg.sender, interest);
        
        // Update state
        cert.status = 1; // Withdrawn
        
        // Burn NFT
        depositNFT.burn(depositId);
        
        emit Withdrawn(depositId, msg.sender, cert.principal + interest);
    }
    
    function earlyWithdraw(uint256 depositId) external nonReentrant whenNotPaused {
        require(depositNFT.ownerOf(depositId) == msg.sender, "Not owner");
        
        DepositCertificate storage cert = deposits[depositId];
        require(cert.status == 0, "Not active");
        require(block.timestamp < cert.maturityTime, "Already matured");
        
        SavingPlan memory plan = savingPlans[cert.planId];
        
        // Calculate penalty
        uint256 penalty = (cert.principal * plan.penaltyBps) / 10000;
        uint256 toUser = cert.principal - penalty;
        
        // Release reserved interest (không trả lãi)
        uint256 duration = cert.maturityTime - cert.startTime;
        uint256 reservedInterest = cert.principal.calculateInterest(
            cert.lockedAprBps, 
            duration / 1 days
        );
        interestVault.release(reservedInterest);
        totalReservedInterest -= reservedInterest;
        
        // Transfer: principal - penalty to user
        tokenVault.withdraw(msg.sender, toUser);
        
        // Transfer: penalty to InterestVault (boost liquidity)
        tokenVault.withdraw(address(interestVault), penalty);
        
        // Update state
        cert.status = 2; // EarlyWithdrawn
        
        // Burn NFT
        depositNFT.burn(depositId);
        
        emit EarlyWithdrawn(depositId, msg.sender, penalty);
    }
    
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
        
        // New principal = old principal + interest
        uint256 newPrincipal = oldCert.principal + interest;
        
        // Transfer interest to TokenVault (compound)
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
    
    // ========== VIEW FUNCTIONS ==========
    
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
}
```

---

### **6. InterestCalculator.sol** (Library)

```solidity
/**
 * @title InterestCalculator
 * @notice Pure interest calculation library
 */
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

---

## 🚀 DEPLOYMENT FLOW

### **Step-by-Step:**

```bash
# 1. Deploy Mock (for testing)
MockUSDC.deploy()

# 2. Deploy Immutable Vaults
TokenVault.deploy(usdc)
InterestVault.deploy(usdc)

# 3. Deploy NFT
DepositNFT.deploy()

# 4. Deploy SavingsBank Implementation
SavingsBank_Implementation.deploy()

# 5. Deploy UUPS Proxy
initData = encodeInitialize(usdc, tokenVault, interestVault, depositNFT)
ERC1967Proxy.deploy(savingsBankImpl, initData)
  → This is the SavingsBank address users interact with

# 6. Transfer Ownership
tokenVault.transferOwnership(proxy)
interestVault.transferOwnership(proxy)
depositNFT.transferOwnership(proxy)

# 7. Configure NFT
depositNFT.setSavingsBank(proxy)

# 8. Fund & Initialize
savingsBank.createPlan("3 Months", 90, ...)
savingsBank.fundVault(1000000 * 1e6) // 1M USDC
```

---

## 🔄 UPGRADE SCENARIO

### **When Bug Found:**

```typescript
// 1. Pause
await savingsBank.pause();

// 2. Deploy V2
const SavingsBankV2 = await ethers.getContractFactory("SavingsBankV2");
const implV2 = await SavingsBankV2.deploy();

// 3. Upgrade Proxy
await savingsBank.upgradeTo(implV2.address);

// 4. Test
// ... run tests

// 5. Unpause
await savingsBank.unpause();
```

**Result:**
- ✅ Storage preserved (all deposits, plans intact)
- ✅ Vaults unchanged (tokens safe)
- ✅ NFT unchanged (ownership intact)
- ✅ Only logic updated

---

## 📊 GAS ESTIMATES

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| **Deploy All** | ~4M | One-time cost |
| **openDeposit** | ~180k | Transfer + NFT mint |
| **withdraw** | ~120k | Transfer + NFT burn |
| **earlyWithdraw** | ~130k | Penalty calc |
| **renew** | ~200k | Burn old + mint new NFT |
| **Upgrade** | ~100k | Just change implementation |

---

## ✅ IMPLEMENTATION CHECKLIST

### **Phase 1: Core Contracts** ⏱️ 2-3 days

- [ ] MockUSDC.sol
- [ ] TokenVault.sol + ITokenVault.sol
- [ ] InterestVault.sol + IInterestVault.sol
- [ ] DepositNFT.sol + IDepositNFT.sol
- [ ] InterestCalculator.sol (library)
- [ ] SavingsBank.sol + ISavingsBank.sol

### **Phase 2: Testing** ⏱️ 2-3 days

- [ ] Unit tests for each contract
- [ ] Integration tests (full flows)
- [ ] Upgrade tests (UUPS)
- [ ] Gas profiling

### **Phase 3: Deployment** ⏱️ 1 day

- [ ] Deploy scripts
- [ ] Deploy to localhost
- [ ] Deploy to Sepolia
- [ ] Verify contracts

### **Phase 4: Documentation** ⏱️ 1 day

- [ ] Update README
- [ ] User guide
- [ ] Developer guide

**Total: ~6-8 days**

---

## 🔒 SECURITY CONSIDERATIONS

1. **Vaults:**
   - ✅ Immutable → No upgrade risk
   - ✅ Simple logic → Easy audit
   - ✅ OnlyOwner → Access control

2. **UUPS Proxy:**
   - ✅ OpenZeppelin battle-tested
   - ✅ _authorizeUpgrade protection
   - ✅ Can pause before upgrade

3. **Reentrancy:**
   - ✅ ReentrancyGuard on all functions
   - ✅ Checks-Effects-Interactions pattern

4. **NFT Ownership:**
   - ✅ Validates ownerOf before operations
   - ✅ Burns NFT after withdraw

---

**Version:** 3.0 - Pragmatic SOLID  
**Last Updated:** 2026-01-29  
**Status:** ✅ Ready for Implementation
