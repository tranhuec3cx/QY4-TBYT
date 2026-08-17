# QY4-TTBYT v5.0.0

**Bản chính thức** của phần mềm quản lý trang thiết bị y tế cho **Khoa Trang bị - Bệnh viện Quân y 4**.

Trạng thái: đã nghiệm thu RC1 trên Windows ngày 17/08/2026 và chuyển sang nhánh phát hành `release/v5.0.0`.

## Công nghệ

- Node.js + Express
- SQLite (`better-sqlite3`, WAL, foreign keys)
- HTML/CSS/JavaScript thuần
- ExcelJS cho nhập/xuất Excel A4
- QR thiết bị ký HMAC-SHA256

## Chức năng chính

- Quản lý danh mục và hồ sơ thiết bị y tế.
- Quản lý khoa/phòng, nhóm thiết bị và tài khoản người dùng.
- Sự cố → xử lý tại chỗ hoặc chuyển sang phiếu sửa chữa có liên kết.
- Quản lý sửa chữa, chi phí, trạng thái và lịch sử xử lý.
- Quản lý bảo dưỡng, kiểm định/hiệu chuẩn và tài liệu kỹ thuật.
- Dashboard cảnh báo quá hạn/sắp hạn bảo dưỡng, kiểm định, bảo hành và sửa chữa.
- Báo cáo tổng hợp, báo cáo theo khoa/nhóm và xuất Excel A4 có phần đầu hành chính.
- QR thiết bị để kiểm tra nhanh/báo sự cố trên điện thoại; payload công khai được tối thiểu hóa và ràng buộc bằng chữ ký theo đúng thiết bị.
- Nhật ký bảo mật/audit theo tài khoản đăng nhập.

## Trạng thái hardening P0-P8

`npm start` chạy **trực tiếp `server.js`**. Các lớp bảo vệ P0-P7 đã được hợp nhất vào backend chính; không còn phụ thuộc chuỗi vá source `safe-start.js → p3-start.js → p7-start.js` khi chạy production.

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

Các file `safe-start.js`, `p3-start.js`, `p7-start.js` hiện chỉ còn phục vụ đối chiếu/hồi quy; **không phải đường chạy production**.

## Cài đặt bản chính thức trên Windows

Khuyến nghị Node.js 20.x.

Cách đơn giản nhất: chạy

```text
CAI_DAT_VA_CHAY.bat
```

Script chính thức sẽ:

1. kiểm tra Node.js/npm;
2. tạo `.env` production tối thiểu nếu chưa có;
3. chặn nếu phát hiện `DEMO_MODE=true`;
4. chạy `npm ci`;
5. chạy `npm audit --omit=dev`;
6. chạy `npm run check:safety`;
7. chỉ khởi động server khi các bước trên đạt.

Có thể chạy thủ công:

```bash
npm ci
npm audit --omit=dev
npm run check:safety
npm start
```

Không copy `node_modules` từ máy khác vì `better-sqlite3` có thành phần biên dịch theo hệ điều hành.

## Cấu hình production

Nếu tự tạo `.env`, tối thiểu nên có:

```text
PORT=5000
DEMO_MODE=false
ADMIN_INITIAL_PASSWORD=<mật khẩu mạnh từ 10 ký tự trở lên>
AUTH_SESSION_HOURS=8
TRUST_PROXY=false
QR_SIGNING_SECRET=
QR_PUBLIC_BASE_URL=
```

Nếu chưa đặt `ADMIN_INITIAL_PASSWORD` ở lần chạy đầu, hệ thống sinh mật khẩu quản trị tạm thời và in một lần trên cửa sổ chạy; sau đăng nhập bắt buộc đổi mật khẩu.

Nếu QR chỉ dùng trong cùng Wi-Fi/LAN, có thể để trống `QR_PUBLIC_BASE_URL` và dùng địa chỉ LAN mà server hiển thị. Nếu cần mở QR từ Internet/4G/5G, phải cấu hình domain/tunnel phù hợp và `TRUST_PROXY` đúng môi trường.

## Chạy phần mềm hằng ngày

```text
CHAY_PHAN_MEM.bat
```

hoặc:

```bash
npm start
```

Sau đó mở:

```text
http://localhost:5000
```

Chỉ dùng dữ liệu demo khi chủ động chạy:

```bash
npm run demo
```

**Không dùng DEMO_MODE trên database production.**

## QR thiết bị

QR mới được phát hành bởi tài khoản Khoa Trang bị/Quản trị. URL QR có token HMAC gắn với `device_code` hoặc ID thiết bị; token của thiết bị này không dùng được cho thiết bị khác.

Nếu không cấu hình `QR_SIGNING_SECRET`, hệ thống tự tạo khóa tại:

```text
db/qr-signing-secret
```

**Phải sao lưu file này cùng database.** Nếu mất/đổi khóa, QR đã in trước đó sẽ bị vô hiệu và cần in lại.

QR cũ không có token ký từ trước P7 cần được in lại.

## Excel A4

Các nút Xuất Excel chính của Thiết bị, Sự cố, Sửa chữa, Bảo dưỡng, Kiểm định và Trung tâm Báo cáo dùng cùng engine A4 phía server.

Mẫu chính có phần đầu:

```text
CỤC HẬU CẦN - KỸ THUẬT QUÂN KHU 4
BỆNH VIỆN QUÂN Y 4

[TÊN BÁO CÁO]
(Từ ngày ... đến ngày ...)
```

## Sao lưu tối thiểu

Trước khi nâng cấp hoặc di chuyển máy chủ, tắt server rồi sao lưu đồng thời:

```text
db/qy4_ttbyt.sqlite
db/qy4_ttbyt.sqlite-wal
db/qy4_ttbyt.sqlite-shm
db/qr-signing-secret
uploads/
.env
```

Nếu vẫn tồn tại `-wal`/`-shm`, không chỉ copy riêng file `.sqlite`.

Không đưa các file này lên repository public.

## Dữ liệu của bản phát hành

Repository chính thức không chứa database, WAL/SHM, uploads, `.env` hoặc khóa QR thật. Khi cài mới, hệ thống tạo database production trắng: danh mục nền + 01 admin, không có thiết bị demo.

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

Xem thêm:

- `RELEASE_V5.0.0.md` - biên bản kỹ thuật/chốt phát hành.
- `DEPLOYMENT_GUIDE_V5.md` - hướng dẫn triển khai chi tiết.
- `RELEASE_CANDIDATE_V5.md` - lịch sử nghiệm thu RC1.
