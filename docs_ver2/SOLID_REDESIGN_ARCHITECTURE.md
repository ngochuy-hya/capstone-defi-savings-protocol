# 🏗️ DeFi Savings Protocol - SOLID Redesign Architecture

> **Version:** 3.0 - SOLID + Hybrid Onchain/Offchain  
> **Date:** 29/01/2026  
> **Purpose:** Tách biệt concerns để tránh mất token khi logic lỗi + Tối ưu gas với offchain metadata

---

## 🎯 VẤN ĐỀ CẦN GIẢI QUYẾT

### **Rủi ro hiện tại:**
1. ❌ **Logic lỗi → Mất token**: Nếu SavingsBank có bug, token user/admin có thể bị lock
2. ❌ **NFT phụ thuộc SavingsBank**: Nếu SavingsBank upgrade, NFT cũng phải redeploy
3. ❌ **Vault lẫn lộn**: TokenVault + InterestVault quá đơn giản, không có logic riêng
4. ❌ **Metadata onchain**: Tốn gas, khó update
5. ❌ **Plan data onchain**: Update plan params = tốn gas

### **Giải pháp SOLID:**
1. ✅ **Single Responsibility**: Mỗi contract 1 nhiệm vụ duy nhất
2. ✅ **Open/Closed**: Có thể extend logic mà không sửa storage
3. ✅ **Liskov Substitution**: Interface rõ ràng, swap được implementation
4. ✅ **Interface Segregation**: Nhiều interface nhỏ, không phụ thuộc không cần thiết
5. ✅ **Dependency Inversion**: Phụ thuộc vào abstraction (interface), không phụ thuộc concrete class

---

## 📐 KIẾN TRÚC MỚI

### **Layer Architecture**

```
┌──────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (Frontend)                   │
│  - Web3.js/Ethers.js kết nối Onchain                             │
│  - API Gateway kết nối Offchain (IPFS/Backend)                   │
└──────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
        ▼                                               ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│   ONCHAIN LAYER         │                 │   OFFCHAIN LAYER        │
│   (Smart Contracts)     │                 │   (IPFS/Backend)        │
├─────────────────────────┤                 ├─────────────────────────┤
│                         │                 │                         │
│ 1. Storage Contracts    │                 │ 1. Plan Metadata        │
│    - TokenStorage       │                 │    - planId → JSON      │
│    - InterestStorage    │                 │    - name, description  │
│    - NFTRegistry        │                 │    - images, graphics   │
│                         │                 │                         │
│ 2. Logic Contracts      │                 │ 2. NFT Metadata         │
│    - SavingsPlanLogic   │                 │    - depositId → JSON   │
│    - DepositLogic       │                 │    - certificate SVG    │
│    - WithdrawLogic      │                 │    - progress graphics  │
│    - RenewalLogic       │                 │                         │
│                         │                 │ 3. Event Indexer        │
│ 3. Coordinator          │                 │    - Index blockchain   │
│    - SavingsCoordinator │                 │    - Cache frequently   │
│                         │                 │      accessed data      │
└─────────────────────────┘                 └─────────────────────────┘
```

---

## 🎨 SOLID PRINCIPLES APPLICATION

### **1. Single Responsibility Principle (SRP)**

**Mỗi contract chỉ làm 1 việc:**

#### **Storage Layer (Chỉ lưu trữ)**
- `TokenStorage.sol`: Chỉ giữ USDC của user deposits
- `InterestStorage.sol`: Chỉ giữ USDC interest pool
- `NFTRegistry.sol`: Chỉ quản lý NFT ownership (ERC721)

#### **Logic Layer (Chỉ xử lý logic)**
- `PlanLogic.sol`: Chỉ quản lý plan (create, update, enable/disable)
- `DepositLogic.sol`: Chỉ xử lý deposit operations
- `WithdrawLogic.sol`: Chỉ xử lý withdraw operations
- `RenewalLogic.sol`: Chỉ xử lý renewal operations

#### **Coordinator Layer (Orchestration)**
- `SavingsCoordinator.sol`: Điều phối các logic contracts

**Lợi ích:**
- ✅ Logic lỗi → Chỉ upgrade logic contract
- ✅ Storage contracts không đổi → Token an toàn
- ✅ NFT độc lập → Không bị ảnh hưởng

---

### **2. Open/Closed Principle (OCP)**

**Open for Extension, Closed for Modification**

```solidity
// Interface không đổi
interface IDepositLogic {
    function createDeposit(
        address user,
        uint256 planId,
        uint256 amount
    ) external returns (uint256 depositId);
}

// Implementation v1
contract DepositLogicV1 is IDepositLogic {
    // Logic cũ
}

// Implementation v2 (extend, không sửa v1)
contract DepositLogicV2 is IDepositLogic {
    // Logic mới, cải tiến
    // Không cần sửa TokenStorage hay NFTRegistry!
}

// Coordinator chỉ cần swap address
coordinator.setDepositLogic(address(depositLogicV2));
```

**Lợi ích:**
- ✅ Upgrade logic dễ dàng
- ✅ Rollback nhanh nếu có bug
- ✅ A/B testing được

---

### **3. Liskov Substitution Principle (LSP)**

**Các implementation phải thay thế được cho nhau**

```solidity
interface IWithdrawStrategy {
    function calculateWithdrawAmount(
        uint256 depositId,
        bool isEarly
    ) external view returns (
        uint256 principalToReturn,
        uint256 interestToReturn,
        uint256 penaltyAmount
    );
}

// Strategy 1: Fixed penalty
contract FixedPenaltyStrategy is IWithdrawStrategy {
    // penalty = principal * fixedRate
}

// Strategy 2: Time-based penalty
contract TimeBasedPenaltyStrategy is IWithdrawStrategy {
    // penalty = f(time remaining)
}

// Coordinator không cần biết strategy nào
withdrawLogic.setStrategy(IWithdrawStrategy(strategy));
```

---

### **4. Interface Segregation Principle (ISP)**

**Nhiều interface nhỏ, không interface to**

```solidity
// ❌ BAD: 1 interface lớn
interface ISavingsBank {
    // Plan functions
    function createPlan(...) external;
    function updatePlan(...) external;
    
    // Deposit functions
    function deposit(...) external;
    function withdraw(...) external;
    
    // Admin functions
    function fundVault(...) external;
    function pause() external;
}

// ✅ GOOD: Nhiều interface nhỏ
interface IPlanManagement {
    function createPlan(...) external;
    function updatePlan(...) external;
}

interface IDepositOperations {
    function deposit(...) external;
    function withdraw(...) external;
}

interface IAdminControls {
    function fundVault(...) external;
    function pause() external;
}
```

---

### **5. Dependency Inversion Principle (DIP)**

**Phụ thuộc vào abstraction, không phụ thuộc concrete**

```solidity
// ❌ BAD: Phụ thuộc concrete class
contract SavingsBank {
    TokenVault public vault;  // Hard-coded dependency
    
    function deposit() external {
        vault.deposit(...);  // Không thay đổi được
    }
}

// ✅ GOOD: Phụ thuộc interface
contract SavingsCoordinator {
    ITokenStorage public tokenStorage;  // Interface
    IDepositLogic public depositLogic;  // Interface
    
    function deposit() external {
        // Có thể swap implementation bất cứ lúc nào
        depositLogic.execute(...);
    }
    
    function upgradeDepositLogic(address newLogic) external onlyAdmin {
        depositLogic = IDepositLogic(newLogic);
    }
}
```

---

## 💾 HYBRID ONCHAIN/OFFCHAIN DESIGN

### **Nguyên tắc phân chia:**

**ONCHAIN (Must be trustless):**
- ✅ Token balances
- ✅ Ownership (NFT)
- ✅ Critical state (deposit amount, maturity time)
- ✅ Core logic execution

**OFFCHAIN (Can be cached/reconstructed):**
- ✅ Plan metadata (name, description, images)
- ✅ NFT metadata (JSON, SVG graphics)
- ✅ Historical events
- ✅ UI-only data

---

### **Plan Metadata Structure**

#### **Onchain (`PlanRegistry.sol`):**
```solidity
struct PlanCore {
    uint256 planId;
    uint256 createdAt;
    uint256 minDeposit;      // Critical for validation
    uint256 maxDeposit;      // Critical for validation
    uint256 aprBps;          // Critical for interest calculation
    uint256 penaltyBps;      // Critical for penalty calculation
    uint256 durationDays;    // Critical for maturity calculation
    bool isActive;           // Critical for state
    bytes32 metadataHash;    // IPFS hash or offchain ID
}
```

#### **Offchain (IPFS JSON):**
```json
{
  "planId": 1,
  "version": "1.0",
  "name": "Gói Tiết Kiệm 3 Tháng",
  "description": "Lãi suất ưu đãi 5% 

/năm",
  "icon": "ipfs://QmXxx.../plan-icon.png",
  "banner": "ipfs://QmYyy.../plan-banner.jpg",
  "tags": ["short-term", "flexible"],
  "features": [
    "Rút sớm được",
    "Gia hạn tự động",
    "Lãi kép"
  ],
  "terms": "https://example.com/terms/plan-1",
  "displayMetadata": {
    "color": "#667eea",
    "gradient": ["#667eea", "#764ba2"]
  }
}
```

#### **Frontend Integration:**
```typescript
// 1. Lấy onchain core data
const planCore = await planRegistry.getPlan(planId);

// 2. Lấy offchain metadata
const metadataUrl = `https://ipfs.io/ipfs/${planCore.metadataHash}`;
const metadata = await fetch(metadataUrl).then(r => r.json());

// 3. Merge data
const fullPlan = {
  ...planCore,      // Critical onchain data
  ...metadata       // Rich offchain metadata
};
```

---

### **Deposit/NFT Metadata Structure**

#### **Onchain (`DepositRegistry.sol`):**
```solidity
struct DepositCore {
    uint256 depositId;
    uint256 planId;
    address owner;
    uint256 principal;
    uint256 startTime;
    uint256 maturityTime;
    uint256 lockedAprBps;
    uint8 status;
    bool autoRenew;
}
```

#### **Offchain (Dynamic NFT Metadata):**
```json
{
  "name": "Sổ Tiết Kiệm #123",
  "description": "Gói 3 tháng - 5% APR",
  "image": "https://api.savings.com/nft/123/image",
  "animation_url": "https://api.savings.com/nft/123/animation",
  "attributes": [
    {"trait_type": "Plan", "value": "3 Months"},
    {"trait_type": "Principal", "value": "1000 USDC"},
    {"trait_type": "APR", "value": "5%"},
    {"trait_type": "Maturity", "value": "2026-04-29"},
    {"trait_type": "Progress", "value": 45, "display_type": "boost_percentage"},
    {"trait_type": "Status", "value": "Active"}
  ],
  "properties": {
    "onchain_deposit_id": 123,
    "certificate_number": "SV-2026-000123"
  }
}
```

#### **NFT Image Generation (Offchain API):**
```
GET /api/nft/{depositId}/image
→ Generates dynamic SVG certificate với:
  - Progress bar (real-time)
  - Days remaining (calculated)
  - Status badge
  - QR code linking to details
```

---

## 📁 CONTRACT STRUCTURE

### **Storage Contracts (Immutable, Hold Tokens)**

#### **1. TokenStorage.sol**
```solidity
/**
 * @title TokenStorage
 * @notice Chỉ giữ USDC deposits, không có logic
 * @dev Immutable storage, không upgrade được
 */
contract TokenStorage is Ownable {
    IERC20 public immutable usdc;
    
    // State
    uint256 public totalLocked;
    
    // Functions
    function deposit(address from, uint256 amount) external onlyOwner;
    function withdraw(address to, uint256 amount) external onlyOwner;
    function balance() external view returns (uint256);
    
    // Emergency: nếu coordinator lỗi, admin có thể rescue
    function emergencyWithdraw(address to, uint256 amount) external onlyAdmin;
}
```

#### **2. InterestStorage.sol**
```solidity
/**
 * @title InterestStorage
 * @notice Chỉ giữ interest pool, không có logic
 */
contract InterestStorage is Ownable {
    IERC20 public immutable usdc;
    
    uint256 public totalReserved;  // Reserved for active deposits
    
    function deposit(address from, uint256 amount) external onlyOwner;
    function withdraw(address to, uint256 amount) external onlyOwner;
    function reserve(uint256 amount) external onlyOwner;
    function release(uint256 amount) external onlyOwner;
    
    function availableBalance() external view returns (uint256);
}
```

#### **3. NFTRegistry.sol (ERC721)**
```solidity
/**
 * @title NFTRegistry
 * @notice ERC721 đại diện deposit ownership
 * @dev Metadata từ offchain API
 */
contract NFTRegistry is ERC721Enumerable, Ownable {
    string private _baseTokenURI;
    
    // depositId = tokenId
    function mint(address to, uint256 tokenId) external onlyOwner;
    function burn(uint256 tokenId) external onlyOwner;
    
    // Metadata offchain
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }
    
    // Admin có thể update base URI
    function setBaseURI(string memory newBaseURI) external onlyAdmin;
}
```

---

### **State Contracts (Persistent State)**

#### **4. PlanRegistry.sol**
```solidity
/**
 * @title PlanRegistry
 * @notice Lưu plan core data onchain + pointer tới offchain metadata
 */
contract PlanRegistry is Ownable {
    struct PlanCore {
        uint256 planId;
        uint256 createdAt;
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 aprBps;
        uint256 penaltyBps;
        uint256 durationDays;
        bool isActive;
        bytes32 metadataHash;  // IPFS CID hoặc API endpoint ID
    }
    
    mapping(uint256 => PlanCore) public plans;
    uint256 public nextPlanId;
    
    event PlanCreated(uint256 indexed planId, bytes32 metadataHash);
    event PlanUpdated(uint256 indexed planId, uint256 aprBps, uint256 penaltyBps);
    event PlanMetadataUpdated(uint256 indexed planId, bytes32 newMetadataHash);
    
    function createPlan(
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 aprBps,
        uint256 penaltyBps,
        uint256 durationDays,
        bytes32 metadataHash
    ) external onlyOwner returns (uint256 planId);
    
    function updatePlanParams(
        uint256 planId,
        uint256 aprBps,
        uint256 penaltyBps
    ) external onlyOwner;
    
    // Update metadata pointer (không tốn nhiều gas)
    function updatePlanMetadata(
        uint256 planId,
        bytes32 newMetadataHash
    ) external onlyOwner;
}
```

#### **5. DepositRegistry.sol**
```solidity
/**
 * @title DepositRegistry
 * @notice Lưu deposit core state onchain
 */
contract DepositRegistry is Ownable {
    struct DepositCore {
        uint256 depositId;
        uint256 planId;
        address owner;
        uint256 principal;
        uint256 startTime;
        uint256 maturityTime;
        uint256 lockedAprBps;
        uint8 status;
        bool autoRenew;
    }
    
    mapping(uint256 => DepositCore) public deposits;
    uint256 public nextDepositId;
    
    event DepositCreated(uint256 indexed depositId, address indexed owner);
    event DepositStatusChanged(uint256 indexed depositId, uint8 newStatus);
    
    function createDeposit(...) external onlyOwner returns (uint256 depositId);
    function updateStatus(uint256 depositId, uint8 newStatus) external onlyOwner;
    function setAutoRenew(uint256 depositId, bool enabled) external onlyOwner;
}
```

---

### **Logic Contracts (Upgradeable, No Token Storage)**

#### **6. DepositLogic.sol**
```solidity
/**
 * @title DepositLogic
 * @notice Logic tạo deposit mới
 * @dev Có thể upgrade mà không ảnh hưởng storage
 */
contract DepositLogic is Ownable {
    ITokenStorage public tokenStorage;
    IInterestStorage public interestStorage;
    IPlanRegistry public planRegistry;
    IDepositRegistry public depositRegistry;
    INFTRegistry public nftRegistry;
    
    function executeDeposit(
        address user,
        uint256 planId,
        uint256 amount,
        bool autoRenew
    ) external onlyCoordinator returns (uint256 depositId) {
        // 1. Validate
        PlanCore memory plan = planRegistry.getPlan(planId);
        require(plan.isActive, "Plan not active");
        require(amount >= plan.minDeposit && amount <= plan.maxDeposit, "Invalid amount");
        
        // 2. Calculate
        uint256 maturityTime = block.timestamp + (plan.durationDays * 1 days);
        uint256 estimatedInterest = _calculateInterest(amount, plan.aprBps, plan.durationDays);
        
        // 3. Transfer tokens
        tokenStorage.deposit(user, amount);
        
        // 4. Reserve interest
        interestStorage.reserve(estimatedInterest);
        
        // 5. Create deposit record
        depositId = depositRegistry.createDeposit(
            planId,
            user,
            amount,
            maturityTime,
            plan.aprBps,
            autoRenew
        );
        
        // 6. Mint NFT
        nftRegistry.mint(user, depositId);
        
        return depositId;
    }
    
    function _calculateInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 durationDays
    ) internal pure returns (uint256) {
        return (principal * aprBps * durationDays) / (365 * 10000);
    }
}
```

#### **7. WithdrawLogic.sol**
```solidity
/**
 * @title WithdrawLogic
 * @notice Logic rút tiền (normal + early)
 */
contract WithdrawLogic is Ownable {
    // Dependencies (injected)
    ITokenStorage public tokenStorage;
    IInterestStorage public interestStorage;
    IPlanRegistry public planRegistry;
    IDepositRegistry public depositRegistry;
    INFTRegistry public nftRegistry;
    
    function executeWithdraw(uint256 depositId, address caller) external onlyCoordinator {
        // 1. Validate
        DepositCore memory deposit = depositRegistry.getDeposit(depositId);
        require(nftRegistry.ownerOf(depositId) == caller, "Not owner");
        require(deposit.status == 0, "Not active");
        require(block.timestamp >= deposit.maturityTime, "Not matured");
        
        // 2. Calculate
        uint256 interest = _calculateInterest(deposit);
        
        // 3. Release reserved interest
        interestStorage.release(interest);
        
        // 4. Transfer
        tokenStorage.withdraw(caller, deposit.principal);
        interestStorage.withdraw(caller, interest);
        
        // 5. Update state
        depositRegistry.updateStatus(depositId, 1); // Withdrawn
        
        // 6. Burn NFT
        nftRegistry.burn(depositId);
    }
    
    function executeEarlyWithdraw(uint256 depositId, address caller) external onlyCoordinator {
        // Similar but with penalty calculation
        // ...
    }
}
```

#### **8. RenewalLogic.sol**
```solidity
/**
 * @title RenewalLogic
 * @notice Logic gia hạn (auto + manual)
 */
contract RenewalLogic is Ownable {
    // Dependencies
    // ...
    
    function executeAutoRenewal(uint256 oldDepositId, address caller) external onlyCoordinator returns (uint256 newDepositId) {
        // Auto: use locked params
        // ...
    }
    
    function executeManualRenewal(
        uint256 oldDepositId,
        uint256 newPlanId,
        address caller
    ) external onlyCoordinator returns (uint256 newDepositId) {
        // Manual: use current plan params
        // ...
    }
}
```

---

### **Coordinator Contract (Orchestration)**

#### **9. SavingsCoordinator.sol**
```solidity
/**
 * @title SavingsCoordinator
 * @notice Điều phối tất cả operations
 * @dev User chỉ tương tác với contract này
 */
contract SavingsCoordinator is Ownable, Pausable, ReentrancyGuard {
    // Dependencies
    ITokenStorage public tokenStorage;
    IInterestStorage public interestStorage;
    IPlanRegistry public planRegistry;
    IDepositRegistry public depositRegistry;
    INFTRegistry public nftRegistry;
    
    // Logic contracts (có thể upgrade)
    IDepositLogic public depositLogic;
    IWithdrawLogic public withdrawLogic;
    IRenewalLogic public renewalLogic;
    
    // Admin functions
    function setDepositLogic(address newLogic) external onlyOwner;
    function setWithdrawLogic(address newLogic) external onlyOwner;
    function setRenewalLogic(address newLogic) external onlyOwner;
    
    // User-facing functions
    function deposit(
        uint256 planId,
        uint256 amount,
        bool autoRenew
    ) external nonReentrant whenNotPaused returns (uint256 depositId) {
        return depositLogic.executeDeposit(msg.sender, planId, amount, autoRenew);
    }
    
    function withdraw(uint256 depositId) external nonReentrant whenNotPaused {
        withdrawLogic.executeWithdraw(depositId, msg.sender);
    }
    
    function earlyWithdraw(uint256 depositId) external nonReentrant whenNotPaused {
        withdrawLogic.executeEarlyWithdraw(depositId, msg.sender);
    }
    
    function renew(uint256 depositId, uint256 newPlanId) external nonReentrant whenNotPaused returns (uint256 newDepositId) {
        if (newPlanId == 0) {
            // Auto-renewal
            return renewalLogic.executeAutoRenewal(depositId, msg.sender);
        } else {
            // Manual renewal
            return renewalLogic.executeManualRenewal(depositId, newPlanId, msg.sender);
        }
    }
}
```

---

## 🔄 DEPLOYMENT & UPGRADE FLOW

### **Initial Deployment:**
```
1. Deploy Storage Contracts (Immutable)
   → TokenStorage
   → InterestStorage
   → NFTRegistry

2. Deploy State Contracts
   → PlanRegistry
   → DepositRegistry

3. Deploy Logic Contracts V1
   → DepositLogic
   → WithdrawLogic
   → RenewalLogic

4. Deploy Coordinator
   → SavingsCoordinator

5. Setup Permissions
   → TokenStorage.transferOwnership(coordinator)
   → InterestStorage.transferOwnership(coordinator)
   → NFTRegistry.transferOwnership(coordinator)
   → PlanRegistry.transferOwnership(coordinator)
   → DepositRegistry.transferOwnership(coordinator)
   
6. Configure Logic
   → coordinator.setDepositLogic(depositLogic)
   → coordinator.setWithdrawLogic(withdrawLogic)
   → coordinator.setRenewalLogic(renewalLogic)
```

### **Upgrade Scenario (Logic có bug):**
```
1. Pause contract
   → coordinator.pause()

2. Deploy new logic
   → DepositLogicV2.sol

3. Update coordinator
   → coordinator.setDepositLogic(address(depositLogicV2))

4. Unpause
   → coordinator.unpause()

→ Storage contracts KHÔNG ĐỔI
→ Token vẫn an toàn
→ NFT vẫn hoạt động
```

---

## 🌐 OFFCHAIN INFRASTRUCTURE

### **Components:**

#### **1. IPFS for Metadata Storage**
```
Plan Metadata:
├── plan-1.json
├── plan-2.json
└── assets/
    ├── plan-icons/
    └── plan-banners/
```

#### **2. Metadata API (Node.js/Express)**
```
GET  /api/plans/:planId/metadata
→ Returns full plan data (onchain + offchain)

GET  /api/deposits/:depositId/metadata  
→ Returns NFT metadata JSON

GET  /api/deposits/:depositId/image
→ Generates dynamic SVG certificate

GET  /api/deposits/:depositId/animation
→ Returns animated version (optional)
```

#### **3. Event Indexer (The Graph or custom)**
```
Indexes blockchain events:
- DepositCreated
- Withdrawn
- Renewed
- PlanCreated

Provides GraphQL API:
query {
  deposits(where: {owner: "0x..."}) {
    depositId
    planId
    principal
    status
    ...
  }
}
```

---

## 📊 COMPARISON: OLD vs NEW

| Aspect | Old Architecture | New SOLID Architecture |
|--------|------------------|------------------------|
| **Token Safety** | ❌ Logic bug → token stuck | ✅ Storage isolated, always safe |
| **Upgradeability** | ❌ Redeploy everything | ✅ Swap logic contracts only |
| **NFT Independence** | ❌ Coupled to SavingsBank | ✅ Independent NFTRegistry |
| **Metadata Storage** | ❌ Fully onchain | ✅ Hybrid: critical onchain, rich offchain |
| **Gas Cost** | ❌ High (onchain metadata) | ✅ Low (offchain metadata) |
| **Testing** | ❌ Hard (monolithic) | ✅ Easy (modular) |
| **SOLID Compliance** | ❌ Mixed concerns | ✅ Full SOLID principles |

---

## ✅ NEXT STEPS

1. ✅ Review architecture với team
2. ⏳ Tạo chi tiết interfaces
3. ⏳ Implement storage contracts
4. ⏳ Implement logic contracts
5. ⏳ Setup offchain infrastructure (IPFS + API)
6. ⏳ Deploy lên Sepolia testnet
7. ⏳ Integration testing
8. ⏳ Write comprehensive tests

---

**Architect:** Antigravity AI  
**Reviewed by:** [Pending]
