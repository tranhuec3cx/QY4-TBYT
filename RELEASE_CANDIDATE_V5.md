# QY4-TTBYT V5.0.0 - Release Candidate 1

Nhánh RC: `release/v5.0.0-rc1`

Mục tiêu của RC1 là đóng băng chức năng, kiểm tra lại toàn bộ đường chạy production trực tiếp qua `server.js`, chuẩn bị merge tuần tự các PR đã xếp chồng và chỉ đưa vào `main` sau khi checklist vận hành đạt yêu cầu.

## 1. Trạng thái kỹ thuật đã chốt

- `npm start` chạy trực tiếp `node server.js`.
- Production không tự sinh dữ liệu demo.
- `/api/reset-seed` bị vô hiệu ngoài DEMO_MODE.
- Serial Number hãng độc lập với mã HIS/BHXH.
- Không xóa cứng thiết bị đã có lịch sử nghiệp vụ.
- Luồng Sự cố -> Sửa chữa được ràng buộc toàn vẹn.
- Có đăng nhập, mật khẩu băm, session, phân quyền và giới hạn theo khoa.
- Upload nội bộ được bảo vệ, không public toàn bộ `uploads`.
- SQLite bật `foreign_keys=ON`, WAL và busy timeout.
- Bảo dưỡng/Kiểm định dùng hủy mềm để giữ lịch sử.
- Dependency production đã được kiểm tra bằng `npm audit --omit=dev`.
- QR công khai dùng payload tối thiểu và token HMAC gắn đúng thiết bị.
- `trust proxy` mặc định an toàn, chỉ bật khi cấu hình rõ.
- Excel dùng ExcelJS + compatibility layer, không dùng package `xlsx` cũ.
- Logo Bệnh viện Quân y 4 đã được bổ sung tại `public/assets/BVQY4.jpg`.

## 2. Checklist trước khi merge vào main

### Tự động - bắt buộc PASS

- [x] `npm ci`
- [x] `npm audit --omit=dev` = 0 vulnerability
- [x] `npm run check:safety`
- [x] `npm run test:p2`
- [x] `npm run test:p3:excel`
- [x] `npm run test:p3:reports`
- [x] `npm run test:p4:ui`
- [x] `npm run test:p4:role`
- [x] `npm run test:p4:dashboard`
- [x] `npm run test:p4:scope`
- [x] `npm run test:p5:qr`
- [x] `npm run test:p6:proxy`
- [x] `npm run test:p7:qr`
- [x] `npm run test:p7:client`
- [x] Khởi động DB production trắng: chỉ có danh mục nền + admin, không có thiết bị demo.
- [x] Khởi động DEMO_MODE và kiểm tra hủy mềm Bảo dưỡng/Kiểm định.
- [x] Không có `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, `.env` hoặc `node_modules` được theo dõi trong Git.
- [x] Có `public/assets/BVQY4.jpg` để hiển thị logo bệnh viện.

### Thủ công - trước khi chạy dữ liệu thật

- [ ] Tạo `.env` production với mật khẩu admin ban đầu mạnh.
- [x] Đăng nhập admin trên máy Windows nghiệm thu và đổi mật khẩu lần đầu.
- [ ] Sao lưu `db/qy4_ttbyt.sqlite` trước khi nâng cấp dữ liệu thật.
- [ ] Sao lưu `db/qr-signing-secret` cùng database.
- [ ] Sao lưu thư mục `uploads/`.
- [ ] Kiểm tra quyền truy cập của tài khoản Khoa Trang bị và tài khoản khoa sử dụng.
- [x] Thử đầy đủ: tạo thiết bị -> báo sự cố -> chuyển sửa chữa -> cập nhật -> hoàn thành -> kiểm tra lịch sử.
- [x] Thử tạo Bảo dưỡng và Kiểm định, xác nhận bản ghi liên kết đúng thiết bị.
- [ ] Thử hủy mềm Bảo dưỡng/Kiểm định trên máy nghiệm thu và xác nhận lịch sử vẫn còn trong DB.
- [ ] Thử báo cáo Excel A4 chính thức từ Trung tâm Báo cáo; dữ liệu báo cáo và một file Excel nghiệp vụ đã được xác nhận đúng, còn kiểm tra trình bày A4.
- [ ] Thử in QR mới và quét bằng điện thoại.
- [ ] Nếu dùng reverse proxy/tunnel, cấu hình `TRUST_PROXY` đúng số hop; nếu chạy trực tiếp/LAN giữ `false`.
- [x] Kiểm tra logo giao diện: `public/assets/BVQY4.jpg` đã được bổ sung từ logo chính thức do người dùng cung cấp.

## 3. Nghiệm thu thực tế trên Windows - 17/08/2026

Đã kiểm tra với Node.js 20.20.1, npm 10.8.2 và database production trắng:

- [x] `npm ci`: 0 vulnerability.
- [x] Màn hình đăng nhập và logo Bệnh viện Quân y 4 hiển thị đúng.
- [x] Tạo thiết bị mẫu `C7.SA.0001`, Serial `TEST26081701`; Serial được giữ độc lập, không bị chuyển sang mã BHXH.
- [x] Tạo sự cố -> Chuyển sửa chữa -> phiếu liên kết đúng sự cố/thiết bị.
- [x] Cập nhật sửa chữa -> hoàn thành -> thiết bị tự trở về `Đang hoạt động`.
- [x] Timeline sửa chữa giữ đúng các mốc 08:05 -> 08:06 -> 08:10.
- [x] Bảo dưỡng định kỳ lưu đúng thiết bị, khoa, ngày tiếp theo và kết quả.
- [x] Kiểm định lưu đúng thiết bị, đơn vị, ngày hết hạn và tự hiển thị `Còn hạn`.
- [x] Trung tâm Báo cáo phản ánh đúng 01 thiết bị, 01 phiếu sửa chữa, 01 lịch bảo dưỡng, 01 lịch kiểm định.

Lỗi phát hiện qua nghiệm thu và đã vá trên nhánh RC:

- [x] Sửa lệch 7 giờ ở `Thời gian cập nhật/thực hiện` của phiếu sửa chữa: dùng giờ địa phương của máy trạm thay vì UTC.
- [x] Sửa ô chọn thiết bị bằng datalist ở Bảo dưỡng và Kiểm định: chọn gợi ý/Tab/Enter/blur đều chốt đúng thiết bị và điền Khoa/Vị trí.
- [x] Phiếu sửa chữa đã kết thúc (`Đã hoàn thành`, `Không sửa được`, `Đã hủy`) không còn cho hủy trực tiếp trên giao diện RC để bảo toàn lịch sử.
- [x] Các nút xuất Excel chính của Thiết bị/Sự cố/Sửa chữa/Bảo dưỡng/Kiểm định đều trỏ về engine `export-a4`; Trung tâm Báo cáo cũng dùng cùng engine.

## 4. Thứ tự merge bắt buộc

Các PR hiện được xếp chồng theo branch. Không merge nhảy cóc.

1. PR #1 - `fix/public-structure` -> `main`
2. PR #2 - `fix/p0-safety` -> `fix/public-structure`
3. PR #3 - `fix/p1-incident-repair` -> `fix/p0-safety`
4. PR #4 - `fix/p2-auth-audit` -> `fix/p1-incident-repair`
5. PR #5 - `fix/p3-dependency-modules` -> `fix/p2-auth-audit`
6. PR #6 - `fix/p4-ui-integrity` -> `fix/p3-dependency-modules`
7. PR #7 - `fix/p5-qr-public` -> `fix/p4-ui-integrity`
8. PR #8 - `fix/p6-proxy-rate-limit` -> `fix/p5-qr-public`
9. PR #9 - `fix/p7-signed-qr` -> `fix/p6-proxy-rate-limit`
10. PR #10 - `fix/p8-consolidate-runtime` -> `fix/p7-signed-qr`
11. RC PR - `release/v5.0.0-rc1` -> `fix/p8-consolidate-runtime`

Sau khi merge tuần tự, kiểm tra lại `main` bằng cùng RC workflow trước khi gắn bản phát hành.

## 5. Không thực hiện trong RC1

- Không đổi cấu trúc database lớn nếu không có migration/test riêng.
- Không thêm tính năng mới ngoài sửa lỗi phát hiện trong smoke test.
- Không xóa các wrapper legacy `safe-start.js`, `p3-start.js`, `p7-start.js` trong RC1; chúng không còn nằm trên đường chạy production và được giữ tạm để đối chiếu/hồi quy.
- Không merge vào `main` nếu một test an toàn hoặc smoke test thất bại.
