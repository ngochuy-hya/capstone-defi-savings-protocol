# Test Scripts Sau Deploy

Chạy sau khi deploy lên network (localhost / sepolia) để kiểm tra logic contract.

## Chạy (dùng hardhat-deploy)

Đảm bảo đã deploy trước:

```bash
npx hardhat deploy --network sepolia
```

Sau đó chạy từng script (cùng network):

```bash
# Verify deployment
npx hardhat run scripts/test-deployment/00_check_deployment.ts --network sepolia

# Setup & plans
npx hardhat run scripts/test-deployment/01_setup_verification.ts --network sepolia
npx hardhat run scripts/test-deployment/02_plan_management.ts --network sepolia
npx hardhat run scripts/test-deployment/create_plan.ts --network sepolia   # Admin: tạo plan mới

# Funding & deposit
npx hardhat run scripts/test-deployment/03_vault_funding.ts --network sepolia
npx hardhat run scripts/test-deployment/04_open_deposit.ts --network sepolia

# Interest & withdraw
npx hardhat run scripts/test-deployment/05_check_interest.ts --network sepolia
npx hardhat run scripts/test-deployment/06_withdraw_matured.ts --network sepolia
npx hardhat run scripts/test-deployment/07_early_withdraw.ts --network sepolia

# Renew
npx hardhat run scripts/test-deployment/08_auto_renew.ts --network sepolia
npx hardhat run scripts/test-deployment/09_manual_renew.ts --network sepolia

# Admin & health
npx hardhat run scripts/test-deployment/10_admin_operations.ts --network sepolia
npx hardhat run scripts/test-deployment/11_edge_cases.ts --network sepolia
npx hardhat run scripts/test-deployment/12_vault_health.ts --network sepolia

# E2E
npx hardhat run scripts/test-deployment/99_full_e2e_test.ts --network sepolia
```

## Localhost (có fast-forward time)

Trên localhost, các script 06, 07, 08, 09, 99 sẽ tự động fast-forward thời gian:

```bash
npx hardhat deploy
npx hardhat run scripts/test-deployment/00_check_deployment.ts
npx hardhat run scripts/test-deployment/99_full_e2e_test.ts
```

## Danh sách script

| File | Mục đích |
|------|----------|
| 00 | Kiểm tra địa chỉ & kết nối contract |
| 01 | Kiểm tra ownership & trạng thái ban đầu |
| 02 | Liệt kê plans |
| create_plan | Admin: tạo plan mới (sửa hằng số trong file rồi chạy) |
| 03 | Test fund InterestVault |
| 04 | Mở deposit |
| 05 | Xem lãi ước tính |
| 06 | Rút khi đáo hạn |
| 07 | Rút trước hạn (penalty) |
| 08 | Auto-renew (APR locked) |
| 09 | Manual renew (withdraw + deposit mới) |
| 10 | Pause/unpause |
| 11 | Edge cases (min, invalid plan) |
| 12 | Vault health |
| 99 | E2E: deposit → withdraw, auto-renew |
