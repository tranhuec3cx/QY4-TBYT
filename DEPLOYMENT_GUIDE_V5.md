# TRIỂN KHAI QY4-TTBYT V5

## 1. Nguyên tắc

- Production chạy trực tiếp bằng `npm start` → `node server.js`.
- `DEMO_MODE=false` trên máy dữ liệu thật.
- Không copy `node_modules` từ máy khác.
- Không đưa `.env`, database, WAL/SHM, uploads hoặc khóa QR lên GitHub.

## 2. Chuẩn bị máy chủ

1. Cài Node.js 20 trở lên.
2. Chép/clone source về máy chủ.
3. Tại thư mục phần mềm chạy:

```bash
npm ci
```

4. Sao chép `.env.example` thành `.env`.

## 3. Cấu hình `.env`

Ví dụ production nội bộ:

```text
PORT=5000
DEMO_MODE=false
ADMIN_INITIAL_PASSWORD=<mat-khau-manh-tu-10-ky-tu>
AUTH_SESSION_HOURS=8
TRUST_PROXY=false
QR_PUBLIC_BASE_URL=
```

Nếu chạy sau reverse proxy/tunnel do đơn vị kiểm soát, cấu hình `TRUST_PROXY` theo số hop thực tế, ví dụ:

```text
TRUST_PROXY=1
```

Không đặt `TRUST_PROXY=true` chỉ để thử nghiệm.

Nếu dùng QR qua Internet/4G/5G, cấu hình domain HTTPS ổn định:

```text
QR_PUBLIC_BASE_URL=https://ttbyt.example.vn
```

## 4. Khởi động lần đầu

Chạy:

```bash
npm start
```

Hoặc Windows:

```text
CHAY_PHAN_MEM.bat
```

Mở `http://localhost:5000`.

Nếu chưa cấu hình mật khẩu admin ban đầu, xem mật khẩu tạm thời trên cửa sổ chạy phần mềm và đổi ngay sau đăng nhập.

## 5. QR bảo mật

QR được ký HMAC theo đúng thiết bị. Nếu `QR_SIGNING_SECRET` không được khai báo, phần mềm tạo khóa cục bộ tại:

```text
db/qr-signing-secret
```

Cần sao lưu khóa này cùng database. Không công khai khóa. Mất hoặc thay khóa đồng nghĩa QR đã in trước đó không còn hợp lệ và phải in lại.

QR cũ trước P7 không có token phải in lại.

## 6. Sao lưu trước nâng cấp

Dừng phần mềm trước khi sao lưu nhất quán. Sao lưu tối thiểu:

```text
db/qy4_ttbyt.sqlite
db/qr-signing-secret
uploads/
.env
```

Nếu đang dùng WAL và chưa dừng tiến trình, phải sao lưu nhất quán cả DB/WAL/SHM hoặc dùng cơ chế backup SQLite; không chỉ copy riêng file `.sqlite` khi server đang ghi dữ liệu.

## 7. Kiểm tra trước khi dùng dữ liệu thật

Chạy:

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

Trên GitHub, `Safety Check P0-P8` phải PASS.

## 8. Kiểm tra nghiệp vụ thủ công sau triển khai

- Đăng nhập Admin; đổi mật khẩu; đăng xuất/đăng nhập lại.
- Tài khoản khoa chỉ thấy thiết bị/sự cố của khoa mình.
- Tạo thiết bị thử và kiểm tra Serial không tự chuyển sang mã HIS/BHXH.
- Báo sự cố → xử lý tại chỗ.
- Báo sự cố → chuyển sửa chữa → hoàn thành/hủy phiếu và kiểm tra trạng thái liên kết.
- Tạo bảo dưỡng/kiểm định → hủy bản ghi nhập nhầm và xác nhận hồ sơ vẫn còn trong lịch sử.
- Xuất Excel/Báo cáo.
- Phát hành QR mới, quét bằng điện thoại, gửi kiểm tra bình thường và báo vấn đề.
- Thử sửa `device_id`/mã trên URL QR: token không được dùng cho thiết bị khác.

## 9. Không thực hiện trên production

- Không chạy `npm run demo`.
- Không bật reset seed.
- Không xóa trực tiếp file database để “làm mới”.
- Không chỉnh dữ liệu trực tiếp bằng SQLite nếu chưa sao lưu và chưa xác định tác động quan hệ.
- Không tải database, uploads, `.env` hoặc `qr-signing-secret` lên repository public.
