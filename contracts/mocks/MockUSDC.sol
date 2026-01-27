// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Token ERC20 giả lập USDC để test
 * @notice Token này có 6 decimals giống USDC thật
 */
contract MockUSDC is ERC20, Ownable {
    // USDC thật có 6 decimals (không phải 18)
    uint8 private constant DECIMALS = 6;

    /**
     * @dev Khởi tạo token với tên "Mock USD Coin" và symbol "USDC"
     * @notice Tự động mint 1,000,000 USDC cho deployer để test
     */
    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {
        // Mint 1 triệu USDC cho người deploy (để test)
        // 1,000,000 USDC = 1,000,000 * 10^6 (vì 6 decimals)
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
    }

    /**
     * @dev Override hàm decimals() để trả về 6 thay vì 18
     * @return uint8 Số decimals (6 cho USDC)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint token mới (chỉ owner gọi được)
     * @param to Địa chỉ nhận token
     * @param amount Số lượng token cần mint (đơn vị nhỏ nhất)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn (đốt) token của chính mình
     * @param amount Số lượng token cần burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burn token của người khác (cần có allowance)
     * @param from Địa chỉ bị burn token
     * @param amount Số lượng token cần burn
     */
    function burnFrom(address from, uint256 amount) external {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }
}
