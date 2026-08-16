# QY4-TTBYT V4.0 - Bản giao diện khoa học để báo cáo Hội đồng khoa

## Nội dung đã hoàn thiện

- Giữ nguyên module **Thiết bị y tế** theo yêu cầu.
- Đổi nền menu trái sang nền trắng/xám nhạt, gọn và khoa học hơn.
- Tối giản module **Sự cố**:
  - Bỏ cột **Mức độ**.
  - Bỏ bộ lọc **Mức độ**.
  - Bỏ trường **Mức độ** trong form ghi nhận sự cố.
  - Bỏ mức độ ở giao diện QR/kiểm tra công khai.
- Quy trình sự cố hiện còn:
  - Ghi nhận sự cố.
  - Xem hồ sơ thiết bị.
  - Chuyển sửa chữa.
  - Xử lý tại chỗ.
- Dữ liệu vẫn chạy bằng SQLite, phù hợp chạy ổn định trên máy tính cá nhân để báo cáo.

## Cách chạy

1. Giải nén thư mục.
2. Bấm `CAI_DAT_VA_CHAY.bat`.
3. Mở trình duyệt: `http://localhost:5000`.

## Ghi chú

Bản này ưu tiên sự ổn định, dễ báo cáo và thao tác nhanh trước Hội đồng khoa. Phần triển khai lên máy chủ SQL Server bệnh viện có thể thực hiện ở giai đoạn sau.
