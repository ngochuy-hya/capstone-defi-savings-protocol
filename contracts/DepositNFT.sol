// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./interfaces/ISavingsBank.sol";
import "./interfaces/IDepositNFT.sol";

/**
 * @title DepositNFT
 * @dev ERC721 NFT representing deposit ownership with 100% on-chain metadata
 * @notice Generates dynamic SVG and metadata based on deposit data from SavingsBank
 * 
 * Features:
 * - ERC721Enumerable for easy enumeration
 * - On-chain SVG generation (no IPFS)
 * - Dynamic metadata updates based on deposit status
 * - Beautiful certificate design with gradient background
 */
contract DepositNFT is ERC721Enumerable, Ownable, IDepositNFT {
    using Strings for uint256;
    using Strings for uint8;

    // ==================== STATE VARIABLES ====================

    /// @dev SavingsBank contract reference
    ISavingsBank public immutable savingsBank;

    /// @dev Next token ID
    uint256 private _nextTokenId;

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Initialize DepositNFT
     * @param _savingsBank SavingsBank contract address
     */
    constructor(address _savingsBank) ERC721("DeFi Savings Certificate", "DSC") Ownable(msg.sender) {
        require(_savingsBank != address(0), "DepositNFT: Invalid SavingsBank");
        savingsBank = ISavingsBank(_savingsBank);
        _nextTokenId = 1;
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    /**
     * @dev Mint new NFT
     * @param to Address to mint to
     * @return tokenId Minted token ID
     */
    function mint(address to) external onlyOwner returns (uint256) {
        require(to != address(0), "DepositNFT: Invalid address");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        emit DepositNFTMinted(tokenId, to);

        return tokenId;
    }

    /**
     * @dev Burn NFT
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);

        emit DepositNFTBurned(tokenId);
    }

    /**
     * @dev Refresh metadata (emit event for marketplaces)
     * @param tokenId Token ID
     */
    function refreshMetadata(uint256 tokenId) external {
        require(ownerOf(tokenId) != address(0), "DepositNFT: Token does not exist");
        emit MetadataUpdated(tokenId);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @dev Generate token URI with on-chain metadata
     * @param tokenId Token ID (same as depositId)
     * @return Token URI in Data URI format
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "DepositNFT: Token does not exist");

        // depositId = tokenId
        uint256 depositId = tokenId;

        // Generate SVG
        string memory svg = _generateSVG(depositId);

        // Generate JSON metadata
        string memory json = _generateJSON(depositId, svg);

        // Return Data URI
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @dev Generate SVG image
     */
    function _generateSVG(uint256 depositId) internal view returns (string memory) {
        // Get deposit details from SavingsBank
        (
            uint256 planId,
            uint256 principal,
            uint256 startTime,
            uint256 maturityTime,
            uint256 lockedAprBps,
            bool isAutoRenewEnabled,
            uint8 status
        ) = savingsBank.getDepositDetails(depositId);

        string memory planName = savingsBank.getPlanName(planId);

        // Calculate progress and status  
        uint256 elapsed = block.timestamp > startTime ? block.timestamp - startTime : 0;
        uint256 duration = maturityTime - startTime;
        uint256 progress = elapsed >= duration ? 100 : (elapsed * 100) / duration;
        
        string memory statusText = _getStatusText(status);
        string memory statusColor = _getStatusColor(status);

        // Format amounts
        string memory principalStr = _formatAmount(principal);
        string memory aprStr = _formatBps(lockedAprBps);

        // Calculate days
        uint256 daysElapsed = elapsed / 1 days;
        uint256 totalDays = duration / 1 days;
        uint256 daysRemaining = totalDays > daysElapsed ? totalDays - daysElapsed : 0;

        return string(abi.encodePacked(
            '<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">',
            '<defs>',
            '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />',
            '</linearGradient>',
            '</defs>',
            '<rect width="400" height="600" fill="url(#bg)" />',
            '<rect x="20" y="20" width="360" height="560" fill="none" stroke="white" stroke-width="2" rx="10" />',
            '<text x="200" y="60" text-anchor="middle" font-size="24" fill="white" font-weight="bold">Deposit Certificate</text>',
            '<text x="200" y="90" text-anchor="middle" font-size="16" fill="white">#', depositId.toString(), '</text>',
            '<text x="40" y="130" font-size="14" fill="white">Plan: ', planName, '</text>',
            '<text x="40" y="160" font-size="14" fill="white">Principal: ', principalStr, ' USDC</text>',
            '<text x="40" y="190" font-size="14" fill="white">Locked APR: ', aprStr, '%</text>',
            '<text x="40" y="220" font-size="14" fill="white">Duration: ', totalDays.toString(), ' days</text>',
            '<text x="40" y="250" font-size="14" fill="white">Days Elapsed: ', daysElapsed.toString(), '</text>',
            '<text x="40" y="280" font-size="14" fill="white">Days Remaining: ', daysRemaining.toString(), '</text>',
            '<text x="40" y="330" font-size="12" fill="white">Progress:</text>',
            '<rect x="40" y="340" width="320" height="20" fill="rgba(255,255,255,0.2)" rx="10" />',
            '<rect x="40" y="340" width="', (progress * 320 / 100).toString(), '" height="20" fill="white" rx="10" />',
            '<text x="200" y="355" text-anchor="middle" font-size="12" fill="black" font-weight="bold">', progress.toString(), '%</text>',
            '<rect x="140" y="390" width="120" height="30" fill="', statusColor, '" rx="5" />',
            '<text x="200" y="410" text-anchor="middle" font-size="14" fill="white" font-weight="bold">', statusText, '</text>',
            '<text x="40" y="460" font-size="12" fill="white">Auto-Renew: ', isAutoRenewEnabled ? "Enabled" : "Disabled", '</text>',
            '<text x="40" y="490" font-size="12" fill="white">Maturity: ', _formatTimestamp(maturityTime), '</text>',
            '<text x="200" y="560" text-anchor="middle" font-size="10" fill="white" opacity="0.7">DeFi Savings Protocol</text>',
            '</svg>'
        ));
    }

    /**
     * @dev Generate JSON metadata
     */
    function _generateJSON(
        uint256 depositId,
        string memory svg
    ) internal view returns (string memory) {
        string memory svgBase64 = Base64.encode(bytes(svg));
        
        // Get deposit details
        (
            uint256 planId,
            uint256 principal,
            uint256 startTime,
            uint256 maturityTime,
            uint256 lockedAprBps,
            bool isAutoRenewEnabled,
            uint8 status
        ) = savingsBank.getDepositDetails(depositId);

        string memory planName = savingsBank.getPlanName(planId);
        
        uint256 elapsed = block.timestamp > startTime ? block.timestamp - startTime : 0;
        uint256 duration = maturityTime - startTime;
        uint256 daysElapsed = elapsed / 1 days;
        uint256 totalDays = duration / 1 days;
        uint256 daysRemaining = totalDays > daysElapsed ? totalDays - daysElapsed : 0;

        return string(abi.encodePacked(
            '{',
            '"name":"Deposit Certificate #', depositId.toString(), '",',
            '"description":"DeFi Savings Protocol - On-chain savings deposit",',
            '"image":"data:image/svg+xml;base64,', svgBase64, '",',
            '"attributes":[',
            '{"trait_type":"Plan","value":"', planName, '"},',
            '{"trait_type":"Principal (USDC)","value":"', _formatAmount(principal), '"},',
            '{"trait_type":"Locked APR","value":"', _formatBps(lockedAprBps), '%"},',
            '{"trait_type":"Duration (Days)","value":', totalDays.toString(), '},',
            '{"trait_type":"Days Elapsed","value":', daysElapsed.toString(), '},',
            '{"trait_type":"Days Remaining","value":', daysRemaining.toString(), '},',
            '{"trait_type":"Status","value":"', _getStatusText(status), '"},',
            '{"trait_type":"Auto-Renew","value":"', isAutoRenewEnabled ? "Enabled" : "Disabled", '"},',
            '{"trait_type":"Maturity Date","value":"', _formatTimestamp(maturityTime), '"}',
            ']',
            '}'
        ));
    }

    /**
     * @dev Format amount (6 decimals)
     */
    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        uint256 wholePart = amount / 1e6;
        uint256 decimalPart = amount % 1e6;
        
        return string(abi.encodePacked(
            wholePart.toString(),
            ".",
            _padZeros(decimalPart, 6)
        ));
    }

    /**
     * @dev Format basis points to percentage
     */
    function _formatBps(uint256 bps) internal pure returns (string memory) {
        uint256 wholePart = bps / 100;
        uint256 decimalPart = bps % 100;
        
        return string(abi.encodePacked(
            wholePart.toString(),
            ".",
            _padZeros(decimalPart, 2)
        ));
    }

    /**
     * @dev Pad zeros
     */
    function _padZeros(uint256 num, uint256 length) internal pure returns (string memory) {
        string memory numStr = num.toString();
        bytes memory numBytes = bytes(numStr);
        
        if (numBytes.length >= length) {
            return numStr;
        }
        
        bytes memory result = new bytes(length);
        uint256 padding = length - numBytes.length;
        
        for (uint256 i = 0; i < padding; i++) {
            result[i] = "0";
        }
        
        for (uint256 i = 0; i < numBytes.length; i++) {
            result[padding + i] = numBytes[i];
        }
        
        return string(result);
    }

    /**
     * @dev Format timestamp to date string
     */
    function _formatTimestamp(uint256 timestamp) internal pure returns (string memory) {
        // Simplified: just return timestamp
        // In production, use a library to convert to YYYY-MM-DD
        return timestamp.toString();
    }

    /**
     * @dev Get status text
     */
    function _getStatusText(uint8 status) internal pure returns (string memory) {
        if (status == 0) return "Active";
        if (status == 1) return "Withdrawn";
        if (status == 2) return "Early Withdrawn";
        if (status == 3) return "Renewed";
        return "Unknown";
    }

    /**
     * @dev Get status color
     */
    function _getStatusColor(uint8 status) internal pure returns (string memory) {
        if (status == 0) return "#10b981"; // Green for Active
        if (status == 1) return "#6366f1"; // Blue for Withdrawn
        if (status == 2) return "#f59e0b"; // Orange for Early Withdrawn
        if (status == 3) return "#8b5cf6"; // Purple for Renewed
        return "#6b7280"; // Gray for Unknown
    }
}

