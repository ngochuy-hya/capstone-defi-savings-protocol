// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITokenVault.sol";

/**
 * @title TokenVault
 * @dev Simple vault for holding user principal deposits
 * @notice This is a "dumb" vault - only stores tokens, no business logic
 * 
 * Key Features:
 * - Holds principal deposits from users
 * - Only owner (SavingsBank) can deposit/withdraw
 * - No complex logic - just simple storage
 */
contract TokenVault is Ownable, ITokenVault {
    using SafeERC20 for IERC20;

    // ==================== STATE VARIABLES ====================

    /// @dev USDC token contract
    IERC20 public immutable usdc;

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Initialize TokenVault with USDC address
     * @param _usdc Address of USDC token contract
     */
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "TokenVault: Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    /**
     * @dev Deposit tokens into vault
     * @param from Address to transfer tokens from
     * @param amount Amount of tokens to deposit
     * @notice Only owner (SavingsBank) can call this
     */
    function deposit(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "TokenVault: Invalid from address");
        require(amount > 0, "TokenVault: Amount must be greater than 0");

        usdc.safeTransferFrom(from, address(this), amount);

        emit Deposited(from, amount);
    }

    /**
     * @dev Withdraw tokens from vault
     * @param to Address to transfer tokens to
     * @param amount Amount of tokens to withdraw
     * @notice Only owner (SavingsBank) can call this
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "TokenVault: Invalid to address");
        require(amount > 0, "TokenVault: Amount must be greater than 0");
        require(amount <= balance(), "TokenVault: Insufficient balance");

        usdc.safeTransfer(to, amount);

        emit Withdrawn(to, amount);
    }

    /**
     * @dev Get current vault balance
     * @return Current balance of USDC tokens in vault
     */
    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}

