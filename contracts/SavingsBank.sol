// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITokenVault.sol";
import "./interfaces/IInterestVault.sol";
import "./interfaces/IDepositNFT.sol";
import "./libraries/InterestCalculator.sol";

/**
 * @title SavingsBank
 * @dev Core business logic contract for DeFi savings protocol
 * @notice This contract NEVER holds tokens - only coordinates transfers between vaults
 * 
 * Key Features:
 * - Plan management (create, update, enable/disable)
 * - Deposit operations (open, withdraw, earlyWithdraw, autoRenew)
 * - Admin vault management (fund, withdraw)
 * - Interest calculation using InterestCalculator library
 * - Auto-renew with LOCKED APR protection
 * - Grace period mechanism (2 days after maturity)
 * - Pause/unpause functionality
 * 
 * Renewal Mechanisms:
 * 1. AUTO-RENEW (via autoRenew function):
 *    - Triggered within grace period (2 days after maturity)
 *    - Locks OLD APR rate (protects user from admin changes)
 *    - Compounds interest (newPrincipal = oldPrincipal + interest)
 *    - Can be called by user or automation (Chainlink/Gelato)
 * 
 * 2. MANUAL RENEW (withdraw + openDeposit):
 *    - User withdraws principal + interest
 *    - User creates new deposit with NEW plan params
 *    - Uses CURRENT APR and duration from plan
 *    - Flexible amount (not tied to previous deposit)
 * 
 * Architecture:
 * - TokenVault: holds principal deposits (IMMUTABLE)
 * - InterestVault: holds interest liquidity + penalties (IMMUTABLE)
 * - DepositNFT: represents ownership (IMMUTABLE)
 * - SavingsBank: all business logic (IMMUTABLE)
 */
contract SavingsBank is
    Ownable,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using InterestCalculator for uint256;

    // ==================== STRUCTS ====================

    struct SavingPlan {
        string name;
        uint256 durationDays;
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 aprBps;                    // basis points (500 = 5%)
        uint256 earlyWithdrawPenaltyBps;   // basis points
        bool isActive;
    }

    struct DepositCertificate {
        uint256 planId;
        uint256 principal;
        uint256 startTime;
        uint256 maturityTime;
        uint256 lockedAprBps;              // APR locked at deposit time
        bool isAutoRenewEnabled;
        uint8 status;                       // 0=Active, 1=Withdrawn, 2=EarlyWithdrawn, 3=Renewed
    }

    // ==================== STATE VARIABLES ====================

    /// @dev USDC token
    IERC20 public usdc;

    /// @dev TokenVault for principal
    ITokenVault public tokenVault;

    /// @dev InterestVault for interest and penalties
    IInterestVault public interestVault;

    /// @dev DepositNFT contract
    IDepositNFT public depositNFT;

    /// @dev Saving plans mapping
    mapping(uint256 => SavingPlan) public savingPlans;

    /// @dev Deposit certificates mapping (depositId => certificate)
    mapping(uint256 => DepositCertificate) public deposits;

    /// @dev Next plan ID
    uint256 public nextPlanId;

    /// @dev Next deposit ID
    uint256 public nextDepositId;

    // ==================== CONSTANTS ====================

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant AUTO_RENEW_GRACE_PERIOD = 2 days;  // Window for auto-renew after maturity

    // Status constants
    uint8 public constant STATUS_ACTIVE = 0;
    uint8 public constant STATUS_WITHDRAWN = 1;
    uint8 public constant STATUS_EARLY_WITHDRAWN = 2;
    uint8 public constant STATUS_RENEWED = 3;

    // ==================== EVENTS ====================

    event PlanCreated(uint256 indexed planId, string name);
    event PlanUpdated(uint256 indexed planId);
    event PlanEnabled(uint256 indexed planId, bool enabled);
    event DepositOpened(
        uint256 indexed depositId,
        address indexed owner,
        uint256 planId,
        uint256 principal,
        uint256 maturityAt
    );
    event Withdrawn(
        uint256 indexed depositId,
        address indexed owner,
        uint256 principal,
        uint256 interest,
        bool isEarly
    );
    event AutoRenewed(
        uint256 indexed oldDepositId,
        uint256 indexed newDepositId,
        uint256 newPrincipal,
        uint256 lockedAprBps
    );
    event VaultFunded(uint256 amount);
    event VaultWithdrawn(uint256 amount);
    event DepositNFTUpdated(address indexed newDepositNFT);

    // ==================== CONSTRUCTOR ====================

    /**
     * @dev Initialize SavingsBank
     * @param _usdc USDC token address
     * @param _tokenVault TokenVault address
     * @param _interestVault InterestVault address
     * @param _depositNFT DepositNFT address
     */
    constructor(
        address _usdc,
        address _tokenVault,
        address _interestVault,
        address _depositNFT
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "SavingsBank: Invalid USDC");
        require(_tokenVault != address(0), "SavingsBank: Invalid TokenVault");
        require(_interestVault != address(0), "SavingsBank: Invalid InterestVault");
        require(_depositNFT != address(0), "SavingsBank: Invalid DepositNFT");

        usdc = IERC20(_usdc);
        tokenVault = ITokenVault(_tokenVault);
        interestVault = IInterestVault(_interestVault);
        depositNFT = IDepositNFT(_depositNFT);

        nextPlanId = 1;
        nextDepositId = 1;
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @dev Create new saving plan
     * @param name Plan name
     * @param durationDays Duration in days
     * @param minDeposit Minimum deposit amount
     * @param maxDeposit Maximum deposit amount
     * @param aprBps APR in basis points
     * @param earlyWithdrawPenaltyBps Early withdraw penalty in basis points
     */
    function createPlan(
        string memory name,
        uint256 durationDays,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 aprBps,
        uint256 earlyWithdrawPenaltyBps
    ) external onlyOwner returns (uint256) {
        require(bytes(name).length > 0, "SavingsBank: Empty name");
        require(durationDays > 0, "SavingsBank: Invalid duration");
        require(minDeposit > 0, "SavingsBank: Invalid minDeposit");
        require(maxDeposit >= minDeposit, "SavingsBank: Invalid maxDeposit");
        require(aprBps > 0 && aprBps <= BPS_DENOMINATOR, "SavingsBank: Invalid APR");
        require(earlyWithdrawPenaltyBps <= BPS_DENOMINATOR, "SavingsBank: Invalid penalty");

        uint256 planId = nextPlanId++;

        savingPlans[planId] = SavingPlan({
            name: name,
            durationDays: durationDays,
            minDeposit: minDeposit,
            maxDeposit: maxDeposit,
            aprBps: aprBps,
            earlyWithdrawPenaltyBps: earlyWithdrawPenaltyBps,
            isActive: true
        });

        emit PlanCreated(planId, name);
        return planId;
    }

    /**
     * @dev Update existing plan
     * @param planId Plan ID
     * @param aprBps New APR
     * @param earlyWithdrawPenaltyBps New penalty
     */
    function updatePlan(
        uint256 planId,
        uint256 aprBps,
        uint256 earlyWithdrawPenaltyBps
    ) external onlyOwner {
        require(planId < nextPlanId, "SavingsBank: Plan not found");
        require(aprBps > 0 && aprBps <= BPS_DENOMINATOR, "SavingsBank: Invalid APR");
        require(earlyWithdrawPenaltyBps <= BPS_DENOMINATOR, "SavingsBank: Invalid penalty");

        savingPlans[planId].aprBps = aprBps;
        savingPlans[planId].earlyWithdrawPenaltyBps = earlyWithdrawPenaltyBps;

        emit PlanUpdated(planId);
    }

    /**
     * @dev Enable or disable plan
     * @param planId Plan ID
     * @param enabled Enable status
     */
    function enablePlan(uint256 planId, bool enabled) external onlyOwner {
        require(planId < nextPlanId, "SavingsBank: Plan not found");

        savingPlans[planId].isActive = enabled;

        emit PlanEnabled(planId, enabled);
    }

    /**
     * @dev Fund InterestVault with liquidity
     * @param amount Amount to fund
     */
    function fundVault(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "SavingsBank: Amount must be > 0");

        // Transfer from admin to InterestVault
        interestVault.deposit(msg.sender, amount);

        emit VaultFunded(amount);
    }

    /**
     * @dev Withdraw from InterestVault
     * @param amount Amount to withdraw
     */
    function withdrawVault(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "SavingsBank: Amount must be > 0");
        require(amount <= interestVault.availableBalance(), "SavingsBank: Insufficient available funds");

        // Transfer from InterestVault to admin
        interestVault.withdraw(msg.sender, amount);

        emit VaultWithdrawn(amount);
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== USER FUNCTIONS ====================

    /**
     * @dev Open new deposit
     * @param planId Plan ID
     * @param amount Principal amount
     * @param enableAutoRenew Enable auto-renew
     * @return depositId New deposit ID
     */
    function openDeposit(
        uint256 planId,
        uint256 amount,
        bool enableAutoRenew
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(planId < nextPlanId, "SavingsBank: Plan not found");

        SavingPlan memory plan = savingPlans[planId];
        require(plan.isActive, "SavingsBank: Plan not active");
        require(amount >= plan.minDeposit, "SavingsBank: Below minDeposit");
        require(amount <= plan.maxDeposit, "SavingsBank: Above maxDeposit");

        // Calculate maturity time
        uint256 maturityTime = block.timestamp + (plan.durationDays * 1 days);

        // Calculate estimated interest and reserve it
        uint256 estimatedInterest = amount.calculateInterest(plan.aprBps, plan.durationDays);

        // Reserve interest in vault
        interestVault.reserve(estimatedInterest);

        // Transfer principal to TokenVault
        tokenVault.deposit(msg.sender, amount);

        // Create deposit certificate
        uint256 depositId = nextDepositId++;
        deposits[depositId] = DepositCertificate({
            planId: planId,
            principal: amount,
            startTime: block.timestamp,
            maturityTime: maturityTime,
            lockedAprBps: plan.aprBps,
            isAutoRenewEnabled: enableAutoRenew,
            status: STATUS_ACTIVE
        });

        // Mint NFT to user
        depositNFT.mint(msg.sender);

        emit DepositOpened(depositId, msg.sender, planId, amount, maturityTime);

        return depositId;
    }

    /**
     * @dev Withdraw at maturity
     * @notice User can withdraw anytime after maturity, even after grace period expires.
     *         If auto-renew is enabled and within grace period, user must decide:
     *         - Call withdraw() to take funds (prevents auto-renew)
     *         - Call autoRenew() to compound interest (locks old APR)
     *         - Do nothing and let automation trigger autoRenew()
     * @param tokenId NFT token ID (same as depositId)
     */
    function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        uint256 depositId = tokenId;
        address owner = depositNFT.ownerOf(tokenId);
        require(owner == msg.sender, "SavingsBank: Not owner");

        DepositCertificate storage cert = deposits[depositId];
        require(cert.status == STATUS_ACTIVE, "SavingsBank: Not active");
        require(block.timestamp >= cert.maturityTime, "SavingsBank: Not matured");

        // Calculate interest using library
        uint256 duration = cert.maturityTime - cert.startTime;
        uint256 durationDays = duration / 1 days;
        uint256 interest = cert.principal.calculateInterest(cert.lockedAprBps, durationDays);

        // Release reserved interest
        interestVault.release(interest);

        // Update state
        cert.status = STATUS_WITHDRAWN;

        // Transfer principal from TokenVault
        tokenVault.withdraw(msg.sender, cert.principal);

        // Transfer interest from InterestVault
        interestVault.withdraw(msg.sender, interest);

        // Burn NFT
        depositNFT.burn(tokenId);

        emit Withdrawn(depositId, msg.sender, cert.principal, interest, false);
    }

    /**
     * @dev Early withdraw (before maturity)
     * @param tokenId NFT token ID
     */
    function earlyWithdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        uint256 depositId = tokenId;
        address owner = depositNFT.ownerOf(tokenId);
        require(owner == msg.sender, "SavingsBank: Not owner");

        DepositCertificate storage cert = deposits[depositId];
        require(cert.status == STATUS_ACTIVE, "SavingsBank: Not active");
        require(block.timestamp < cert.maturityTime, "SavingsBank: Already matured");

        SavingPlan memory plan = savingPlans[cert.planId];

        // Calculate penalty using library
        uint256 penalty = cert.principal.calculatePenalty(plan.earlyWithdrawPenaltyBps);
        uint256 userReceives = cert.principal - penalty;

        // Release reserved interest (no interest paid on early withdraw)
        uint256 duration = cert.maturityTime - cert.startTime;
        uint256 durationDays = duration / 1 days;
        uint256 reservedInterest = cert.principal.calculateInterest(cert.lockedAprBps, durationDays);
        interestVault.release(reservedInterest);

        // Update status
        cert.status = STATUS_EARLY_WITHDRAWN;

        // Transfer principal minus penalty to user
        tokenVault.withdraw(msg.sender, userReceives);

        // Transfer penalty to InterestVault (boosts liquidity)
        tokenVault.withdraw(address(this), penalty);
        usdc.approve(address(interestVault), penalty);
        interestVault.deposit(address(this), penalty);

        // Burn NFT
        depositNFT.burn(tokenId);

        emit Withdrawn(depositId, msg.sender, cert.principal, 0, true);
    }

    /**
     * @dev Auto-renew deposit with LOCKED APR and duration
     * @notice This function implements the auto-renew mechanism:
     *         - Only works within grace period (2 days after maturity)
     *         - Locks the OLD APR rate (protection against admin changes)
     *         - Compounds interest (new principal = old principal + interest)
     *         - Can be called by user manually or by automation (Chainlink/Gelato)
     * @param tokenId NFT token ID
     * @return newDepositId New deposit ID after renewal
     */
    function autoRenew(uint256 tokenId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        uint256 depositId = tokenId;
        address owner = depositNFT.ownerOf(tokenId);
        require(owner == msg.sender, "SavingsBank: Not owner");

        DepositCertificate storage oldCert = deposits[depositId];
        require(oldCert.status == STATUS_ACTIVE, "SavingsBank: Not active");
        require(oldCert.isAutoRenewEnabled, "SavingsBank: Auto-renew not enabled");
        require(block.timestamp >= oldCert.maturityTime, "SavingsBank: Not matured");
        require(
            block.timestamp <= oldCert.maturityTime + AUTO_RENEW_GRACE_PERIOD,
            "SavingsBank: Grace period expired"
        );

        // Calculate interest using library
        uint256 duration = oldCert.maturityTime - oldCert.startTime;
        uint256 durationDays = duration / 1 days;
        uint256 interest = oldCert.principal.calculateInterest(oldCert.lockedAprBps, durationDays);
        uint256 newPrincipal = oldCert.principal + interest;

        // Get original plan to get duration (duration doesn't change on auto-renew)
        SavingPlan memory originalPlan = savingPlans[oldCert.planId];
        require(originalPlan.durationDays > 0, "SavingsBank: Invalid plan");

        // Validate new principal against current plan limits
        require(newPrincipal >= originalPlan.minDeposit, "SavingsBank: Below minDeposit");
        require(newPrincipal <= originalPlan.maxDeposit, "SavingsBank: Above maxDeposit");

        // AUTO-RENEW: Lock OLD APR and duration (regardless of admin updates)
        uint256 lockedAprBps = oldCert.lockedAprBps;
        uint256 lockedDurationDays = originalPlan.durationDays;

        // Release old reserved interest
        interestVault.release(interest);

        // Calculate new maturity time
        uint256 newMaturityTime = block.timestamp + (lockedDurationDays * 1 days);

        // Reserve new interest using LOCKED APR
        uint256 newEstimatedInterest = newPrincipal.calculateInterest(lockedAprBps, lockedDurationDays);
        interestVault.reserve(newEstimatedInterest);

        // Transfer interest from InterestVault to TokenVault (compound interest)
        interestVault.withdraw(address(this), interest);
        usdc.approve(address(tokenVault), interest);
        tokenVault.deposit(address(this), interest);

        // Update old certificate status
        oldCert.status = STATUS_RENEWED;

        // Burn old NFT
        depositNFT.burn(tokenId);

        // Create new deposit with LOCKED APR
        uint256 newDepositId = nextDepositId++;
        deposits[newDepositId] = DepositCertificate({
            planId: oldCert.planId,  // Keep same plan ID
            principal: newPrincipal,
            startTime: block.timestamp,
            maturityTime: newMaturityTime,
            lockedAprBps: lockedAprBps,  // LOCKED APR (protection for user)
            isAutoRenewEnabled: oldCert.isAutoRenewEnabled,  // Preserve setting
            status: STATUS_ACTIVE
        });

        // Mint new NFT
        depositNFT.mint(msg.sender);

        emit AutoRenewed(depositId, newDepositId, newPrincipal, lockedAprBps);

        return newDepositId;
    }

    /**
     * @dev Set auto-renew for deposit
     * @param tokenId NFT token ID
     * @param enabled Enable auto-renew
     */
    function setAutoRenew(uint256 tokenId, bool enabled) external {
        uint256 depositId = tokenId;
        address owner = depositNFT.ownerOf(tokenId);
        require(owner == msg.sender, "SavingsBank: Not owner");

        DepositCertificate storage cert = deposits[depositId];
        require(cert.status == STATUS_ACTIVE, "SavingsBank: Not active");

        cert.isAutoRenewEnabled = enabled;
    }

    /**
     * @dev Check if deposit needs auto-renew (for Chainlink Automation / Gelato)
     * @param depositId Deposit ID to check
     * @return upkeepNeeded True if deposit should be auto-renewed
     * @return performData Encoded data for performAutoRenew (depositId)
     */
    function checkAutoRenew(uint256 depositId)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // Check if deposit exists and has an NFT owner
        if (depositId >= nextDepositId) {
            return (false, "");
        }

        DepositCertificate memory cert = deposits[depositId];

        // Check all conditions for auto-renew
        upkeepNeeded = (
            cert.status == STATUS_ACTIVE &&
            cert.isAutoRenewEnabled &&
            block.timestamp >= cert.maturityTime &&
            block.timestamp <= cert.maturityTime + AUTO_RENEW_GRACE_PERIOD
        );

        if (upkeepNeeded) {
            performData = abi.encode(depositId);
        }

        return (upkeepNeeded, performData);
    }

    /**
     * @dev Batch check multiple deposits for auto-renew
     * @param depositIds Array of deposit IDs to check
     * @return needsRenewal Array of booleans indicating which deposits need renewal
     */
    function checkAutoRenewBatch(uint256[] calldata depositIds)
        external
        view
        returns (bool[] memory needsRenewal)
    {
        needsRenewal = new bool[](depositIds.length);

        for (uint256 i = 0; i < depositIds.length; i++) {
            uint256 depositId = depositIds[i];

            if (depositId >= nextDepositId) {
                needsRenewal[i] = false;
                continue;
            }

            DepositCertificate memory cert = deposits[depositId];

            needsRenewal[i] = (
                cert.status == STATUS_ACTIVE &&
                cert.isAutoRenewEnabled &&
                block.timestamp >= cert.maturityTime &&
                block.timestamp <= cert.maturityTime + AUTO_RENEW_GRACE_PERIOD
            );
        }

        return needsRenewal;
    }

    // ================== VIEW FUNCTIONS ====================

    /**
     * @dev Calculate interest for deposit
     * @param depositId Deposit ID
     * @return interest Calculated interest
     */
    function calculateInterest(uint256 depositId) public view returns (uint256 interest) {
        DepositCertificate memory cert = deposits[depositId];
        require(cert.principal > 0, "SavingsBank: Deposit not found");

        uint256 duration = cert.maturityTime - cert.startTime;
        uint256 durationDays = duration / 1 days;
        return cert.principal.calculateInterest(cert.lockedAprBps, durationDays);
    }

    /**
     * @dev Calculate early withdraw amount
     * @param depositId Deposit ID
     * @return principalMinusPenalty Amount user receives
     * @return penalty Penalty amount
     */
    function calculateEarlyWithdrawAmount(uint256 depositId)
        external
        view
        returns (uint256 principalMinusPenalty, uint256 penalty)
    {
        DepositCertificate memory cert = deposits[depositId];
        require(cert.principal > 0, "SavingsBank: Deposit not found");

        SavingPlan memory plan = savingPlans[cert.planId];
        penalty = cert.principal.calculatePenalty(plan.earlyWithdrawPenaltyBps);
        principalMinusPenalty = cert.principal - penalty;
    }

    /**
     * @dev Get available vault balance (from InterestVault)
     * @return available Available balance
     */
    function availableVaultBalance() public view returns (uint256 available) {
        return interestVault.availableBalance();
    }

    /**
     * @dev Get all deposit IDs for user (via NFT enumeration)
     * @param user User address
     * @return depositIds Array of deposit IDs
     */
    function getUserDeposits(address user) external view returns (uint256[] memory depositIds) {
        uint256 balance = depositNFT.balanceOf(user);
        depositIds = new uint256[](balance);

        for (uint256 i = 0; i < balance; i++) {
            depositIds[i] = depositNFT.tokenOfOwnerByIndex(user, i);
        }

        return depositIds;
    }

    /**
     * @dev Get plan name (for DepositNFT metadata)
     * @param planId Plan ID
     * @return name Plan name
     */
    function getPlanName(uint256 planId) external view returns (string memory name) {
        return savingPlans[planId].name;
    }

    /**
     * @dev Get deposit details (for DepositNFT metadata)
     * @param depositId Deposit ID
     * @return planId Plan ID
     * @return principal Principal amount
     * @return startTime Start timestamp
     * @return maturityTime Maturity timestamp
     * @return lockedAprBps Locked APR
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
        )
    {
        DepositCertificate memory cert = deposits[depositId];
        return (
            cert.planId,
            cert.principal,
            cert.startTime,
            cert.maturityTime,
            cert.lockedAprBps,
            cert.isAutoRenewEnabled,
            cert.status
        );
    }

    /**
     * @dev Check deposit status and eligibility for operations
     * @param depositId Deposit ID
     * @return canWithdraw True if can withdraw normally
     * @return canAutoRenew True if can auto-renew (within grace period)
     * @return isMatured True if deposit has matured
     * @return gracePeriodExpired True if grace period has passed
     */
    function getDepositStatus(uint256 depositId)
        external
        view
        returns (
            bool canWithdraw,
            bool canAutoRenew,
            bool isMatured,
            bool gracePeriodExpired
        )
    {
        DepositCertificate memory cert = deposits[depositId];

        isMatured = block.timestamp >= cert.maturityTime;
        gracePeriodExpired = block.timestamp > cert.maturityTime + AUTO_RENEW_GRACE_PERIOD;

        // Can withdraw if active and matured
        canWithdraw = (cert.status == STATUS_ACTIVE && isMatured);

        // Can auto-renew if active, auto-renew enabled, matured, and within grace period
        canAutoRenew = (
            cert.status == STATUS_ACTIVE &&
            cert.isAutoRenewEnabled &&
            isMatured &&
            !gracePeriodExpired
        );

        return (canWithdraw, canAutoRenew, isMatured, gracePeriodExpired);
    }
}

