# Hướng dẫn cấu hình QR dùng được bằng điện thoại qua Internet

Mục tiêu: điện thoại chỉ cần có mạng Internet/4G/5G là quét QR và mở được trang kiểm tra/báo sự cố thiết bị, không cần cùng mạng LAN/Wi-Fi với máy tính chạy phần mềm.

## Nguyên tắc

QR phải trỏ tới một địa chỉ public HTTPS, ví dụ:

```text
https://ttbyt-qy4.example.vn/inspect.html?id=123
```

Không dùng các địa chỉ sau cho QR nếu muốn truy cập ngoài mạng nội bộ:

```text
http://localhost:5000
http://127.0.0.1:5000
http://192.168.x.x:5000
http://10.x.x.x:5000
```

## Cách 1: Triển khai thật bằng domain cố định

1. Cài phần mềm trên máy chủ nội bộ hoặc VPS.
2. Trỏ domain/subdomain tới máy chủ, ví dụ `ttbyt-qy4.example.vn`.
3. Cấu hình reverse proxy HTTPS bằng Nginx/Caddy/IIS/Apache.
4. Chạy phần mềm với biến môi trường:

```bash
QR_PUBLIC_BASE_URL=https://ttbyt-qy4.example.vn npm start
```

Trên Windows PowerShell:

```powershell
$env:QR_PUBLIC_BASE_URL="https://ttbyt-qy4.example.vn"
npm start
```

## Cách 2: Demo nhanh bằng Cloudflare Tunnel

Cách này phù hợp khi chưa có domain chính thức.

1. Chạy phần mềm:

```bash
npm start
```

2. Mở tunnel tới cổng 5000, ví dụ Cloudflare Tunnel/ngrok/localtunnel.
3. Lấy link HTTPS public được cấp, ví dụ:

```text
https://abc.trycloudflare.com
```

4. Khởi động lại phần mềm với link đó:

```bash
QR_PUBLIC_BASE_URL=https://abc.trycloudflare.com npm start
```

5. Vào danh sách thiết bị → QR → in/quét lại QR mới.

## Lưu ý vận hành

- Khi đổi domain/tunnel phải in/quét lại QR mới.
- Nên dùng HTTPS để điện thoại tải ảnh/video sự cố ổn định hơn.
- Nếu dùng tunnel miễn phí, link có thể thay đổi sau mỗi lần chạy; triển khai thật nên dùng domain cố định.
- Trang QR chỉ hiển thị thông tin cần thiết của thiết bị, không hiển thị hồ sơ nội bộ.
