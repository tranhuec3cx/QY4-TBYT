# QY4-TTBYT

Phần mềm quản lý trang thiết bị y tế cho **Khoa Trang bị - Bệnh viện Quân y 4**.

## Công nghệ

- Node.js + Express
- SQLite (`better-sqlite3`, WAL, foreign keys)
- HTML/CSS/JavaScript thuần
- ExcelJS cho nhập/xuất Excel
- QR thiết bị ký HMAC-SHA256

## Chức năng chính

- Quản lý danh mục và hồ sơ thiết bị y tế.
- Quản lý khoa/phòng, nhóm thiết bị và tài khoản người dùng.
- Sự cố → xử lý tại chỗ hoặc chuyển sang phiếu sửa chữa có liên kết.
- Quản lý sửa chữa, chi phí, trạng thái và lịch sử xử lý.
- Quản lý bảo dưỡng, kiểm định/hiệu chuẩn và tài liệu kỹ thuật.
- Dashboard cảnh báo quá hạn/sắp hạn bảo dưỡng, kiểm định, bảo hành và sửa chữa.
- Báo cáo tổng hợp, báo cáo theo khoa/nhóm, xuất Excel.
- QR thiết bị để kiểm tra nhanh/báo sự cố; payload công khai được tối thiểu hóa và ràng buộc bằng chữ ký theo đúng thiết bị.
- Nhật ký bảo mật/audit theo tài khoản đăng nhập.

## Trạng thái hardening P0-P8

Từ P8, `npm start` chạy **trực tiếp `server.js`**. Các lớp bảo vệ P0-P7 đã được hợp nhất vào backend chính; không còn phụ thuộc chuỗi vá source `safe-start.js → p3-start.js → p7-start.js` khi chạy production.

Các bảo vệ chính đang có:

- Production không tự tạo/thay đổi dữ liệu demo; reset seed bị khóa.
- Serial Number hãng độc lập với mã HIS/BHXH.
- Không xóa cứng thiết bị đã có lịch sử nghiệp vụ.
- Toàn vẹn liên kết Sự cố ↔ Sửa chữa và khóa đổi thiết bị sau khi tạo phiếu.
- Đăng nhập, mật khẩu băm scrypt, session HttpOnly/SameSite, phân quyền theo vai trò/khoa và audit.
- Tệp tài liệu/QR không còn được public toàn bộ thư mục uploads.
- Bảo dưỡng và kiểm định dùng hủy mềm để giữ lịch sử.
- `trust proxy` mặc định tắt; chỉ bật khi quản trị cấu hình reverse proxy rõ ràng.
- QR công khai dùng chữ ký HMAC gắn đúng thiết bị; backend không tin `device_id` do client tự gửi.
- `.env` được nạp trước khi đọc PORT/QR/TRUST_PROXY/DEMO_MODE.
- SQLite bật `foreign_keys=ON`, WAL và `busy_timeout`.

Các file `safe-start.js`, `p3-start.js`, `p7-start.js` hiện chỉ còn phục vụ đối chiếu/hồi quy trong giai đoạn chuyển đổi; **không phải đường chạy production**.

## Cài đặt

Khuyến nghị Node.js 20+.

```bash
npm ci
```

Nếu không có `package-lock.json` tương ứng thì dùng:

```bash
npm install
```

Không copy `node_modules` từ máy khác vì `better-sqlite3` có thành phần biên dịch theo hệ điều hành.

## Cấu hình production

Sao chép `.env.example` thành `.env`, sau đó chỉnh các giá trị cần thiết. `.env` đã được loại khỏi Git.

Tối thiểu nên kiểm tra:

```text
PORT=5000
DEMO_MODE=false
ADMIN_INITIAL_PASSWORD=<mật khẩu mạnh từ 10 ký tự trở lên>
AUTH_SESSION_HOURS=8
TRUST_PROXY=false
QR_PUBLIC_BASE_URL=https://ten-mien-cua-don-vi
```

Nếu chưa đặt `ADMIN_INITIAL_PASSWORD` ở lần chạy đầu, hệ thống sinh mật khẩu quản trị tạm thời và in một lần trên cửa sổ chạy; sau đăng nhập bắt buộc đổi mật khẩu.

## Chạy phần mềm

```bash
npm start
```

Hoặc trên Windows dùng:

```text
CHAY_PHAN_MEM.bat
```

Sau đó mở:

```text
http://localhost:5000
```

Chỉ dùng dữ liệu demo khi chủ động chạy:

```bash
npm run demo
```

Không dùng DEMO_MODE trên database production.

## QR thiết bị

QR mới được phát hành bởi tài khoản Khoa Trang bị/Quản trị. URL QR có token HMAC gắn với `device_code` hoặc ID thiết bị; token của thiết bị này không dùng được cho thiết bị khác.

Nếu không cấu hình `QR_SIGNING_SECRET`, hệ thống tự tạo khóa tại:

```text
db/qr-signing-secret
```

**Phải sao lưu file này cùng database.** Nếu mất/đổi khóa, QR đã in trước đó sẽ bị vô hiệu và cần in lại.

QR cũ không có token ký từ trước P7 cần được in lại.

## Sao lưu tối thiểu

Trước khi nâng cấp hoặc di chuyển máy chủ, sao lưu:

```text
db/qy4_ttbyt.sqlite
db/qr-signing-secret
uploads/
.env
```

Không đưa các file này lên repository public.

## Kiểm tra trước triển khai

```bash
npm run check:safety
npm run test:p2
npm run test:p3:excel
npm run test:p3:reports
npm run test:p4:ui
npm run test:p4:role
npm run test:p4:dashboard
npm run test:p4:scope
npm run test:p5:qr
npm run test:p6:proxy
npm run test:p7:qr
npm run test:p7:client
```

GitHub Actions `Safety Check P0-P8` còn kiểm tra khởi động database production trắng, DEMO_MODE, vòng đời hủy mềm và toàn bộ chuỗi bảo mật.

Xem hướng dẫn triển khai chi tiết tại `DEPLOYMENT_GUIDE_V5.md`.
