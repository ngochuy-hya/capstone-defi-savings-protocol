# 📋 DeFi Savings Protocol - Danh Sách Công Việc Rebuild

> **Cập nhật trạng thái:** 2026-01-30  
> **Ghi chú:** Checklist bên dưới phản ánh đúng code hiện có trong repo (contracts/tests/deploy/scripts/data/docs).  

## 📦 Giai Đoạn 1: Phát Triển Smart Contracts
- [x] **MockUSDC.sol** - ERC20 stablecoin (6 decimals) có hàm mint
- [x] **TokenVault.sol** - Vault đơn giản để giữ tiền gốc (principal)
- [x] **InterestVault.sol** - Vault đơn giản để giữ tiền lãi + tiền phạt
- [x] **SavingsBank.sol** - Contract logic nghiệp vụ chính (không custody token)
  - [x] Quản lý gói tiết kiệm (tạo, cập nhật, bật/tắt)
  - [x] Các thao tác gửi tiền (mở sổ, rút tiền, rút sớm, gia hạn)
  - [x] Quản lý vault cho admin (nạp tiền, rút tiền)
  - [x] Tính lãi và theo dõi lãi dự trữ
  - [x] Logic gia hạn tự động (locked params)
  - [x] Logic gia hạn thủ công (cùng gói/khác gói)
  - [x] Chức năng tạm dừng/tiếp tục
- [x] **DepositNFT.sol** - ERC721Enumerable với metadata on-chain (production)
- [x] **MockDepositNFT.sol** - NFT mock (được dùng trong deploy scripts hiện tại)

## 🧪 Giai Đoạn 2: Testing Toàn Diện
- [x] **Tests cho MockUSDC** - mint, transfer, approve, balanceOf
- [x] **Tests cho InterestCalculator** - unit tests (library)
- [x] **SavingsBank unit tests (core flow)** - hiện có `test/unit/SavingsBank.test.ts`


## 🚀 Giai Đoạn 3: Scripts Deploy
- [x] **01_deploy_mock_usdc.ts** - Deploy MockUSDC
- [x] **02_deploy_vaults.ts** - Deploy TokenVault & InterestVault
- [x] **03_deploy_savings_bank.ts** - Deploy SavingsBank + MockDepositNFT (constructor wires deps)
- [x] **04_setup_ownership.ts** - Transfer ownership vaults/NFT → SavingsBank
- [x] **05_configure_system.ts** - Fund InterestVault + create initial plans
- [x] **Deploy Sepolia (hardhat-deploy)** - `npx hardhat deploy --network sepolia`

## 🔧 Giai Đoạn 4: Scripts Tiện Ích
- [x] **verify.ts** - Verify contracts trên Etherscan (nếu cần)
- [x] **scripts chạy nhanh (manual/sanity)**
  - [x] `01_check_deployment.ts` - check ownership/balances/plans
  - [x] `02_open_deposit.ts` / `04_withdraw_matured.ts` / `05_early_withdraw.ts` / `06_renew_deposit.ts`
  - [x] `07_check_vault_health.ts`
- [x] **Export ABIs cho frontend** (đã có trong `data/abi/...`)

## 📄 Giai Đoạn 5: Documentation & ABIs
- [x] Export ABIs vào `data/abi/` (MockUSDC/TokenVault/InterestVault/(Mock)DepositNFT/SavingsBank + interfaces)
- [ ] Tạo file địa chỉ deployment (VD: `deployment-info.json` hoặc copy từ `deployments/<network>/`)
- [x] Cập nhật `README.md` + `docs_ver2/` theo kiến trúc mới (đã clean logic cũ)
- [ ] (Tuỳ chọn) Hướng dẫn tích hợp frontend riêng 1 file
  - [ ] Env vars + addresses (VITE_*)
  - [ ] User flow: approve TokenVault → openDeposit/withdraw/earlyWithdraw/renew
  - [ ] Admin flow: createPlan/updatePlan/enablePlan/fundVault/withdrawVault
  - [ ] Events cần lắng nghe (nếu frontend cần realtime)
