// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./libraries/InterestCalculator.sol";
import "./interfaces/IVaultManager.sol";

/**
 * @title SavingsBank
 * @dev Hệ thống tiết kiệm DeFi giống ngân hàng truyền thống
 * @notice Người dùng mở sổ tiết kiệm, nhận lãi khi đáo hạn
 * 
 * Tính năng chính:
 * - Admin tạo các gói tiết kiệm (kỳ hạn + lãi suất)
 * - User mở sổ tiết kiệm bằng USDC
 * - Tính lãi đơn (simple interest)
 * - Rút tiền đúng hạn hoặc rút sớm (có phạt)
 * - Gia hạn sổ tiết kiệm
 * - ERC721: Mỗi deposit là một NFT transferrable
 * 
 * @notice Method 2 Architecture:
 * - SavingsBank giữ toàn bộ principal của users (USDC deposits)
 * - VaultManager chỉ giữ liquidity pool để trả lãi (interest only)
 * - Clear separation: user funds (principal) vs protocol funds (interest)
 */
contract SavingsBank is ERC721Enumerable, ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    
    // ROLES
    /// @dev Role cho admin (quản lý toàn bộ hệ thống)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ==================== ENUMS ====================
    /// @dev Trạng thái của sổ tiết kiệm
    enum DepositStatus {
        ACTIVE,        // Đang tiết kiệm
        WITHDRAWN,     // Đã rút tiền
        AUTORENEWED,   // Đã tự động gia hạn (giữ nguyên lãi suất cũ)
        MANUALRENEWED  // Đã gia hạn thủ công (áp dụng lãi suất mới)
    }

    // STRUCTS
    
    /**
     * @dev Struct cho gói tiết kiệm (Saving Plan)
     * @notice Admin tạo các gói này với kỳ hạn và lãi suất khác nhau
     */
    struct SavingPlan {
        uint256 planId;                  // ID của plan
        uint32 tenorDays;                // Kỳ hạn (7, 30, 90, 180 ngày...)
        uint16 aprBps;                   // Lãi suất năm (basis points: 800 = 8%)
        uint256 minDeposit;              // Số tiền gửi tối thiểu
        uint256 maxDeposit;              // Số tiền gửi tối đa (0 = không giới hạn)
        uint16 earlyWithdrawPenaltyBps;  // Phạt rút sớm (500 = 5%)
        bool enabled;                    // Plan có đang hoạt động không
    }

    /**
     * @dev Struct cho sổ tiết kiệm (Deposit Certificate)
     * @notice Mỗi user mở sổ sẽ có 1 certificate với ID duy nhất
     */
    struct DepositCertificate {
        uint256 depositId;        // ID duy nhất của sổ tiết kiệm
        address owner;            // Chủ sở hữu
        uint256 planId;           // Plan đã chọn
        uint256 principal;        // Số tiền gốc (USDC)
        uint256 startAt;          // Thời điểm mở sổ
        uint256 maturityAt;       // Thời điểm đáo hạn
        DepositStatus status;     // Trạng thái hiện tại
        uint16 lockedAprBps;      // Lãi suất đã locked (cho auto renew)
        bool isAutoRenewEnabled;  // Có tự động gia hạn không
    }

    // State variables 
    /// @dev Token USDC để gửi tiết kiệm
    IERC20 public immutable depositToken;
    
    /// @dev VaultManager contract quản lý vault
    IVaultManager public immutable vaultManager;
    
    /// @dev Địa chỉ nhận phí phạt (khi user rút sớm)
    address public feeReceiver;
    
    /// @dev ID tiếp theo cho plan mới
    uint256 public nextPlanId;
    
    /// @dev ID tiếp theo cho deposit mới
    uint256 public nextDepositId;
    
    /// @dev Mapping: planId => SavingPlan
    mapping(uint256 => SavingPlan) public plans;
    
    /// @dev Mapping: depositId => DepositCertificate
    mapping(uint256 => DepositCertificate) public deposits;
    
    /// @dev Mapping: user address => danh sách depositId của user
    mapping(address => uint256[]) public userDeposits;

    // Constants
    
    /// @dev Basis points (100% = 10,000 BPS)
    uint256 public constant BPS_DENOMINATOR = 10_000;
    
    /// @dev Số giây trong 1 năm (365 ngày)
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Events

    /// @dev Event khi tạo plan mới
    event PlanCreated(
        uint256 indexed planId,
        uint32 tenorDays,
        uint16 aprBps,
        uint256 minDeposit,
        uint256 maxDeposit
    );
    
    /// @dev Event khi cập nhật plan
    event PlanUpdated(uint256 indexed planId, bool enabled);
    
    /// @dev Event khi user mở sổ tiết kiệm
    event DepositOpened(
        uint256 indexed depositId,
        address indexed owner,
        uint256 indexed planId,
        uint256 principal,
        uint256 maturityAt
    );
    
    /// @dev Event khi rút tiền
    event Withdrawn(
        uint256 indexed depositId,
        address indexed owner,
        uint256 principal,
        uint256 interest,
        bool isEarly
    );
    
    /// @dev Event khi gia hạn
    event Renewed(
        uint256 indexed oldDepositId,
        uint256 indexed newDepositId,
        uint256 newPrincipal,
        bool isAutoRenew,
        uint16 aprBps
    );
    
    /// @dev Event khi admin nạp tiền vào vault
    event VaultFunded(address indexed from, uint256 amount);
    
    /// @dev Event khi admin rút tiền từ vault
    event VaultWithdrawn(address indexed to, uint256 amount);
    
    /// @dev Event khi NFT (deposit certificate) được transfer
    event DepositTransferred(
        uint256 indexed depositId,
        address indexed from,
        address indexed to
    );
    
    /// @dev Event khi user bật/tắt auto renew
    event AutoRenewUpdated(
        uint256 indexed depositId,
        bool isAutoRenewEnabled
    );

    // Constructor
    
    /**
     * @dev Khởi tạo SavingsBank
     * @param _depositToken Địa chỉ token USDC
     * @param _vaultManager Địa chỉ VaultManager contract
     * @param _feeReceiver Địa chỉ nhận phí phạt
     * @param _admin Địa chỉ admin đầu tiên
     * 
     * @notice Constructor này setup:
     * - ERC721 với name "Savings Deposit Certificate" và symbol "SDC"
     * - Token USDC để gửi tiết kiệm
     * - VaultManager contract để quản lý vault
     * - Địa chỉ nhận phí phạt
     * - Admin role cho người quản lý
     * - ID bắt đầu từ 1 (dễ debug hơn 0)
     */
    constructor(
        address _depositToken,
        address _vaultManager,
        address _feeReceiver,
        address _admin
    ) ERC721("Savings Deposit Certificate", "SDC") {
        // Validate inputs
        require(_depositToken != address(0), "Invalid deposit token");
        require(_vaultManager != address(0), "Invalid vault manager");
        require(_feeReceiver != address(0), "Invalid fee receiver");
        require(_admin != address(0), "Invalid admin");

        // Khởi tạo token và địa chỉ
        depositToken = IERC20(_depositToken);
        vaultManager = IVaultManager(_vaultManager);
        feeReceiver = _feeReceiver;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        
        // Bắt đầu ID từ 1 (dễ debug)
        nextPlanId = 1;
        nextDepositId = 1;
    }

    // ==================== ERC721 OVERRIDES ====================
    
    /**
     * @dev Override supportsInterface để support cả ERC721 và AccessControl
     * @param interfaceId Interface ID để check
     * @return bool True nếu contract support interface này
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721Enumerable, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
    
    /**
     * @dev Override _update để sync owner trong DepositCertificate khi NFT transfer
     * @param to Địa chỉ nhận NFT
     * @param tokenId ID của NFT (depositId)
     * @param auth Địa chỉ được authorize để transfer
     * @return previousOwner Địa chỉ owner trước đó
     * 
     * @notice Function này được gọi khi:
     * - Mint NFT (openDeposit)
     * - Transfer NFT (user chuyển deposit cho người khác)
     * - Burn NFT (nếu implement)
     * 
     * @notice Khi transfer, cần update owner trong DepositCertificate
     * và emit DepositTransferred event
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Call parent _update
        address previousOwner = super._update(to, tokenId, auth);
        
        // Nếu không phải mint (from != zero) và không phải burn (to != zero)
        // thì đây là transfer → cập nhật owner trong deposit
        if (from != address(0) && to != address(0)) {
            // Update owner trong DepositCertificate
            deposits[tokenId].owner = to;
            
            // Update userDeposits mapping
            // Remove from old owner's list
            uint256[] storage oldOwnerDeposits = userDeposits[from];
            for (uint256 i = 0; i < oldOwnerDeposits.length; i++) {
                if (oldOwnerDeposits[i] == tokenId) {
                    // Swap với phần tử cuối và pop
                    oldOwnerDeposits[i] = oldOwnerDeposits[oldOwnerDeposits.length - 1];
                    oldOwnerDeposits.pop();
                    break;
                }
            }
            
            // Add to new owner's list
            userDeposits[to].push(tokenId);
            
            // Emit event
            emit DepositTransferred(tokenId, from, to);
        }
        
        return previousOwner;
    }
    
    // Modifiers
    
    /**
     * @dev Modifier check plan có tồn tại và enabled
     */
    modifier planExists(uint256 planId) {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        require(plans[planId].enabled, "Plan is disabled");
        _;
    }

    /**
     * @dev Modifier check deposit có tồn tại
     */
    modifier depositExists(uint256 depositId) {
        require(depositId > 0 && depositId < nextDepositId, "Deposit does not exist");
        _;
    }

    /**
     * @dev Modifier check owner của deposit
     */
    modifier onlyDepositOwner(uint256 depositId) {
        require(deposits[depositId].owner == msg.sender, "Not deposit owner");
        _;
    }

    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @dev Admin tạo plan tiết kiệm mới
     * @param tenorDays Kỳ hạn (số ngày)
     * @param aprBps Lãi suất năm (basis points: 800 = 8%)
     * @param minDeposit Số tiền gửi tối thiểu
     * @param maxDeposit Số tiền gửi tối đa (0 = không giới hạn)
     * @param earlyWithdrawPenaltyBps Phạt rút sớm (basis points)
     * @return planId ID của plan mới được tạo
     */
    function createPlan(
        uint32 tenorDays,
        uint16 aprBps,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint16 earlyWithdrawPenaltyBps
    ) external onlyRole(ADMIN_ROLE) returns (uint256) {
        // Validation
        require(tenorDays > 0, "Tenor must be greater than 0");
        require(aprBps > 0 && aprBps <= BPS_DENOMINATOR, "Invalid APR");
        require(minDeposit > 0, "Min deposit must be greater than 0");
        require(earlyWithdrawPenaltyBps <= BPS_DENOMINATOR, "Invalid penalty");
        
        // Check maxDeposit nếu được set
        if (maxDeposit > 0) {
            require(maxDeposit >= minDeposit, "Max deposit must be >= min deposit");
        }
        
        // Tạo plan mới
        uint256 planId = nextPlanId;
        nextPlanId++;
        
        plans[planId] = SavingPlan({
            planId: planId,
            tenorDays: tenorDays,
            aprBps: aprBps,
            minDeposit: minDeposit,
            maxDeposit: maxDeposit,
            earlyWithdrawPenaltyBps: earlyWithdrawPenaltyBps,
            enabled: true
        });
        
        emit PlanCreated(planId, tenorDays, aprBps, minDeposit, maxDeposit);
        
        return planId;
    }

    /**
     * @dev Admin cập nhật plan hiện có
     * @param planId ID của plan cần cập nhật
     * @param aprBps Lãi suất năm mới
     * @param minDeposit Số tiền gửi tối thiểu mới
     * @param maxDeposit Số tiền gửi tối đa mới
     * @param earlyWithdrawPenaltyBps Phạt rút sớm mới
     */
    function updatePlan(
        uint256 planId,
        uint16 aprBps,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint16 earlyWithdrawPenaltyBps
    ) external onlyRole(ADMIN_ROLE) {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        
        // Validation
        require(aprBps > 0 && aprBps <= BPS_DENOMINATOR, "Invalid APR");
        require(minDeposit > 0, "Min deposit must be greater than 0");
        require(earlyWithdrawPenaltyBps <= BPS_DENOMINATOR, "Invalid penalty");
        
        if (maxDeposit > 0) {
            require(maxDeposit >= minDeposit, "Max deposit must be >= min deposit");
        }
        
        SavingPlan storage plan = plans[planId];
        plan.aprBps = aprBps;
        plan.minDeposit = minDeposit;
        plan.maxDeposit = maxDeposit;
        plan.earlyWithdrawPenaltyBps = earlyWithdrawPenaltyBps;
        
        emit PlanUpdated(planId, plan.enabled);
    }

    /**
     * @dev Admin bật/tắt plan
     * @param planId ID của plan
     * @param enabled true = bật, false = tắt
     */
    function enablePlan(uint256 planId, bool enabled) external onlyRole(ADMIN_ROLE) {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        
        plans[planId].enabled = enabled;
        
        emit PlanUpdated(planId, enabled);
    }

    /**
     * @dev Admin tạm dừng contract (emergency)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Admin kích hoạt lại contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ==================== VAULT MANAGEMENT ====================
    // Note: Vault management functions removed - use VaultManager contract directly

    /**
     * @dev Admin cập nhật địa chỉ nhận phí phạt
     * @param newFeeReceiver Địa chỉ mới
     */
    function setFeeReceiver(address newFeeReceiver) external onlyRole(ADMIN_ROLE) {
        require(newFeeReceiver != address(0), "Invalid fee receiver address");
        feeReceiver = newFeeReceiver;
    }

    // ==================== USER FUNCTIONS ====================

    /**
     * @dev User mở sổ tiết kiệm mới
     * @param planId ID của plan muốn tham gia
     * @param amount Số tiền gửi (USDC with 6 decimals)
     * @param enableAutoRenew Có tự động gia hạn khi đáo hạn không
     * @return depositId ID của sổ tiết kiệm mới
     * 
     * @notice Flow (Method 2 - Separated Architecture):
     * 1. Validate plan exists và enabled
     * 2. Check amount nằm trong [minDeposit, maxDeposit]
     * 3. Transfer USDC từ user TRỰC TIẾP vào SavingsBank (giữ principal)
     * 4. Tính interest cần trả khi đáo hạn
     * 5. Reserve ONLY interest amount trong VaultManager (không reserve principal)
     * 6. Tạo DepositCertificate mới
     * 7. Lock lãi suất hiện tại (cho auto renew)
     * 8. Lưu vào userDeposits mapping
     * 9. Emit DepositOpened event
     * 
     * Requirements:
     * - Contract không bị pause
     * - Plan phải enabled
     * - Amount phải >= minDeposit
     * - Amount phải <= maxDeposit (nếu có giới hạn)
     * - User phải approve USDC trước
     * - VaultManager phải có đủ liquidity để reserve interest
     * 
     * @notice Method 2 Architecture:
     * - SavingsBank giữ principal (user deposits)
     * - VaultManager chỉ giữ liquidity pool để trả lãi
     * - Khi withdraw: principal từ SavingsBank, interest từ VaultManager
     * 
     * @notice Auto Renew:
     * - Nếu enableAutoRenew = true: tự động gia hạn khi đến maturity
     * - Lãi suất locked = lãi suất plan tại thời điểm open
     * - Dù admin có thay đổi lãi suất plan sau này, auto renew vẫn dùng rate cũ
     */
    function openDeposit(
        uint256 planId,
        uint256 amount,
        bool enableAutoRenew
    ) 
        external 
        whenNotPaused 
        nonReentrant 
        planExists(planId) 
        returns (uint256) 
    {
        SavingPlan memory plan = plans[planId];
        
        // Validate amount
        require(amount >= plan.minDeposit, "Amount below minimum deposit");
        if (plan.maxDeposit > 0) {
            require(amount <= plan.maxDeposit, "Amount exceeds maximum deposit");
        }
        
        // METHOD 2: Transfer principal DIRECTLY to SavingsBank (not VaultManager)
        // User phải approve trước khi gọi function này
        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Tạo deposit certificate mới
        uint256 depositId = nextDepositId;
        nextDepositId++;
        
        // Tính maturity time
        uint256 maturityAt = block.timestamp + (uint256(plan.tenorDays) * 1 days);
        
        // METHOD 2: Calculate interest cần reserve trong VaultManager
        uint256 expectedInterest = InterestCalculator.calculateTotalInterestForReserve(
            amount,
            plan.aprBps,
            plan.tenorDays
        );
        
        // METHOD 2: Reserve ONLY interest trong VaultManager (không reserve principal)
        vaultManager.reserveFunds(expectedInterest);
        
        // Lưu deposit certificate
        deposits[depositId] = DepositCertificate({
            depositId: depositId,
            owner: msg.sender,
            planId: planId,
            principal: amount,
            startAt: block.timestamp,
            maturityAt: maturityAt,
            status: DepositStatus.ACTIVE,
            lockedAprBps: plan.aprBps,        // Lock lãi suất hiện tại
            isAutoRenewEnabled: enableAutoRenew
        });
        
        // Mint NFT cho user (depositId là tokenId)
        _mint(msg.sender, depositId);
        
        // Thêm vào danh sách deposits của user
        userDeposits[msg.sender].push(depositId);
        
        emit DepositOpened(depositId, msg.sender, planId, amount, maturityAt);
        
        return depositId;
    }

    /**
     * @dev Tính lãi cho deposit certificate
     * @param depositId ID của sổ tiết kiệm
     * @return interest Số tiền lãi user sẽ nhận được
     * 
     * @notice Tính lãi theo simple interest formula:
     * interest = principal × aprBps × duration / (365 days × 10000)
     * 
     * @notice Hàm này tính lãi tại thời điểm hiện tại:
     * - Nếu chưa đáo hạn: tính lãi từ startAt → now
     * - Nếu đã đáo hạn: tính lãi từ startAt → maturityAt (full term)
     * - Sử dụng lockedAprBps (lãi suất đã locked khi mở deposit)
     * 
     * @notice Lãi suất locked:
     * - Khi user mở deposit, lãi suất hiện tại của plan được lock vào lockedAprBps
     * - Dù admin có thay đổi lãi suất plan sau này, deposit vẫn dùng lockedAprBps
     * - Điều này bảo vệ user khỏi việc lãi suất giảm sau khi đã gửi tiền
     * 
     * Example:
     * - Principal: 10,000 USDC (10,000 * 10^6)
     * - Locked APR: 8% = 800 basis points
     * - Tenor: 90 days
     * - Interest ≈ 197.26 USDC
     */
    function calculateInterest(
        uint256 depositId
    ) 
        public 
        view 
        depositExists(depositId) 
        returns (uint256) 
    {
        DepositCertificate memory cert = deposits[depositId];
        
        // Chỉ tính lãi cho deposit đang ACTIVE
        require(cert.status == DepositStatus.ACTIVE, "Deposit not active");
        
        // Tính thời gian: từ startAt đến min(now, maturityAt)
        uint256 endTime = block.timestamp < cert.maturityAt 
            ? block.timestamp 
            : cert.maturityAt;
        
        uint256 durationSeconds = endTime - cert.startAt;
        
        // Nếu không có thời gian trôi qua, trả về 0
        if (durationSeconds == 0) {
            return 0;
        }
        
        // Sử dụng InterestCalculator library để tính lãi
        // Dùng lockedAprBps thay vì plan.aprBps để bảo đảm lãi suất đã locked
        uint256 interest = InterestCalculator.calculateSimpleInterest(
            cert.principal,
            cert.lockedAprBps,
            durationSeconds
        );
        
        return interest;
    }

    /**
     * @dev User rút tiền khi đáo hạn
     * @param depositId ID của sổ tiết kiệm
     * 
     * @notice Flow (Method 2 - Separated Architecture):
     * 1. Validate deposit exists và đang ACTIVE
     * 2. Check msg.sender là owner
     * 3. Check đã đến maturityAt
     * 4. Tính lãi (simple interest)
     * 5. Release reserved interest từ VaultManager
     * 6. Transfer principal từ SavingsBank balance
     * 7. Transfer interest từ VaultManager
     * 8. Update deposit status = WITHDRAWN
     * 9. Emit Withdrawn event
     * 
     * Requirements:
     * - Contract không bị pause
     * - Deposit đang ACTIVE
     * - Msg.sender là owner
     * - block.timestamp >= maturityAt
     * - SavingsBank đủ principal để trả
     * - VaultManager đủ interest để trả
     * 
     * @notice Method 2 Architecture:
     * - Principal được trả từ SavingsBank's balance (USDC held in contract)
     * - Interest được trả từ VaultManager's liquidity pool
     * - Clear separation: user funds vs protocol interest pool
     * 
     * @notice User nhận: principal + full interest
     */
    function withdraw(
        uint256 depositId
    ) 
        external 
        whenNotPaused 
        nonReentrant 
        depositExists(depositId)
        onlyDepositOwner(depositId)
    {
        DepositCertificate storage cert = deposits[depositId];
        
        // Validate deposit status
        require(cert.status == DepositStatus.ACTIVE, "Deposit not active");
        
        // Check đã đến maturity
        require(block.timestamp >= cert.maturityAt, "Not yet matured");
        
        // Tính lãi đầy đủ (từ startAt → maturityAt)
        uint256 durationSeconds = cert.maturityAt - cert.startAt;
        
        uint256 interest = InterestCalculator.calculateSimpleInterest(
            cert.principal,
            cert.lockedAprBps,  // Dùng locked rate
            durationSeconds
        );
        
        // Update deposit status
        cert.status = DepositStatus.WITHDRAWN;
        
        // METHOD 2: Release reserved interest từ VaultManager
        vaultManager.releaseFunds(interest);
        
        // METHOD 2: Transfer principal từ SavingsBank balance
        depositToken.safeTransfer(msg.sender, cert.principal);
        
        // METHOD 2: Transfer interest từ VaultManager
        vaultManager.transferOut(msg.sender, interest);
        
        emit Withdrawn(depositId, msg.sender, cert.principal, interest, false);
    }

    /**
     * @dev User rút tiền trước hạn (early withdrawal) với phạt
     * @param depositId ID của sổ tiết kiệm
     * 
     * @notice Flow (Method 2 - Separated Architecture):
     * 1. Validate deposit chưa matured (nếu đã matured thì dùng withdraw())
     * 2. Calculate penalty (phần trăm của principal)
     * 3. Release ALL reserved interest từ VaultManager (user gets NO interest)
     * 4. Transfer (principal - penalty) từ SavingsBank
     * 5. Transfer penalty to feeReceiver từ SavingsBank
     * 6. Update status = WITHDRAWN
     * 7. Emit Withdrawn event với interest = 0 và isEarly = true
     * 
     * Requirements:
     * - Contract không bị pause
     * - Deposit phải ACTIVE
     * - Chỉ owner mới rút được
     * - Phải chưa đáo hạn (nếu đã đáo hạn dùng withdraw())
     * - SavingsBank đủ principal
     * 
     * @notice Method 2 Architecture:
     * - Principal và penalty xử lý trong SavingsBank
     * - NO interest paid for early withdrawal (phạt = mất lãi)
     * - All reserved interest released back to VaultManager
     * 
     * @notice Business Rule: KHÔNG TRẢ LÃI KHI RÚT SỚM
     * - User KHÔNG nhận bất kỳ lãi nào (kể cả pro-rata)
     * - Đây là một hình thức phạt (ngoài penalty fee)
     * - Khuyến khích user giữ đến đáo hạn
     * 
     * Example:
     * - Principal: 10,000 USDC
     * - Plan: 30 days, 8% APR, 5% penalty
     * - Withdraw after 15 days:
     *   + Penalty: 10,000 * 0.05 = 500 USDC
     *   + Interest: 0 USDC (NO INTEREST for early withdraw)
     *   + User receives: 10,000 - 500 = 9,500 USDC (principal - penalty only)
     *   + Fee receiver gets: 500 USDC (from SavingsBank)
     */
    function earlyWithdraw(uint256 depositId)
        external
        whenNotPaused
        nonReentrant
        depositExists(depositId)
        onlyDepositOwner(depositId)
    {
        DepositCertificate storage cert = deposits[depositId];
        
        // Validate deposit is active
        require(cert.status == DepositStatus.ACTIVE, "Deposit not active");
        
        // Validate chưa đáo hạn (nếu đã đáo hạn thì dùng withdraw() thông thường)
        require(block.timestamp < cert.maturityAt, "Already matured, use withdraw()");
        
        SavingPlan memory plan = plans[cert.planId];
        
        // Calculate full interest (đã reserve lúc open)
        uint256 fullDurationSeconds = cert.maturityAt - cert.startAt;
        uint256 fullInterest = InterestCalculator.calculateSimpleInterest(
            cert.principal,
            cert.lockedAprBps,
            fullDurationSeconds
        );
        
        // Early withdraw: NO INTEREST paid (user only gets principal - penalty)
        // Pro-rata interest calculation removed as per business requirements
        
        // Calculate penalty from principal
        uint256 penalty = (cert.principal * plan.earlyWithdrawPenaltyBps) / BPS_DENOMINATOR;
        
        // Update deposit status
        cert.status = DepositStatus.WITHDRAWN;
        
        // METHOD 2: Release ALL reserved interest (user gets NO interest for early withdraw)
        if (fullInterest > 0) {
            vaultManager.releaseFunds(fullInterest);
        }
        
        // METHOD 2: Handle principal and penalty from SavingsBank
        // Calculate amounts from principal
        uint256 principalAfterPenalty;
        uint256 actualPenalty;
        
        if (penalty >= cert.principal) {
            // Edge case: penalty >= principal
            principalAfterPenalty = 0;
            actualPenalty = cert.principal;
        } else {
            // Normal case
            principalAfterPenalty = cert.principal - penalty;
            actualPenalty = penalty;
        }
        
        // METHOD 2: Transfer penalty to feeReceiver từ SavingsBank (nếu có)
        if (actualPenalty > 0) {
            depositToken.safeTransfer(feeReceiver, actualPenalty);
        }
        
        // METHOD 2: Transfer principal (after penalty) to user từ SavingsBank (nếu có)
        if (principalAfterPenalty > 0) {
            depositToken.safeTransfer(msg.sender, principalAfterPenalty);
        }
        
        // METHOD 2: NO interest paid for early withdrawal
        // User only receives principal minus penalty
        
        emit Withdrawn(depositId, msg.sender, cert.principal, 0, true);
    }

    /**
     * @dev User gia hạn sổ tiết kiệm đã đáo hạn
     * @param depositId ID của sổ tiết kiệm cũ
     * @param useCurrentRate True = dùng lãi suất hiện tại của plan, False = giữ lãi suất cũ (locked)
     * @return newDepositId ID của sổ tiết kiệm mới sau khi gia hạn
     * 
     * @notice Flow (Method 2 - Separated Architecture):
     * 1. Validate deposit đã đáo hạn (matured)
     * 2. Calculate interest từ deposit cũ
     * 3. Release old reserved interest từ VaultManager
     * 4. Transfer interest từ VaultManager vào SavingsBank
     * 5. New principal = old principal + interest (cả 2 đều ở SavingsBank)
     * 6. Reserve new interest amount trong VaultManager
     * 7. Chọn lãi suất:
     *    - useCurrentRate = false (AUTO): giữ nguyên lockedAprBps cũ
     *    - useCurrentRate = true (MANUAL): dùng lãi suất hiện tại của plan
     * 8. Giữ nguyên isAutoRenewEnabled từ deposit cũ
     * 9. Mark deposit cũ = AUTORENEWED hoặc MANUALRENEWED
     * 10. Emit Renewed event
     * 
     * Requirements:
     * - Contract không bị pause
     * - Deposit phải ACTIVE
     * - Chỉ owner mới renew được
     * - Phải đã đáo hạn (matured)
     * - Plan phải còn enabled
     * - VaultManager phải đủ tiền để cover interest cũ và reserve interest mới
     * 
     * @notice Method 2 Architecture:
     * - Interest từ deposit cũ được transfer từ VaultManager vào SavingsBank
     * - Principal mới = old principal (trong SavingsBank) + interest (từ VaultManager)
     * - Reserve interest mới cho kỳ hạn tiếp theo trong VaultManager
     * 
     * @notice Auto Renew Logic:
     * - Nếu user mở deposit với auto renew enabled
     * - Khi đáo hạn, user gọi renew(depositId, false) để auto renew
     * - Lãi suất sẽ giữ nguyên như lúc đầu (locked rate)
     * - Dù admin có giảm lãi suất plan, user vẫn hưởng lãi suất cũ
     * 
     * @notice Manual Renew Logic:
     * - User gọi renew(depositId, true) để manual renew
     * - Lãi suất = lãi suất hiện tại của plan
     * - Nếu admin tăng lãi suất, user được hưởng lãi cao hơn
     * - Nếu admin giảm lãi suất, user chịu lãi thấp hơn
     * 
     * Example 1 - Auto Renew:
     * - Old deposit: 10,000 USDC (SavingsBank), 30 days, 8% APR locked
     * - Interest earned: 65.75 USDC (from VaultManager → SavingsBank)
     * - New principal: 10,065.75 USDC (all in SavingsBank)
     * - New deposit: 10,065.75 USDC, 30 days, 8% APR locked (giữ nguyên)
     * - New reserved: 66.18 USDC (in VaultManager)
     * 
     * Example 2 - Manual Renew (plan rate giảm xuống 6%):
     * - Old deposit: 10,000 USDC (SavingsBank), 30 days, 8% APR locked
     * - Interest earned: 65.75 USDC (from VaultManager → SavingsBank)
     * - New principal: 10,065.75 USDC (all in SavingsBank)
     * - New deposit: 10,065.75 USDC, 30 days, 6% APR (dùng rate mới)
     * - New reserved: 49.64 USDC (in VaultManager)
     */
    function renew(uint256 depositId, bool useCurrentRate)
        external
        whenNotPaused
        nonReentrant
        depositExists(depositId)
        onlyDepositOwner(depositId)
        returns (uint256)
    {
        DepositCertificate storage oldCert = deposits[depositId];
        
        // Validate deposit is active
        require(oldCert.status == DepositStatus.ACTIVE, "Deposit not active");
        
        // Validate đã đáo hạn (nếu chưa đáo hạn thì chưa được renew)
        require(block.timestamp >= oldCert.maturityAt, "Not yet matured");
        
        SavingPlan memory plan = plans[oldCert.planId];
        require(plan.enabled, "Plan is disabled");
        
        // Calculate interest from old deposit
        uint256 interest = calculateInterest(depositId);
        
        // METHOD 2: Release old reserved interest từ VaultManager
        vaultManager.releaseFunds(interest);
        
        // METHOD 2: Transfer interest từ VaultManager vào SavingsBank
        // (Interest được cộng vào principal trong SavingsBank)
        vaultManager.transferOut(address(this), interest);
        
        // New principal = old principal + interest (cả 2 đều ở SavingsBank)
        uint256 newPrincipal = oldCert.principal + interest;
        
        // Validate new principal nằm trong range của plan
        require(newPrincipal >= plan.minDeposit, "New principal below minimum");
        if (plan.maxDeposit > 0) {
            require(newPrincipal <= plan.maxDeposit, "New principal exceeds maximum");
        }
        
        // Determine APR for new deposit
        uint16 newAprBps;
        DepositStatus newStatus;
        
        if (useCurrentRate) {
            // Manual renew: dùng lãi suất hiện tại của plan
            newAprBps = plan.aprBps;
            newStatus = DepositStatus.MANUALRENEWED;
        } else {
            // Auto renew: giữ nguyên lãi suất cũ (locked)
            newAprBps = oldCert.lockedAprBps;
            newStatus = DepositStatus.AUTORENEWED;
        }
        
        // METHOD 2: Reserve new interest amount trong VaultManager
        uint256 newExpectedInterest = InterestCalculator.calculateTotalInterestForReserve(
            newPrincipal,
            newAprBps,
            plan.tenorDays
        );
        vaultManager.reserveFunds(newExpectedInterest);
        
        // Mark old deposit as renewed
        oldCert.status = newStatus;
        
        // Create new deposit
        uint256 newDepositId = nextDepositId;
        nextDepositId++;
        
        uint256 newMaturityAt = block.timestamp + (uint256(plan.tenorDays) * 1 days);
        
        deposits[newDepositId] = DepositCertificate({
            depositId: newDepositId,
            owner: msg.sender,
            planId: oldCert.planId,
            principal: newPrincipal,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            status: DepositStatus.ACTIVE,
            lockedAprBps: newAprBps,
            isAutoRenewEnabled: oldCert.isAutoRenewEnabled  // Giữ nguyên setting
        });
        
        // Mint NFT cho new deposit
        _mint(msg.sender, newDepositId);
        
        // Add to userDeposits
        userDeposits[msg.sender].push(newDepositId);
        
        // Emit events
        emit Renewed(depositId, newDepositId, newPrincipal, !useCurrentRate, newAprBps);
        emit DepositOpened(newDepositId, msg.sender, oldCert.planId, newPrincipal, newMaturityAt);
        
        return newDepositId;
    }

    // View Functions
    
    /**
     * @dev Lấy thông tin plan
     */
    function getPlan(uint256 planId) external view returns (SavingPlan memory) {
        return plans[planId];
    }

    /**
     * @dev Lấy tất cả plans
     * @return allPlans Mảng chứa tất cả saving plans
     * 
     * @notice Function này trả về tất cả plans (cả enabled và disabled)
     * @notice Frontend có thể filter chỉ enabled plans nếu cần
     */
    function getAllPlans() external view returns (SavingPlan[] memory) {
        uint256 planCount = nextPlanId - 1; // nextPlanId starts from 1
        SavingPlan[] memory allPlans = new SavingPlan[](planCount);
        
        for (uint256 i = 1; i <= planCount; i++) {
            allPlans[i - 1] = plans[i];
        }
        
        return allPlans;
    }

    /**
     * @dev User bật/tắt auto renew cho deposit của mình
     * @param depositId ID của sổ tiết kiệm
     * @param enable True = bật auto renew, False = tắt
     * 
     * @notice Chỉ owner của deposit mới có thể thay đổi auto renew
     * @notice Deposit phải đang ACTIVE (chưa withdraw/renew)
     */
    function setAutoRenew(uint256 depositId, bool enable) 
        external 
        depositExists(depositId) 
        onlyDepositOwner(depositId) 
    {
        DepositCertificate storage cert = deposits[depositId];
        require(cert.status == DepositStatus.ACTIVE, "Deposit not active");
        
        cert.isAutoRenewEnabled = enable;
        
        emit AutoRenewUpdated(depositId, enable);
    }

    /**
     * @dev Lấy thông tin deposit
     */
    function getDeposit(uint256 depositId) external view returns (DepositCertificate memory) {
        return deposits[depositId];
    }

    /**
     * @dev Lấy danh sách depositId của user
     */
    function getUserDeposits(address user) external view returns (uint256[] memory) {
        return userDeposits[user];
    }

    /**
     * @dev Lấy thông tin liquidity pool từ VaultManager
     * @return totalBalance Tổng số dư VaultManager (interest pool)
     * @return reservedFunds Số tiền đã reserve cho deposits
     * @return availableFunds Số tiền available để reserve thêm
     * 
     * @notice Method 2: VaultManager chỉ quản lý interest pool, không phải principal
     */
    function getVaultInfo() external view returns (
        uint256 totalBalance,
        uint256 reservedFunds,
        uint256 availableFunds
    ) {
        totalBalance = vaultManager.totalBalance();
        reservedFunds = vaultManager.reservedFunds();
        availableFunds = vaultManager.getAvailableFunds();
        
        return (totalBalance, reservedFunds, availableFunds);
    }

    /**
     * @dev Lấy tổng principal đang được giữ trong SavingsBank
     * @return balance Tổng USDC balance của SavingsBank contract
     * 
     * @notice Method 2: Đây là tổng principal của tất cả user deposits
     */
    function getTotalPrincipalHeld() external view returns (uint256) {
        return depositToken.balanceOf(address(this));
    }

    /**
     * @dev Lấy thông tin tổng quan về contract
     * @return principalHeld Tổng principal trong SavingsBank
     * @return vaultTotal Tổng interest pool trong VaultManager
     * @return vaultReserved Interest đã reserve
     * @return vaultAvailable Interest available
     * @return totalDeposits Tổng số deposits đã mở
     * 
     * @notice Method 2 Summary:
     * - principalHeld: User funds (in SavingsBank)
     * - vaultTotal: Protocol interest pool (in VaultManager)
     */
    function getContractSummary() external view returns (
        uint256 principalHeld,
        uint256 vaultTotal,
        uint256 vaultReserved,
        uint256 vaultAvailable,
        uint256 totalDeposits
    ) {
        principalHeld = depositToken.balanceOf(address(this));
        vaultTotal = vaultManager.totalBalance();
        vaultReserved = vaultManager.reservedFunds();
        vaultAvailable = vaultManager.getAvailableFunds();
        totalDeposits = nextDepositId - 1;
        
        return (principalHeld, vaultTotal, vaultReserved, vaultAvailable, totalDeposits);
    }
}
