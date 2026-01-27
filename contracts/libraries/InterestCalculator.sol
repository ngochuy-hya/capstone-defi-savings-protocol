// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InterestCalculator
 * @dev Library để tính lãi đơn (simple interest) cho hệ thống savings
 * @notice Sử dụng simple interest giống ngân hàng truyền thống, KHÔNG dùng compound interest
 * 
 * Formula: Interest = Principal × APR × Time / Year
 * 
 * Ví dụ:
 * - Principal: 10,000 USDC
 * - APR: 8% (800 basis points)
 * - Tenor: 90 days
 * - Interest = 10,000 × 0.08 × (90/365) ≈ 197.26 USDC
 */
library InterestCalculator {
    
    // ==================== CONSTANTS ====================
    
    /// @dev Basis points denominator (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10_000;
    
    /// @dev Số giây trong 1 năm (365 ngày)
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ==================== MAIN FUNCTIONS ====================

    /**
     * @dev Tính lãi đơn (simple interest)
     * @param principal Số tiền gốc
     * @param aprBps Lãi suất năm (basis points: 800 = 8%)
     * @param durationSeconds Thời gian tính lãi (giây)
     * @return interest Số tiền lãi
     * 
     * @notice Formula: interest = principal × aprBps × durationSeconds / (SECONDS_PER_YEAR × BPS_DENOMINATOR)
     * 
     * Example:
     * calculateSimpleInterest(10_000_000_000, 800, 90 days)
     * = 10_000_000_000 × 800 × 7_776_000 / (31_536_000 × 10_000)
     * = 197_260_274 (≈ 197.26 USDC với 6 decimals)
     */
    function calculateSimpleInterest(
        uint256 principal,
        uint16 aprBps,
        uint256 durationSeconds
    ) internal pure returns (uint256 interest) {
        require(principal > 0, "Principal must be greater than 0");
        require(aprBps > 0, "APR must be greater than 0");
        require(durationSeconds > 0, "Duration must be greater than 0");
        
        // interest = principal × aprBps × durationSeconds / (SECONDS_PER_YEAR × BPS_DENOMINATOR)
        interest = (principal * aprBps * durationSeconds) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
        
        return interest;
    }

    /**
     * @dev Tính lãi cho deposit certificate
     * @param principal Số tiền gốc
     * @param aprBps Lãi suất năm
     * @param startAt Thời điểm bắt đầu
     * @param maturityAt Thời điểm đáo hạn
     * @return interest Số tiền lãi
     * @return timeElapsed Thời gian đã trôi qua (giây)
     * 
     * @notice Tính lãi từ startAt đến maturityAt
     */
    function calculateInterestForDeposit(
        uint256 principal,
        uint16 aprBps,
        uint256 startAt,
        uint256 maturityAt
    ) internal pure returns (uint256 interest, uint256 timeElapsed) {
        require(maturityAt > startAt, "Invalid maturity time");
        
        timeElapsed = maturityAt - startAt;
        interest = calculateSimpleInterest(principal, aprBps, timeElapsed);
        
        return (interest, timeElapsed);
    }

    /**
     * @dev Tính lãi cho early withdrawal
     * @param principal Số tiền gốc
     * @param aprBps Lãi suất năm
     * @param startAt Thời điểm bắt đầu
     * @param withdrawAt Thời điểm rút sớm
     * @return interest Số tiền lãi (pro-rata)
     * @return timeElapsed Thời gian đã trôi qua
     * 
     * @notice Tính lãi pro-rata cho thời gian đã gửi (từ startAt đến withdrawAt)
     * @notice User sẽ nhận lãi pro-rata MINUS penalty
     */
    function calculateEarlyWithdrawInterest(
        uint256 principal,
        uint16 aprBps,
        uint256 startAt,
        uint256 withdrawAt
    ) internal pure returns (uint256 interest, uint256 timeElapsed) {
        require(withdrawAt > startAt, "Invalid withdraw time");
        
        timeElapsed = withdrawAt - startAt;
        
        // Nếu thời gian quá ngắn (< 1 giây), không có lãi
        if (timeElapsed == 0) {
            return (0, 0);
        }
        
        interest = calculateSimpleInterest(principal, aprBps, timeElapsed);
        
        return (interest, timeElapsed);
    }

    /**
     * @dev Tính penalty cho early withdrawal
     * @param principal Số tiền gốc
     * @param penaltyBps Phạt (basis points: 500 = 5%)
     * @return penalty Số tiền phạt
     * 
     * @notice Formula: penalty = principal × penaltyBps / BPS_DENOMINATOR
     */
    function calculatePenalty(
        uint256 principal,
        uint16 penaltyBps
    ) internal pure returns (uint256 penalty) {
        require(principal > 0, "Principal must be greater than 0");
        require(penaltyBps <= BPS_DENOMINATOR, "Invalid penalty rate");
        
        penalty = (principal * penaltyBps) / BPS_DENOMINATOR;
        
        return penalty;
    }

    /**
     * @dev Tính total interest cho việc reserve funds
     * @param principal Số tiền gốc
     * @param aprBps Lãi suất năm
     * @param tenorDays Kỳ hạn (ngày)
     * @return totalInterest Tổng lãi cần reserve
     * 
     * @notice Hàm này dùng để tính trước số tiền lãi cần reserve trong vault
     */
    function calculateTotalInterestForReserve(
        uint256 principal,
        uint16 aprBps,
        uint32 tenorDays
    ) internal pure returns (uint256 totalInterest) {
        require(principal > 0, "Principal must be greater than 0");
        require(aprBps > 0, "APR must be greater than 0");
        require(tenorDays > 0, "Tenor must be greater than 0");
        
        uint256 tenorSeconds = uint256(tenorDays) * 1 days;
        totalInterest = calculateSimpleInterest(principal, aprBps, tenorSeconds);
        
        return totalInterest;
    }

    /**
     * @dev Tính APY từ APR (compound annually)
     * @param aprBps APR (basis points)
     * @return apyBps APY (basis points)
     * 
     * @notice APY = (1 + APR)^1 - 1 = APR (vì compound = 1 lần/năm)
     * @notice Đơn giản hóa: Với simple interest, APY = APR
     */
    function calculateAPY(uint16 aprBps) internal pure returns (uint16 apyBps) {
        // Với simple interest, APY = APR
        return aprBps;
    }

    /**
     * @dev Estimate số tiền nhận được khi withdraw at maturity
     * @param principal Số tiền gốc
     * @param aprBps Lãi suất năm
     * @param tenorDays Kỳ hạn
     * @return totalAmount Tổng số tiền nhận được (principal + interest)
     * @return interest Chỉ phần lãi
     */
    function estimateMaturityAmount(
        uint256 principal,
        uint16 aprBps,
        uint32 tenorDays
    ) internal pure returns (uint256 totalAmount, uint256 interest) {
        interest = calculateTotalInterestForReserve(principal, aprBps, tenorDays);
        totalAmount = principal + interest;
        
        return (totalAmount, interest);
    }

    /**
     * @dev Estimate số tiền nhận được khi early withdraw
     * @param principal Số tiền gốc
     * @param aprBps Lãi suất năm
     * @param penaltyBps Phạt rút sớm
     * @param daysElapsed Số ngày đã gửi
     * @return netAmount Số tiền nhận được (principal - penalty + proRataInterest)
     * @return proRataInterest Lãi pro-rata
     * @return penalty Tiền phạt
     */
    function estimateEarlyWithdrawAmount(
        uint256 principal,
        uint16 aprBps,
        uint16 penaltyBps,
        uint32 daysElapsed
    ) internal pure returns (
        uint256 netAmount,
        uint256 proRataInterest,
        uint256 penalty
    ) {
        // Tính lãi pro-rata
        uint256 durationSeconds = uint256(daysElapsed) * 1 days;
        proRataInterest = calculateSimpleInterest(principal, aprBps, durationSeconds);
        
        // Tính penalty
        penalty = calculatePenalty(principal, penaltyBps);
        
        // Tính net amount
        // net = principal + proRataInterest - penalty
        // Nhưng thông thường penalty > proRataInterest nên net = principal - penalty + proRataInterest
        if (principal + proRataInterest >= penalty) {
            netAmount = principal + proRataInterest - penalty;
        } else {
            // Edge case: penalty lớn hơn principal + interest
            netAmount = 0;
        }
        
        return (netAmount, proRataInterest, penalty);
    }

    // ==================== VALIDATION HELPERS ====================

    /**
     * @dev Validate APR trong phạm vi hợp lệ
     * @param aprBps APR (basis points)
     * @return valid true nếu valid
     */
    function isValidAPR(uint16 aprBps) internal pure returns (bool valid) {
        return aprBps > 0 && aprBps <= BPS_DENOMINATOR; // 0% < APR <= 100%
    }

    /**
     * @dev Validate penalty rate trong phạm vi hợp lệ
     * @param penaltyBps Penalty (basis points)
     * @return valid true nếu valid
     */
    function isValidPenalty(uint16 penaltyBps) internal pure returns (bool valid) {
        return penaltyBps <= BPS_DENOMINATOR; // penalty <= 100%
    }

    /**
     * @dev Validate tenor trong phạm vi hợp lệ
     * @param tenorDays Tenor (ngày)
     * @param minDays Minimum tenor
     * @param maxDays Maximum tenor
     * @return valid true nếu valid
     */
    function isValidTenor(
        uint32 tenorDays,
        uint32 minDays,
        uint32 maxDays
    ) internal pure returns (bool valid) {
        return tenorDays >= minDays && tenorDays <= maxDays;
    }
}
