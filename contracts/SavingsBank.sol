// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./libraries/InterestCalculator.sol";

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
 */
contract SavingsBank is ERC721Enumerable, ReentrancyGuard, Pausable, AccessControl {
    
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
    
    /// @dev Vault chứa tiền để trả lãi cho user
    uint256 public liquidityVault;
    
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
     * @param _feeReceiver Địa chỉ nhận phí phạt
     * @param _admin Địa chỉ admin đầu tiên
     * 
     * @notice Constructor này setup:
     * - ERC721 với name "Savings Deposit Certificate" và symbol "SDC"
     * - Token USDC để gửi tiết kiệm
     * - Địa chỉ nhận phí phạt
     * - Admin role cho người quản lý
     * - ID bắt đầu từ 1 (dễ debug hơn 0)
     */
    constructor(
        address _depositToken,
        address _feeReceiver,
        address _admin
    ) ERC721("Savings Deposit Certificate", "SDC") {
        // Validate inputs
        require(_depositToken != address(0), "Invalid deposit token");
        require(_feeReceiver != address(0), "Invalid fee receiver");
        require(_admin != address(0), "Invalid admin");

        // Khởi tạo token và địa chỉ
        depositToken = IERC20(_depositToken);
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

    /**
     * @dev Admin nạp tiền vào vault để trả lãi
     * @param amount Số lượng token nạp vào
     */
    function fundVault(uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer token từ admin vào contract
        require(
            depositToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        liquidityVault += amount;
        
        emit VaultFunded(msg.sender, amount);
    }

    /**
     * @dev Admin rút tiền từ vault
     * @param amount Số lượng token rút ra
     */
    function withdrawVault(uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= liquidityVault, "Insufficient vault balance");
        
        liquidityVault -= amount;
        
        // Transfer token từ contract ra admin
        require(
            depositToken.transfer(msg.sender, amount),
            "Transfer failed"
        );
        
        emit VaultWithdrawn(msg.sender, amount);
    }

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
     * @notice Flow:
     * 1. Validate plan exists và enabled
     * 2. Check amount nằm trong [minDeposit, maxDeposit]
     * 3. Transfer USDC từ user vào contract
     * 4. Tạo DepositCertificate mới
     * 5. Lock lãi suất hiện tại (cho auto renew)
     * 6. Lưu vào userDeposits mapping
     * 7. Emit DepositOpened event
     * 
     * Requirements:
     * - Contract không bị pause
     * - Plan phải enabled
     * - Amount phải >= minDeposit
     * - Amount phải <= maxDeposit (nếu có giới hạn)
     * - User phải approve USDC trước
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
        
        // Transfer USDC từ user vào contract
        // User phải approve trước khi gọi function này
        require(
            depositToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        // Tạo deposit certificate mới
        uint256 depositId = nextDepositId;
        nextDepositId++;
        
        // Tính maturity time
        uint256 maturityAt = block.timestamp + (uint256(plan.tenorDays) * 1 days);
        
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
     * @notice Flow:
     * 1. Validate deposit exists và đang ACTIVE
     * 2. Check msg.sender là owner
     * 3. Check đã đến maturityAt
     * 4. Tính lãi (simple interest)
     * 5. Check vault đủ tiền trả lãi
     * 6. Transfer principal + interest cho user
     * 7. Update deposit status = WITHDRAWN
     * 8. Emit Withdrawn event
     * 
     * Requirements:
     * - Contract không bị pause
     * - Deposit đang ACTIVE
     * - Msg.sender là owner
     * - block.timestamp >= maturityAt
     * - Vault đủ liquidity để trả lãi
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
        SavingPlan memory plan = plans[cert.planId];
        uint256 durationSeconds = cert.maturityAt - cert.startAt;
        
        uint256 interest = InterestCalculator.calculateSimpleInterest(
            cert.principal,
            plan.aprBps,
            durationSeconds
        );
        
        // Check vault đủ tiền trả lãi
        require(liquidityVault >= interest, "Insufficient vault liquidity");
        
        // Trừ lãi từ vault
        liquidityVault -= interest;
        
        // Update deposit status
        cert.status = DepositStatus.WITHDRAWN;
        
        // Tính tổng tiền trả cho user
        uint256 totalAmount = cert.principal + interest;
        
        // Transfer principal + interest cho user
        require(
            depositToken.transfer(msg.sender, totalAmount),
            "Transfer failed"
        );
        
        emit Withdrawn(depositId, msg.sender, cert.principal, interest, false);
    }

    /**
     * @dev User rút tiền trước hạn (early withdrawal) với phạt
     * @param depositId ID của sổ tiết kiệm
     * 
     * @notice Flow:
     * 1. Validate deposit chưa matured (nếu đã matured thì dùng withdraw())
     * 2. Calculate pro-rata interest (lãi theo thời gian đã qua)
     * 3. Calculate penalty (phần trăm của principal)
     * 4. Check vault liquidity
     * 5. Transfer (principal + interest - penalty) cho user
     * 6. Transfer penalty cho feeReceiver
     * 7. Update status = WITHDRAWN
     * 8. Emit Withdrawn event với isEarly = true
     * 
     * Requirements:
     * - Contract không bị pause
     * - Deposit phải ACTIVE
     * - Chỉ owner mới rút được
     * - Phải chưa đáo hạn (nếu đã đáo hạn dùng withdraw())
     * - Vault phải đủ liquidity
     * 
     * Example:
     * - Principal: 10,000 USDC
     * - Plan: 30 days, 8% APR, 5% penalty
     * - Withdraw after 15 days:
     *   + Pro-rata interest: 10,000 * 0.08 * (15/365) ≈ 32.88 USDC
     *   + Penalty: 10,000 * 0.05 = 500 USDC
     *   + User receives: 10,000 + 32.88 - 500 = 9,532.88 USDC
     *   + Fee receiver gets: 500 USDC
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
        
        // Calculate pro-rata interest (lãi theo thời gian đã qua)
        uint256 durationSeconds = block.timestamp - cert.startAt;
        uint256 proRataInterest = 0;
        
        if (durationSeconds > 0) {
            proRataInterest = InterestCalculator.calculateSimpleInterest(
                cert.principal,
                cert.lockedAprBps,
                durationSeconds
            );
        }
        
        // Calculate penalty
        uint256 penalty = (cert.principal * plan.earlyWithdrawPenaltyBps) / BPS_DENOMINATOR;
        
        // Check vault có đủ tiền trả lãi
        require(liquidityVault >= proRataInterest, "Insufficient vault liquidity");
        
        // Trừ lãi từ vault
        liquidityVault -= proRataInterest;
        
        // Update deposit status
        cert.status = DepositStatus.WITHDRAWN;
        
        // Calculate amounts
        uint256 totalBeforePenalty = cert.principal + proRataInterest;
        
        // Nếu penalty > total, user nhận 0 và penalty = total
        uint256 userAmount;
        uint256 actualPenalty;
        
        if (penalty >= totalBeforePenalty) {
            // Penalty lớn hơn hoặc bằng total: user nhận 0
            userAmount = 0;
            actualPenalty = totalBeforePenalty;
        } else {
            // Normal case: user nhận (principal + interest - penalty)
            userAmount = totalBeforePenalty - penalty;
            actualPenalty = penalty;
        }
        
        // Transfer penalty to feeReceiver (nếu có)
        if (actualPenalty > 0) {
            require(
                depositToken.transfer(feeReceiver, actualPenalty),
                "Penalty transfer failed"
            );
        }
        
        // Transfer remaining amount to user (nếu có)
        if (userAmount > 0) {
            require(
                depositToken.transfer(msg.sender, userAmount),
                "Transfer failed"
            );
        }
        
        emit Withdrawn(depositId, msg.sender, cert.principal, proRataInterest, true);
    }

    /**
     * @dev User gia hạn sổ tiết kiệm đã đáo hạn
     * @param depositId ID của sổ tiết kiệm cũ
     * @param useCurrentRate True = dùng lãi suất hiện tại của plan, False = giữ lãi suất cũ (locked)
     * @return newDepositId ID của sổ tiết kiệm mới sau khi gia hạn
     * 
     * @notice Flow:
     * 1. Validate deposit đã đáo hạn (matured)
     * 2. Calculate interest từ deposit cũ
     * 3. Tạo deposit mới với principal = principal cũ + interest
     * 4. Chọn lãi suất:
     *    - useCurrentRate = false (AUTO): giữ nguyên lockedAprBps cũ
     *    - useCurrentRate = true (MANUAL): dùng lãi suất hiện tại của plan
     * 5. Giữ nguyên isAutoRenewEnabled từ deposit cũ
     * 6. Mark deposit cũ = AUTORENEWED hoặc MANUALRENEWED
     * 7. Không transfer USDC (principal + interest tự động roll over)
     * 8. Emit Renewed event
     * 
     * Requirements:
     * - Contract không bị pause
     * - Deposit phải ACTIVE
     * - Chỉ owner mới renew được
     * - Phải đã đáo hạn (matured)
     * - Plan phải còn enabled
     * - Vault phải đủ tiền để cover interest
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
     * - Deposit cũ: 10,000 USDC, 30 days, 8% APR locked
     * - Interest earned: 65.75 USDC
     * - New deposit: 10,065.75 USDC, 30 days, 8% APR locked (giữ nguyên)
     * 
     * Example 2 - Manual Renew (plan rate giảm xuống 6%):
     * - Deposit cũ: 10,000 USDC, 30 days, 8% APR locked
     * - Interest earned: 65.75 USDC  
     * - New deposit: 10,065.75 USDC, 30 days, 6% APR (dùng rate mới)
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
        
        // Check vault có đủ tiền để cover interest (interest sẽ được add vào principal mới)
        // Lưu ý: interest không được transfer ra, mà được cộng vào principal
        // Vault vẫn cần "reserve" interest này cho new deposit
        require(liquidityVault >= interest, "Insufficient vault liquidity");
        
        // Trừ interest từ vault (vì đã earned)
        liquidityVault -= interest;
        
        // New principal = old principal + interest
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
     * @dev Lấy số dư vault hiện tại
     */
    function getVaultBalance() external view returns (uint256) {
        return liquidityVault;
    }
}
