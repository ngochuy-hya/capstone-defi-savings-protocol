// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IInterestVault
 * @dev Interface for InterestVault contract
 * @notice SavingsBank uses this interface to interact with InterestVault
 */
interface IInterestVault {
    // Events
    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Reserved(uint256 amount);
    event Released(uint256 amount);

    /**
     * @dev Deposit tokens into vault (admin funding or penalty deposits)
     * @param from Address to transfer tokens from
     * @param amount Amount of tokens to deposit
     */
    function deposit(address from, uint256 amount) external;

    /**
     * @dev Withdraw tokens from vault (interest payments)
     * @param to Address to transfer tokens to
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(address to, uint256 amount) external;

    /**
     * @dev Reserve interest for active deposit
     * @param amount Amount to reserve
     */
    function reserve(uint256 amount) external;

    /**
     * @dev Release reserved interest
     * @param amount Amount to release
     */
    function release(uint256 amount) external;

    /**
     * @dev Get current vault balance
     * @return Current balance of tokens in vault
     */
    function balance() external view returns (uint256);

    /**
     * @dev Get available balance (total - reserved)
     * @return Available balance for admin withdrawal
     */
    function availableBalance() external view returns (uint256);

    /**
     * @dev Get total reserved interest
     * @return Total reserved amount
     */
    function totalReserved() external view returns (uint256);

    /**
     * @dev Get USDC token
     * @return IERC20 token instance
     */
    function usdc() external view returns (IERC20);
}

