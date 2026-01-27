import { expect } from "chai";
import { ethers } from "hardhat";

// Test contract wrapper để test library
describe("InterestCalculator Library", function () {
  let testContract: any;

  // Helper function to create test contract
  before(async function () {
    const TestInterestCalculator = await ethers.getContractFactory("TestInterestCalculator");
    testContract = await TestInterestCalculator.deploy();
    await testContract.waitForDeployment();
  });

  const USDC_DECIMALS = 6;
  const toUSDC = (amount: number) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  describe("calculateSimpleInterest", function () {
    it("Should calculate interest correctly for 90-day deposit at 8% APR", async function () {
      const principal = toUSDC(10000); // 10,000 USDC
      const aprBps = 800; // 8%
      const durationSeconds = 90n * 24n * 60n * 60n; // 90 days

      const interest = await testContract.calculateSimpleInterest(
        principal,
        aprBps,
        durationSeconds
      );

      // Expected: 10,000 * 0.08 * (90/365) ≈ 197.26 USDC
      const expected = toUSDC(197.26);
      const tolerance = toUSDC(0.01); // 0.01 USDC tolerance

      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("Should calculate interest correctly for 30-day deposit at 5% APR", async function () {
      const principal = toUSDC(5000); // 5,000 USDC
      const aprBps = 500; // 5%
      const durationSeconds = 30n * 24n * 60n * 60n; // 30 days

      const interest = await testContract.calculateSimpleInterest(
        principal,
        aprBps,
        durationSeconds
      );

      // Expected: 5,000 * 0.05 * (30/365) ≈ 20.55 USDC
      const expected = toUSDC(20.55);
      const tolerance = toUSDC(0.01);

      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("Should calculate interest correctly for 180-day deposit at 12% APR", async function () {
      const principal = toUSDC(20000); // 20,000 USDC
      const aprBps = 1200; // 12%
      const durationSeconds = 180n * 24n * 60n * 60n; // 180 days

      const interest = await testContract.calculateSimpleInterest(
        principal,
        aprBps,
        durationSeconds
      );

      // Expected: 20,000 * 0.12 * (180/365) ≈ 1,183.56 USDC
      const expected = toUSDC(1183.56);
      const tolerance = toUSDC(0.5);

      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("Should calculate interest correctly for 7-day deposit at 5% APR", async function () {
      const principal = toUSDC(1000); // 1,000 USDC
      const aprBps = 500; // 5%
      const durationSeconds = 7n * 24n * 60n * 60n; // 7 days

      const interest = await testContract.calculateSimpleInterest(
        principal,
        aprBps,
        durationSeconds
      );

      // Expected: 1,000 * 0.05 * (7/365) ≈ 0.96 USDC
      const expected = toUSDC(0.96);
      const tolerance = toUSDC(0.01);

      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("Should return 0 interest for 0 duration", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800;
      const durationSeconds = 0;

      await expect(
        testContract.calculateSimpleInterest(principal, aprBps, durationSeconds)
      ).to.be.revertedWith("Duration must be greater than 0");
    });

    it("Should revert if principal is 0", async function () {
      await expect(
        testContract.calculateSimpleInterest(0, 800, 90n * 24n * 60n * 60n)
      ).to.be.revertedWith("Principal must be greater than 0");
    });

    it("Should revert if APR is 0", async function () {
      await expect(
        testContract.calculateSimpleInterest(toUSDC(10000), 0, 90n * 24n * 60n * 60n)
      ).to.be.revertedWith("APR must be greater than 0");
    });
  });

  describe("calculateInterestForDeposit", function () {
    it("Should calculate interest and time elapsed correctly", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800; // 8%
      const startAt = Math.floor(Date.now() / 1000);
      const maturityAt = startAt + 90 * 24 * 60 * 60; // 90 days later

      const result = await testContract.calculateInterestForDeposit(
        principal,
        aprBps,
        startAt,
        maturityAt
      );

      const interest = result[0];
      const timeElapsed = result[1];

      expect(timeElapsed).to.equal(90n * 24n * 60n * 60n);

      const expected = toUSDC(197.26);
      const tolerance = toUSDC(0.01);
      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("Should revert if maturity is before start", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800;
      const startAt = Math.floor(Date.now() / 1000);
      const maturityAt = startAt - 1;

      await expect(
        testContract.calculateInterestForDeposit(principal, aprBps, startAt, maturityAt)
      ).to.be.revertedWith("Invalid maturity time");
    });
  });

  describe("calculateEarlyWithdrawInterest", function () {
    it("Should calculate pro-rata interest for early withdrawal", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800; // 8% APR for 90 days
      const startAt = Math.floor(Date.now() / 1000);
      const withdrawAt = startAt + 45 * 24 * 60 * 60; // Withdraw after 45 days (half)

      const result = await testContract.calculateEarlyWithdrawInterest(
        principal,
        aprBps,
        startAt,
        withdrawAt
      );

      const interest = result[0];
      const timeElapsed = result[1];

      expect(timeElapsed).to.equal(45n * 24n * 60n * 60n);

      // Expected: ≈ half of 197.26 = 98.63 USDC
      const expected = toUSDC(98.63);
      const tolerance = toUSDC(0.01);
      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("Should return 0 interest for same-second withdrawal", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800;
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        testContract.calculateEarlyWithdrawInterest(principal, aprBps, timestamp, timestamp)
      ).to.be.revertedWith("Invalid withdraw time");
    });

    it("Should revert if withdraw time is before start", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800;
      const startAt = Math.floor(Date.now() / 1000);
      const withdrawAt = startAt - 1;

      await expect(
        testContract.calculateEarlyWithdrawInterest(principal, aprBps, startAt, withdrawAt)
      ).to.be.revertedWith("Invalid withdraw time");
    });
  });

  describe("calculatePenalty", function () {
    it("Should calculate penalty correctly (5%)", async function () {
      const principal = toUSDC(10000);
      const penaltyBps = 500; // 5%

      const penalty = await testContract.calculatePenalty(principal, penaltyBps);

      expect(penalty).to.equal(toUSDC(500)); // 5% of 10,000 = 500
    });

    it("Should calculate penalty correctly (3%)", async function () {
      const principal = toUSDC(5000);
      const penaltyBps = 300; // 3%

      const penalty = await testContract.calculatePenalty(principal, penaltyBps);

      expect(penalty).to.equal(toUSDC(150)); // 3% of 5,000 = 150
    });

    it("Should return 0 penalty if penalty rate is 0", async function () {
      const principal = toUSDC(10000);
      const penaltyBps = 0;

      const penalty = await testContract.calculatePenalty(principal, penaltyBps);

      expect(penalty).to.equal(0);
    });

    it("Should revert if principal is 0", async function () {
      await expect(testContract.calculatePenalty(0, 500)).to.be.revertedWith(
        "Principal must be greater than 0"
      );
    });

    it("Should revert if penalty > 100%", async function () {
      await expect(testContract.calculatePenalty(toUSDC(10000), 10001)).to.be.revertedWith(
        "Invalid penalty rate"
      );
    });
  });

  describe("calculateTotalInterestForReserve", function () {
    it("Should calculate correct interest for reserve (90 days, 8%)", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800;
      const tenorDays = 90;

      const totalInterest = await testContract.calculateTotalInterestForReserve(
        principal,
        aprBps,
        tenorDays
      );

      const expected = toUSDC(197.26);
      const tolerance = toUSDC(0.01);
      expect(totalInterest).to.be.closeTo(expected, tolerance);
    });

    it("Should calculate correct interest for reserve (30 days, 5%)", async function () {
      const principal = toUSDC(5000);
      const aprBps = 500;
      const tenorDays = 30;

      const totalInterest = await testContract.calculateTotalInterestForReserve(
        principal,
        aprBps,
        tenorDays
      );

      const expected = toUSDC(20.55);
      const tolerance = toUSDC(0.01);
      expect(totalInterest).to.be.closeTo(expected, tolerance);
    });

    it("Should revert if tenor is 0", async function () {
      await expect(
        testContract.calculateTotalInterestForReserve(toUSDC(10000), 800, 0)
      ).to.be.revertedWith("Tenor must be greater than 0");
    });
  });

  describe("estimateMaturityAmount", function () {
    it("Should estimate correct maturity amount", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800; // 8%
      const tenorDays = 90;

      const result = await testContract.estimateMaturityAmount(principal, aprBps, tenorDays);

      const totalAmount = result[0];
      const interest = result[1];

      const expectedInterest = toUSDC(197.26);
      const expectedTotal = principal + expectedInterest;
      const tolerance = toUSDC(0.01);

      expect(interest).to.be.closeTo(expectedInterest, tolerance);
      expect(totalAmount).to.be.closeTo(expectedTotal, tolerance);
    });
  });

  describe("estimateEarlyWithdrawAmount", function () {
    it("Should estimate correct early withdraw amount", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800; // 8%
      const penaltyBps = 500; // 5%
      const daysElapsed = 45; // Half of 90 days

      const result = await testContract.estimateEarlyWithdrawAmount(
        principal,
        aprBps,
        penaltyBps,
        daysElapsed
      );

      const netAmount = result[0];
      const proRataInterest = result[1];
      const penalty = result[2];

      // Pro-rata interest: ~98.63 USDC
      const expectedInterest = toUSDC(98.63);
      const toleranceInterest = toUSDC(0.01);
      expect(proRataInterest).to.be.closeTo(expectedInterest, toleranceInterest);

      // Penalty: 5% of 10,000 = 500 USDC
      expect(penalty).to.equal(toUSDC(500));

      // Net: 10,000 + 98.63 - 500 = 9,598.63 USDC
      const expectedNet = toUSDC(9598.63);
      const toleranceNet = toUSDC(0.01);
      expect(netAmount).to.be.closeTo(expectedNet, toleranceNet);
    });

    it("Should handle case where penalty > principal + interest", async function () {
      const principal = toUSDC(1000);
      const aprBps = 100; // 1% APR
      const penaltyBps = 9900; // 99% penalty
      const daysElapsed = 1; // 1 day (very small interest)

      const result = await testContract.estimateEarlyWithdrawAmount(
        principal,
        aprBps,
        penaltyBps,
        daysElapsed
      );

      const netAmount = result[0];

      // Net amount should be 0 or very close (penalty too large)
      expect(netAmount).to.be.lt(toUSDC(100)); // Less than 100 USDC
    });
  });

  describe("Validation Helpers", function () {
    describe("isValidAPR", function () {
      it("Should return true for valid APR (1-10000 bps)", async function () {
        expect(await testContract.isValidAPR(1)).to.be.true;
        expect(await testContract.isValidAPR(500)).to.be.true;
        expect(await testContract.isValidAPR(10000)).to.be.true;
      });

      it("Should return false for 0 APR", async function () {
        expect(await testContract.isValidAPR(0)).to.be.false;
      });

      it("Should return false for APR > 100%", async function () {
        expect(await testContract.isValidAPR(10001)).to.be.false;
      });
    });

    describe("isValidPenalty", function () {
      it("Should return true for valid penalty (0-10000 bps)", async function () {
        expect(await testContract.isValidPenalty(0)).to.be.true;
        expect(await testContract.isValidPenalty(500)).to.be.true;
        expect(await testContract.isValidPenalty(10000)).to.be.true;
      });

      it("Should return false for penalty > 100%", async function () {
        expect(await testContract.isValidPenalty(10001)).to.be.false;
      });
    });

    describe("isValidTenor", function () {
      it("Should return true for valid tenor within range", async function () {
        expect(await testContract.isValidTenor(30, 7, 365)).to.be.true;
        expect(await testContract.isValidTenor(7, 7, 365)).to.be.true;
        expect(await testContract.isValidTenor(365, 7, 365)).to.be.true;
      });

      it("Should return false for tenor below min", async function () {
        expect(await testContract.isValidTenor(6, 7, 365)).to.be.false;
      });

      it("Should return false for tenor above max", async function () {
        expect(await testContract.isValidTenor(366, 7, 365)).to.be.false;
      });
    });
  });
});
