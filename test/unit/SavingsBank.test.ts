import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDC, SavingsBank } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SavingsBank - User Functions", function () {
  let savingsBank: SavingsBank;
  let mockUSDC: MockUSDC;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeReceiver: SignerWithAddress;

  // Constants
  const SECONDS_PER_YEAR = BigInt(365 * 24 * 60 * 60);
  const BPS_DENOMINATOR = 10_000n;

  // Plan configs
  const PLAN_7_DAYS = {
    tenorDays: 7,
    aprBps: 500, // 5%
    minDeposit: ethers.parseUnits("100", 6), // 100 USDC
    maxDeposit: ethers.parseUnits("10000", 6), // 10,000 USDC
    penaltyBps: 300, // 3%
  };

  const PLAN_30_DAYS = {
    tenorDays: 30,
    aprBps: 800, // 8%
    minDeposit: ethers.parseUnits("500", 6), // 500 USDC
    maxDeposit: ethers.parseUnits("50000", 6), // 50,000 USDC
    penaltyBps: 500, // 5%
  };

  const PLAN_90_DAYS = {
    tenorDays: 90,
    aprBps: 1000, // 10%
    minDeposit: ethers.parseUnits("1000", 6), // 1,000 USDC
    maxDeposit: 0, // No limit
    penaltyBps: 700, // 7%
  };

  beforeEach(async function () {
    [owner, admin, user1, user2, feeReceiver] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();

    // Deploy SavingsBank
    const SavingsBankFactory = await ethers.getContractFactory("SavingsBank");
    savingsBank = await SavingsBankFactory.deploy(
      await mockUSDC.getAddress(),
      feeReceiver.address,
      admin.address
    );

    // Mint USDC for users
    await mockUSDC.mint(user1.address, ethers.parseUnits("100000", 6)); // 100k USDC
    await mockUSDC.mint(user2.address, ethers.parseUnits("100000", 6)); // 100k USDC

    // Admin funds vault
    await mockUSDC.mint(admin.address, ethers.parseUnits("500000", 6)); // 500k USDC
    await mockUSDC.connect(admin).approve(await savingsBank.getAddress(), ethers.MaxUint256);
    await savingsBank.connect(admin).fundVault(ethers.parseUnits("500000", 6));

    // Create saving plans
    await savingsBank.connect(admin).createPlan(
      PLAN_7_DAYS.tenorDays,
      PLAN_7_DAYS.aprBps,
      PLAN_7_DAYS.minDeposit,
      PLAN_7_DAYS.maxDeposit,
      PLAN_7_DAYS.penaltyBps
    );

    await savingsBank.connect(admin).createPlan(
      PLAN_30_DAYS.tenorDays,
      PLAN_30_DAYS.aprBps,
      PLAN_30_DAYS.minDeposit,
      PLAN_30_DAYS.maxDeposit,
      PLAN_30_DAYS.penaltyBps
    );

    await savingsBank.connect(admin).createPlan(
      PLAN_90_DAYS.tenorDays,
      PLAN_90_DAYS.aprBps,
      PLAN_90_DAYS.minDeposit,
      PLAN_90_DAYS.maxDeposit,
      PLAN_90_DAYS.penaltyBps
    );

    // Users approve USDC
    await mockUSDC.connect(user1).approve(await savingsBank.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user2).approve(await savingsBank.getAddress(), ethers.MaxUint256);
  });

  describe("openDeposit()", function () {
    describe("Success Cases", function () {
      it("Should open deposit successfully with valid plan and amount", async function () {
        const depositAmount = ethers.parseUnits("1000", 6); // 1,000 USDC
        const planId = 1; // 7-day plan

        const userBalanceBefore = await mockUSDC.balanceOf(user1.address);
        const contractBalanceBefore = await mockUSDC.balanceOf(await savingsBank.getAddress());

        const tx = await savingsBank.connect(user1).openDeposit(planId, depositAmount);
        const receipt = await tx.wait();

        // Check event emitted
        const event = receipt?.logs.find((log: any) => {
          try {
            return savingsBank.interface.parseLog(log)?.name === "DepositOpened";
          } catch {
            return false;
          }
        });
        expect(event).to.not.be.undefined;

        // Check balances
        const userBalanceAfter = await mockUSDC.balanceOf(user1.address);
        const contractBalanceAfter = await mockUSDC.balanceOf(await savingsBank.getAddress());

        expect(userBalanceAfter).to.equal(userBalanceBefore - depositAmount);
        expect(contractBalanceAfter).to.equal(contractBalanceBefore + depositAmount);

        // Check deposit certificate
        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.depositId).to.equal(1);
        expect(deposit.owner).to.equal(user1.address);
        expect(deposit.planId).to.equal(planId);
        expect(deposit.principal).to.equal(depositAmount);
        expect(deposit.status).to.equal(0); // ACTIVE

        // Check maturity time (should be ~7 days from now)
        const blockTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        const expectedMaturity = blockTimestamp + 7 * 24 * 60 * 60;
        expect(deposit.maturityAt).to.be.closeTo(expectedMaturity, 5); // Allow 5 seconds tolerance
      });

      it("Should allow multiple deposits from same user", async function () {
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6));
        await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("2000", 6));
        await savingsBank.connect(user1).openDeposit(3, ethers.parseUnits("3000", 6));

        const userDeposits = await savingsBank.getUserDeposits(user1.address);
        expect(userDeposits.length).to.equal(3);
        expect(userDeposits[0]).to.equal(1);
        expect(userDeposits[1]).to.equal(2);
        expect(userDeposits[2]).to.equal(3);
      });

      it("Should allow multiple users to open deposits", async function () {
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6));
        await savingsBank.connect(user2).openDeposit(1, ethers.parseUnits("2000", 6));

        const user1Deposits = await savingsBank.getUserDeposits(user1.address);
        const user2Deposits = await savingsBank.getUserDeposits(user2.address);

        expect(user1Deposits.length).to.equal(1);
        expect(user2Deposits.length).to.equal(1);

        const deposit1 = await savingsBank.getDeposit(1);
        const deposit2 = await savingsBank.getDeposit(2);

        expect(deposit1.owner).to.equal(user1.address);
        expect(deposit2.owner).to.equal(user2.address);
      });

      it("Should handle minimum deposit amount", async function () {
        const minDeposit = PLAN_7_DAYS.minDeposit;
        await savingsBank.connect(user1).openDeposit(1, minDeposit);

        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.principal).to.equal(minDeposit);
      });

      it("Should handle maximum deposit amount", async function () {
        const maxDeposit = PLAN_7_DAYS.maxDeposit;
        await savingsBank.connect(user1).openDeposit(1, maxDeposit);

        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.principal).to.equal(maxDeposit);
      });

      it("Should handle plan with no max deposit limit", async function () {
        const largeAmount = ethers.parseUnits("50000", 6); // 50k USDC
        await savingsBank.connect(user1).openDeposit(3, largeAmount); // Plan 3 has no limit

        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.principal).to.equal(largeAmount);
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if plan does not exist", async function () {
        await expect(
          savingsBank.connect(user1).openDeposit(999, ethers.parseUnits("1000", 6))
        ).to.be.revertedWith("Plan does not exist");
      });

      it("Should revert if plan is disabled", async function () {
        await savingsBank.connect(admin).enablePlan(1, false);

        await expect(
          savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6))
        ).to.be.revertedWith("Plan is disabled");
      });

      it("Should revert if amount below minimum deposit", async function () {
        const belowMin = PLAN_7_DAYS.minDeposit - 1n;

        await expect(
          savingsBank.connect(user1).openDeposit(1, belowMin)
        ).to.be.revertedWith("Amount below minimum deposit");
      });

      it("Should revert if amount exceeds maximum deposit", async function () {
        const aboveMax = PLAN_7_DAYS.maxDeposit + 1n;

        await expect(
          savingsBank.connect(user1).openDeposit(1, aboveMax)
        ).to.be.revertedWith("Amount exceeds maximum deposit");
      });

      it("Should revert if user has insufficient balance", async function () {
        const tooMuch = ethers.parseUnits("200000", 6); // More than user has

        await expect(savingsBank.connect(user1).openDeposit(3, tooMuch)).to.be.reverted;
      });

      it("Should revert if user hasn't approved USDC", async function () {
        const [newUser] = await ethers.getSigners();
        await mockUSDC.mint(newUser.address, ethers.parseUnits("10000", 6));

        // Don't approve
        await expect(savingsBank.connect(newUser).openDeposit(1, ethers.parseUnits("1000", 6))).to.be.reverted;
      });

      it("Should revert when contract is paused", async function () {
        await savingsBank.connect(admin).pause();

        await expect(
          savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6))
        ).to.be.revertedWithCustomError(savingsBank, "EnforcedPause");
      });
    });
  });

  describe("calculateInterest()", function () {
    beforeEach(async function () {
      // User opens a deposit
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6)); // 10k USDC, 30 days, 8% APR
    });

    it("Should return 0 interest immediately after opening", async function () {
      const interest = await savingsBank.calculateInterest(1);
      expect(interest).to.equal(0);
    });

    it("Should calculate correct interest after some time (7 days)", async function () {
      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      const interest = await savingsBank.calculateInterest(1);

      // Expected: 10,000 * 0.08 * (7/365) ≈ 15.34 USDC
      const expected = (10_000_000_000n * 800n * 7n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
      expect(interest).to.be.closeTo(expected, ethers.parseUnits("0.1", 6)); // Allow 0.1 USDC tolerance
    });

    it("Should calculate correct interest after 15 days", async function () {
      await time.increase(15 * 24 * 60 * 60);

      const interest = await savingsBank.calculateInterest(1);

      // Expected: 10,000 * 0.08 * (15/365) ≈ 32.88 USDC
      const expected = (10_000_000_000n * 800n * 15n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
      expect(interest).to.be.closeTo(expected, ethers.parseUnits("0.1", 6));
    });

    it("Should calculate full interest at maturity (30 days)", async function () {
      await time.increase(30 * 24 * 60 * 60);

      const interest = await savingsBank.calculateInterest(1);

      // Expected: 10,000 * 0.08 * (30/365) ≈ 65.75 USDC
      const expected = (10_000_000_000n * 800n * 30n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
      expect(interest).to.be.closeTo(expected, ethers.parseUnits("0.1", 6));
    });

    it("Should cap interest at maturity even after maturity date", async function () {
      // Go 60 days (past maturity)
      await time.increase(60 * 24 * 60 * 60);

      const interest = await savingsBank.calculateInterest(1);

      // Should still be 30-day interest, not 60-day
      const expected = (10_000_000_000n * 800n * 30n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
      expect(interest).to.be.closeTo(expected, ethers.parseUnits("0.1", 6));
    });

    it("Should calculate correct interest for different amounts", async function () {
      // Open another deposit with different amount
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("5000", 6)); // 5k USDC

      await time.increase(15 * 24 * 60 * 60);

      const interest1 = await savingsBank.calculateInterest(1); // 10k
      const interest2 = await savingsBank.calculateInterest(2); // 5k

      // Interest2 should be half of interest1
      expect(interest2).to.be.closeTo(interest1 / 2n, ethers.parseUnits("0.1", 6));
    });

    it("Should revert for non-existent deposit", async function () {
      await expect(savingsBank.calculateInterest(999)).to.be.revertedWith("Deposit does not exist");
    });

    it("Should revert for withdrawn deposit", async function () {
      // Fast forward to maturity and withdraw
      await time.increase(30 * 24 * 60 * 60);
      await savingsBank.connect(user1).withdraw(1);

      // Try to calculate interest on withdrawn deposit
      await expect(savingsBank.calculateInterest(1)).to.be.revertedWith("Deposit not active");
    });
  });

  describe("withdraw()", function () {
    beforeEach(async function () {
      // User opens a 30-day deposit: 10k USDC at 8% APR
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6));
    });

    describe("Success Cases", function () {
      it("Should withdraw successfully at maturity", async function () {
        const depositAmount = ethers.parseUnits("10000", 6);

        // Fast forward to maturity
        await time.increase(30 * 24 * 60 * 60);

        const userBalanceBefore = await mockUSDC.balanceOf(user1.address);
        const vaultBalanceBefore = await savingsBank.getVaultBalance();

        await savingsBank.connect(user1).withdraw(1);

        const userBalanceAfter = await mockUSDC.balanceOf(user1.address);
        const vaultBalanceAfter = await savingsBank.getVaultBalance();

        // Calculate expected interest: 10,000 * 0.08 * (30/365) ≈ 65.75 USDC
        const expectedInterest =
          (10_000_000_000n * 800n * 30n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);

        // User should receive principal + interest
        const expectedTotal = depositAmount + expectedInterest;
        expect(userBalanceAfter - userBalanceBefore).to.be.closeTo(expectedTotal, ethers.parseUnits("0.1", 6));

        // Vault should decrease by interest amount
        expect(vaultBalanceBefore - vaultBalanceAfter).to.be.closeTo(expectedInterest, ethers.parseUnits("0.1", 6));

        // Deposit should be marked as WITHDRAWN
        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.status).to.equal(1); // WITHDRAWN
      });

      it("Should emit Withdrawn event with correct parameters", async function () {
        await time.increase(30 * 24 * 60 * 60);

        const tx = await savingsBank.connect(user1).withdraw(1);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return savingsBank.interface.parseLog(log)?.name === "Withdrawn";
          } catch {
            return false;
          }
        });

        expect(event).to.not.be.undefined;
      });

      it("Should handle multiple withdrawals from different users", async function () {
        // User2 opens deposit
        await savingsBank.connect(user2).openDeposit(2, ethers.parseUnits("5000", 6));

        await time.increase(30 * 24 * 60 * 60);

        const user1BalanceBefore = await mockUSDC.balanceOf(user1.address);
        const user2BalanceBefore = await mockUSDC.balanceOf(user2.address);

        await savingsBank.connect(user1).withdraw(1);
        await savingsBank.connect(user2).withdraw(2);

        const user1BalanceAfter = await mockUSDC.balanceOf(user1.address);
        const user2BalanceAfter = await mockUSDC.balanceOf(user2.address);

        // Both should receive their deposits + interest
        expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
        expect(user2BalanceAfter).to.be.gt(user2BalanceBefore);
      });

      it("Should calculate exact interest at maturity for 7-day plan", async function () {
        await savingsBank.connect(user2).openDeposit(1, ethers.parseUnits("1000", 6)); // 1k USDC, 7 days, 5% APR

        await time.increase(7 * 24 * 60 * 60);

        const balanceBefore = await mockUSDC.balanceOf(user2.address);
        await savingsBank.connect(user2).withdraw(2);
        const balanceAfter = await mockUSDC.balanceOf(user2.address);

        // Expected interest: 1,000 * 0.05 * (7/365) ≈ 0.96 USDC
        const expectedInterest = (1_000_000_000n * 500n * 7n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
        const expectedTotal = ethers.parseUnits("1000", 6) + expectedInterest;

        expect(balanceAfter - balanceBefore).to.be.closeTo(expectedTotal, ethers.parseUnits("0.01", 6));
      });

      it("Should calculate exact interest at maturity for 90-day plan", async function () {
        await savingsBank.connect(user2).openDeposit(3, ethers.parseUnits("5000", 6)); // 5k USDC, 90 days, 10% APR

        await time.increase(90 * 24 * 60 * 60);

        const balanceBefore = await mockUSDC.balanceOf(user2.address);
        await savingsBank.connect(user2).withdraw(2);
        const balanceAfter = await mockUSDC.balanceOf(user2.address);

        // Expected interest: 5,000 * 0.10 * (90/365) ≈ 123.29 USDC
        const expectedInterest =
          (5_000_000_000n * 1000n * 90n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
        const expectedTotal = ethers.parseUnits("5000", 6) + expectedInterest;

        expect(balanceAfter - balanceBefore).to.be.closeTo(expectedTotal, ethers.parseUnits("0.1", 6));
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if not yet matured", async function () {
        // Only 15 days passed (need 30)
        await time.increase(15 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWith("Not yet matured");
      });

      it("Should revert if caller is not owner", async function () {
        await time.increase(30 * 24 * 60 * 60);

        await expect(savingsBank.connect(user2).withdraw(1)).to.be.revertedWith("Not deposit owner");
      });

      it("Should revert if deposit does not exist", async function () {
        await expect(savingsBank.connect(user1).withdraw(999)).to.be.revertedWith("Deposit does not exist");
      });

      it("Should revert if already withdrawn", async function () {
        await time.increase(30 * 24 * 60 * 60);

        await savingsBank.connect(user1).withdraw(1);

        // Try to withdraw again
        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWith("Deposit not active");
      });

      it("Should revert if vault has insufficient liquidity", async function () {
        // Drain vault
        const vaultBalance = await savingsBank.getVaultBalance();
        await savingsBank.connect(admin).withdrawVault(vaultBalance);

        await time.increase(30 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWith("Insufficient vault liquidity");
      });

      it("Should revert when contract is paused", async function () {
        await time.increase(30 * 24 * 60 * 60);
        await savingsBank.connect(admin).pause();

        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWithCustomError(savingsBank, "EnforcedPause");
      });
    });

    describe("Edge Cases", function () {
      it("Should handle withdraw exactly at maturity timestamp", async function () {
        const deposit = await savingsBank.getDeposit(1);
        const maturityAt = deposit.maturityAt;

        // Set time to exactly maturity
        await time.increaseTo(maturityAt);

        await savingsBank.connect(user1).withdraw(1);

        const finalDeposit = await savingsBank.getDeposit(1);
        expect(finalDeposit.status).to.equal(1); // WITHDRAWN
      });

      it("Should handle very small deposit amount", async function () {
        const smallAmount = ethers.parseUnits("100", 6); // Minimum for plan 1
        await savingsBank.connect(user2).openDeposit(1, smallAmount);

        await time.increase(7 * 24 * 60 * 60);

        const balanceBefore = await mockUSDC.balanceOf(user2.address);
        await savingsBank.connect(user2).withdraw(2);
        const balanceAfter = await mockUSDC.balanceOf(user2.address);

        expect(balanceAfter).to.be.gt(balanceBefore);
      });

      it("Should handle large deposit amount", async function () {
        const largeAmount = ethers.parseUnits("50000", 6);
        await savingsBank.connect(user2).openDeposit(3, largeAmount); // Plan 3 has no max

        await time.increase(90 * 24 * 60 * 60);

        const balanceBefore = await mockUSDC.balanceOf(user2.address);
        await savingsBank.connect(user2).withdraw(2);
        const balanceAfter = await mockUSDC.balanceOf(user2.address);

        // Should receive 50k + interest
        expect(balanceAfter - balanceBefore).to.be.gt(largeAmount);
      });
    });
  });

  describe("Integration: Full User Journey", function () {
    it("Should complete full deposit lifecycle for multiple users", async function () {
      // User1: 7-day plan
      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6));

      // User2: 30-day plan
      await savingsBank.connect(user2).openDeposit(2, ethers.parseUnits("5000", 6));

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      // User1 can withdraw
      const user1BalanceBefore = await mockUSDC.balanceOf(user1.address);
      await savingsBank.connect(user1).withdraw(1);
      const user1BalanceAfter = await mockUSDC.balanceOf(user1.address);
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);

      // User2 cannot yet withdraw
      await expect(savingsBank.connect(user2).withdraw(2)).to.be.revertedWith("Not yet matured");

      // Fast forward another 23 days (total 30)
      await time.increase(23 * 24 * 60 * 60);

      // Now User2 can withdraw
      const user2BalanceBefore = await mockUSDC.balanceOf(user2.address);
      await savingsBank.connect(user2).withdraw(2);
      const user2BalanceAfter = await mockUSDC.balanceOf(user2.address);
      expect(user2BalanceAfter).to.be.gt(user2BalanceBefore);
    });

    it("Should handle user opening multiple deposits at different times", async function () {
      // Open 3 deposits with delays
      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6));

      await time.increase(1 * 24 * 60 * 60); // +1 day

      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("2000", 6));

      await time.increase(1 * 24 * 60 * 60); // +1 day

      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("3000", 6));

      // Fast forward to first maturity (5 more days = 7 total)
      await time.increase(5 * 24 * 60 * 60);

      // First deposit can be withdrawn
      await savingsBank.connect(user1).withdraw(1);

      // Second and third cannot yet
      await expect(savingsBank.connect(user1).withdraw(2)).to.be.revertedWith("Not yet matured");
      await expect(savingsBank.connect(user1).withdraw(3)).to.be.revertedWith("Not yet matured");

      // Fast forward 2 more days
      await time.increase(2 * 24 * 60 * 60);

      // Now all can be withdrawn
      await savingsBank.connect(user1).withdraw(2);
      await savingsBank.connect(user1).withdraw(3);

      // All deposits should be WITHDRAWN
      const deposit1 = await savingsBank.getDeposit(1);
      const deposit2 = await savingsBank.getDeposit(2);
      const deposit3 = await savingsBank.getDeposit(3);

      expect(deposit1.status).to.equal(1);
      expect(deposit2.status).to.equal(1);
      expect(deposit3.status).to.equal(1);
    });
  });
});
