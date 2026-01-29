// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InterestCalculator
 * @notice Pure math library for interest and penalty calculations
 * @dev All calculations use basis points (BPS) where 10000 BPS = 100%
 */
library InterestCalculator {
    /// @dev Basis points denominator (10000 = 100%)
    uint256 constant BPS_DENOMINATOR = 10000;
    
    /// @dev Seconds per year (365 days)
    uint256 constant SECONDS_PER_YEAR = 365 days;

    /**
     * @dev Calculate simple interest
     * @param principal Principal amount
     * @param aprBps Annual percentage rate in basis points (e.g., 500 = 5%)
     * @param durationDays Duration in days
     * @return interest Calculated interest amount
     * 
     * Formula: interest = principal * aprBps * durationDays / (365 * 10000)
     */
    function calculateInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 durationDays
    ) internal pure returns (uint256 interest) {
        return (principal * aprBps * durationDays) / (365 * BPS_DENOMINATOR);
    }

    /**
     * @dev Calculate penalty amount
     * @param principal Principal amount
     * @param penaltyBps Penalty rate in basis points (e.g., 200 = 2%)
     * @return penalty Calculated penalty amount
     * 
     * Formula: penalty = principal * penaltyBps / 10000
     */
    function calculatePenalty(
        uint256 principal,
        uint256 penaltyBps
    ) internal pure returns (uint256 penalty) {
        return (principal * penaltyBps) / BPS_DENOMINATOR;
    }
}

