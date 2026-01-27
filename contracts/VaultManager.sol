// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VaultManager
 * @dev Quản lý vault liquidity cho SavingsBank - tách biệt logic quản lý vốn
 * @notice Contract này chỉ xử lý việc quản lý vault, không xử lý user deposits
 * 
 * Tính năng chính:
 * - Quản lý vault balance (fund/withdraw)
 * - Theo dõi reserved funds (số tiền cần giữ lại để trả lãi)
 * - Tính toán vault health (đủ tiền trả lãi không)
 * - Chỉ SavingsBank contract mới được gọi các hàm reserve
 * 
 * Lý do tách riêng:
 * - Separation of concerns (SavingsBank = user logic, VaultManager = vault logic)
 * - Dễ upgrade logic vault sau này
 * - Rõ ràng hơn trong việc tracking vault reserves
 */
contract VaultManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== STATE VARIABLES ====================

    /// @dev Token được sử dụng (USDC)
    IERC20 public immutable depositToken;

    /// @dev Tổng số tiền trong vault
    uint256 public totalBalance;

    /// @dev Số tiền đã reserved (cần giữ lại để trả lãi cho deposits hiện có)
    uint256 public reservedFunds;

    /// @dev Địa chỉ nhận phí phạt (khi user rút sớm)
    address public feeReceiver;

    /// @dev SavingsBank contract address (được phép gọi reserve functions)
    address public savingsBank;

    /// @dev Minimum vault health ratio (basis points: 10000 = 100%)
    /// @notice Vault health = availableFunds / reservedFunds
    /// @notice Nếu < minHealthRatio thì cảnh báo cần nạp thêm tiền
    uint16 public minHealthRatioBps;

    // ==================== CONSTANTS ====================

    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ==================== EVENTS ====================

    /// @dev Event khi admin nạp tiền vào vault
    event VaultFunded(address indexed from, uint256 amount, uint256 newTotalBalance);

    /// @dev Event khi admin rút tiền từ vault
    event VaultWithdrawn(address indexed to, uint256 amount, uint256 newTotalBalance);

    /// @dev Event khi reserve funds (SavingsBank gọi khi có deposit mới)
    event FundsReserved(uint256 amount, uint256 newReservedFunds);

    /// @dev Event khi release reserved funds (SavingsBank gọi khi user withdraw)
    event FundsReleased(uint256 amount, uint256 newReservedFunds);

    /// @dev Event khi cập nhật fee receiver
    event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);

    /// @dev Event khi cập nhật SavingsBank address
    event SavingsBankUpdated(address indexed oldBank, address indexed newBank);

    /// @dev Event khi vault health thấp
    event VaultHealthLow(uint256 availableFunds, uint256 reservedFunds, uint256 healthRatioBps);

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Khởi tạo VaultManager
     * @param _depositToken Địa chỉ token USDC
     * @param _feeReceiver Địa chỉ nhận phí phạt
     * @param _minHealthRatioBps Minimum health ratio (e.g., 12000 = 120%)
     */
    constructor(
        address _depositToken,
        address _feeReceiver,
        uint16 _minHealthRatioBps
    ) Ownable(msg.sender) {
        require(_depositToken != address(0), "Invalid deposit token");
        require(_feeReceiver != address(0), "Invalid fee receiver");
        require(_minHealthRatioBps >= BPS_DENOMINATOR, "Health ratio must be >= 100%");

        depositToken = IERC20(_depositToken);
        feeReceiver = _feeReceiver;
        minHealthRatioBps = _minHealthRatioBps;
    }

    // ==================== MODIFIERS ====================

    /**
     * @dev Chỉ SavingsBank contract mới được gọi
     */
    modifier onlySavingsBank() {
        require(msg.sender == savingsBank, "Only SavingsBank can call");
        _;
    }

    // ==================== OWNER FUNCTIONS ====================

    /**
     * @dev Owner set địa chỉ SavingsBank contract (chỉ set 1 lần)
     * @param _savingsBank Địa chỉ SavingsBank contract
     */
    function setSavingsBank(address _savingsBank) external onlyOwner {
        require(_savingsBank != address(0), "Invalid SavingsBank address");
        require(savingsBank == address(0), "SavingsBank already set");
        
        address oldBank = savingsBank;
        savingsBank = _savingsBank;
        
        emit SavingsBankUpdated(oldBank, _savingsBank);
    }

    /**
     * @dev Owner nạp tiền vào vault
     * @param amount Số lượng token nạp vào
     */
    function fundVault(uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");

        // Transfer token từ owner vào contract
        depositToken.safeTransferFrom(msg.sender, address(this), amount);

        totalBalance += amount;

        emit VaultFunded(msg.sender, amount, totalBalance);
    }

    /**
     * @dev Owner rút tiền từ vault
     * @param amount Số lượng token rút ra
     * @notice Chỉ được rút phần available (không được rút reserved funds)
     */
    function withdrawVault(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 available = getAvailableFunds();
        require(amount <= available, "Insufficient available funds");

        totalBalance -= amount;

        // Transfer token từ contract ra owner
        depositToken.safeTransfer(msg.sender, amount);

        emit VaultWithdrawn(msg.sender, amount, totalBalance);

        // Check vault health sau khi withdraw
        _checkVaultHealth();
    }

    /**
     * @dev Owner cập nhật địa chỉ nhận phí phạt
     * @param newFeeReceiver Địa chỉ mới
     */
    function setFeeReceiver(address newFeeReceiver) external onlyOwner {
        require(newFeeReceiver != address(0), "Invalid fee receiver");
        
        address oldReceiver = feeReceiver;
        feeReceiver = newFeeReceiver;
        
        emit FeeReceiverUpdated(oldReceiver, newFeeReceiver);
    }

    /**
     * @dev Owner cập nhật minimum health ratio
     * @param newRatioBps Ratio mới (basis points)
     */
    function setMinHealthRatio(uint16 newRatioBps) external onlyOwner {
        require(newRatioBps >= BPS_DENOMINATOR, "Health ratio must be >= 100%");
        minHealthRatioBps = newRatioBps;
    }

    /**
     * @dev Owner pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Owner unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== SAVINGS BANK FUNCTIONS ====================

    /**
     * @dev SavingsBank gọi để reserve funds khi user mở deposit
     * @param amount Số tiền cần reserve (principal + estimated interest)
     * @notice Chỉ SavingsBank contract mới được gọi
     */
    function reserveFunds(uint256 amount) external onlySavingsBank whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= getAvailableFunds(), "Insufficient available funds");

        reservedFunds += amount;

        emit FundsReserved(amount, reservedFunds);

        // Check vault health sau khi reserve
        _checkVaultHealth();
    }

    /**
     * @dev SavingsBank gọi để release reserved funds khi user withdraw
     * @param amount Số tiền release
     * @notice Chỉ SavingsBank contract mới được gọi
     */
    function releaseFunds(uint256 amount) external onlySavingsBank {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= reservedFunds, "Amount exceeds reserved funds");

        reservedFunds -= amount;

        emit FundsReleased(amount, reservedFunds);
    }

    /**
     * @dev SavingsBank gọi để transfer token ra ngoài (khi user withdraw)
     * @param to Địa chỉ nhận
     * @param amount Số lượng token
     */
    function transferOut(address to, uint256 amount) external onlySavingsBank nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= totalBalance, "Insufficient balance");

        totalBalance -= amount;

        depositToken.safeTransfer(to, amount);
    }

    /**
     * @dev SavingsBank gọi để nhận token vào vault (khi user deposit)
     * @param from Địa chỉ gửi
     * @param amount Số lượng token
     */
    function transferIn(address from, uint256 amount) external onlySavingsBank nonReentrant whenNotPaused {
        require(from != address(0), "Invalid sender");
        require(amount > 0, "Amount must be greater than 0");

        depositToken.safeTransferFrom(from, address(this), amount);

        totalBalance += amount;
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @dev Lấy số tiền available (chưa reserve)
     * @return Số tiền có thể rút hoặc reserve
     */
    function getAvailableFunds() public view returns (uint256) {
        if (totalBalance <= reservedFunds) {
            return 0;
        }
        return totalBalance - reservedFunds;
    }

    /**
     * @dev Tính vault health ratio
     * @return healthRatioBps Ratio in basis points (10000 = 100%)
     * @notice Health = (totalBalance / reservedFunds) * 10000
     * @notice Nếu reservedFunds = 0, return max uint256 (healthy)
     */
    function getVaultHealthRatio() public view returns (uint256 healthRatioBps) {
        if (reservedFunds == 0) {
            return type(uint256).max; // Extremely healthy
        }
        return (totalBalance * BPS_DENOMINATOR) / reservedFunds;
    }

    /**
     * @dev Check vault có healthy không
     * @return true nếu health ratio >= minHealthRatioBps
     */
    function isVaultHealthy() public view returns (bool) {
        uint256 healthRatio = getVaultHealthRatio();
        return healthRatio >= minHealthRatioBps;
    }

    /**
     * @dev Lấy vault info tổng quan
     * @return totalBal Tổng số dư vault
     * @return reserved Số tiền đã reserve
     * @return available Số tiền available
     * @return healthRatio Vault health ratio (bps)
     * @return isHealthy Vault có healthy không
     */
    function getVaultInfo() external view returns (
        uint256 totalBal,
        uint256 reserved,
        uint256 available,
        uint256 healthRatio,
        bool isHealthy
    ) {
        return (
            totalBalance,
            reservedFunds,
            getAvailableFunds(),
            getVaultHealthRatio(),
            isVaultHealthy()
        );
    }

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @dev Check vault health và emit warning nếu thấp
     */
    function _checkVaultHealth() internal {
        if (!isVaultHealthy()) {
            emit VaultHealthLow(
                getAvailableFunds(),
                reservedFunds,
                getVaultHealthRatio()
            );
        }
    }

    // ==================== EMERGENCY FUNCTIONS ====================

    /**
     * @dev Emergency withdraw (chỉ khi pause)
     * @notice Chỉ dùng trong trường hợp khẩn cấp
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = depositToken.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");

        depositToken.safeTransfer(msg.sender, balance);

        totalBalance = 0;
        reservedFunds = 0;
    }
}
