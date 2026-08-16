# V2.6 - Giữ SQLite, hoàn thiện QR public và ổn định vận hành

## Thay đổi chính
- Giữ nguyên SQLite, không chuyển CSDL.
- Bổ sung link QR ngắn `/q/:id`, `/qr/:id`, `/thiet-bi/:id`.
- QR mới trỏ về `/q/<id>` thay vì trang dài.
- Bổ sung API kiểm tra cấu hình QR public: `/api/system/public-qr-check`.
- Cập nhật cảnh báo để tránh nhập tên miền giả/chưa cấu hình DNS.
- Thêm hướng dẫn triển khai QR thực tế: `QR_PUBLIC_SETUP_THUC_TE.md`.

## Lưu ý
QR chỉ hoạt động ngoài Internet khi `QR_PUBLIC_BASE_URL` là domain/tunnel public thật, ví dụ Cloudflare Tunnel, ngrok hoặc VPS + tên miền.
