// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVaultManager
 * @dev Interface cho VaultManager contract
 * @notice SavingsBank sử dụng interface này để tương tác với VaultManager
 */
interface IVaultManager {
    // ==================== EVENTS ====================
    
    event VaultFunded(address indexed from, uint256 amount, uint256 newTotalBalance);
    event VaultWithdrawn(address indexed to, uint256 amount, uint256 newTotalBalance);
    event FundsReserved(uint256 amount, uint256 newReservedFunds);
    event FundsReleased(uint256 amount, uint256 newReservedFunds);
    event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event SavingsBankUpdated(address indexed oldBank, address indexed newBank);
    event VaultHealthLow(uint256 availableFunds, uint256 reservedFunds, uint256 healthRatioBps);

    // ==================== SAVINGS BANK FUNCTIONS ====================
    
    /**
     * @dev SavingsBank gọi để reserve funds khi user mở deposit
     * @param amount Số tiền cần reserve (principal + estimated interest)
     */
    function reserveFunds(uint256 amount) external;

    /**
     * @dev SavingsBank gọi để release reserved funds khi user withdraw
     * @param amount Số tiền release
     */
    function releaseFunds(uint256 amount) external;

    /**
     * @dev SavingsBank gọi để transfer token ra ngoài (khi user withdraw)
     * @param to Địa chỉ nhận
     * @param amount Số lượng token
     */
    function transferOut(address to, uint256 amount) external;

    /**
     * @dev SavingsBank gọi để nhận token vào vault (khi user deposit)
     * @param from Địa chỉ gửi
     * @param amount Số lượng token
     */
    function transferIn(address from, uint256 amount) external;

    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @dev Lấy số tiền available (chưa reserve)
     * @return Số tiền có thể rút hoặc reserve
     */
    function getAvailableFunds() external view returns (uint256);

    /**
     * @dev Tính vault health ratio
     * @return healthRatioBps Ratio in basis points (10000 = 100%)
     */
    function getVaultHealthRatio() external view returns (uint256 healthRatioBps);

    /**
     * @dev Check vault có healthy không
     * @return true nếu health ratio >= minHealthRatioBps
     */
    function isVaultHealthy() external view returns (bool);

    /**
     * @dev Lấy vault info tổng quan
     */
    function getVaultInfo() external view returns (
        uint256 totalBal,
        uint256 reserved,
        uint256 available,
        uint256 healthRatio,
        bool isHealthy
    );

    // ==================== STATE VARIABLES (as view functions) ====================
    
    function depositToken() external view returns (address);
    function totalBalance() external view returns (uint256);
    function reservedFunds() external view returns (uint256);
    function feeReceiver() external view returns (address);
    function savingsBank() external view returns (address);
}
