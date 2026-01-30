import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * MockUSDC unit tests (localhost).
 * ERC20 with 6 decimals and public mint.
 */
describe("MockUSDC", function () {
  let mockUSDC: MockUSDC;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = (await MockUSDCFactory.deploy()) as MockUSDC;
    await mockUSDC.waitForDeployment();
  });

  it("has 6 decimals and correct name/symbol", async function () {
    expect(await mockUSDC.decimals()).to.equal(6);
    expect(await mockUSDC.name()).to.equal("Mock USDC");
    expect(await mockUSDC.symbol()).to.equal("USDC");
  });

  it("mints tokens to any address", async function () {
    const amount = ethers.parseUnits("1000", 6);
    await mockUSDC.mint(user.address, amount);
    expect(await mockUSDC.balanceOf(user.address)).to.equal(amount);
  });

  it("allows standard ERC20 transfer", async function () {
    const amount = ethers.parseUnits("500", 6);
    await mockUSDC.mint(user.address, amount);

    await mockUSDC.connect(user).transfer(owner.address, amount);

    expect(await mockUSDC.balanceOf(owner.address)).to.equal(amount);
    expect(await mockUSDC.balanceOf(user.address)).to.equal(0);
  });
});

