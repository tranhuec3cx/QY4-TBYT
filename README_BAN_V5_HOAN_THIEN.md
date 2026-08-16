# QY4-TTBYT V5.0 – Bản hoàn thiện phục vụ báo cáo Hội đồng khoa

Phiên bản này tập trung vào 4 mục tiêu:

1. Chạy ổn định trên máy tính cá nhân bằng SQLite.
2. Giao diện đồng bộ, menu trái nền trắng/xám nhạt.
3. Chuẩn hóa nghiệp vụ: sự cố, sửa chữa, bảo dưỡng, kiểm định, QR.
4. Bổ sung Trung tâm báo cáo cho Khoa Trang bị.

## Điểm mới chính

- Trung tâm báo cáo mới với các nhóm: Tổng hợp thiết bị, Vận hành kỹ thuật, Kho - vật tư, Biểu mẫu quản lý/Cục Quân y.
- Xuất Excel từng báo cáo hoặc xuất sổ tổng hợp nhiều sheet.
- Bảng sửa chữa/bảo dưỡng/kiểm định được tinh gọn cột thời gian, khoa hiển thị mã ngắn.
- Bảo dưỡng bỏ trạng thái, có file đính kèm.
- Kiểm định bỏ số chứng nhận khỏi bảng, số giấy chỉ lưu trong chi tiết/form.
- Sự cố không dùng mức độ.
- QR giữ dạng ngắn để sau này chuyển server/domain không phải thay logic phần mềm.

## Cách chạy

1. Giải nén thư mục.
2. Chạy `CAI_DAT_VA_CHAY.bat`.
3. Mở trình duyệt tại `http://localhost:5000`.

## Ghi chú triển khai

Bản này vẫn dùng SQLite để thuận tiện báo cáo. Khi triển khai chính thức tại bệnh viện có thể nâng cấp sang SQL Server theo hạ tầng sẵn có.
