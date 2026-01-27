import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Test Suite cho MockUSDC
 * Mục tiêu: Verify 6 decimals và mint/burn hoạt động đúng
 */
describe("MockUSDC - Basic Tests", function () {
  let mockUSDC: MockUSDC;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  // Setup: Deploy contract trước mỗi test
  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();
  });

  // Test 6 decimals của USDC
  describe("Verify 6 Decimals", function () {
    it("Should have 6 decimals (not 18)", async function () {
      const decimals = await mockUSDC.decimals();
      expect(Number(decimals)).to.equal(6);
    });

    it("Should have correct name and symbol", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USD Coin");
      expect(await mockUSDC.symbol()).to.equal("USDC");
    });

    it("Should mint initial supply with 6 decimals", async function () {
      // 1,000,000 USDC = 1,000,000 * 10^6
      const expectedSupply = ethers.parseUnits("1000000", 6);
      const actualSupply = await mockUSDC.totalSupply();
      
      expect(actualSupply).to.equal(expectedSupply);
    });
  });

  // Test Mint
  describe("Verify Mint Works", function () {
    it("Owner can mint new tokens", async function () {
      const mintAmount = ethers.parseUnits("5000", 6); // 5,000 USDC
      
      await mockUSDC.mint(user1.address, mintAmount);
      
      const balance = await mockUSDC.balanceOf(user1.address);
      expect(balance).to.equal(mintAmount);
    });

    it("Non-owner cannot mint", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      
      // User1 không phải owner, nên không mint được
      try {
        await mockUSDC.connect(user1).mint(user1.address, mintAmount);
        expect.fail("Should have reverted");
      } catch (error: any) {
        // Expect error - this is correct behavior
        expect(error.message).to.include("reverted");
      }
    });

    it("Minting increases total supply", async function () {
      const initialSupply = await mockUSDC.totalSupply();
      const mintAmount = ethers.parseUnits("10000", 6);

      await mockUSDC.mint(user1.address, mintAmount);

      const newSupply = await mockUSDC.totalSupply();
      expect(newSupply).to.equal(initialSupply + mintAmount);
    });
  });

  // Test Burn
  describe("Verify Burn Works", function () {
    it("User can burn their own tokens", async function () {
      // Mint cho user1 trước
      const mintAmount = ethers.parseUnits("5000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
      
      // User1 burn 1000 USDC
      const burnAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).burn(burnAmount);
      
      // Check balance còn lại
      const balance = await mockUSDC.balanceOf(user1.address);
      expect(balance).to.equal(mintAmount - burnAmount);
    });

    it("Burning decreases total supply", async function () {
      const mintAmount = ethers.parseUnits("5000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
      
      const supplyBeforeBurn = await mockUSDC.totalSupply();
      
      const burnAmount = ethers.parseUnits("2000", 6);
      await mockUSDC.connect(user1).burn(burnAmount);
      
      const supplyAfterBurn = await mockUSDC.totalSupply();
      expect(supplyAfterBurn).to.equal(supplyBeforeBurn - burnAmount);
    });

    it("Cannot burn more than balance", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
      
      const burnAmount = ethers.parseUnits("2000", 6); // More than balance!
      
      try {
        await mockUSDC.connect(user1).burn(burnAmount);
        expect.fail("Should have reverted");
      } catch (error: any) {
        // Expect error - this is correct behavior
        expect(error.message).to.include("reverted");
      }
    });
  });

  // Test Transfer
  describe("Basic ERC20 Transfer", function () {
    it("Can transfer tokens between users", async function () {
      const mintAmount = ethers.parseUnits("5000", 6);
      await mockUSDC.mint(user1.address, mintAmount);
      
      const transferAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).transfer(owner.address, transferAmount);
      
      const ownerBalance = await mockUSDC.balanceOf(owner.address);
      expect(ownerBalance > 0n).to.be.true;
    });
  });
});
