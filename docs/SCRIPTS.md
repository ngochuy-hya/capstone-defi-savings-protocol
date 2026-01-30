# DeFi Savings Protocol — Scripts

Danh sách script và cách dùng.

---

## 1. Deploy Scripts (`deploy/`)

Chạy bằng `npx hardhat deploy --network <network>`.

| File | Mô tả |
|------|--------|
| 01_deploy_mock_usdc.ts | Deploy MockUSDC |
| 02_deploy_token_vault.ts | Deploy TokenVault(USDC) |
| 03_deploy_interest_vault.ts | Deploy InterestVault(USDC) |
| 04_deploy_deposit_nft.ts | Deploy MockDepositNFT |
| 05_deploy_savings_bank.ts | Deploy SavingsBank(usdc, tokenVault, interestVault, depositNFT) |
| 06_setup_ownership.ts | Transfer ownership TokenVault, InterestVault, MockDepositNFT → SavingsBank |
| 07_configure_system.ts | Fund InterestVault (100k USDC) + tạo 3 plans |

---

## 2. Test-Deployment Scripts (`scripts/test-deployment/`)

Chạy **sau khi deploy** để kiểm tra logic trên network (Sepolia / localhost).

**Chạy chung:** `npx hardhat run scripts/test-deployment/<file>.ts --network sepolia`

| File | Mô tả |
|------|--------|
| 00_check_deployment.ts | Kiểm tra địa chỉ & kết nối contract |
| 01_setup_verification.ts | Kiểm tra ownership & trạng thái ban đầu |
| 02_plan_management.ts | Liệt kê plans |
| create_plan.ts | **Admin**: Tạo plan mới (sửa hằng số trong file) |
| 03_vault_funding.ts | Fund InterestVault (mint + approve + fundVault) |
| 04_open_deposit.ts | Mở deposit 10k USDC plan 2 |
| 05_check_interest.ts | Xem lãi ước tính deposit #1 |
| 06_withdraw_matured.ts | Rút đúng hạn (deposit #1; localhost có fast-forward) |
| 07_early_withdraw.ts | Rút trước hạn (mở deposit mới → fast-forward 15 ngày → earlyWithdraw) |
| 08_auto_renew.ts | Auto-renew (mở deposit autoRenew=true → fast-forward → autoRenew) |
| 09_manual_renew.ts | Manual renew (withdraw + openDeposit mới) |
| 10_admin_operations.ts | Pause/unpause (chỉ khi deployer là owner) |
| 11_edge_cases.ts | Edge cases: planId invalid, below minDeposit, minDeposit success |
| 12_vault_health.ts | Vault health: balance, reserved, available |
| 99_full_e2e_test.ts | E2E: deposit → (trên localhost: withdraw, auto-renew) |

**Lưu ý:** Trên Sepolia không có fast-forward; các script cần đáo hạn (06, 08, 09, 99) sẽ skip bước withdraw/auto-renew hoặc báo “chờ đáo hạn / chạy trên localhost”.

---

## 3. Helper Scripts (`scripts/helpers/`)

| File | Mô tả |
|------|--------|
| mint_to_address.ts | Mint MockUSDC cho một địa chỉ. Sửa `TARGET_ADDRESS` và `AMOUNT_USDC` trong file rồi chạy. |
| check_balance.ts | (Optional) Kiểm tra balance USDC. |
| verify_deployment.ts | (Optional) Verify deployment với SAVINGS_BANK_ADDRESS env. |

**Ví dụ mint:**

```bash
# Sửa TARGET_ADDRESS và AMOUNT_USDC trong scripts/helpers/mint_to_address.ts
npx hardhat run scripts/helpers/mint_to_address.ts --network sepolia
```

---

## 4. Legacy / Other Scripts (`scripts/`)

- `01_check_deployment.ts` … `07_check_vault_health.ts`: Script kiểm tra / thao tác cơ bản (có thể dùng thay cho một số test-deployment script).
- `setup_sepolia.ts`: (Optional) Setup Sepolia.

---

*Scripts guide — DeFi Savings Protocol.*
