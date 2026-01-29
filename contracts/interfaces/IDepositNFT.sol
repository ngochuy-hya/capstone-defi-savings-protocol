// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

/**
 * @title IDepositNFT
 * @dev Interface for DepositNFT contract
 * @notice SavingsBank uses this interface to interact with DepositNFT
 * @dev Extends IERC721Enumerable to include all standard ERC721 functions
 */
interface IDepositNFT is IERC721Enumerable {
    // Events
    event DepositNFTMinted(uint256 indexed tokenId, address indexed owner);
    event DepositNFTBurned(uint256 indexed tokenId);
    event MetadataUpdated(uint256 indexed tokenId);

    /**
     * @dev Mint new deposit NFT
     * @param to Address to mint NFT to
     * @return tokenId ID of minted NFT
     */
    function mint(address to) external returns (uint256);

    /**
     * @dev Burn deposit NFT
     * @param tokenId ID of NFT to burn
     */
    function burn(uint256 tokenId) external;

    /**
     * @dev Refresh metadata (emit event for marketplaces)
     * @param tokenId ID of NFT to refresh
     */
    function refreshMetadata(uint256 tokenId) external;

    // Note: ownerOf, balanceOf, tokenOfOwnerByIndex are inherited from ERC721Enumerable
    // and do not need to be declared here to avoid override conflicts
}

