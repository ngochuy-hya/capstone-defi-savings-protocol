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

        const tx = await savingsBank.connect(user1).openDeposit(planId, depositAmount, false);
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
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);
        await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("2000", 6), false);
        await savingsBank.connect(user1).openDeposit(3, ethers.parseUnits("3000", 6), false);

        const userDeposits = await savingsBank.getUserDeposits(user1.address);
        expect(userDeposits.length).to.equal(3);
        expect(userDeposits[0]).to.equal(1);
        expect(userDeposits[1]).to.equal(2);
        expect(userDeposits[2]).to.equal(3);
      });

      it("Should allow multiple users to open deposits", async function () {
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);
        await savingsBank.connect(user2).openDeposit(1, ethers.parseUnits("2000", 6), false);

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
        await savingsBank.connect(user1).openDeposit(1, minDeposit, false);

        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.principal).to.equal(minDeposit);
      });

      it("Should handle maximum deposit amount", async function () {
        const maxDeposit = PLAN_7_DAYS.maxDeposit;
        await savingsBank.connect(user1).openDeposit(1, maxDeposit, false);

        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.principal).to.equal(maxDeposit);
      });

      it("Should handle plan with no max deposit limit", async function () {
        const largeAmount = ethers.parseUnits("50000", 6); // 50k USDC
        await savingsBank.connect(user1).openDeposit(3, largeAmount, false); // Plan 3 has no limit

        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.principal).to.equal(largeAmount);
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if plan does not exist", async function () {
        await expect(
          savingsBank.connect(user1).openDeposit(999, ethers.parseUnits("1000", 6), false)
        ).to.be.revertedWith("Plan does not exist");
      });

      it("Should revert if plan is disabled", async function () {
        await savingsBank.connect(admin).enablePlan(1, false);

        await expect(
          savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false)
        ).to.be.revertedWith("Plan is disabled");
      });

      it("Should revert if amount below minimum deposit", async function () {
        const belowMin = PLAN_7_DAYS.minDeposit - 1n;

        await expect(
          savingsBank.connect(user1).openDeposit(1, belowMin, false)
        ).to.be.revertedWith("Amount below minimum deposit");
      });

      it("Should revert if amount exceeds maximum deposit", async function () {
        const aboveMax = PLAN_7_DAYS.maxDeposit + 1n;

        await expect(
          savingsBank.connect(user1).openDeposit(1, aboveMax, false)
        ).to.be.revertedWith("Amount exceeds maximum deposit");
      });

      it("Should revert if user has insufficient balance", async function () {
        const tooMuch = ethers.parseUnits("200000", 6); // More than user has

        await expect(savingsBank.connect(user1).openDeposit(3, tooMuch, false)).to.be.reverted;
      });

      it("Should revert if user hasn't approved USDC", async function () {
        const [newUser] = await ethers.getSigners();
        await mockUSDC.mint(newUser.address, ethers.parseUnits("10000", 6));

        // Don't approve
        await expect(savingsBank.connect(newUser).openDeposit(1, ethers.parseUnits("1000", 6), false)).to.be.reverted;
      });

      it("Should revert when contract is paused", async function () {
        await savingsBank.connect(admin).pause();

        await expect(
          savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false)
        ).to.be.revertedWithCustomError(savingsBank, "EnforcedPause");
      });
    });
  });

  describe("calculateInterest()", function () {
    beforeEach(async function () {
      // User opens a deposit
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false); // 10k USDC, 30 days, 8% APR
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
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("5000", 6), false); // 5k USDC

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
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false);
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
        await savingsBank.connect(user2).openDeposit(2, ethers.parseUnits("5000", 6), false);

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
        await savingsBank.connect(user2).openDeposit(1, ethers.parseUnits("1000", 6), false); // 1k USDC, 7 days, 5% APR

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
        await savingsBank.connect(user2).openDeposit(3, ethers.parseUnits("5000", 6), false); // 5k USDC, 90 days, 10% APR

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
        await savingsBank.connect(user2).openDeposit(1, smallAmount, false);

        await time.increase(7 * 24 * 60 * 60);

        const balanceBefore = await mockUSDC.balanceOf(user2.address);
        await savingsBank.connect(user2).withdraw(2);
        const balanceAfter = await mockUSDC.balanceOf(user2.address);

        expect(balanceAfter).to.be.gt(balanceBefore);
      });

      it("Should handle large deposit amount", async function () {
        const largeAmount = ethers.parseUnits("50000", 6);
        await savingsBank.connect(user2).openDeposit(3, largeAmount, false); // Plan 3 has no max

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
      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);

      // User2: 30-day plan
      await savingsBank.connect(user2).openDeposit(2, ethers.parseUnits("5000", 6), false);

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
      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);

      await time.increase(1 * 24 * 60 * 60); // +1 day

      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("2000", 6), false);

      await time.increase(1 * 24 * 60 * 60); // +1 day

      await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("3000", 6), false);

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

  describe("ERC721 Integration", function () {
    describe("NFT Minting", function () {
      it("Should mint NFT when opening deposit", async function () {
        const depositAmount = ethers.parseUnits("1000", 6);
        await savingsBank.connect(user1).openDeposit(1, depositAmount, false);

        // Check NFT ownership
        const owner = await savingsBank.ownerOf(1);
        expect(owner).to.equal(user1.address);

        // Check balance
        const balance = await savingsBank.balanceOf(user1.address);
        expect(balance).to.equal(1);
      });

      it("Should have correct NFT name and symbol", async function () {
        const name = await savingsBank.name();
        const symbol = await savingsBank.symbol();

        expect(name).to.equal("Savings Deposit Certificate");
        expect(symbol).to.equal("SDC");
      });

      it("Should increment token IDs correctly", async function () {
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("2000", 6), false);
        await savingsBank.connect(user2).openDeposit(2, ethers.parseUnits("3000", 6), false);

        expect(await savingsBank.ownerOf(1)).to.equal(user1.address);
        expect(await savingsBank.ownerOf(2)).to.equal(user1.address);
        expect(await savingsBank.ownerOf(3)).to.equal(user2.address);

        expect(await savingsBank.balanceOf(user1.address)).to.equal(2);
        expect(await savingsBank.balanceOf(user2.address)).to.equal(1);
      });
    });

    describe("NFT Transfer", function () {
      beforeEach(async function () {
        // User1 opens a deposit
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("5000", 6), false);
      });

      it("Should transfer NFT and update deposit owner", async function () {
        // Transfer NFT from user1 to user2
        await savingsBank.connect(user1).transferFrom(user1.address, user2.address, 1);

        // Check NFT ownership
        expect(await savingsBank.ownerOf(1)).to.equal(user2.address);

        // Check deposit owner updated
        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.owner).to.equal(user2.address);

        // Check balances
        expect(await savingsBank.balanceOf(user1.address)).to.equal(0);
        expect(await savingsBank.balanceOf(user2.address)).to.equal(1);
      });

      it("Should emit DepositTransferred event", async function () {
        const tx = await savingsBank.connect(user1).transferFrom(user1.address, user2.address, 1);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return savingsBank.interface.parseLog(log)?.name === "DepositTransferred";
          } catch {
            return false;
          }
        });

        expect(event).to.not.be.undefined;
      });

      it("Should update userDeposits mapping after transfer", async function () {
        // Initial state
        let user1Deposits = await savingsBank.getUserDeposits(user1.address);
        let user2Deposits = await savingsBank.getUserDeposits(user2.address);
        expect(user1Deposits.length).to.equal(1);
        expect(user2Deposits.length).to.equal(0);

        // Transfer
        await savingsBank.connect(user1).transferFrom(user1.address, user2.address, 1);

        // After transfer
        user1Deposits = await savingsBank.getUserDeposits(user1.address);
        user2Deposits = await savingsBank.getUserDeposits(user2.address);
        expect(user1Deposits.length).to.equal(0);
        expect(user2Deposits.length).to.equal(1);
        expect(user2Deposits[0]).to.equal(1);
      });

      it("Should allow new owner to withdraw after transfer", async function () {
        // Transfer to user2
        await savingsBank.connect(user1).transferFrom(user1.address, user2.address, 1);

        // Fast forward to maturity
        await time.increase(7 * 24 * 60 * 60);

        // User1 cannot withdraw (no longer owner)
        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWith("Not deposit owner");

        // User2 can withdraw
        const balanceBefore = await mockUSDC.balanceOf(user2.address);
        await savingsBank.connect(user2).withdraw(1);
        const balanceAfter = await mockUSDC.balanceOf(user2.address);

        expect(balanceAfter).to.be.gt(balanceBefore);
      });

      it("Should prevent transfer if not owner", async function () {
        await expect(
          savingsBank.connect(user2).transferFrom(user1.address, user2.address, 1)
        ).to.be.reverted;
      });

      it("Should support safeTransferFrom", async function () {
        await savingsBank.connect(user1)["safeTransferFrom(address,address,uint256)"](
          user1.address,
          user2.address,
          1
        );

        expect(await savingsBank.ownerOf(1)).to.equal(user2.address);
      });
    });

    describe("ERC721 Enumerable", function () {
      beforeEach(async function () {
        // Create multiple deposits
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("2000", 6), false);
        await savingsBank.connect(user2).openDeposit(2, ethers.parseUnits("3000", 6), false);
      });

      it("Should return total supply", async function () {
        const totalSupply = await savingsBank.totalSupply();
        expect(totalSupply).to.equal(3);
      });

      it("Should support tokenByIndex", async function () {
        const token0 = await savingsBank.tokenByIndex(0);
        const token1 = await savingsBank.tokenByIndex(1);
        const token2 = await savingsBank.tokenByIndex(2);

        expect(token0).to.equal(1);
        expect(token1).to.equal(2);
        expect(token2).to.equal(3);
      });

      it("Should support tokenOfOwnerByIndex", async function () {
        const user1Token0 = await savingsBank.tokenOfOwnerByIndex(user1.address, 0);
        const user1Token1 = await savingsBank.tokenOfOwnerByIndex(user1.address, 1);

        expect(user1Token0).to.equal(1);
        expect(user1Token1).to.equal(2);

        const user2Token0 = await savingsBank.tokenOfOwnerByIndex(user2.address, 0);
        expect(user2Token0).to.equal(3);
      });
    });

    describe("ERC165 Support", function () {
      it("Should support ERC721 interface", async function () {
        // ERC721 interface ID: 0x80ac58cd
        const supportsERC721 = await savingsBank.supportsInterface("0x80ac58cd");
        expect(supportsERC721).to.be.true;
      });

      it("Should support ERC721Enumerable interface", async function () {
        // ERC721Enumerable interface ID: 0x780e9d63
        const supportsEnumerable = await savingsBank.supportsInterface("0x780e9d63");
        expect(supportsEnumerable).to.be.true;
      });

      it("Should support AccessControl interface", async function () {
        // AccessControl interface ID: 0x7965db0b
        const supportsAccessControl = await savingsBank.supportsInterface("0x7965db0b");
        expect(supportsAccessControl).to.be.true;
      });
    });
  });

  describe("earlyWithdraw()", function () {
    beforeEach(async function () {
      // User opens a 30-day deposit
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false);
    });

    describe("Success Cases", function () {
      it("Should early withdraw successfully with penalty", async function () {
        // Fast forward 15 days (half of 30-day term)
        await time.increase(15 * 24 * 60 * 60);

        const userBalanceBefore = await mockUSDC.balanceOf(user1.address);
        const feeReceiverBalanceBefore = await mockUSDC.balanceOf(feeReceiver.address);
        const vaultBalanceBefore = await savingsBank.getVaultBalance();

        await savingsBank.connect(user1).earlyWithdraw(1);

        const userBalanceAfter = await mockUSDC.balanceOf(user1.address);
        const feeReceiverBalanceAfter = await mockUSDC.balanceOf(feeReceiver.address);
        const vaultBalanceAfter = await savingsBank.getVaultBalance();

        // Calculate expected values
        // Pro-rata interest: 10,000 * 0.08 * (15/365) ≈ 32.88 USDC
        const expectedInterest =
          (10_000_000_000n * 800n * 15n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);

        // Penalty: 10,000 * 0.05 = 500 USDC
        const expectedPenalty = (10_000_000_000n * 500n) / BPS_DENOMINATOR;

        // User receives: 10,000 + 32.88 - 500 = 9,532.88 USDC
        const expectedUserAmount = 10_000_000_000n + expectedInterest - expectedPenalty;

        expect(userBalanceAfter - userBalanceBefore).to.be.closeTo(expectedUserAmount, ethers.parseUnits("0.1", 6));
        expect(feeReceiverBalanceAfter - feeReceiverBalanceBefore).to.be.closeTo(
          expectedPenalty,
          ethers.parseUnits("0.1", 6)
        );

        // Vault should decrease by interest amount
        expect(vaultBalanceBefore - vaultBalanceAfter).to.be.closeTo(expectedInterest, ethers.parseUnits("0.1", 6));

        // Deposit should be WITHDRAWN
        const deposit = await savingsBank.getDeposit(1);
        expect(deposit.status).to.equal(1); // WITHDRAWN
      });

      it("Should emit Withdrawn event with isEarly=true", async function () {
        await time.increase(10 * 24 * 60 * 60);

        const tx = await savingsBank.connect(user1).earlyWithdraw(1);
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

      it("Should handle early withdraw with no interest (immediate)", async function () {
        // Withdraw immediately (no time passed)
        const userBalanceBefore = await mockUSDC.balanceOf(user1.address);
        const feeReceiverBalanceBefore = await mockUSDC.balanceOf(feeReceiver.address);

        await savingsBank.connect(user1).earlyWithdraw(1);

        const userBalanceAfter = await mockUSDC.balanceOf(user1.address);
        const feeReceiverBalanceAfter = await mockUSDC.balanceOf(feeReceiver.address);

        // Penalty: 10,000 * 0.05 = 500 USDC
        const expectedPenalty = (10_000_000_000n * 500n) / BPS_DENOMINATOR;

        // User receives: 10,000 - 500 = 9,500 USDC
        const expectedUserAmount = 10_000_000_000n - expectedPenalty;

        expect(userBalanceAfter - userBalanceBefore).to.be.closeTo(expectedUserAmount, ethers.parseUnits("1", 6));
        expect(feeReceiverBalanceAfter - feeReceiverBalanceBefore).to.be.closeTo(expectedPenalty, ethers.parseUnits("1", 6));
      });

      it("Should handle case where penalty >= principal + interest", async function () {
        // Create a plan with very high penalty (90%)
        await savingsBank.connect(admin).createPlan(
          7, // 7 days
          500, // 5% APR
          ethers.parseUnits("100", 6),
          ethers.parseUnits("10000", 6),
          9000 // 90% penalty
        );

        await savingsBank.connect(user2).openDeposit(4, ethers.parseUnits("1000", 6), false);

        await time.increase(1 * 24 * 60 * 60); // 1 day

        const userBalanceBefore = await mockUSDC.balanceOf(user2.address);
        const feeReceiverBalanceBefore = await mockUSDC.balanceOf(feeReceiver.address);

        await savingsBank.connect(user2).earlyWithdraw(2);

        const userBalanceAfter = await mockUSDC.balanceOf(user2.address);
        const feeReceiverBalanceAfter = await mockUSDC.balanceOf(feeReceiver.address);

        // With 90% penalty, user should receive very little
        // Principal: 1000, Penalty: 900, Interest: ~0.14 (1 day)
        // User receives: 1000 + 0.14 - 900 = ~100.14 USDC
        expect(userBalanceAfter - userBalanceBefore).to.be.closeTo(ethers.parseUnits("100", 6), ethers.parseUnits("1", 6));

        // Fee receiver gets penalty
        expect(feeReceiverBalanceAfter).to.be.gt(feeReceiverBalanceBefore);
        expect(feeReceiverBalanceAfter - feeReceiverBalanceBefore).to.be.closeTo(ethers.parseUnits("900", 6), ethers.parseUnits("1", 6));
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if already matured", async function () {
        // Fast forward past maturity
        await time.increase(31 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).earlyWithdraw(1)).to.be.revertedWith(
          "Already matured, use withdraw()"
        );
      });

      it("Should revert if not owner", async function () {
        await time.increase(10 * 24 * 60 * 60);

        await expect(savingsBank.connect(user2).earlyWithdraw(1)).to.be.revertedWith("Not deposit owner");
      });

      it("Should revert if deposit not active", async function () {
        await time.increase(30 * 24 * 60 * 60);
        await savingsBank.connect(user1).withdraw(1);

        await expect(savingsBank.connect(user1).earlyWithdraw(1)).to.be.revertedWith("Deposit not active");
      });

      it("Should revert if vault has insufficient liquidity", async function () {
        // Drain vault
        const vaultBalance = await savingsBank.getVaultBalance();
        await savingsBank.connect(admin).withdrawVault(vaultBalance);

        await time.increase(15 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).earlyWithdraw(1)).to.be.revertedWith("Insufficient vault liquidity");
      });

      it("Should revert when contract is paused", async function () {
        await time.increase(10 * 24 * 60 * 60);
        await savingsBank.connect(admin).pause();

        await expect(savingsBank.connect(user1).earlyWithdraw(1)).to.be.revertedWithCustomError(
          savingsBank,
          "EnforcedPause"
        );
      });
    });
  });

  describe("renew()", function () {
    beforeEach(async function () {
      // User opens a 30-day deposit with auto renew enabled
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), true);
    });

    describe("Auto Renew (useCurrentRate = false)", function () {
      it("Should auto renew successfully with locked rate", async function () {
        // Fast forward to maturity
        await time.increase(30 * 24 * 60 * 60);

        const vaultBalanceBefore = await savingsBank.getVaultBalance();

        // Auto renew (useCurrentRate = false)
        const tx = await savingsBank.connect(user1).renew(1, false);
        const receipt = await tx.wait();

        const vaultBalanceAfter = await savingsBank.getVaultBalance();

        // Old deposit should be AUTORENEWED
        const oldDeposit = await savingsBank.getDeposit(1);
        expect(oldDeposit.status).to.equal(2); // AUTORENEWED

        // New deposit should exist
        const newDeposit = await savingsBank.getDeposit(2);
        expect(newDeposit.status).to.equal(0); // ACTIVE
        expect(newDeposit.owner).to.equal(user1.address);

        // Calculate expected interest
        const expectedInterest =
          (10_000_000_000n * 800n * 30n * 24n * 60n * 60n) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);

        // New principal = old principal + interest
        const expectedNewPrincipal = 10_000_000_000n + expectedInterest;
        expect(newDeposit.principal).to.be.closeTo(expectedNewPrincipal, ethers.parseUnits("0.1", 6));

        // New deposit should have same lockedAprBps as old
        expect(newDeposit.lockedAprBps).to.equal(oldDeposit.lockedAprBps);

        // Should keep auto renew enabled
        expect(newDeposit.isAutoRenewEnabled).to.be.true;

        // Vault should decrease by interest
        expect(vaultBalanceBefore - vaultBalanceAfter).to.be.closeTo(expectedInterest, ethers.parseUnits("0.1", 6));
      });

      it("Should emit Renewed and DepositOpened events", async function () {
        await time.increase(30 * 24 * 60 * 60);

        const tx = await savingsBank.connect(user1).renew(1, false);
        const receipt = await tx.wait();

        const renewedEvent = receipt?.logs.find((log: any) => {
          try {
            return savingsBank.interface.parseLog(log)?.name === "Renewed";
          } catch {
            return false;
          }
        });

        const openedEvent = receipt?.logs.find((log: any) => {
          try {
            return savingsBank.interface.parseLog(log)?.name === "DepositOpened";
          } catch {
            return false;
          }
        });

        expect(renewedEvent).to.not.be.undefined;
        expect(openedEvent).to.not.be.undefined;
      });

      it("Should preserve locked rate even if plan rate changed", async function () {
        // Wait for maturity
        await time.increase(30 * 24 * 60 * 60);

        // Admin changes plan rate to 6% (down from 8%)
        await savingsBank.connect(admin).updatePlan(2, 600, ethers.parseUnits("500", 6), ethers.parseUnits("50000", 6), 500);

        // Auto renew
        await savingsBank.connect(user1).renew(1, false);

        const newDeposit = await savingsBank.getDeposit(2);

        // Should still use old 8% rate (800 bps)
        expect(newDeposit.lockedAprBps).to.equal(800);
      });
    });

    describe("Manual Renew (useCurrentRate = true)", function () {
      it("Should manual renew successfully with current rate", async function () {
        await time.increase(30 * 24 * 60 * 60);

        // Manual renew (useCurrentRate = true)
        await savingsBank.connect(user1).renew(1, true);

        // Old deposit should be MANUALRENEWED
        const oldDeposit = await savingsBank.getDeposit(1);
        expect(oldDeposit.status).to.equal(3); // MANUALRENEWED

        // New deposit should have current plan rate
        const newDeposit = await savingsBank.getDeposit(2);
        const plan = await savingsBank.getPlan(2);
        expect(newDeposit.lockedAprBps).to.equal(plan.aprBps);
      });

      it("Should use updated plan rate if admin changed it", async function () {
        await time.increase(30 * 24 * 60 * 60);

        // Admin increases plan rate to 10% (up from 8%)
        await savingsBank.connect(admin).updatePlan(2, 1000, ethers.parseUnits("500", 6), ethers.parseUnits("50000", 6), 500);

        // Manual renew
        await savingsBank.connect(user1).renew(1, true);

        const newDeposit = await savingsBank.getDeposit(2);

        // Should use new 10% rate (1000 bps)
        expect(newDeposit.lockedAprBps).to.equal(1000);
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if not yet matured", async function () {
        // Only 15 days passed (need 30)
        await time.increase(15 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).renew(1, false)).to.be.revertedWith("Not yet matured");
      });

      it("Should revert if not owner", async function () {
        await time.increase(30 * 24 * 60 * 60);

        await expect(savingsBank.connect(user2).renew(1, false)).to.be.revertedWith("Not deposit owner");
      });

      it("Should revert if deposit not active", async function () {
        await time.increase(30 * 24 * 60 * 60);
        await savingsBank.connect(user1).withdraw(1);

        await expect(savingsBank.connect(user1).renew(1, false)).to.be.revertedWith("Deposit not active");
      });

      it("Should revert if plan is disabled", async function () {
        await time.increase(30 * 24 * 60 * 60);
        await savingsBank.connect(admin).enablePlan(2, false);

        await expect(savingsBank.connect(user1).renew(1, false)).to.be.revertedWith("Plan is disabled");
      });

      it("Should revert if vault has insufficient liquidity", async function () {
        await time.increase(30 * 24 * 60 * 60);

        // Drain vault
        const vaultBalance = await savingsBank.getVaultBalance();
        await savingsBank.connect(admin).withdrawVault(vaultBalance);

        await expect(savingsBank.connect(user1).renew(1, false)).to.be.revertedWith("Insufficient vault liquidity");
      });

      it("Should revert when contract is paused", async function () {
        await time.increase(30 * 24 * 60 * 60);
        await savingsBank.connect(admin).pause();

        await expect(savingsBank.connect(user1).renew(1, false)).to.be.revertedWithCustomError(
          savingsBank,
          "EnforcedPause"
        );
      });
    });

    describe("NFT Integration", function () {
      it("Should mint new NFT for renewed deposit", async function () {
        await time.increase(30 * 24 * 60 * 60);

        const balanceBefore = await savingsBank.balanceOf(user1.address);

        await savingsBank.connect(user1).renew(1, false);

        const balanceAfter = await savingsBank.balanceOf(user1.address);

        // Should have one more NFT
        expect(balanceAfter).to.equal(balanceBefore + 1n);

        // Should own the new token
        expect(await savingsBank.ownerOf(2)).to.equal(user1.address);
      });
    });
  });

  describe("setAutoRenew()", function () {
    beforeEach(async function () {
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false);
    });

    it("Should enable auto renew", async function () {
      await savingsBank.connect(user1).setAutoRenew(1, true);

      const deposit = await savingsBank.getDeposit(1);
      expect(deposit.isAutoRenewEnabled).to.be.true;
    });

    it("Should disable auto renew", async function () {
      // First enable it
      await savingsBank.connect(user1).setAutoRenew(1, true);

      // Then disable it
      await savingsBank.connect(user1).setAutoRenew(1, false);

      const deposit = await savingsBank.getDeposit(1);
      expect(deposit.isAutoRenewEnabled).to.be.false;
    });

    it("Should emit AutoRenewUpdated event", async function () {
      const tx = await savingsBank.connect(user1).setAutoRenew(1, true);
      const receipt = await tx.wait();

      const event = receipt?.logs.find((log: any) => {
        try {
          return savingsBank.interface.parseLog(log)?.name === "AutoRenewUpdated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });

    it("Should revert if not owner", async function () {
      await expect(savingsBank.connect(user2).setAutoRenew(1, true)).to.be.revertedWith("Not deposit owner");
    });

    it("Should revert if deposit not active", async function () {
      await time.increase(30 * 24 * 60 * 60);
      await savingsBank.connect(user1).withdraw(1);

      await expect(savingsBank.connect(user1).setAutoRenew(1, true)).to.be.revertedWith("Deposit not active");
    });
  });
});
