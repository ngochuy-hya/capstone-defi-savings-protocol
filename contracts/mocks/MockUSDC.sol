// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing (6 decimals like real USDC)
 * @notice Public mint function for easy testing - DO NOT use in production
 */
contract MockUSDC is ERC20 {
    /**
     * @dev Constructor sets token name and symbol
     */
    constructor() ERC20("Mock USDC", "USDC") {}

    /**
     * @dev Returns 6 decimals (same as real USDC)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Public mint function for testing
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in 6 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

