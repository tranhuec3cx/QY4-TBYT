# Thiết lập QR dùng bằng điện thoại qua Internet

## Mục tiêu
Điện thoại chỉ cần có Internet là quét QR mở được hồ sơ thiết bị, không cần cùng mạng LAN với máy tính chạy phần mềm.

## Nguyên tắc
Mã QR chỉ chứa một đường dẫn, ví dụ:

```text
https://ttbyt-qy4.example.vn/q/13
```

Vì vậy QR hoạt động hay không phụ thuộc vào địa chỉ public của phần mềm, không phụ thuộc SQLite hay PostgreSQL.

## Cấu hình chuẩn
Tạo file `.env` hoặc đặt biến môi trường:

```env
PORT=5000
QR_PUBLIC_BASE_URL=https://ten-mien-public-that
PUBLIC_BASE_URL=https://ten-mien-public-that
```

Sau đó chạy:

```bash
npm install
npm start
```

## Không dùng tên miền chưa tồn tại
Ví dụ `qy4.benhvien.vn` nếu chưa cấu hình DNS sẽ báo:

```text
DNS_PROBE_FINISHED_NXDOMAIN
```

Đây là lỗi tên miền chưa tồn tại/chưa trỏ DNS, không phải lỗi mã QR.

## Cách test nhanh không cần mua tên miền

### Dùng ngrok
```bash
ngrok http 5000
```
Lấy link HTTPS ngrok rồi cấu hình:

```env
QR_PUBLIC_BASE_URL=https://xxxx.ngrok-free.app
```

### Dùng Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:5000
```
Lấy link HTTPS Cloudflare rồi cấu hình:

```env
QR_PUBLIC_BASE_URL=https://xxxx.trycloudflare.com
```

## Link QR mới
Từ bản V2.6, QR dùng link ngắn:

```text
/q/<id-thiet-bi>
```

Ví dụ:

```text
https://ten-mien-public/q/13
```

Khi mở, hệ thống tự chuyển tới trang kiểm tra QR trên điện thoại.

## Kiểm tra trạng thái QR
Mở API:

```text
/api/system/qr-origins
/api/system/public-qr-check
```

Nếu `is_public_ready = true` và base URL là HTTPS public thật thì điện thoại ngoài mạng mở được.
