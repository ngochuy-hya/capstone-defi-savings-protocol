# Sepolia Testnet Deployment Guide

Complete guide for deploying and testing DeFi Savings Protocol on Sepolia testnet.

---

## 📋 Prerequisites Checklist

### ✅ 1. Environment Setup

- [x] Node.js and Yarn installed
- [x] `.env` file configured with:
  - [x] `TESTNET_PRIVATE_KEY` - Your Sepolia wallet private key
  - [x] `ETHERSCAN_API_KEY` - For contract verification
- [ ] Sepolia ETH in deployer wallet (minimum 0.5 ETH recommended)

### ✅ 2. Get Sepolia ETH

**Faucets (choose one):**

1. **Alchemy Sepolia Faucet** (Recommended)
   - URL: https://sepoliafaucet.com/
   - Requires: Alchemy account
   - Amount: 0.5 ETH/day

2. **Infura Sepolia Faucet**
   - URL: https://www.infura.io/faucet/sepolia
   - Requires: Infura account
   - Amount: 0.5 ETH/day

3. **QuickNode Faucet**
   - URL: https://faucet.quicknode.com/ethereum/sepolia
   - No account required
   - Amount: 0.1 ETH

**Your Deployer Address:**
```bash
# Get your address from private key
npx hardhat console --network sepolia
> const [deployer] = await ethers.getSigners()
> deployer.address
```

### ✅ 3. Check Balance

```bash
npx hardhat run scripts/helpers/check_balance.ts --network sepolia
```

Expected output:
```
Deployer: 0x...
Balance: 0.5 ETH ✅
Status: Ready to deploy
```

---

## 🚀 Deployment Steps

### Step 1: Deploy All Contracts

```bash
# Deploy MockUSDC + SavingsBank + Create Plans + Fund Vault
npx hardhat run scripts/deploy_all.ts --network sepolia
```

**Expected Output:**
```
✅ MockUSDC deployed: 0x...
✅ SavingsBank deployed: 0x...
✅ Plans Created: 4
✅ Vault funded: 100000.0 USDC
💾 Deployment saved to: deployment-11155111-{timestamp}.json
```

**Deployment Time:** ~2-3 minutes (6 transactions)

**Gas Cost:** ~0.02-0.03 ETH

---

### Step 2: Verify Contracts on Etherscan

#### Verify MockUSDC

```bash
npx hardhat verify --network sepolia <MOCKUSDC_ADDRESS>
```

#### Verify SavingsBank

```bash
npx hardhat verify --network sepolia <SAVINGSBANK_ADDRESS> \
  <USDC_ADDRESS> \
  <FEE_RECEIVER> \
  <ADMIN_ADDRESS>
```

**Example:**
```bash
npx hardhat verify --network sepolia 0x123... \
  0x456... \
  0x789... \
  0x789...
```

**Expected Output:**
```
Successfully verified contract SavingsBank on Etherscan.
https://sepolia.etherscan.io/address/0x...#code
```

---

### Step 3: Update .env with Deployed Addresses

```bash
# Add to .env
USDC_ADDRESS=0x...
SAVINGS_BANK_ADDRESS=0x...
```

---

### Step 4: Verify Deployment Health

```bash
SAVINGS_BANK_ADDRESS=<your_address> \
npx hardhat run scripts/helpers/verify_deployment.ts --network sepolia
```

**Expected Checks:**
- ✅ Contract exists
- ✅ ERC721 properties correct
- ✅ 4 saving plans created
- ✅ Vault funded: 100,000 USDC
- ✅ Contract active (not paused)

---

## 🧪 Manual Testing

### Test 1: Open Deposit

```bash
npx hardhat run scripts/helpers/manual_test.ts --network sepolia
```

Or use Hardhat console:

```javascript
// Connect to Sepolia
npx hardhat console --network sepolia

// Get contracts
const savingsBank = await ethers.getContractAt("SavingsBank", "<address>")
const usdc = await ethers.getContractAt("MockUSDC", "<address>")

// Check balance
const balance = await usdc.balanceOf((await ethers.getSigners())[0].address)
console.log("USDC balance:", ethers.formatUnits(balance, 6))

// Mint more USDC if needed (MockUSDC only)
await usdc.mint((await ethers.getSigners())[0].address, ethers.parseUnits("10000", 6))

// Approve USDC
await usdc.approve(await savingsBank.getAddress(), ethers.parseUnits("1000", 6))

// Open deposit
await savingsBank.openDeposit(1, ethers.parseUnits("1000", 6), false)

// Get deposit info
const deposit = await savingsBank.getDeposit(1)
console.log("Deposit:", deposit)
```

---

### Test 2: Calculate Interest

```javascript
// After opening deposit (ID 1)
const interest = await savingsBank.calculateInterest(1)
console.log("Current interest:", ethers.formatUnits(interest, 6), "USDC")
```

---

### Test 3: Early Withdraw

```javascript
// Early withdraw with penalty
await savingsBank.earlyWithdraw(1)

// Check status
const deposit = await savingsBank.getDeposit(1)
console.log("Status:", deposit.status) // Should be 1 (WITHDRAWN)
```

---

### Test 4: NFT Transfer

```javascript
// Transfer NFT to another address
const [deployer, user2] = await ethers.getSigners()
await savingsBank.transferFrom(deployer.address, user2.address, 1)

// Verify new owner
const newOwner = await savingsBank.ownerOf(1)
console.log("New owner:", newOwner)
```

---

### Test 5: Full Withdrawal at Maturity

```javascript
// Open new deposit
await usdc.approve(await savingsBank.getAddress(), ethers.parseUnits("1000", 6))
await savingsBank.openDeposit(1, ethers.parseUnits("1000", 6), false) // Plan 1 = 7 days

// Wait 7 days on testnet (real time)
// After 7 days:
await savingsBank.withdraw(2) // depositId 2

// Verify received amount
const balance = await usdc.balanceOf(deployer.address)
console.log("Balance:", ethers.formatUnits(balance, 6))
```

---

### Test 6: Auto Renew

```javascript
// Open deposit with auto-renew enabled
await usdc.approve(await savingsBank.getAddress(), ethers.parseUnits("1000", 6))
await savingsBank.openDeposit(1, ethers.parseUnits("1000", 6), true) // true = auto-renew

// Check auto-renew status
const deposit = await savingsBank.getDeposit(3)
console.log("Auto-renew enabled:", deposit.isAutoRenewEnabled)

// After maturity (7 days), renew
await savingsBank.renew(3, false) // false = use locked rate

// Verify new deposit created
const newDeposit = await savingsBank.getDeposit(4)
console.log("New deposit:", newDeposit)
```

---

## 🔍 Verification Checklist

### Contract Verification

- [ ] MockUSDC verified on Etherscan
- [ ] SavingsBank verified on Etherscan
- [ ] Can read contract on Etherscan UI
- [ ] Can interact with contract on Etherscan

### Functional Verification

- [ ] Can open deposit successfully
- [ ] Interest calculation works
- [ ] Can withdraw at maturity
- [ ] Can early withdraw with penalty
- [ ] NFT minting works
- [ ] NFT transfer updates owner
- [ ] Auto-renew logic works
- [ ] Manual renew works
- [ ] Admin functions work (pause, create plan)

### Edge Cases

- [ ] Minimum deposit works
- [ ] Maximum deposit enforced
- [ ] Cannot withdraw before maturity (unless early)
- [ ] Cannot withdraw twice
- [ ] Vault liquidity check works

---

## 📊 View Contract on Sepolia Etherscan

### MockUSDC
- Address: `<will be filled after deployment>`
- URL: https://sepolia.etherscan.io/address/<MOCKUSDC_ADDRESS>

### SavingsBank
- Address: `<will be filled after deployment>`
- URL: https://sepolia.etherscan.io/address/<SAVINGSBANK_ADDRESS>
- Read Contract: View all public getters
- Write Contract: Interact with functions (requires wallet connection)

---

## 🎯 Testing Scenarios

### Scenario 1: Normal User Journey

1. **User deposits 1,000 USDC for 7 days**
   - Expected: Deposit opens, NFT minted
2. **Wait 7 days**
   - Expected: Maturity reached
3. **User withdraws**
   - Expected: Receives ~1,000.96 USDC (1,000 + 5% APR × 7/365)

### Scenario 2: Early Withdrawal

1. **User deposits 1,000 USDC for 30 days**
2. **Withdraws after 15 days**
   - Expected: Pro-rata interest - 5% penalty
   - Interest: ~1000 × 8% × 15/365 = 3.29 USDC
   - Penalty: ~1000 × 5% = 50 USDC
   - Net: 1000 + 3.29 - 50 = ~953 USDC

### Scenario 3: NFT Trading

1. **User A deposits 1,000 USDC**
2. **User A transfers NFT to User B**
3. **User B withdraws at maturity**
   - Expected: User B receives principal + interest

### Scenario 4: Auto Renew

1. **User deposits with auto-renew enabled**
2. **At maturity, calls renew(depositId, false)**
3. **New deposit created with same rate**
   - Expected: Principal + interest → new deposit
   - Locked rate preserved

---

## 🔧 Troubleshooting

### Issue: Insufficient ETH

**Solution:**
- Get more Sepolia ETH from faucets
- Check balance: `ethers.provider.getBalance(address)`

### Issue: Transaction Reverted

**Solution:**
- Check revert reason in Etherscan
- Ensure USDC approved before deposit
- Ensure deposit hasn't matured for early withdraw
- Ensure deposit has matured for normal withdraw

### Issue: Contract Not Verified

**Solution:**
```bash
# Try manual verification with constructor args
npx hardhat verify --network sepolia <address> --constructor-args arguments.js
```

Create `arguments.js`:
```javascript
module.exports = [
  "0x...", // usdc
  "0x...", // feeReceiver
  "0x..."  // admin
];
```

### Issue: Cannot Read Contract on Etherscan

**Solution:**
- Wait 1-2 minutes after deployment
- Refresh Etherscan page
- Try verification again

---

## 📝 Save Deployment Info

After successful deployment, update `deployments/sepolia-deployment.json`:

```json
{
  "network": "sepolia",
  "chainId": "11155111",
  "deployedAt": "2026-01-28T...",
  "contracts": {
    "usdc": "0x...",
    "savingsBank": "0x..."
  },
  "etherscan": {
    "usdc": "https://sepolia.etherscan.io/address/0x...",
    "savingsBank": "https://sepolia.etherscan.io/address/0x..."
  }
}
```

---

## 🎉 Success Criteria

✅ **Deployment Complete When:**
- All contracts deployed and verified
- 4 saving plans created
- Vault funded with test USDC
- Can open test deposit
- Can withdraw successfully
- All functions work as expected

**Status: Ready for user testing!** 🚀

---

## 📞 Next Steps

1. Share contract addresses with team
2. Test all user flows manually
3. Document any issues found
4. Prepare for mainnet deployment (after audit)

---

## ⚠️ Important Notes

- Sepolia testnet has no real value
- Test USDC is free (mint unlimited)
- Transactions are public on Sepolia Etherscan
- Keep private key secure (even for testnet)
- For mainnet: Get professional audit first!
