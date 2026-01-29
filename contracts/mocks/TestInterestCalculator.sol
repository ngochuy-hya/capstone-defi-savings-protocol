// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/InterestCalculator.sol";

/**
 * @title TestInterestCalculator
 * @dev Test wrapper for InterestCalculator library
 * @notice This contract is only for testing the library, not for production deployment
 */
contract TestInterestCalculator {
    using InterestCalculator for uint256;

    // ==================== WRAPPER FUNCTIONS ====================

    /**
     * @dev Calculate interest
     * @param principal Principal amount
     * @param aprBps APR in basis points
     * @param durationDays Duration in days
     * @return interest Calculated interest
     */
    function calculateInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 durationDays
    ) external pure returns (uint256) {
        return InterestCalculator.calculateInterest(principal, aprBps, durationDays);
    }

    /**
     * @dev Calculate penalty
     * @param principal Principal amount
     * @param penaltyBps Penalty in basis points
     * @return penalty Calculated penalty
     */
    function calculatePenalty(
        uint256 principal,
        uint256 penaltyBps
    ) external pure returns (uint256) {
        return InterestCalculator.calculatePenalty(principal, penaltyBps);
    }
}
