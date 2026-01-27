// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

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
 */
contract SavingsBank is ReentrancyGuard, Pausable, AccessControl {
    
    // ROLES
    /// @dev Role cho admin (quản lý toàn bộ hệ thống)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ==================== ENUMS ====================
    /// @dev Trạng thái của sổ tiết kiệm
    enum DepositStatus {
        ACTIVE,      // Đang tiết kiệm
        WITHDRAWN,   // Đã rút tiền
        RENEWED      // Đã gia hạn
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
        uint256 newPrincipal
    );
    
    /// @dev Event khi admin nạp tiền vào vault
    event VaultFunded(address indexed from, uint256 amount);
    
    /// @dev Event khi admin rút tiền từ vault
    event VaultWithdrawn(address indexed to, uint256 amount);

    // Constructor
    
    /**
     * @dev Khởi tạo SavingsBank
     * @param _depositToken Địa chỉ token USDC
     * @param _feeReceiver Địa chỉ nhận phí phạt
     * @param _admin Địa chỉ admin đầu tiên
     * 
     * @notice Constructor này setup:
     * - Token USDC để gửi tiết kiệm
     * - Địa chỉ nhận phí phạt
     * - Admin role cho người quản lý
     * - ID bắt đầu từ 1 (dễ debug hơn 0)
     */
    constructor(
        address _depositToken,
        address _feeReceiver,
        address _admin
    ) {
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

    // ==================== USER FUNCTIONS (Placeholder) ====================
    // Sẽ implement ở phần TỐI

    
    /**
     * @dev [TO BE IMPLEMENTED] User mở sổ tiết kiệm
     * Sẽ implement ở phần TỐI
     */
    function openDeposit(
        uint256 planId,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (uint256) {
        // TODO: Implement ở phần tối
        revert("Not implemented yet");
    }

    /**
     * @dev [TO BE IMPLEMENTED] Tính lãi
     * Sẽ implement ở phần TỐI
     */
    function calculateInterest(
        uint256 depositId
    ) public view returns (uint256) {
        // TODO: Implement ở phần tối
        revert("Not implemented yet");
    }

    /**
     * @dev [TO BE IMPLEMENTED] Rút tiền đúng hạn
     * Sẽ implement ở phần TỐI
     */
    function withdraw(
        uint256 depositId
    ) external whenNotPaused nonReentrant {
        // TODO: Implement ở phần tối
        revert("Not implemented yet");
    }

    // View Functions
    
    /**
     * @dev Lấy thông tin plan
     */
    function getPlan(uint256 planId) external view returns (SavingPlan memory) {
        return plans[planId];
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
