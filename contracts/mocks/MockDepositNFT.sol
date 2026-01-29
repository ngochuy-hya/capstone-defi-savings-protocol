// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IDepositNFT.sol";

/**
 * @title MockDepositNFT
 * @dev Minimal ERC721Enumerable implementation of IDepositNFT used for testing SavingsBank.
 *      This contract does NOT implement on-chain SVG metadata; it only tracks ownership.
 */
contract MockDepositNFT is ERC721Enumerable, Ownable, IDepositNFT {
    uint256 private _nextTokenId;

    constructor() ERC721("Mock Deposit NFT", "mDSC") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    function mint(address to) external override onlyOwner returns (uint256) {
        require(to != address(0), "MockDepositNFT: invalid receiver");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit DepositNFTMinted(tokenId, to);
        return tokenId;
    }

    function burn(uint256 tokenId) external override onlyOwner {
        _burn(tokenId);
        emit DepositNFTBurned(tokenId);
    }

    function refreshMetadata(uint256 tokenId) external override {
        // OpenZeppelin v5 removed `_exists`; use `_ownerOf` to check existence instead.
        require(_ownerOf(tokenId) != address(0), "MockDepositNFT: token does not exist");
        emit MetadataUpdated(tokenId);
    }
}

