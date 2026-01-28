# Deployment Scripts

Comprehensive deployment scripts for DeFi Savings Protocol.

## 📁 Structure

```
scripts/
├── 01_deploy_mock_usdc.ts      # Deploy MockUSDC (testnet only)
├── 02_deploy_savings_bank.ts   # Deploy SavingsBank
├── deploy_all.ts                # Complete deployment (recommended)
└── helpers/
    ├── verify_deployment.ts     # Verify deployment health
    └── test_deposit.ts          # Test full deposit lifecycle
```

---

## 🚀 Quick Start

### Deploy Everything (Recommended)

```bash
# Local testing
npx hardhat run scripts/deploy_all.ts --network hardhat

# Sepolia testnet
npx hardhat run scripts/deploy_all.ts --network sepolia

# With custom config
INITIAL_VAULT_FUNDING=50000 npx hardhat run scripts/deploy_all.ts --network sepolia
```

### Step-by-Step Deployment

```bash
# 1. Deploy MockUSDC (testnet only)
npx hardhat run scripts/01_deploy_mock_usdc.ts --network sepolia

# 2. Deploy SavingsBank (set USDC_ADDRESS first)
USDC_ADDRESS=0x... npx hardhat run scripts/02_deploy_savings_bank.ts --network sepolia
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (copy from `.env_example`):

```bash
# Required for testnet/mainnet
TESTNET_PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional - use existing USDC
USDC_ADDRESS=0x...

# Optional - custom addresses
FEE_RECEIVER=0x...
ADMIN_ADDRESS=0x...

# Optional - vault funding
INITIAL_VAULT_FUNDING=100000
SKIP_VAULT_FUNDING=false
```

### Initial Saving Plans

Default plans in `deploy_all.ts`:

| Plan | Tenor | APR | Min Deposit | Max Deposit | Penalty |
|------|-------|-----|-------------|-------------|---------|
| 1. Express | 7 days | 5% | 100 USDC | 10,000 USDC | 3% |
| 2. Standard | 30 days | 8% | 500 USDC | 50,000 USDC | 5% |
| 3. Premium | 90 days | 12% | 1,000 USDC | Unlimited | 7% |
| 4. Elite | 180 days | 15% | 5,000 USDC | Unlimited | 10% |

Edit `SAVING_PLANS` array to customize.

---

## 🧪 Testing Deployment

### Verify Deployment

```bash
SAVINGS_BANK_ADDRESS=0x... npx hardhat run scripts/helpers/verify_deployment.ts --network sepolia
```

Checks:
- ✅ Contract exists and accessible
- ✅ ERC721 properties correct
- ✅ Admin roles configured
- ✅ Saving plans created
- ✅ Vault balance

### Test Full Lifecycle

```bash
SAVINGS_BANK_ADDRESS=0x... npx hardhat run scripts/helpers/test_deposit.ts --network localhost
```

Tests:
- ✅ Open deposit
- ✅ Calculate interest
- ✅ Withdraw at maturity
- ✅ NFT minting & ownership

---

## 🌐 Network Support

### Local Development

```bash
# Start local node
npx hardhat node

# Deploy (in another terminal)
npx hardhat run scripts/deploy_all.ts --network localhost
```

### Sepolia Testnet

```bash
# Setup .env with TESTNET_PRIVATE_KEY

# Get Sepolia ETH from faucet:
# https://sepoliafaucet.com/

# Deploy
npx hardhat run scripts/deploy_all.ts --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <SAVINGS_BANK_ADDRESS> <USDC_ADDRESS> <FEE_RECEIVER> <ADMIN>
```

### Mainnet (Production)

```bash
# ⚠️ WARNING: Use multi-sig wallet for admin!
# ⚠️ Get professional audit before mainnet deployment!

# Setup .env with MAINNET_PRIVATE_KEY
USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
FEE_RECEIVER=<multisig_address> \
ADMIN_ADDRESS=<multisig_address> \
npx hardhat run scripts/deploy_all.ts --network mainnet
```

---

## 📝 Deployment Output

### Deployment Data

Saved to `deployments/deployment-{chainId}-{timestamp}.json`:

```json
{
  "network": "sepolia",
  "chainId": "11155111",
  "contracts": {
    "usdc": "0x...",
    "savingsBank": "0x..."
  },
  "config": {
    "feeReceiver": "0x...",
    "admin": "0x..."
  },
  "plans": [
    {
      "planId": 1,
      "name": "7-Day Express",
      "tenorDays": 7,
      "aprPercent": 5
    }
  ]
}
```

### Console Output

```
✅ MockUSDC deployed: 0x...
✅ SavingsBank deployed: 0x...
✅ Plans Created: 4
✅ Vault funded: 100000.0 USDC
```

---

## 🔧 Troubleshooting

### "Insufficient funds"

- Ensure deployer has enough ETH for gas
- Testnet: Get ETH from faucet
- Check balance: `await ethers.provider.getBalance(address)`

### "Cannot mint MockUSDC"

- MockUSDC.mint() is owner-only
- Deployer must be the one who deployed MockUSDC
- Alternative: Use `transfer()` from deployer balance

### "Insufficient USDC for vault funding"

- Deployer needs USDC balance
- Option 1: Set `SKIP_VAULT_FUNDING=true`
- Option 2: Fund vault manually after deployment
- Option 3: Mint more MockUSDC first

### "Network not configured"

- Add network config to `hardhat.config.ts`
- Ensure `TESTNET_PRIVATE_KEY` is set in `.env`

---

## 📚 Additional Scripts

### Create Custom Plan

```typescript
await savingsBank.createPlan(
  30,                              // 30 days
  800,                             // 8% APR (800 bps)
  ethers.parseUnits("500", 6),    // Min: 500 USDC
  ethers.parseUnits("50000", 6),  // Max: 50,000 USDC
  500                              // 5% penalty
);
```

### Fund Vault

```typescript
const amount = ethers.parseUnits("100000", 6);
await usdc.approve(savingsBankAddress, amount);
await savingsBank.fundVault(amount);
```

### Grant Admin Role

```typescript
const ADMIN_ROLE = await savingsBank.ADMIN_ROLE();
await savingsBank.grantRole(ADMIN_ROLE, newAdminAddress);
```

---

## 🎯 Best Practices

1. **Always test locally first** (`--network hardhat`)
2. **Verify contracts on Etherscan** after testnet deployment
3. **Use multi-sig wallet** for mainnet admin
4. **Fund vault sufficiently** to cover interest payments
5. **Monitor vault health** regularly
6. **Get professional audit** before mainnet

---

## 📞 Support

For issues or questions, refer to:
- [IMPLEMENTATION_PLAN.md](../docs/IMPLEMENTATION_PLAN.md)
- [SECURITY_AUDIT.md](../docs/SECURITY_AUDIT.md)
- [README.md](../README.md)
