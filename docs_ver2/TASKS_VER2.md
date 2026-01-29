# 📋 DeFi Savings Protocol - Danh Sách Công Việc Rebuild

## 📦 Giai Đoạn 1: Phát Triển Smart Contracts
- [ ] **MockUSDC.sol** - ERC20 stablecoin (6 decimals) có hàm mint
- [ ] **TokenVault.sol** - Vault đơn giản để giữ tiền gốc (principal)
- [ ] **InterestVault.sol** - Vault đơn giản để giữ tiền lãi + tiền phạt
- [ ] **SavingsBank.sol** - Contract logic nghiệp vụ chính
  - [ ] Quản lý gói tiết kiệm (tạo, cập nhật, bật/tắt)
  - [ ] Các thao tác gửi tiền (mở sổ, rút tiền, rút sớm, gia hạn)
  - [ ] Quản lý vault cho admin (nạp tiền, rút tiền)
  - [ ] Tính lãi và theo dõi lãi dự trữ
  - [ ] Logic gia hạn tự động (locked params)
  - [ ] Logic gia hạn thủ công (cùng gói/khác gói)
  - [ ] Chức năng tạm dừng/tiếp tục
- [ ] **DepositNFT.sol** - ERC721Enumerable với metadata on-chain
  - [ ] Mint/burn được điều khiển bởi SavingsBank
  - [ ] Tạo SVG on-chain với thông tin sổ tiết kiệm
  - [ ] Data URI (JSON + SVG được encode base64)

## 🧪 Giai Đoạn 2: Testing Toàn Diện
- [ ] **Tests cho MockUSDC** - mint, transfer, approve, balanceOf
- [ ] **Tests cho TokenVault** - deposit, withdraw, theo dõi balance
- [ ] **Tests cho InterestVault** - deposit, withdraw, theo dõi balance
- [ ] **Tests Quản Lý Gói của SavingsBank**
  - [ ] Tạo gói (các trường hợp thành công/thất bại)
  - [ ] Cập nhật gói (APR, phạt)
  - [ ] Bật/tắt gói
- [ ] **Tests Gửi Tiền của SavingsBank**
  - [ ] Mở sổ tiết kiệm (flow bình thường)
  - [ ] Kiểm tra validation khi mở sổ (số tiền min/max)
  - [ ] Theo dõi lãi dự trữ (reserved interest)
- [ ] **Tests Rút Tiền của SavingsBank**
  - [ ] Rút đúng hạn (gốc + lãi)
  - [ ] Rút sớm (gốc - phạt, KHÔNG có lãi)
  - [ ] Tiền phạt chảy vào InterestVault
  - [ ] Không thể rút trước hạn nếu không dùng earlyWithdraw
  - [ ] Không thể rút 2 lần
- [ ] **Tests Gia Hạn của SavingsBank**
  - [ ] Gia hạn tự động (locked params, bỏ qua chỉnh sửa của admin)
  - [ ] Gia hạn thủ công cùng gói (dùng params hiện tại)
  - [ ] Gia hạn thủ công sang gói khác
  - [ ] Cộng lãi vào gốc khi gia hạn
- [ ] **Tests Quản Lý Vault của SavingsBank**
  - [ ] Nạp tiền vào vault
  - [ ] Rút tiền từ vault (tôn trọng lãi đã dự trữ)
  - [ ] Tính số dư khả dụng
- [ ] **Tests cho DepositNFT**
  - [ ] Quyền mint/burn
  - [ ] Tạo token URI
  - [ ] Các thuộc tính metadata
  - [ ] Render SVG
- [ ] **Tests Tích Hợp**
  - [ ] Flow đầy đủ: gửi → rút tiền
  - [ ] Flow đầy đủ: gửi → rút sớm
  - [ ] Flow đầy đủ: gửi → gia hạn (cả 3 loại)
  - [ ] Chuyển NFT → chủ mới rút tiền
  - [ ] Nhiều người dùng
  - [ ] Tạm dừng/tiếp tục khẩn cấp
- [ ] **Edge Cases & Bảo Mật**
  - [ ] Gửi số tiền = 0
  - [ ] Dưới/trên giới hạn min/max
  - [ ] Vault không đủ tiền
  - [ ] Bảo vệ reentrancy
  - [ ] Kiểm tra phân quyền

## 🚀 Giai Đoạn 3: Scripts Deploy
- [ ] **01_deploy_mock_usdc.ts** - Deploy MockUSDC
- [ ] **02_deploy_vaults.ts** - Deploy TokenVault & InterestVault
- [ ] **03_deploy_savings_bank.ts** - Deploy SavingsBank
- [ ] **04_deploy_deposit_nft.ts** - Deploy DepositNFT
- [ ] **05_setup_system.ts** - Kết nối tất cả contracts
  - [ ] Chuyển quyền sở hữu vaults cho SavingsBank
  - [ ] Set DepositNFT trong SavingsBank
  - [ ] Tạo các gói tiết kiệm ban đầu
  - [ ] Nạp tiền vào InterestVault
- [ ] **deploy_all.ts** - Script deploy tổng hợp

## 🔧 Giai Đoạn 4: Scripts Tiện Ích
- [ ] **verify.ts** - Verify tất cả contracts trên Etherscan
- [ ] **interact.ts** - Hàm helper để test các contract đã deploy
  - [ ] User: approve, openDeposit, withdraw, earlyWithdraw, renew
  - [ ] Admin: createPlan, updatePlan, fundVault, withdrawVault
- [ ] **export-abis.ts** - Export ABIs cho frontend

## 📄 Giai Đoạn 5: Documentation & ABIs
- [ ] Export tất cả ABIs của contracts vào thư mục `/data/abis/`
- [ ] Tạo file địa chỉ deployment
- [ ] Cập nhật README với kiến trúc mới
- [ ] Tạo hướng dẫn tích hợp frontend
  - [ ] Tài liệu các hàm cho User
  - [ ] Tài liệu các hàm cho Admin
  - [ ] Hướng dẫn lắng nghe Events
