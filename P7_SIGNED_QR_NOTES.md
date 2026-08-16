# P7 - Signed QR public access

Nhánh này xây trên P6. Mục tiêu: mỗi QR thiết bị phải có chữ ký HMAC gắn với đúng `device_code`/`id`, để không thể chỉ đoán mã thiết bị rồi gọi API public hoặc gửi kiểm tra giả.

Nguyên tắc triển khai:
- URL QR chứa `token` ký bằng HMAC-SHA256.
- Khóa ký lấy từ `QR_SIGNING_SECRET`; nếu chưa cấu hình thì tự tạo và lưu cục bộ trong `db/qr-signing-secret` (không commit).
- Token là dài hạn để nhãn QR đã in không tự hết hạn; có thể vô hiệu toàn bộ nhãn cũ bằng cách đổi khóa ký và in lại.
- API public nhận diện thiết bị và `POST /api/qr/checks` phải có token hợp lệ, gắn đúng thiết bị.
- Endpoint sinh token chỉ dành cho người dùng Khoa Trang bị/Quản trị đã đăng nhập.
- Giữ rate-limit P5/P6 và toàn bộ kiểm thử P0-P6.
