// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISavingsBank
 * @dev Interface for SavingsBank contract
 * @notice DepositNFT uses this interface to read deposit data for metadata generation
 */
interface ISavingsBank {
    /**
     * @dev Get saving plan name
     * @param planId ID of the plan
     * @return name Plan name
     */
    function getPlanName(uint256 planId) external view returns (string memory name);

    /**
     * @dev Get deposit details for NFT metadata
     * @param depositId ID of the deposit
     * @return planId Plan ID
     * @return principal Principal amount
     * @return startTime Start timestamp
     * @return maturityTime Maturity timestamp
     * @return lockedAprBps Locked APR in basis points
     * @return isAutoRenewEnabled Auto-renew status
     * @return status Deposit status
     */
    function getDepositDetails(uint256 depositId)
        external
        view
        returns (
            uint256 planId,
            uint256 principal,
            uint256 startTime,
            uint256 maturityTime,
            uint256 lockedAprBps,
            bool isAutoRenewEnabled,
            uint8 status
        );

    /**
     * @dev Calculate interest for a deposit
     * @param depositId ID of the deposit
     * @return interest Calculated interest amount
     */
    function calculateInterest(uint256 depositId) external view returns (uint256 interest);
}

