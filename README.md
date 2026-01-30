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
### Current Architecture: Immutable Vaults + Orchestrator (TokenVault/InterestVault/NFT)

This repository implements the **new architecture** with strict separation of concerns:

- **TokenVault.sol**: holds **principal** (user deposits) — immutable, simple, auditable
- **InterestVault.sol**: holds **interest liquidity** + collects **penalties** — immutable, simple, auditable
- **SavingsBank.sol**: **business logic only** (no token custody) — orchestrates vault transfers + plan/deposit state
- **(Mock)DepositNFT.sol**: ERC721Enumerable used by SavingsBank for deposit ownership (on Sepolia we deploy `MockDepositNFT`)

```
User approves TokenVault
        │
        ▼
┌──────────────┐        ┌──────────────┐
│  TokenVault  │        │ InterestVault │
│  principal   │        │ interest +    │
│  (custody)   │        │ penalties     │
└──────▲───────┘        └──────▲───────┘
       │ onlyOwner               │ onlyOwner
       └──────────────┬─────────┘
                      ▼
               ┌──────────────┐
               │  SavingsBank │  (logic + state, no token custody)
               └──────▲───────┘
                      │ onlyOwner mint/burn
                      ▼
               ┌──────────────┐
               │ DepositNFT   │ (currently: MockDepositNFT on Sepolia)
               └──────────────┘
```

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
# Deploy all contracts (hardhat-deploy)
npx hardhat deploy --network sepolia

# Sanity check: ownership, balances, plans
npx hardhat run scripts/01_check_deployment.ts --network sepolia
```

---

## 📊 Deployed Contracts

> **Status:** ✅ **LIVE ON SEPOLIA TESTNET** (new architecture)

### Sepolia Testnet
- **MockUSDC**: `0x5f89720026332AC218F3f832dE3b7488222aDE9C`
- **TokenVault**: `0xEF08c572e314e0BAbf781C82B5775EAD68c789d4`
- **InterestVault**: `0xAaa46e0dE3CA6031dDD391da653FCedF5cb32a84`
- **MockDepositNFT**: `0xdD4572634915c7aa789CCD03af9d6dB0Fd61E690`
- **SavingsBank**: `0xbf18558adf6BA008eA2c6924D50e980C998313f0`

📖 See architecture docs in `docs_ver2/`.

---

## 🎮 Usage Example

### For Users

```solidity
// 1. Approve TokenVault (principal is pulled by TokenVault.deposit(from, amount))
mockUSDC.approve(tokenVault, 10000 * 10**6);

// 2. Open a deposit (planId, amount, enableAutoRenew)
uint256 tokenId = savingsBank.openDeposit(2, 10000 * 10**6, false);

// 3. Wait until maturity
// ...

// 4. Withdraw at maturity (tokenId == depositId)
savingsBank.withdraw(tokenId);
```

### For Admins

```solidity
// Create new saving plan
savingsBank.createPlan(
    "90 Days",    // name
    90,           // durationDays
    1000 * 10**6, // min deposit: 1,000 USDC
    0,            // max deposit: (use MaxUint256 in practice for "no limit")
    1000,         // aprBps: 10%
    500           // earlyWithdrawPenaltyBps: 5%
);

// Enable/disable plan
savingsBank.enablePlan(1, true);

// Fund interest vault (requires approval to InterestVault first)
savingsBank.fundVault(100000 * 10**6);
```

---

## 📚 Documentation

- **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)** - Detailed technical specifications and implementation plan
- **[TASKS.md](./docs/TASKS.md)** - Daily task breakdown and progress tracking
- **Walkthrough.md** - Coming soon (deployment guide with screenshots)

---

## 🛡️ Security

### Security Features
- ✅ OpenZeppelin's `Ownable` for admin permissions
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
