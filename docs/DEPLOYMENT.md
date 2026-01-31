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

## 6. Verify on Etherscan

Cần có `ETHERSCAN_API_KEY` trong `.env`. Thay `0x...` bằng địa chỉ thật từ `deployments/sepolia/`.

### Lệnh verify từng contract (Sepolia)

**1. MockUSDC** (không tham số constructor):

```bash
npx hardhat verify --network sepolia <MOCK_USDC_ADDRESS>
```

**2. TokenVault** (1 tham số: USDC):

```bash
npx hardhat verify --network sepolia <TOKEN_VAULT_ADDRESS> <MOCK_USDC_ADDRESS>
```

**3. InterestVault** (1 tham số: USDC):

```bash
npx hardhat verify --network sepolia <INTEREST_VAULT_ADDRESS> <MOCK_USDC_ADDRESS>
```

**4. MockDepositNFT** (không tham số):

```bash
npx hardhat verify --network sepolia <MOCK_DEPOSIT_NFT_ADDRESS>
```

**5. SavingsBank** (4 tham số: usdc, tokenVault, interestVault, depositNFT):

```bash
npx hardhat verify --network sepolia <SAVINGS_BANK_ADDRESS> <MOCK_USDC_ADDRESS> <TOKEN_VAULT_ADDRESS> <INTEREST_VAULT_ADDRESS> <MOCK_DEPOSIT_NFT_ADDRESS>
```

### Lấy địa chỉ đã deploy

```bash
# Xem địa chỉ trong file deployment
cat deployments/sepolia/MockUSDC.json
cat deployments/sepolia/TokenVault.json
# ... tương tự
```

Hoặc chạy script:

```bash
npx hardhat run scripts/test-deployment/00_check_deployment.ts --network sepolia
```

### Ví dụ (thay bằng địa chỉ thật từ deployments/sepolia/)

```bash
# MockUSDC (0 args)
npx hardhat verify --network sepolia 0xMockUsdcAddress

# TokenVault (usdc)
npx hardhat verify --network sepolia 0xTokenVaultAddress 0xMockUsdcAddress

# InterestVault (usdc)
npx hardhat verify --network sepolia 0xInterestVaultAddress 0xMockUsdcAddress

# MockDepositNFT (0 args)
npx hardhat verify --network sepolia 0xMockDepositNftAddress

# SavingsBank (usdc, tokenVault, interestVault, depositNFT)
npx hardhat verify --network sepolia 0xSavingsBankAddress 0xMockUsdcAddress 0xTokenVaultAddress 0xInterestVaultAddress 0xMockDepositNftAddress
```

---

*Deployment guide — DeFi Savings Protocol.*
