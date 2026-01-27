import { expect } from "chai";
import { ethers } from "hardhat";
import { VaultManager, MockUSDC } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VaultManager", function () {
  let vaultManager: VaultManager;
  let mockUSDC: MockUSDC;
  let owner: SignerWithAddress;
  let feeReceiver: SignerWithAddress;
  let savingsBank: SignerWithAddress;
  let user1: SignerWithAddress;

  const INITIAL_MINT = ethers.parseUnits("1000000", 6); // 1M USDC
  const MIN_HEALTH_RATIO = 12000; // 120%

  beforeEach(async function () {
    // Get signers
    [owner, feeReceiver, savingsBank, user1] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy VaultManager
    const VaultManagerFactory = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManagerFactory.deploy(
      await mockUSDC.getAddress(),
      feeReceiver.address,
      MIN_HEALTH_RATIO
    );
    await vaultManager.waitForDeployment();

    // Mint tokens to owner
    await mockUSDC.mint(owner.address, INITIAL_MINT);
  });

  describe("Deployment", function () {
    it("Should set the correct deposit token", async function () {
      expect(await vaultManager.depositToken()).to.equal(await mockUSDC.getAddress());
    });

    it("Should set the correct fee receiver", async function () {
      expect(await vaultManager.feeReceiver()).to.equal(feeReceiver.address);
    });

    it("Should set the correct minimum health ratio", async function () {
      expect(await vaultManager.minHealthRatioBps()).to.equal(MIN_HEALTH_RATIO);
    });

    it("Should set the correct owner", async function () {
      expect(await vaultManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero balances", async function () {
      expect(await vaultManager.totalBalance()).to.equal(0);
      expect(await vaultManager.reservedFunds()).to.equal(0);
    });

    it("Should revert if deposit token is zero address", async function () {
      const VaultManagerFactory = await ethers.getContractFactory("VaultManager");
      await expect(
        VaultManagerFactory.deploy(ethers.ZeroAddress, feeReceiver.address, MIN_HEALTH_RATIO)
      ).to.be.revertedWith("Invalid deposit token");
    });

    it("Should revert if fee receiver is zero address", async function () {
      const VaultManagerFactory = await ethers.getContractFactory("VaultManager");
      await expect(
        VaultManagerFactory.deploy(await mockUSDC.getAddress(), ethers.ZeroAddress, MIN_HEALTH_RATIO)
      ).to.be.revertedWith("Invalid fee receiver");
    });

    it("Should revert if health ratio is less than 100%", async function () {
      const VaultManagerFactory = await ethers.getContractFactory("VaultManager");
      await expect(
        VaultManagerFactory.deploy(await mockUSDC.getAddress(), feeReceiver.address, 9000) // 90%
      ).to.be.revertedWith("Health ratio must be >= 100%");
    });
  });

  describe("setSavingsBank", function () {
    it("Should allow owner to set SavingsBank address", async function () {
      await expect(vaultManager.setSavingsBank(savingsBank.address))
        .to.emit(vaultManager, "SavingsBankUpdated")
        .withArgs(ethers.ZeroAddress, savingsBank.address);

      expect(await vaultManager.savingsBank()).to.equal(savingsBank.address);
    });

    it("Should revert if non-owner tries to set SavingsBank", async function () {
      await expect(
        vaultManager.connect(user1).setSavingsBank(savingsBank.address)
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });

    it("Should revert if SavingsBank address is zero", async function () {
      await expect(
        vaultManager.setSavingsBank(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid SavingsBank address");
    });

    it("Should revert if trying to set SavingsBank twice", async function () {
      await vaultManager.setSavingsBank(savingsBank.address);

      await expect(
        vaultManager.setSavingsBank(user1.address)
      ).to.be.revertedWith("SavingsBank already set");
    });
  });

  describe("fundVault", function () {
    const FUND_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC

    it("Should allow owner to fund vault", async function () {
      await mockUSDC.approve(await vaultManager.getAddress(), FUND_AMOUNT);

      await expect(vaultManager.fundVault(FUND_AMOUNT))
        .to.emit(vaultManager, "VaultFunded")
        .withArgs(owner.address, FUND_AMOUNT, FUND_AMOUNT);

      expect(await vaultManager.totalBalance()).to.equal(FUND_AMOUNT);
      expect(await mockUSDC.balanceOf(await vaultManager.getAddress())).to.equal(FUND_AMOUNT);
    });

    it("Should revert if non-owner tries to fund vault", async function () {
      await mockUSDC.mint(user1.address, FUND_AMOUNT);
      await mockUSDC.connect(user1).approve(await vaultManager.getAddress(), FUND_AMOUNT);

      await expect(
        vaultManager.connect(user1).fundVault(FUND_AMOUNT)
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });

    it("Should revert if amount is zero", async function () {
      await expect(vaultManager.fundVault(0)).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert when paused", async function () {
      await vaultManager.pause();

      await mockUSDC.approve(await vaultManager.getAddress(), FUND_AMOUNT);

      await expect(vaultManager.fundVault(FUND_AMOUNT)).to.be.revertedWithCustomError(
        vaultManager,
        "EnforcedPause"
      );
    });
  });

  describe("withdrawVault", function () {
    const FUND_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC
    const WITHDRAW_AMOUNT = ethers.parseUnits("50000", 6); // 50k USDC

    beforeEach(async function () {
      // Fund the vault first
      await mockUSDC.approve(await vaultManager.getAddress(), FUND_AMOUNT);
      await vaultManager.fundVault(FUND_AMOUNT);
    });

    it("Should allow owner to withdraw from vault", async function () {
      const ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);

      await expect(vaultManager.withdrawVault(WITHDRAW_AMOUNT))
        .to.emit(vaultManager, "VaultWithdrawn")
        .withArgs(owner.address, WITHDRAW_AMOUNT, FUND_AMOUNT - WITHDRAW_AMOUNT);

      expect(await vaultManager.totalBalance()).to.equal(FUND_AMOUNT - WITHDRAW_AMOUNT);
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(
        ownerBalanceBefore + WITHDRAW_AMOUNT
      );
    });

    it("Should revert if non-owner tries to withdraw", async function () {
      await expect(
        vaultManager.connect(user1).withdrawVault(WITHDRAW_AMOUNT)
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });

    it("Should revert if amount is zero", async function () {
      await expect(vaultManager.withdrawVault(0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });

    it("Should revert if trying to withdraw more than available funds", async function () {
      // Set SavingsBank
      await vaultManager.setSavingsBank(savingsBank.address);

      // Reserve some funds
      const RESERVE_AMOUNT = ethers.parseUnits("80000", 6); // 80k USDC
      await vaultManager.connect(savingsBank).reserveFunds(RESERVE_AMOUNT);

      // Try to withdraw more than available (only 20k available)
      const OVER_WITHDRAW = ethers.parseUnits("30000", 6);
      await expect(vaultManager.withdrawVault(OVER_WITHDRAW)).to.be.revertedWith(
        "Insufficient available funds"
      );
    });

    it("Should emit VaultHealthLow event if health drops below threshold", async function () {
      // Set SavingsBank
      await vaultManager.setSavingsBank(savingsBank.address);

      // Reserve funds to make health ratio marginal
      const RESERVE_AMOUNT = ethers.parseUnits("85000", 6); // 85k reserved, 15k available
      await vaultManager.connect(savingsBank).reserveFunds(RESERVE_AMOUNT);

      // Withdraw to drop health below 120%
      const WITHDRAW_AMOUNT_HEALTH = ethers.parseUnits("5000", 6);
      
      await expect(vaultManager.withdrawVault(WITHDRAW_AMOUNT_HEALTH))
        .to.emit(vaultManager, "VaultHealthLow");
    });
  });

  describe("setFeeReceiver", function () {
    it("Should allow owner to update fee receiver", async function () {
      const newFeeReceiver = user1.address;

      await expect(vaultManager.setFeeReceiver(newFeeReceiver))
        .to.emit(vaultManager, "FeeReceiverUpdated")
        .withArgs(feeReceiver.address, newFeeReceiver);

      expect(await vaultManager.feeReceiver()).to.equal(newFeeReceiver);
    });

    it("Should revert if non-owner tries to update fee receiver", async function () {
      await expect(
        vaultManager.connect(user1).setFeeReceiver(user1.address)
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });

    it("Should revert if new fee receiver is zero address", async function () {
      await expect(vaultManager.setFeeReceiver(ethers.ZeroAddress)).to.be.revertedWith(
        "Invalid fee receiver"
      );
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow owner to pause", async function () {
      await vaultManager.pause();
      expect(await vaultManager.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      await vaultManager.pause();
      await vaultManager.unpause();
      expect(await vaultManager.paused()).to.be.false;
    });

    it("Should revert if non-owner tries to pause", async function () {
      await expect(
        vaultManager.connect(user1).pause()
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });

    it("Should revert if non-owner tries to unpause", async function () {
      await vaultManager.pause();
      await expect(
        vaultManager.connect(user1).unpause()
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("SavingsBank Functions", function () {
    const FUND_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC
    const RESERVE_AMOUNT = ethers.parseUnits("50000", 6); // 50k USDC

    beforeEach(async function () {
      // Set SavingsBank
      await vaultManager.setSavingsBank(savingsBank.address);

      // Fund the vault
      await mockUSDC.approve(await vaultManager.getAddress(), FUND_AMOUNT);
      await vaultManager.fundVault(FUND_AMOUNT);
    });

    describe("reserveFunds", function () {
      it("Should allow SavingsBank to reserve funds", async function () {
        await expect(vaultManager.connect(savingsBank).reserveFunds(RESERVE_AMOUNT))
          .to.emit(vaultManager, "FundsReserved")
          .withArgs(RESERVE_AMOUNT, RESERVE_AMOUNT);

        expect(await vaultManager.reservedFunds()).to.equal(RESERVE_AMOUNT);
      });

      it("Should revert if non-SavingsBank tries to reserve", async function () {
        await expect(
          vaultManager.connect(user1).reserveFunds(RESERVE_AMOUNT)
        ).to.be.revertedWith("Only SavingsBank can call");
      });

      it("Should revert if amount is zero", async function () {
        await expect(
          vaultManager.connect(savingsBank).reserveFunds(0)
        ).to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should revert if trying to reserve more than available", async function () {
        const OVER_RESERVE = ethers.parseUnits("150000", 6); // More than balance
        await expect(
          vaultManager.connect(savingsBank).reserveFunds(OVER_RESERVE)
        ).to.be.revertedWith("Insufficient available funds");
      });

      it("Should revert when paused", async function () {
        await vaultManager.pause();

        await expect(
          vaultManager.connect(savingsBank).reserveFunds(RESERVE_AMOUNT)
        ).to.be.revertedWithCustomError(vaultManager, "EnforcedPause");
      });
    });

    describe("releaseFunds", function () {
      beforeEach(async function () {
        // Reserve some funds first
        await vaultManager.connect(savingsBank).reserveFunds(RESERVE_AMOUNT);
      });

      it("Should allow SavingsBank to release funds", async function () {
        const RELEASE_AMOUNT = ethers.parseUnits("20000", 6);

        await expect(vaultManager.connect(savingsBank).releaseFunds(RELEASE_AMOUNT))
          .to.emit(vaultManager, "FundsReleased")
          .withArgs(RELEASE_AMOUNT, RESERVE_AMOUNT - RELEASE_AMOUNT);

        expect(await vaultManager.reservedFunds()).to.equal(RESERVE_AMOUNT - RELEASE_AMOUNT);
      });

      it("Should revert if non-SavingsBank tries to release", async function () {
        await expect(
          vaultManager.connect(user1).releaseFunds(RESERVE_AMOUNT)
        ).to.be.revertedWith("Only SavingsBank can call");
      });

      it("Should revert if amount is zero", async function () {
        await expect(vaultManager.connect(savingsBank).releaseFunds(0)).to.be.revertedWith(
          "Amount must be greater than 0"
        );
      });

      it("Should revert if trying to release more than reserved", async function () {
        const OVER_RELEASE = ethers.parseUnits("60000", 6);
        await expect(
          vaultManager.connect(savingsBank).releaseFunds(OVER_RELEASE)
        ).to.be.revertedWith("Amount exceeds reserved funds");
      });
    });

    describe("transferOut", function () {
      it("Should allow SavingsBank to transfer out", async function () {
        const TRANSFER_AMOUNT = ethers.parseUnits("10000", 6);
        const recipientBalanceBefore = await mockUSDC.balanceOf(user1.address);

        await vaultManager.connect(savingsBank).transferOut(user1.address, TRANSFER_AMOUNT);

        expect(await mockUSDC.balanceOf(user1.address)).to.equal(
          recipientBalanceBefore + TRANSFER_AMOUNT
        );
        expect(await vaultManager.totalBalance()).to.equal(FUND_AMOUNT - TRANSFER_AMOUNT);
      });

      it("Should revert if non-SavingsBank tries to transfer out", async function () {
        await expect(
          vaultManager.connect(user1).transferOut(user1.address, 1000)
        ).to.be.revertedWith("Only SavingsBank can call");
      });

      it("Should revert if recipient is zero address", async function () {
        await expect(
          vaultManager.connect(savingsBank).transferOut(ethers.ZeroAddress, 1000)
        ).to.be.revertedWith("Invalid recipient");
      });

      it("Should revert if amount is zero", async function () {
        await expect(
          vaultManager.connect(savingsBank).transferOut(user1.address, 0)
        ).to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should revert if insufficient balance", async function () {
        const OVER_TRANSFER = ethers.parseUnits("150000", 6);
        await expect(
          vaultManager.connect(savingsBank).transferOut(user1.address, OVER_TRANSFER)
        ).to.be.revertedWith("Insufficient balance");
      });
    });

    describe("transferIn", function () {
      it("Should allow SavingsBank to transfer in", async function () {
        const TRANSFER_AMOUNT = ethers.parseUnits("10000", 6);

        // Mint tokens to user1 and approve
        await mockUSDC.mint(user1.address, TRANSFER_AMOUNT);
        await mockUSDC.connect(user1).approve(await vaultManager.getAddress(), TRANSFER_AMOUNT);

        await vaultManager.connect(savingsBank).transferIn(user1.address, TRANSFER_AMOUNT);

        expect(await vaultManager.totalBalance()).to.equal(FUND_AMOUNT + TRANSFER_AMOUNT);
      });

      it("Should revert if non-SavingsBank tries to transfer in", async function () {
        await expect(
          vaultManager.connect(user1).transferIn(user1.address, 1000)
        ).to.be.revertedWith("Only SavingsBank can call");
      });

      it("Should revert if sender is zero address", async function () {
        await expect(
          vaultManager.connect(savingsBank).transferIn(ethers.ZeroAddress, 1000)
        ).to.be.revertedWith("Invalid sender");
      });

      it("Should revert if amount is zero", async function () {
        await expect(
          vaultManager.connect(savingsBank).transferIn(user1.address, 0)
        ).to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should revert when paused", async function () {
        await vaultManager.pause();

        const TRANSFER_AMOUNT = ethers.parseUnits("10000", 6);
        await mockUSDC.mint(user1.address, TRANSFER_AMOUNT);
        await mockUSDC.connect(user1).approve(await vaultManager.getAddress(), TRANSFER_AMOUNT);

        await expect(
          vaultManager.connect(savingsBank).transferIn(user1.address, TRANSFER_AMOUNT)
        ).to.be.revertedWithCustomError(vaultManager, "EnforcedPause");
      });
    });
  });

  describe("View Functions", function () {
    const FUND_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC
    const RESERVE_AMOUNT = ethers.parseUnits("40000", 6); // 40k USDC

    beforeEach(async function () {
      await vaultManager.setSavingsBank(savingsBank.address);
      await mockUSDC.approve(await vaultManager.getAddress(), FUND_AMOUNT);
      await vaultManager.fundVault(FUND_AMOUNT);
      await vaultManager.connect(savingsBank).reserveFunds(RESERVE_AMOUNT);
    });

    describe("getAvailableFunds", function () {
      it("Should return correct available funds", async function () {
        const available = await vaultManager.getAvailableFunds();
        expect(available).to.equal(FUND_AMOUNT - RESERVE_AMOUNT);
      });

      it("Should return 0 when all funds are reserved", async function () {
        await vaultManager
          .connect(savingsBank)
          .reserveFunds(FUND_AMOUNT - RESERVE_AMOUNT);
        expect(await vaultManager.getAvailableFunds()).to.equal(0);
      });
    });

    describe("getVaultHealthRatio", function () {
      it("Should return correct health ratio", async function () {
        const healthRatio = await vaultManager.getVaultHealthRatio();
        // 100k / 40k = 2.5 = 250% = 25000 bps
        expect(healthRatio).to.equal(25000);
      });

      it("Should return max uint256 when no reserves", async function () {
        await vaultManager.connect(savingsBank).releaseFunds(RESERVE_AMOUNT);
        const healthRatio = await vaultManager.getVaultHealthRatio();
        expect(healthRatio).to.equal(ethers.MaxUint256);
      });
    });

    describe("isVaultHealthy", function () {
      it("Should return true when health is above threshold", async function () {
        expect(await vaultManager.isVaultHealthy()).to.be.true;
      });

      it("Should return false when health is below threshold", async function () {
        // Reserve more to drop health below 120%
        const ADDITIONAL_RESERVE = ethers.parseUnits("45000", 6);
        await vaultManager.connect(savingsBank).reserveFunds(ADDITIONAL_RESERVE);

        // Now: 100k / 85k = 1.176 = 117.6% < 120%
        expect(await vaultManager.isVaultHealthy()).to.be.false;
      });
    });

    describe("getVaultInfo", function () {
      it("Should return correct vault info", async function () {
        const info = await vaultManager.getVaultInfo();

        expect(info[0]).to.equal(FUND_AMOUNT); // totalBalance
        expect(info[1]).to.equal(RESERVE_AMOUNT); // reserved
        expect(info[2]).to.equal(FUND_AMOUNT - RESERVE_AMOUNT); // available
        expect(info[3]).to.equal(25000); // healthRatio (250%)
        expect(info[4]).to.be.true; // isHealthy
      });
    });
  });

  describe("Emergency Functions", function () {
    const FUND_AMOUNT = ethers.parseUnits("100000", 6);

    beforeEach(async function () {
      await mockUSDC.approve(await vaultManager.getAddress(), FUND_AMOUNT);
      await vaultManager.fundVault(FUND_AMOUNT);
    });

    it("Should allow emergency withdraw when paused", async function () {
      await vaultManager.pause();

      const ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);

      await vaultManager.emergencyWithdraw();

      expect(await mockUSDC.balanceOf(owner.address)).to.equal(
        ownerBalanceBefore + FUND_AMOUNT
      );
      expect(await vaultManager.totalBalance()).to.equal(0);
      expect(await vaultManager.reservedFunds()).to.equal(0);
    });

    it("Should revert emergency withdraw when not paused", async function () {
      await expect(vaultManager.emergencyWithdraw()).to.be.revertedWithCustomError(
        vaultManager,
        "ExpectedPause"
      );
    });

    it("Should revert if non-owner tries emergency withdraw", async function () {
      await vaultManager.pause();

      await expect(
        vaultManager.connect(user1).emergencyWithdraw()
      ).to.be.revertedWithCustomError(vaultManager, "OwnableUnauthorizedAccount");
    });
  });
});
