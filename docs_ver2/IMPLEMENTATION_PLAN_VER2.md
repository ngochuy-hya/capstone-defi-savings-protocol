# 🏗️ Kế Hoạch Triển Khai: Rebuild DeFi Savings Protocol

## Tổng Quan

Rebuild hoàn toàn DeFi savings protocol theo kiến trúc mới trong `DEFI_SAVINGS_ARCHITECTURE_FINAL.md`. Hệ thống sử dụng pattern phân chia trách nhiệm với các vault đơn giản (TokenVault, InterestVault) và logic thông minh (SavingsBank), cộng thêm quyền sở hữu dựa trên NFT (DepositNFT).

## Đề Xuất Thay Đổi

### Thành Phần 1: Mock Token

#### [MỚI] [MockUSDC.sol](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/contracts/mocks/MockUSDC.sol)

Token ERC20 đơn giản với 6 decimals (giống USDC) cho testing. Có hàm `mint()` public để test dễ dàng.

**Tính năng:**
- ERC20 chuẩn với 6 decimals
- Hàm mint public (chỉ để test)
- Tên: "Mock USDC", Symbol: "USDC"

---

### Thành Phần 2: Các Contract Vault

#### [MỚI] [TokenVault.sol](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/contracts/TokenVault.sol)

Vault đơn giản giữ tiền gốc (principal) của user. Chỉ SavingsBank mới có thể deposit/withdraw.

**Các hàm:**
- `deposit(address from, uint256 amount)` - Chuyển token từ user vào vault
- `withdraw(address to, uint256 amount)` - Chuyển token từ vault cho user
- `balance()` - Xem số dư hiện tại

**Phân quyền:** `onlyOwner` (SavingsBank)

#### [MỚI] [InterestVault.sol](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/contracts/InterestVault.sol)

Vault đơn giản giữ tiền do admin nạp để trả lãi. Cũng nhận tiền phạt khi rút sớm.

**Các hàm:**
- `deposit(address from, uint256 amount)` - Admin nạp tiền hoặc tiền phạt
- `withdraw(address to, uint256 amount)` - Trả lãi
- `balance()` - Xem số dư hiện tại

**Phân quyền:** `onlyOwner` (SavingsBank)

---

### Thành Phần 3: Logic Nghiệp Vụ Chính

#### [MỚI] [SavingsBank.sol](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/contracts/SavingsBank.sol)

Contract điều phối quản lý toàn bộ logic nghiệp vụ. **Không bao giờ giữ token** - chỉ điều phối chuyển tiền giữa các vault.

**Structs:**
```solidity
struct SavingPlan {
    string name;                      // Tên gói
    uint256 durationDays;             // Kỳ hạn (ngày)
    uint256 minDeposit;               // Số tiền gửi tối thiểu
    uint256 maxDeposit;               // Số tiền gửi tối đa
    uint256 aprBps;                   // Lãi suất (basis points, 500 = 5%)
    uint256 earlyWithdrawPenaltyBps;  // Phạt rút sớm
    bool isActive;                    // Gói có hoạt động không
}

struct DepositCertificate {
    uint256 planId;                   // ID gói tiết kiệm
    uint256 principal;                // Số tiền gốc
    uint256 startTime;                // Thời gian bắt đầu
    uint256 maturityTime;             // Thời gian đến hạn
    uint256 lockedAprBps;             // APR cố định khi gửi
    bool isAutoRenewEnabled;          // Có gia hạn tự động không
    uint8 status;                     // 0=Hoạt động, 1=Đã rút, 2=Rút sớm, 3=Gia hạn
}
```

**Các hàm Admin:**
- `createPlan(...)` - Tạo gói tiết kiệm mới
- `updatePlan(planId, apr, penalty)` - Cập nhật gói hiện có
- `enablePlan(planId, enabled)` - Bật/tắt gói
- `fundVault(amount)` - Nạp tiền vào InterestVault
- `withdrawVault(amount)` - Rút tiền dư từ InterestVault
- `setDepositNFT(address)` - Set địa chỉ contract NFT
- `setFeeReceiver(address)` - Set địa chỉ nhận phí (tùy chọn)
- `pause()` / `unpause()` - Điều khiển khẩn cấp

**Các hàm User:**
- `openDeposit(planId, amount, enableAutoRenew)` - Mở sổ tiết kiệm mới
  - Kiểm tra gói và số tiền
  - Chuyển tiền gốc vào TokenVault
  - Dự trữ lãi ước tính
  - Mint NFT cho user
- `withdraw(tokenId)` - Rút tiền đúng hạn
  - Trả tiền gốc từ TokenVault
  - Trả lãi từ InterestVault
  - Đốt NFT
- `earlyWithdraw(tokenId)` - Rút tiền trước hạn
  - Trả tiền gốc trừ đi tiền phạt
  - KHÔNG trả lãi
  - Tiền phạt chảy vào InterestVault
  - Đốt NFT
- `renew(tokenId, useCurrentRate, newPlanId)` - Gia hạn sổ
  - **Gia hạn tự động** (`useCurrentRate=false`): cùng gói, params cố định
  - **Gia hạn thủ công cùng gói** (`useCurrentRate=true, newPlanId=0`): dùng params hiện tại của gói
  - **Gia hạn thủ công sang gói khác** (`useCurrentRate=true, newPlanId!=oldPlanId`): chuyển sang gói mới
  - Cộng lãi vào tiền gốc mới
- `setAutoRenew(tokenId, enabled)` - Bật/tắt gia hạn tự động

**Các hàm View:**
- `calculateInterest(tokenId)` - Tính lãi hiện tại
- `calculateEarlyWithdrawAmount(tokenId)` - Tính tiền gốc trừ phạt
- `availableVaultBalance()` - Số dư khả dụng (tổng - dự trữ)
- `getUserDeposits(user)` - Lấy tất cả ID sổ của user

**Logic chính:**
- Tính lãi: `principal * aprBps * durationSeconds / (365 days * 10000)`
- Theo dõi lãi dự trữ: tăng khi gửi, giảm khi rút/gia hạn
- Rút sớm: KHÔNG có lãi, phạt = `principal * penaltyBps / 10000`
- Các loại gia hạn: tự động (cố định), thủ công cùng gói (hiện tại), thủ công khác gói

**Events:**
- `PlanCreated(uint256 planId, string name)` - Tạo gói mới
- `PlanUpdated(uint256 planId)` - Cập nhật gói
- `DepositOpened(uint256 depositId, address owner, uint256 planId, uint256 principal, uint256 maturityAt)` - Mở sổ
- `Withdrawn(uint256 depositId, address owner, uint256 principal, uint256 interest, bool isEarly)` - Rút tiền
- `Renewed(uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal)` - Gia hạn
- `VaultFunded(uint256 amount)` - Nạp vault
- `VaultWithdrawn(uint256 amount)` - Rút từ vault

**Bảo mật:**
- OpenZeppelin: `Ownable`, `Pausable`, `ReentrancyGuard`
- Pattern Checks-Effects-Interactions
- Phân quyền cho các hàm admin

---

### Thành Phần 4: NFT Quyền Sở Hữu

#### [MỚI] [DepositNFT.sol](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/contracts/DepositNFT.sol)

NFT ERC721Enumerable đại diện quyền sở hữu sổ tiết kiệm. Tạo metadata 100% on-chain với SVG.

**Các hàm:**
- `mint(address to)` - Mint NFT (chỉ SavingsBank)
- `burn(uint256 tokenId)` - Đốt NFT (chỉ SavingsBank)
- `tokenURI(uint256 tokenId)` - Tạo metadata Data URI
- `refreshMetadata(uint256 tokenId)` - Emit event để marketplace refresh

**Tạo Metadata:**
1. Đọc dữ liệu sổ từ SavingsBank
2. Tạo JSON với các thuộc tính
3. Tạo hình SVG on-chain
4. Encode base64 cả hai
5. Trả về `data:application/json;base64,...`

**Thành phần SVG:**
- Background gradient (tím-xanh)
- Viền chứng chỉ
- ID sổ và tên gói
- Số tiền gốc và APR cố định
- Thanh tiến trình (thời gian đã trôi)
- Badge trạng thái (Hoạt động/Đến hạn/v.v.)
- Ngày đến hạn
- Chỉ báo gia hạn tự động

**Thuộc tính JSON:**
- Tên gói
- Số tiền gốc (USDC)
- APR cố định (%)
- Kỳ hạn (ngày)
- Số ngày đã qua/còn lại
- Trạng thái (Hoạt động/Đã rút/v.v.)
- Gia hạn tự động có bật không
- Ngày đến hạn

---

### Thành Phần 5: Interfaces

#### [MỚI] [ISavingsBank.sol](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/contracts/interfaces/ISavingsBank.sol)

Interface cho SavingsBank để DepositNFT đọc dữ liệu sổ.

---

### Thành Phần 6: Testing

#### [MỚI] [MockUSDC.test.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/test/MockUSDC.test.ts)

Tests các chức năng ERC20 cơ bản.

#### [MỚI] [TokenVault.test.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/test/TokenVault.test.ts)

Tests deposit/withdraw vault với kiểm soát phân quyền.

#### [MỚI] [InterestVault.test.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/test/InterestVault.test.ts)

Giống tests của TokenVault.

#### [MỚI] [SavingsBank.test.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/test/SavingsBank.test.ts)

Tests toàn diện bao gồm:
- Quản lý gói (tạo, cập nhật, bật/tắt)
- Gửi tiền (mở, validation, theo dõi lãi dự trữ)
- Rút tiền (đúng hạn, sớm, ngăn rút 2 lần)
- Gia hạn (tự động, thủ công cùng gói, thủ công khác gói)
- Quản lý vault (nạp, rút, số dư khả dụng)
- Tạm dừng/tiếp tục
- Phân quyền
- Edge cases (số tiền = 0, giới hạn, không đủ tiền)

#### [MỚI] [DepositNFT.test.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/test/DepositNFT.test.ts)

Tests NFT bao gồm:
- Quyền mint/burn
- Tạo token URI
- Parse metadata
- Render SVG
- Transfer và ownership

#### [MỚI] [Integration.test.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/test/Integration.test.ts)

Tests workflow end-to-end:
- Flow đầy đủ: gửi → rút tiền
- Flow đầy đủ: gửi → rút sớm
- Flow đầy đủ: gửi → gia hạn (cả 3 loại)
- Chuyển NFT → chủ mới rút tiền
- Nhiều user
- Các tình huống quản lý vault của admin

---

### Thành Phần 7: Scripts Deploy

#### [SỬA] [01_deploy_mock_usdc.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/deploy/01_deploy_mock_usdc.ts)

Cập nhật để deploy contract MockUSDC mới.

#### [MỚI] [02_deploy_vaults.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/deploy/02_deploy_vaults.ts)

Deploy cả TokenVault và InterestVault.

#### [MỚI] [03_deploy_savings_bank.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/deploy/03_deploy_savings_bank.ts)

Deploy SavingsBank với tham chiếu đến các vault.

#### [MỚI] [04_deploy_deposit_nft.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/deploy/04_deploy_deposit_nft.ts)

Deploy DepositNFT với tham chiếu đến SavingsBank.

#### [MỚI] [05_setup_system.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/deploy/05_setup_system.ts)

Kết nối tất cả contracts với nhau:
1. Chuyển ownership của vaults cho SavingsBank
2. Set DepositNFT trong SavingsBank
3. Tạo các gói tiết kiệm ban đầu
4. Nạp tiền vào InterestVault

---

### Thành Phần 8: Scripts Tiện Ích

#### [MỚI] [export-abis.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/scripts/export-abis.ts)

Export ABIs của contracts vào thư mục `data/abis/` cho frontend.

#### [MỚI] [interact.ts](file:///d:/Internship_AppsCyclone_2025/Capstone/capstone-defi-savings-protocol/scripts/interact.ts)

Script helper với các hàm để tương tác với contracts đã deploy (cả user và admin).

---

## Kế Hoạch Kiểm Tra

### Tests Tự Động

Tất cả tests sẽ chạy bằng Hardhat với lệnh:

```bash
npx hardhat test
```

**Yêu Cầu Coverage:**
- Unit tests cho từng contract (MockUSDC, TokenVault, InterestVault, SavingsBank, DepositNFT)
- Integration tests cho workflow hoàn chỉnh
- Edge case tests cho validation và điều kiện lỗi
- Mục tiêu tối thiểu 90% code coverage

**Các Tình Huống Test Cụ Thể:**

1. **Tests MockUSDC** (`test/MockUSDC.test.ts`)
   - Mint token
   - Transfer token
   - Approve và transferFrom
   - Kiểm tra balance

2. **Tests Vault** (`test/TokenVault.test.ts`, `test/InterestVault.test.ts`)
   - Chỉ owner mới deposit/withdraw được
   - Theo dõi balance chính xác
   - Events được emit đúng

3. **Tests SavingsBank** (`test/SavingsBank.test.ts`)
   - Quản lý gói: tạo, cập nhật, bật/tắt
   - Mở sổ: validation, dự trữ lãi
   - Rút tiền: kiểm tra đến hạn, chuyển gốc + lãi
   - Rút sớm: tính phạt, không có lãi, phạt vào InterestVault
   - Gia hạn: tự động (cố định), thủ công cùng gói (hiện tại), thủ công khác gói
   - Quản lý vault: nạp, rút (tôn trọng dự trữ), số dư khả dụng
   - Tạm dừng/tiếp tục
   - Phân quyền

4. **Tests DepositNFT** (`test/DepositNFT.test.ts`)
   - Mint/burn chỉ bởi SavingsBank
   - Tạo token URI và format
   - Thuộc tính metadata chính xác
   - Validation render SVG

5. **Tests Tích Hợp** (`test/Integration.test.ts`)
   - Flow đầy đủ gửi → rút
   - Flow đầy đủ gửi → rút sớm
   - Flow đầy đủ gửi → gia hạn (tất cả loại)
   - Chuyển NFT → chủ mới thao tác
   - Nhiều user với các thao tác trùng lặp
   - Edge cases và điều kiện lỗi

### Kiểm Tra Thủ Công (Sau Deploy)

> [!IMPORTANT]
> Sau khi deploy lên testnet (Sepolia), kiểm tra các điều sau:

**Kiểm Tra Deployment:**
```bash
# Deploy lên testnet
npx hardhat deploy --network sepolia

# Verify contracts trên Etherscan
npx hardhat run scripts/verify.ts --network sepolia
```

**Tích Hợp Frontend:**
```bash
# Export ABIs cho frontend
npx hardhat run scripts/export-abis.ts
```

Kiểm tra rằng:
1. Cả 5 contracts deploy thành công
2. Ownership của vaults được chuyển cho SavingsBank
3. DepositNFT được set trong SavingsBank
4. Các gói ban đầu được tạo
5. InterestVault được nạp tiền
6. ABIs được export vào thư mục `data/abis/`

**Checklist Test Thủ Công:**
- [ ] User có thể approve và mở sổ tiết kiệm
- [ ] NFT được mint vào ví user
- [ ] Metadata NFT hiển thị đúng trên OpenSea testnet
- [ ] User có thể rút tiền đúng hạn
- [ ] User có thể rút sớm với phạt
- [ ] User có thể gia hạn sổ (test cả 3 loại)
- [ ] Admin có thể tạo/cập nhật gói
- [ ] Admin có thể nạp/rút vault
- [ ] Pause ngăn thao tác user nhưng cho phép admin

---

## Đánh Giá Rủi Ro

> [!WARNING]
> **Thay Đổi Breaking**
> Đây là rebuild hoàn toàn. Tất cả contracts và scripts cũ sẽ không tương thích.

**Cần Migration:**
- Địa chỉ deploy cũ sẽ không hoạt động
- Frontend phải tích hợp với ABIs mới
- Kiến trúc contract khác (vault tách biệt)

**Cân Nhắc Bảo Mật:**
- Bảo vệ reentrancy qua OpenZeppelin `ReentrancyGuard`
- Phân quyền qua `Ownable` và modifier tùy chỉnh
- Pausable cho tình huống khẩn cấp
- Pattern Checks-Effects-Interactions xuyên suốt

**Tối Ưu Gas:**
- Đóng gói struct cho `DepositCertificate`
- Hàm view không tốn gas
- Giảm thiểu cập nhật storage

---

## Ước Tính Thời Gian

- **Giai đoạn 1** (Contracts): ~4-5 giờ
- **Giai đoạn 2** (Tests): ~3-4 giờ
- **Giai đoạn 3** (Deployment): ~1-2 giờ
- **Giai đoạn 4** (Scripts & ABIs): ~1 giờ
- **Tổng**: ~10-12 giờ

---

## Sau Triển Khai

Sau khi triển khai và test thành công:

1. **Documentation**: Cập nhật README với kiến trúc mới
2. **Export ABI**: Đảm bảo tất cả ABIs trong `data/abis/` cho frontend
3. **Địa Chỉ Deploy**: Tạo file địa chỉ deployment
4. **Hướng Dẫn Frontend**: Tạo hướng dẫn tích hợp với tài liệu hàm user/admin
