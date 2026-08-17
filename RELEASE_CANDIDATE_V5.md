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

## 2. Checklist trước khi merge vào main

### Tự động - bắt buộc PASS

- [ ] `npm ci`
- [ ] `npm audit --omit=dev` = 0 vulnerability
- [ ] `npm run check:safety`
- [ ] `npm run test:p2`
- [ ] `npm run test:p3:excel`
- [ ] `npm run test:p3:reports`
- [ ] `npm run test:p4:ui`
- [ ] `npm run test:p4:role`
- [ ] `npm run test:p4:dashboard`
- [ ] `npm run test:p4:scope`
- [ ] `npm run test:p5:qr`
- [ ] `npm run test:p6:proxy`
- [ ] `npm run test:p7:qr`
- [ ] `npm run test:p7:client`
- [ ] Khởi động DB production trắng: chỉ có danh mục nền + admin, không có thiết bị demo.
- [ ] Khởi động DEMO_MODE và kiểm tra hủy mềm Bảo dưỡng/Kiểm định.
- [ ] Không có `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, `.env` hoặc `node_modules` được theo dõi trong Git.

### Thủ công - trước khi chạy dữ liệu thật

- [ ] Tạo `.env` production với mật khẩu admin ban đầu mạnh.
- [ ] Đổi mật khẩu admin ngay lần đăng nhập đầu.
- [ ] Sao lưu `db/qy4_ttbyt.sqlite` trước khi nâng cấp dữ liệu thật.
- [ ] Sao lưu `db/qr-signing-secret` cùng database.
- [ ] Sao lưu thư mục `uploads/`.
- [ ] Kiểm tra quyền truy cập của tài khoản Khoa Trang bị và tài khoản khoa sử dụng.
- [ ] Thử đầy đủ: tạo thiết bị -> báo sự cố -> chuyển sửa chữa -> hoàn thành/hủy -> kiểm tra lịch sử.
- [ ] Thử tạo Bảo dưỡng, Kiểm định, hủy mềm và xác nhận lịch sử vẫn còn trong DB.
- [ ] Thử xuất ít nhất 01 báo cáo Excel.
- [ ] Thử in QR mới và quét bằng điện thoại.
- [ ] Nếu dùng reverse proxy/tunnel, cấu hình `TRUST_PROXY` đúng số hop; nếu chạy trực tiếp/LAN giữ `false`.
- [ ] Kiểm tra logo giao diện. Hiện `public/assets/BVQY4.jpg` chưa có trong repo mới; đây là hạng mục giao diện cần bổ sung trước khi bàn giao chính thức nếu muốn hiển thị logo bệnh viện.

## 3. Thứ tự merge bắt buộc

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

## 4. Không thực hiện trong RC1

- Không đổi cấu trúc database lớn nếu không có migration/test riêng.
- Không thêm tính năng mới ngoài sửa lỗi phát hiện trong smoke test.
- Không xóa các wrapper legacy `safe-start.js`, `p3-start.js`, `p7-start.js` trong RC1; chúng không còn nằm trên đường chạy production và được giữ tạm để đối chiếu/hồi quy.
- Không merge vào `main` nếu một test an toàn hoặc smoke test thất bại.
