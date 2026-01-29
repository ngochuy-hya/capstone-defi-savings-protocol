import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockUSDC,
  TokenVault,
  InterestVault,
  MockDepositNFT,
  SavingsBank,
} from "../../typechain";

/**
 * Comprehensive SavingsBank tests for the new architecture:
 * MockUSDC + TokenVault + InterestVault + MockDepositNFT + SavingsBank (UUPS).
 */
describe("SavingsBank (Pragmatic SOLID)", function () {
  let usdc: MockUSDC;
  let tokenVault: TokenVault;
  let interestVault: InterestVault;
  let depositNFT: MockDepositNFT;
  let savingsBank: SavingsBank;
  let admin: any;
  let user1: any;
  let user2: any;
  let feeReceiver: any;

  const BPS_DENOMINATOR = 10_000n;
  const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;

  const PLAN_7_DAYS = {
    tenorDays: 7,
    aprBps: 500, // 5%
    minDeposit: ethers.parseUnits("100", 6),
    maxDeposit: ethers.parseUnits("10000", 6),
  };

  const PLAN_30_DAYS = {
    tenorDays: 30,
    aprBps: 800, // 8%
    minDeposit: ethers.parseUnits("500", 6),
    maxDeposit: ethers.parseUnits("50000", 6),
  };

  const PLAN_90_DAYS = {
    tenorDays: 90,
    aprBps: 1000, // 10%
    minDeposit: ethers.parseUnits("1000", 6),
    maxDeposit: ethers.MaxUint256, // No limit
  };

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [admin, user1, user2, feeReceiver] = signers;

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDCFactory.deploy()) as MockUSDC;
    await usdc.waitForDeployment();

    // Mint tokens to users
    await usdc.mint(user1.address, ethers.parseUnits("100000", 6));
    await usdc.mint(user2.address, ethers.parseUnits("100000", 6));

    // Deploy TokenVault
    const TokenVaultFactory = await ethers.getContractFactory("TokenVault");
    tokenVault = (await TokenVaultFactory.deploy(await usdc.getAddress())) as TokenVault;
    await tokenVault.waitForDeployment();

    // Deploy InterestVault
    const InterestVaultFactory = await ethers.getContractFactory("InterestVault");
    interestVault = (await InterestVaultFactory.deploy(await usdc.getAddress())) as InterestVault;
    await interestVault.waitForDeployment();

    // Deploy MockDepositNFT
    const MockDepositNFTFactory = await ethers.getContractFactory("MockDepositNFT");
    depositNFT = (await MockDepositNFTFactory.deploy()) as MockDepositNFT;
    await depositNFT.waitForDeployment();

    // Deploy SavingsBank (direct deployment)
    const SavingsBankFactory = await ethers.getContractFactory("SavingsBank");
    savingsBank = (await SavingsBankFactory.deploy(
      await usdc.getAddress(),
      await tokenVault.getAddress(),
      await interestVault.getAddress(),
      await depositNFT.getAddress()
    )) as SavingsBank;
    await savingsBank.waitForDeployment();

    // Transfer ownership of vaults and NFT to SavingsBank
    await tokenVault.transferOwnership(await savingsBank.getAddress());
    await interestVault.transferOwnership(await savingsBank.getAddress());
    await depositNFT.transferOwnership(await savingsBank.getAddress());

    // Fund InterestVault via SavingsBank helper
    const fundAmount = ethers.parseUnits("100000", 6);
    await usdc.mint(admin.address, fundAmount);
    await usdc.connect(admin).approve(await interestVault.getAddress(), fundAmount);
    await savingsBank.connect(admin).fundVault(fundAmount);

    // Create plans
    await savingsBank.connect(admin).createPlan(
      "7 Days",
      PLAN_7_DAYS.tenorDays,
      PLAN_7_DAYS.minDeposit,
      PLAN_7_DAYS.maxDeposit,
      PLAN_7_DAYS.aprBps,
      500 // 5% penalty
    );

    await savingsBank.connect(admin).createPlan(
      "30 Days",
      PLAN_30_DAYS.tenorDays,
      PLAN_30_DAYS.minDeposit,
      PLAN_30_DAYS.maxDeposit,
      PLAN_30_DAYS.aprBps,
      500 // 5% penalty
    );

    await savingsBank.connect(admin).createPlan(
      "90 Days",
      PLAN_90_DAYS.tenorDays,
      PLAN_90_DAYS.minDeposit,
      PLAN_90_DAYS.maxDeposit,
      PLAN_90_DAYS.aprBps,
      500 // 5% penalty
    );

    // Approve TokenVault for principal
    await usdc.connect(user1).approve(await tokenVault.getAddress(), ethers.parseUnits("100000", 6));
    await usdc.connect(user2).approve(await tokenVault.getAddress(), ethers.parseUnits("100000", 6));
  });

  // ==================== Basic Smoke Tests ====================

  it("opens a deposit and mints NFT", async function () {
    const amount = ethers.parseUnits("1000", 6);

    const userBalanceBefore = await usdc.balanceOf(user1.address);
    const vaultBalanceBefore = await tokenVault.balance();

    const tx = await savingsBank.connect(user1).openDeposit(1, amount, false);
    await tx.wait();

    const userBalanceAfter = await usdc.balanceOf(user1.address);
    const vaultBalanceAfter = await tokenVault.balance();

    // Principal moves from user to TokenVault
    expect(userBalanceBefore - userBalanceAfter).to.equal(amount);
    expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(amount);

    // NFT minted to user
    const nftBalance = await depositNFT.balanceOf(user1.address);
    expect(nftBalance).to.equal(1n);
  });

  it("withdraws at maturity with principal + interest", async function () {
    const amount = ethers.parseUnits("1000", 6);
    await savingsBank.connect(user1).openDeposit(1, amount, false);

    // Fast-forward 7 days
    await time.increase(7 * 24 * 60 * 60);

    const userBalanceBefore = await usdc.balanceOf(user1.address);

    await savingsBank.connect(user1).withdraw(1);

    const userBalanceAfter = await usdc.balanceOf(user1.address);

    // User should receive more than principal (some interest)
    expect(userBalanceAfter - userBalanceBefore).to.be.gt(amount);
  });

  it("early withdraws with penalty and no interest", async function () {
    const amount = ethers.parseUnits("1000", 6);
    await savingsBank.connect(user1).openDeposit(1, amount, false);

    // Fast-forward 3 days (< 7 days)
    await time.increase(3 * 24 * 60 * 60);

    const userBalanceBefore = await usdc.balanceOf(user1.address);

    await savingsBank.connect(user1).earlyWithdraw(1);

    const userBalanceAfter = await usdc.balanceOf(user1.address);

    // User should receive less than principal due to penalty
    const received = userBalanceAfter - userBalanceBefore;
    expect(received).to.be.lt(amount);
  });

  // ==================== Detailed Behavior Tests ====================

  describe("openDeposit()", function () {
    describe("Success Cases", function () {
      it("Should open deposit successfully with valid plan and amount", async function () {
        const depositAmount = ethers.parseUnits("1000", 6);
        const planId = 1;

        const userBalanceBefore = await usdc.balanceOf(user1.address);
        const tokenVaultBalanceBefore = await tokenVault.balance();
        const reservedBefore = await interestVault.totalReserved();

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
        const userBalanceAfter = await usdc.balanceOf(user1.address);
        const tokenVaultBalanceAfter = await tokenVault.balance();
        const reservedAfter = await interestVault.totalReserved();

        expect(userBalanceAfter).to.equal(userBalanceBefore - depositAmount);
        expect(tokenVaultBalanceAfter).to.equal(tokenVaultBalanceBefore + depositAmount);

        // InterestVault reserves increased by expected interest
        const expectedInterest = depositAmount * 500n * 7n / (365n * 10_000n);
        expect(reservedAfter).to.be.closeTo(reservedBefore + expectedInterest, ethers.parseUnits("0.01", 6));

        // Check deposit certificate
        const [returnedPlanId, principal, , maturityTime, , , status] = await savingsBank.getDepositDetails(1);
        expect(returnedPlanId).to.equal(planId);
        expect(principal).to.equal(depositAmount);
        expect(status).to.equal(0); // ACTIVE
      });

      it("Should allow multiple deposits from same user", async function () {
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);
        await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("2000", 6), false);
        await savingsBank.connect(user1).openDeposit(3, ethers.parseUnits("3000", 6), false);

        const userDeposits = await savingsBank.getUserDeposits(user1.address);
        expect(userDeposits.length).to.equal(3);
      });

      it("Should allow multiple users to open deposits", async function () {
        await savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false);
        await savingsBank.connect(user2).openDeposit(1, ethers.parseUnits("2000", 6), false);

        const user1Deposits = await savingsBank.getUserDeposits(user1.address);
        const user2Deposits = await savingsBank.getUserDeposits(user2.address);

        expect(user1Deposits.length).to.equal(1);
        expect(user2Deposits.length).to.equal(1);
      });

      it("Should handle minimum deposit amount", async function () {
        const minDeposit = PLAN_7_DAYS.minDeposit;
        await savingsBank.connect(user1).openDeposit(1, minDeposit, false);

        const [, principal] = await savingsBank.getDepositDetails(1);
        expect(principal).to.equal(minDeposit);
      });

      it("Should handle maximum deposit amount", async function () {
        const maxDeposit = PLAN_7_DAYS.maxDeposit;
        await savingsBank.connect(user1).openDeposit(1, maxDeposit, false);

        const [, principal] = await savingsBank.getDepositDetails(1);
        expect(principal).to.equal(maxDeposit);
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if plan does not exist", async function () {
        await expect(
          savingsBank.connect(user1).openDeposit(999, ethers.parseUnits("1000", 6), false)
        ).to.be.revertedWith("SavingsBank: Plan not found");
      });

      it("Should revert if plan is disabled", async function () {
        await savingsBank.connect(admin).enablePlan(1, false);

        await expect(
          savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false)
        ).to.be.revertedWith("SavingsBank: Plan not active");
      });

      it("Should revert if amount below minimum deposit", async function () {
        const belowMin = PLAN_7_DAYS.minDeposit - 1n;

        await expect(
          savingsBank.connect(user1).openDeposit(1, belowMin, false)
        ).to.be.revertedWith("SavingsBank: Below minDeposit");
      });

      it("Should revert if amount exceeds maximum deposit", async function () {
        const aboveMax = PLAN_7_DAYS.maxDeposit + 1n;

        await expect(
          savingsBank.connect(user1).openDeposit(1, aboveMax, false)
        ).to.be.revertedWith("SavingsBank: Above maxDeposit");
      });

      it("Should revert when contract is paused", async function () {
        await savingsBank.connect(admin).pause();

        await expect(
          savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false)
        ).to.be.revertedWithCustomError(savingsBank, "EnforcedPause");
      });
    });
  });

  describe("withdraw()", function () {
    beforeEach(async function () {
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false);
    });

    describe("Success Cases", function () {
      it("Should withdraw successfully at maturity", async function () {
        const depositAmount = ethers.parseUnits("10000", 6);

        await time.increase(30 * 24 * 60 * 60);

        const userBalanceBefore = await usdc.balanceOf(user1.address);

        await savingsBank.connect(user1).withdraw(1);

        const userBalanceAfter = await usdc.balanceOf(user1.address);

        // User should receive principal + interest
        const received = userBalanceAfter - userBalanceBefore;
        expect(received).to.be.gt(depositAmount);

        // Deposit should be marked as WITHDRAWN
        const [, , , , , , status] = await savingsBank.getDepositDetails(1);
        expect(status).to.equal(1); // WITHDRAWN
      });

      it("Should emit Withdrawn event", async function () {
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
    });

    describe("Failure Cases", function () {
      it("Should revert if not yet matured", async function () {
        await time.increase(15 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWith("SavingsBank: Not matured");
      });

      it("Should revert if caller is not owner", async function () {
        await time.increase(30 * 24 * 60 * 60);

        await expect(savingsBank.connect(user2).withdraw(1)).to.be.reverted;
      });

      it("Should revert if already withdrawn", async function () {
        await time.increase(30 * 24 * 60 * 60);

        await savingsBank.connect(user1).withdraw(1);

        await expect(savingsBank.connect(user1).withdraw(1)).to.be.reverted;
      });

      it("Should revert when contract is paused", async function () {
        await time.increase(30 * 24 * 60 * 60);
        await savingsBank.connect(admin).pause();

        await expect(savingsBank.connect(user1).withdraw(1)).to.be.revertedWithCustomError(
          savingsBank,
          "EnforcedPause"
        );
      });
    });
  });

  describe("earlyWithdraw()", function () {
    beforeEach(async function () {
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false);
    });

    describe("Success Cases", function () {
      it("Should early withdraw successfully with penalty", async function () {
        await time.increase(15 * 24 * 60 * 60);

        const userBalanceBefore = await usdc.balanceOf(user1.address);

        await savingsBank.connect(user1).earlyWithdraw(1);

        const userBalanceAfter = await usdc.balanceOf(user1.address);

        // User receives less than principal due to penalty
        const received = userBalanceAfter - userBalanceBefore;
        expect(received).to.be.lt(ethers.parseUnits("10000", 6));

        // Deposit should be marked as EARLY_WITHDRAWN
        const [, , , , , , status] = await savingsBank.getDepositDetails(1);
        expect(status).to.equal(2); // EARLY_WITHDRAWN
      });
    });

    describe("Failure Cases", function () {
      it("Should revert if already matured", async function () {
        await time.increase(31 * 24 * 60 * 60);

        await expect(savingsBank.connect(user1).earlyWithdraw(1)).to.be.revertedWith(
          "SavingsBank: Already matured"
        );
      });

      it("Should revert if not owner", async function () {
        await time.increase(10 * 24 * 60 * 60);

        await expect(savingsBank.connect(user2).earlyWithdraw(1)).to.be.reverted;
      });
    });
  });

  describe("renew()", function () {
    beforeEach(async function () {
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), true);
    });

    it("Should auto renew successfully with locked rate", async function () {
      await time.increase(30 * 24 * 60 * 60);

      await savingsBank.connect(user1).renew(1, false, 0);

      // Old deposit should be RENEWED
      const [, , , , , , oldStatus] = await savingsBank.getDepositDetails(1);
      expect(oldStatus).to.equal(3); // RENEWED

      // New deposit should exist
      const [, newPrincipal, , , , , newStatus] = await savingsBank.getDepositDetails(2);
      expect(newStatus).to.equal(0); // ACTIVE
      expect(newPrincipal).to.be.gt(ethers.parseUnits("10000", 6));
    });

    it("Should revert if not yet matured", async function () {
      await time.increase(15 * 24 * 60 * 60);

      await expect(savingsBank.connect(user1).renew(1, false, 0)).to.be.revertedWith(
        "SavingsBank: Not matured"
      );
    });
  });

  describe("setAutoRenew()", function () {
    beforeEach(async function () {
      await savingsBank.connect(user1).openDeposit(2, ethers.parseUnits("10000", 6), false);
    });

    it("Should enable auto renew", async function () {
      await savingsBank.connect(user1).setAutoRenew(1, true);

      const [, , , , , isAutoRenew] = await savingsBank.getDepositDetails(1);
      expect(isAutoRenew).to.be.true;
    });

    it("Should disable auto renew", async function () {
      await savingsBank.connect(user1).setAutoRenew(1, true);
      await savingsBank.connect(user1).setAutoRenew(1, false);

      const [, , , , , isAutoRenew] = await savingsBank.getDepositDetails(1);
      expect(isAutoRenew).to.be.false;
    });

    it("Should revert if not owner", async function () {
      await expect(savingsBank.connect(user2).setAutoRenew(1, true)).to.be.reverted;
    });
  });

  describe("Admin Functions", function () {
    it("Should create new plan", async function () {
      const tx = await savingsBank.connect(admin).createPlan(
        "Test Plan",
        14,
        ethers.parseUnits("200", 6),
        ethers.parseUnits("20000", 6),
        600,
        300
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return savingsBank.interface.parseLog(log)?.name === "PlanCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });

    it("Should pause and unpause contract", async function () {
      await savingsBank.connect(admin).pause();

      await expect(
        savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false)
      ).to.be.revertedWithCustomError(savingsBank, "EnforcedPause");

      await savingsBank.connect(admin).unpause();

      await expect(savingsBank.connect(user1).openDeposit(1, ethers.parseUnits("1000", 6), false)).to.not.be
        .reverted;
    });
  });
});
