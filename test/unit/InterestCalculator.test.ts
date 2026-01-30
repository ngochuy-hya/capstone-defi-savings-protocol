import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * InterestCalculator library tests (localhost).
 * Uses TestInterestCalculator wrapper contract.
 */
describe("InterestCalculator", function () {
  let testContract: any;

  before(async function () {
    const TestInterestCalculator = await ethers.getContractFactory("TestInterestCalculator");
    testContract = await TestInterestCalculator.deploy();
    await testContract.waitForDeployment();
  });

  const USDC_DECIMALS = 6;
  const toUSDC = (amount: number) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);

  describe("calculateInterest", function () {
    it("calculates interest for 90-day deposit at 8% APR", async function () {
      const principal = toUSDC(10000); // 10,000 USDC
      const aprBps = 800; // 8%
      const tenorDays = 90;

      const interest = await testContract.calculateInterest(principal, aprBps, tenorDays);

      // Expected: 10,000 * 0.08 * (90/365) ≈ 197.26 USDC
      const expected = toUSDC(197.26);
      const tolerance = toUSDC(0.1);

      expect(interest).to.be.closeTo(expected, tolerance);
    });

    it("returns 0 interest when tenor is 0", async function () {
      const principal = toUSDC(10000);
      const aprBps = 800;
      const tenorDays = 0;

      const interest = await testContract.calculateInterest(principal, aprBps, tenorDays);
      expect(interest).to.equal(0);
    });
  });

  describe("calculatePenalty", function () {
    it("calculates 5% penalty correctly", async function () {
      const principal = toUSDC(10000);
      const penaltyBps = 500; // 5%

      const penalty = await testContract.calculatePenalty(principal, penaltyBps);
      expect(penalty).to.equal(toUSDC(500));
    });

    it("returns 0 penalty when rate is 0", async function () {
      const principal = toUSDC(10000);
      const penaltyBps = 0;

      const penalty = await testContract.calculatePenalty(principal, penaltyBps);
      expect(penalty).to.equal(0);
    });
  });
});
