// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ITokenVault
 * @dev Interface for TokenVault contract
 * @notice SavingsBank uses this interface to interact with TokenVault
 */
interface ITokenVault {
    // Events
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    /**
     * @dev Deposit tokens into vault
     * @param from Address to transfer tokens from
     * @param amount Amount of tokens to deposit
     */
    function deposit(address from, uint256 amount) external;

    /**
     * @dev Withdraw tokens from vault
     * @param to Address to transfer tokens to
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(address to, uint256 amount) external;

    /**
     * @dev Get current vault balance
     * @return Current balance of tokens in vault
     */
    function balance() external view returns (uint256);

    /**
     * @dev Get USDC token
     * @return IERC20 token instance
     */
    function usdc() external view returns (IERC20);
}

