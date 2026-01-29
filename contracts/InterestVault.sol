// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IInterestVault.sol";

/**
 * @title InterestVault
 * @dev Simple vault for holding interest liquidity and penalties
 * @notice This is a "dumb" vault - only stores tokens, no business logic
 * 
 * Key Features:
 * - Holds admin-funded liquidity for interest payments
 * - Receives early withdrawal penalties (penalty boosts liquidity)
 * - Only owner (SavingsBank) can deposit/withdraw
 * - No complex logic - just simple storage
 */
contract InterestVault is Ownable, IInterestVault {
    using SafeERC20 for IERC20;

    // ==================== STATE VARIABLES ====================

    /// @dev USDC token contract
    IERC20 public immutable usdc;

    /// @dev Total reserved interest for active deposits
    uint256 public totalReserved;

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Initialize InterestVault with USDC address
     * @param _usdc Address of USDC token contract
     */
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "InterestVault: Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    /**
     * @dev Deposit tokens into vault
     * @param from Address to transfer tokens from
     * @param amount Amount of tokens to deposit
     * @notice Only owner (SavingsBank) can call this
     * @notice Used for admin funding AND penalty deposits
     */
    function deposit(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "InterestVault: Invalid from address");
        require(amount > 0, "InterestVault: Amount must be greater than 0");

        usdc.safeTransferFrom(from, address(this), amount);

        emit Funded(from, amount);
    }

    /**
     * @dev Withdraw tokens from vault
     * @param to Address to transfer tokens to
     * @param amount Amount of tokens to withdraw
     * @notice Only owner (SavingsBank) can call this
     * @notice Used for interest payments to users
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "InterestVault: Invalid to address");
        require(amount > 0, "InterestVault: Amount must be greater than 0");
        require(amount <= balance(), "InterestVault: Insufficient balance");

        usdc.safeTransfer(to, amount);

        emit Withdrawn(to, amount);
    }

    /**
     * @dev Reserve interest for active deposit
     * @param amount Amount to reserve
     * @notice Only owner (SavingsBank) can call this
     * @notice Used when user opens deposit to ensure interest is available at maturity
     */
    function reserve(uint256 amount) external onlyOwner {
        require(amount > 0, "InterestVault: Amount must be greater than 0");
        require(amount <= availableBalance(), "InterestVault: Insufficient available balance");

        totalReserved += amount;

        emit Reserved(amount);
    }

    /**
     * @dev Release reserved interest
     * @param amount Amount to release
     * @notice Only owner (SavingsBank) can call this
     * @notice Used when deposit is withdrawn or cancelled
     */
    function release(uint256 amount) external onlyOwner {
        require(amount > 0, "InterestVault: Amount must be greater than 0");
        require(amount <= totalReserved, "InterestVault: Invalid release amount");

        totalReserved -= amount;

        emit Released(amount);
    }

    /**
     * @dev Get current vault balance
     * @return Current balance of USDC tokens in vault
     */
    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @dev Get available balance (total - reserved)
     * @return Available balance for admin withdrawal
     */
    function availableBalance() public view returns (uint256) {
        uint256 total = balance();
        return total > totalReserved ? total - totalReserved : 0;
    }
}

