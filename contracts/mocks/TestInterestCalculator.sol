// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/InterestCalculator.sol";

/**
 * @title TestInterestCalculator
 * @dev Test wrapper cho InterestCalculator library
 * @notice Contract này chỉ dùng để test library, không deploy lên production
 */
contract TestInterestCalculator {
    using InterestCalculator for *;

    // ==================== WRAPPER FUNCTIONS ====================

    function calculateSimpleInterest(
        uint256 principal,
        uint16 aprBps,
        uint256 durationSeconds
    ) external pure returns (uint256) {
        return InterestCalculator.calculateSimpleInterest(principal, aprBps, durationSeconds);
    }

    function calculateInterestForDeposit(
        uint256 principal,
        uint16 aprBps,
        uint256 startAt,
        uint256 maturityAt
    ) external pure returns (uint256 interest, uint256 timeElapsed) {
        return InterestCalculator.calculateInterestForDeposit(principal, aprBps, startAt, maturityAt);
    }

    function calculateEarlyWithdrawInterest(
        uint256 principal,
        uint16 aprBps,
        uint256 startAt,
        uint256 withdrawAt
    ) external pure returns (uint256 interest, uint256 timeElapsed) {
        return InterestCalculator.calculateEarlyWithdrawInterest(principal, aprBps, startAt, withdrawAt);
    }

    function calculatePenalty(
        uint256 principal,
        uint16 penaltyBps
    ) external pure returns (uint256) {
        return InterestCalculator.calculatePenalty(principal, penaltyBps);
    }

    function calculateTotalInterestForReserve(
        uint256 principal,
        uint16 aprBps,
        uint32 tenorDays
    ) external pure returns (uint256) {
        return InterestCalculator.calculateTotalInterestForReserve(principal, aprBps, tenorDays);
    }

    function calculateAPY(uint16 aprBps) external pure returns (uint16) {
        return InterestCalculator.calculateAPY(aprBps);
    }

    function estimateMaturityAmount(
        uint256 principal,
        uint16 aprBps,
        uint32 tenorDays
    ) external pure returns (uint256 totalAmount, uint256 interest) {
        return InterestCalculator.estimateMaturityAmount(principal, aprBps, tenorDays);
    }

    function estimateEarlyWithdrawAmount(
        uint256 principal,
        uint16 aprBps,
        uint16 penaltyBps,
        uint32 daysElapsed
    ) external pure returns (
        uint256 netAmount,
        uint256 proRataInterest,
        uint256 penalty
    ) {
        return InterestCalculator.estimateEarlyWithdrawAmount(principal, aprBps, penaltyBps, daysElapsed);
    }

    function isValidAPR(uint16 aprBps) external pure returns (bool) {
        return InterestCalculator.isValidAPR(aprBps);
    }

    function isValidPenalty(uint16 penaltyBps) external pure returns (bool) {
        return InterestCalculator.isValidPenalty(penaltyBps);
    }

    function isValidTenor(
        uint32 tenorDays,
        uint32 minDays,
        uint32 maxDays
    ) external pure returns (bool) {
        return InterestCalculator.isValidTenor(tenorDays, minDays, maxDays);
    }
}
