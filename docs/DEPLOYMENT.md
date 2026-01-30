# DeFi Savings Protocol — Deployment

Hướng dẫn deploy và cấu hình hệ thống.

---

## 1. Prerequisites

- Node.js v16+
- Yarn hoặc npm
- Hardhat
- Private key (Sepolia hoặc mainnet) — **không commit vào repo**
- (Optional) Etherscan API key để verify contract

---

## 2. Environment

Tạo file `.env` từ `.env_example`:

```bash
cp .env_example .env
```

Cấu hình:

- `TESTNET_PRIVATE_KEY`: Private key ví dùng deploy trên Sepolia
- `MAINNET_PRIVATE_KEY`: (Optional) Cho mainnet
- `ETHERSCAN_API_KEY`: (Optional) Để verify contract trên Etherscan

---

## 3. Deploy Order (hardhat-deploy)

Thứ tự deploy **bắt buộc** (dependency):

| Step | Script | Contract(s) | Phụ thuộc |
|------|--------|-------------|-----------|
| 01 | `01_deploy_mock_usdc.ts` | MockUSDC | — |
| 02 | `02_deploy_token_vault.ts` | TokenVault | MockUSDC |
| 03 | `03_deploy_interest_vault.ts` | InterestVault | MockUSDC |
| 04 | `04_deploy_deposit_nft.ts` | MockDepositNFT | — |
| 05 | `05_deploy_savings_bank.ts` | SavingsBank | TokenVault, InterestVault, MockDepositNFT |
| 06 | `06_setup_ownership.ts` | — | Transfer ownership 3 contract → SavingsBank |
| 07 | `07_configure_system.ts` | — | Fund InterestVault + create 3 plans |

---

## 4. Commands

### Deploy to Sepolia

```bash
npx hardhat compile
npx hardhat deploy --network sepolia
```

### Deploy to Localhost

```bash
npx hardhat node   # terminal 1
npx hardhat deploy --network localhost   # terminal 2
```

### Fresh Deploy (deploy lại từ đầu)

Xóa deployment của network tương ứng rồi chạy lại:

- Sepolia: xóa folder `deployments/sepolia`
- Localhost: xóa `deployments/localhost`

Sau đó:

```bash
npx hardhat deploy --network sepolia
```

---

## 5. Post-Deploy

1. **Verify ownership**: TokenVault, InterestVault, MockDepositNFT phải có `owner() == SavingsBank`.
2. **Fund InterestVault**: Script 07 đã fund 100k USDC (mock). Nếu cần thêm: chạy `scripts/test-deployment/03_vault_funding.ts`.
3. **Plans**: Script 07 tạo 3 plan (7 Days, 30 Days, 90 Days). Thêm plan: `scripts/test-deployment/create_plan.ts`.

---

## 6. Verify on Etherscan (Optional)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Ví dụ SavingsBank (constructor: usdc, tokenVault, interestVault, depositNFT):

```bash
npx hardhat verify --network sepolia 0x... 0x... 0x... 0x... 0x...
```

---

*Deployment guide — DeFi Savings Protocol.*
