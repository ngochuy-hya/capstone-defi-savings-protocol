# 🏦 DeFi Savings Protocol

> **Capstone Project - Blockchain Development Internship**  
> **Author:** Nguyễn Ngọc Huy - AppsCyclone  
> **Timeline:** January 26-30, 2025

A decentralized savings protocol that brings traditional banking savings experience to blockchain - allowing users to open deposit certificates with fixed terms, earn interest, and manage their savings on-chain.

---

## 📋 Overview

**DeFi Savings Protocol** is a smart contract system that mimics traditional bank savings accounts:

- 💰 **Open Savings Deposits** - Choose from multiple saving plans (7/30/90/180 days)
- 📈 **Earn Interest** - Get simple interest calculated based on APR and tenor
- 🔄 **Flexible Withdrawal** - Withdraw at maturity or early (with penalty)
- ♻️ **Renew/Rollover** - Automatically reinvest principal + interest to new term
- 🎫 **NFT-like Certificates** - Each deposit is a unique certificate with transferable ownership

### Key Features

- ✅ Multiple saving plans with different APR rates
- ✅ Simple interest calculation (like traditional banks)
- ✅ Early withdrawal with configurable penalty
- ✅ Deposit renewal/rollover functionality
- ✅ Admin-managed liquidity vault for interest payments
- ✅ Access control and emergency pause mechanism
- ✅ ReentrancyGuard protection

---

## 🏗️ Architecture

### Method 2: Separated Principal & Interest 🎯

This protocol implements a **production-grade architecture** with clear separation between user funds and protocol obligations:

```
┌─────────────────────────────────────────────────────────────┐
│                  METHOD 2 ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐          ┌────────────────────┐    │
│  │   SavingsBank      │          │   VaultManager     │    │
│  │                    │          │                    │    │
│  │  Holds:            │          │  Holds:            │    │
│  │  ✓ User Principal  │          │  ✓ Interest Pool   │    │
│  │  ✓ User Deposits   │          │  ✓ Reserved Funds  │    │
│  └────────────────────┘          └────────────────────┘    │
│           │                                │                │
│           ▼                                ▼                │
│    User Principal                  Interest Payments       │
│    (Customer Assets)               (Protocol Obligation)   │
└─────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- 🔒 **User principal protected** - Held separately in SavingsBank
- 💰 **Capital efficient** - VaultManager only needs ~2-10% of TVL for interest
- 📊 **Clear accounting** - Easy to audit and verify solvency
- 🛡️ **Regulatory friendly** - Clear segregation of customer funds

### Smart Contracts

#### **SavingsBank.sol** (Main Contract)
Core contract handling all savings operations:
- 👤 **User deposits** - Holds all principal (customer funds)
- 📋 **Plan management** - Admin creates/updates saving plans
- 🎫 **ERC721 Integration** - Deposit certificates as transferrable NFTs
- 💵 **Withdraw logic** - Principal from SavingsBank, interest from VaultManager
- ♻️ **Renewal** - Interest compounds into principal

#### **VaultManager.sol** (Interest Pool Manager)
Manages protocol liquidity for interest payments:
- 💰 **Interest reserves** - Reserve funds for expected interest
- 🏦 **Liquidity pool** - Admin funds vault for interest payments
- 📊 **Health monitoring** - Track vault solvency (120% minimum ratio)
- 🔐 **Access control** - Only SavingsBank can reserve/release/transfer

#### **InterestCalculator.sol** (Library)
Pure functions for interest calculations:
- 📈 Simple interest formula
- ⏱️ Pro-rata interest for early withdrawal
- 💸 Penalty calculations
- 📊 Maturity estimations

#### **MockUSDC.sol** (Test Token)
ERC20 token with 6 decimals for testing (mimics real USDC)

### Core Concepts

```
Traditional Banking          →    Blockchain Implementation
─────────────────────────────────────────────────────────────
Saving Plans                 →    Struct with tenor/APR config
Deposit Certificates         →    ERC721 NFT with unique ID
Interest Payment             →    Simple interest from VaultManager
Principal Storage            →    Held in SavingsBank contract
Bank Manager                 →    Admin role with AccessControl
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v16+ and Yarn
- Hardhat development environment
- MetaMask or similar Web3 wallet

### Installation

```bash
# Clone repository
git clone <repository-url>
cd capstone-defi-savings-protocol

# Install dependencies
yarn install

# Copy environment file
cp .env_example .env
# Fill in your private keys and RPC URLs
```

### Compile Contracts

```bash
yarn hardhat compile
```

### Run Tests

```bash
# Run all tests
yarn test

# Run with gas reporting
REPORT_GAS=1 yarn test

# Check coverage
yarn hardhat coverage
```

### Deploy to Testnet

```bash
# Deploy to Sepolia (all contracts)
npx hardhat run scripts/deploy_sepolia.ts --network sepolia

# Verify contracts on Etherscan
npx hardhat verify --network sepolia 0xC62464eaD63c27aE68B296522837e923f856fe05
npx hardhat verify --network sepolia 0x870d756E4Ec6745C24CE3DAD776cC53ddB51ae62 "0xC62464eaD63c27aE68B296522837e923f856fe05" "0x7Fd5E1B5954B00027cA0C2FC152449411089BF1d" 12000
npx hardhat verify --network sepolia 0xB95742736EDeE68c9cb3F9a44D3F04D96F40d7d4 "0xC62464eaD63c27aE68B296522837e923f856fe05" "0x870d756E4Ec6745C24CE3DAD776cC53ddB51ae62" "0x7Fd5E1B5954B00027cA0C2FC152449411089BF1d" "0x7Fd5E1B5954B00027cA0C2FC152449411089BF1d"
```

---

## 📊 Deployed Contracts

> **Status:** ✅ **LIVE ON SEPOLIA TESTNET** - All contracts deployed and verified!

### Sepolia Testnet
- **MockUSDC**: [`0xC62464eaD63c27aE68B296522837e923f856fe05`](https://sepolia.etherscan.io/address/0xC62464eaD63c27aE68B296522837e923f856fe05#code)
- **VaultManager**: [`0x870d756E4Ec6745C24CE3DAD776cC53ddB51ae62`](https://sepolia.etherscan.io/address/0x870d756E4Ec6745C24CE3DAD776cC53ddB51ae62#code)
- **SavingsBank**: [`0xB95742736EDeE68c9cb3F9a44D3F04D96F40d7d4`](https://sepolia.etherscan.io/address/0xB95742736EDeE68c9cb3F9a44D3F04D96F40d7d4#code)

📖 **[View Full Deployment Details](./docs/SEPOLIA_DEPLOYMENT.md)**

---

## 🎮 Usage Example

### For Users

```solidity
// 1. Approve USDC spending
mockUSDC.approve(savingsBank, 10000 * 10**6);

// 2. Open a 30-day deposit with 10,000 USDC
uint256 depositId = savingsBank.openDeposit(1, 10000 * 10**6);

// 3. Wait until maturity (30 days)
// ...

// 4. Withdraw principal + interest
savingsBank.withdraw(depositId);
// Receives: 10,000 USDC + ~65.75 USDC interest (8% APR)
```

### For Admins

```solidity
// Create new saving plan: 90 days, 10% APR
savingsBank.createPlan(
    90 days,      // tenor
    1000,         // 10% APR in basis points
    1000 * 10**6, // min deposit: 1,000 USDC
    0,            // max deposit: unlimited
    500           // early penalty: 5%
);

// Fund vault to ensure liquidity for interest payments
savingsBank.fundVault(100000 * 10**6); // 100k USDC
```

---

## 📚 Documentation

- **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)** - Detailed technical specifications and implementation plan
- **[TASKS.md](./docs/TASKS.md)** - Daily task breakdown and progress tracking
- **Walkthrough.md** - Coming soon (deployment guide with screenshots)

---

## 🛡️ Security

### Security Features
- ✅ OpenZeppelin's `AccessControl` for role-based permissions
- ✅ OpenZeppelin's `ReentrancyGuard` to prevent reentrancy attacks
- ✅ OpenZeppelin's `Pausable` for emergency stops
- ✅ Input validation on all public functions
- ✅ Safe math operations (Solidity 0.8+)

### Security Audit
- 🔍 Self-audit checklist completed
- 🔍 Slither static analysis planned
- ⚠️ **Note**: This is a capstone project and has NOT been professionally audited. DO NOT use in production with real funds.

---

## 🧪 Testing

Comprehensive test suite covering:
- ✅ Plan management (create, update, enable/disable)
- ✅ Deposit lifecycle (open, withdraw, early withdraw, renew)
- ✅ Interest calculation accuracy
- ✅ Access control and permissions
- ✅ Edge cases and error scenarios
- ✅ Multi-user concurrent operations

**Target Coverage:** ≥ 95%

---

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity ^0.8.20
- **Framework**: Hardhat
- **Testing**: Hardhat + Ethers.js
- **Libraries**: OpenZeppelin Contracts v5
- **Network**: Ethereum Sepolia Testnet
- **Token Standard**: ERC20 (USDC), ERC721-like deposits

---

## 📝 License

This project is for educational purposes as part of a blockchain development internship capstone project.

---

## 👨‍💻 Author

**Nguyễn Ngọc Huy**  
Blockchain Development Intern - AppsCyclone  
Capstone Project - January 2025

---

## 🙏 Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Hardhat team for excellent development tools
- AppsCyclone for internship opportunity and guidance

---

> **Project Status:** ✅ Blockchain Complete - Ready for Frontend Integration  
> **Last Updated:** January 29, 2026
