# DeFi Savings Protocol - Danh Sách Công Việc

> **Thời gian:** Thứ 2 (26/1) → Thứ 5 (29/1) - Hoàn thành sớm 1 ngày
> **Mục tiêu:** Xây dựng hệ thống tiết kiệm giống ngân hàng truyền thống trên blockchain

## 📅 Thứ 2 (26/1) - Lập Kế Hoạch & Thiết Lập

- [x] Xem xét và phê duyệt kế hoạch triển khai
- [x] Cài đặt các thư viện và môi trường phát triển
- [x] Tạo cấu trúc dự án cơ bản

## 📝 Thứ 3 (27/1) - Phát Triển Smart Contract Chính

**Sáng (3-4 giờ):**
- [x] **MockUSDC.sol** - Token ERC20 với 6 decimals (30 phút)
- [x] Test MockUSDC (5 phút)
  - [x] Verify 6 decimals
  - [x] Verify mint/burn works
- [x] **SavingsBank.sol** thiết lập khung sườn
  - [x] Struct SavingPlan (kế hoạch tiết kiệm)
  - [x] Struct DepositCertificate & enum (sổ tiết kiệm)
  - [x] Thiết kế cách lưu trữ & biến trạng thái
  - [x] Constructor & khởi tạo

**Chiều (3-4 giờ):** ✅ **HOÀN THÀNH**
- [x] **Chức Năng Quản Trị**
  - [x] createPlan() - Tạo gói tiết kiệm mới ✅
  - [x] updatePlan() - Cập nhật gói tiết kiệm ✅
  - [x] enablePlan() - Bật/tắt gói tiết kiệm ✅
  - [x] pause()/unpause() - Điều khiển khẩn cấp ✅
- [x] **Quản Lý Kho Tiền**
  - [x] fundVault() - Admin nạp tiền vào kho ✅
  - [x] withdrawVault() - Admin rút tiền từ kho ✅
- [x] **Sự Kiện Cơ Bản** - PlanCreated, VaultFunded, v.v. ✅
- [x] **BONUS: VaultManager.sol** - Tách logic vault riêng biệt
  - [x] Quản lý vault balance (fund/withdraw) ✅
  - [x] Reserve/Release funds tracking ✅
  - [x] Vault health monitoring ✅
  - [x] Integration với SavingsBank ✅
- [x] **BONUS: InterestCalculator.sol** - Library tính lãi
  - [x] Simple interest calculation ✅
  - [x] Penalty calculation ✅
  - [x] Maturity amount estimation ✅
  - [x] Validation helpers ✅
- [x] **Tests**
  - [x] VaultManager.test.ts (57 test cases) ✅
  - [x] InterestCalculator.test.ts (31 test cases) ✅
  - [x] MockUSDC.test.ts (10 test cases) ✅
  - [x] **TOTAL: 98/98 tests passing** ✅

**Tối (2-3 giờ):**
- [ ] **Chức Năng Người Dùng Cơ Bản**
  - [ ] openDeposit() - Mở sổ tiết kiệm
  - [ ] calculateInterest() - Hàm tính lãi (lãi đơn)
  - [ ] withdraw() - Rút tiền đúng hạn (gốc + lãi)

## 🔨 Thứ 4 (28/1) - Hoàn Thiện Tính Năng + Kiểm Thử

**Sáng (3-4 giờ):**
- [ ] **ERC721 Integration** 
  - [ ] Extend ERC721Enumerable
  - [ ] Override _transfer với event
  - [ ] Implement getUserDeposits()
- [ ] **Hoàn Thiện Chức Năng Người Dùng**
  - [ ] earlyWithdraw() - Rút trước hạn với phạt tiền
  - [ ] renew() - Gia hạn/tái tục sổ
- [ ] **Hoàn Thiện Sự Kiện** - DepositOpened, Withdrawn, Renewed
- [ ] **Thiết Lập Bảo Mật**
  - [ ] AccessControl roles (VAI TRÒ ADMIN)
  - [ ] Tích hợp ReentrancyGuard (chống tấn công Reentrancy)
  - [ ] Kiểm tra dữ liệu đầu vào

**Chiều (3-4 giờ) - Kiểm Thử Phần 1:**
- [ ] **Kiểm Thử Chức Năng Quản Trị**
  - [ ] Test createPlan, updatePlan
  - [ ] Test quản lý kho tiền
  - [ ] Test pause/unpause
- [ ] **Kiểm Thử Luồng Chính**
  - [ ] Test openDeposit → chờ → withdraw
  - [ ] Độ chính xác tính lãi
  - [ ] Tính đúng đắn của việc chuyển token

**Tối (2-3 giờ) - Kiểm Thử Phần 2:**
- [ ] **Kiểm Thử Các Trường Hợp Đặc Biệt**
  - [ ] Rút sớm + tính phạt tiền
  - [ ] Các tình huống gia hạn (cùng/khác gói)
  - [ ] Kho tiền không đủ số dư
  - [ ] Vi phạm kiểm soát truy cập
  - [ ] Nhiều người dùng cùng lúc
- [ ] **Transfer Scenarios**
  - [ ] Transfer NFT trước maturity
  - [ ] Transfer NFT sau maturity
  - [ ] Verify ownership + withdraw rights

## 🚀 Thứ 5 (29/1) - Bảo Mật, Triển Khai & Tài Liệu

**Sáng (3-4 giờ):**
- [ ] **Rà Soát Bảo Mật**
  - [ ] Danh sách kiểm tra tự đánh giá
  - [ ] Phân tích tĩnh bằng Slither
  - [ ] Sửa các vấn đề nghiêm trọng
  - [ ] Xem xét tối ưu gas
- [ ] **Scripts Triển Khai**
  - [ ] 01_deploy_mock_usdc.ts
  - [ ] 02_deploy_savings_bank.ts (với các gói ban đầu)

**Chiều (3-4 giờ):**
- [ ] **Triển Khai Lên Testnet**
  - [ ] Triển khai lên Sepolia
  - [ ] Xác minh contract trên Etherscan
  - [ ] Nạp USDC test vào kho
  - [ ] Kiểm thử thủ công các tình huống
- [ ] **Kiểm Thử Thực Tế**
  - [ ] Tạo sổ tiết kiệm thử nghiệm
  - [ ] Kiểm tra rút tiền
  - [ ] Xác minh tất cả chức năng hoạt động

**Tối (2-3 giờ):**
- [ ] **Tài Liệu**
  - [ ] Cập nhật README.md (địa chỉ triển khai)
  - [ ] Thêm chú thích NatSpec cho tất cả hàm
  - [ ] Tạo walkthrough.md với ảnh chụp màn hình
  - [ ] Quay video demo (tùy chọn)
- [ ] **Kiểm Tra Lần Cuối**
  - [ ] Dọn dẹp code
  - [ ] Kiểm thử toàn diện lần cuối
  - [ ] Chuẩn bị tài liệu trình bày

## 🎁 Thứ 6 (30/1) - Tính Năng Thêm (nếu xong sớm)

- [ ] Giao diện demo đơn giản (React)
- [ ] Tối ưu hóa gas
- [ ] Kiểm thử bảo mật bổ sung
- [ ] Phân tích Slither

---

## 📊 Tiến Độ Tổng Quan

- **Thứ 2**: ✅ Hoàn thành
- **Thứ 3**: 🔄 Đang thực hiện
  - ✅ **Sáng (3-4 giờ)**: HOÀN THÀNH - MockUSDC.sol + Tests (10/10 pass) + SavingsBank.sol khung sườn
  - ✅ **Chiều (3-4 giờ)**: HOÀN THÀNH - Chức năng quản trị + Quản lý kho tiền + VaultManager + InterestCalculator + Tests (98/98 pass)
  - ⏳ **Tối (2-3 giờ)**: Chưa bắt đầu - Chức năng người dùng cơ bản
- **Thứ 4**: ⏳ Chưa bắt đầu
- **Thứ 5**: ⏳ Chưa bắt đầu

## 💡 Ghi Chú Quan Trọng

- Ưu tiên **chức năng chính** trước các tính năng phụ
- **Kiểm thử kỹ lưỡng** trước khi triển khai lên testnet
- Đảm bảo **bảo mật** ở mọi bước
- Commit code thường xuyên với message rõ ràng
