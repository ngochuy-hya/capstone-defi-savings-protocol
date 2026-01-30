# DeFi Savings Protocol — Documentation

Tài liệu chính của dự án.

---

## Nội dung

| Tài liệu | Mô tả |
|----------|--------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | High Level Architecture, Components, Data Flow, Access Control (có diagram Mermaid) |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Hướng dẫn deploy (env, thứ tự deploy, fresh deploy, verify) |
| **[SCRIPTS.md](./SCRIPTS.md)** | Danh sách script deploy, test-deployment, helpers |
| **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)** | Tóm tắt refactor (UUPS, vaults, deploy scripts) |

---

## High Level Architecture (tóm tắt)

- **SavingsBank**: Orchestrator — business logic, **không giữ token**.
- **TokenVault**: Giữ principal (gốc). Chỉ SavingsBank gọi deposit/withdraw.
- **InterestVault**: Giữ interest liquidity + penalties; reserve/release cho lãi. Chỉ SavingsBank gọi.
- **DepositNFT**: ERC721 ownership; chỉ SavingsBank mint/burn.

Chi tiết + data flow + access control: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Hình ảnh kiến trúc (Image)

- **Diagram:** Trong [ARCHITECTURE.md](./ARCHITECTURE.md) có sẵn diagram **Mermaid** và **ASCII**. GitHub / VS Code / nhiều viewer render Mermaid trực tiếp.
- **Export PNG:** Có thể copy Mermaid code từ ARCHITECTURE.md vào [Mermaid Live Editor](https://mermaid.live) rồi export ra file ảnh `architecture.png` nếu cần.
