# Bản chỉnh giao diện Demo Hội đồng - Version 1.0

Đã chỉnh theo phạm vi báo cáo Hội đồng Khoa Trang bị:

## Phạm vi menu chính
- Thiết bị
- Sự cố
- Sửa chữa
- Bảo dưỡng
- Kiểm định

Các mục Dashboard, Báo cáo, Vận hành, Cài đặt phức tạp được ẩn khỏi menu chính để giao diện gọn hơn khi demo.

## Các điểm đã chỉnh
- Giao diện dùng font Segoe UI/Inter thay Times New Roman.
- Sidebar gọn hơn, màu xanh y tế, tiêu đề “QL Trang thiết bị y tế”.
- Danh sách thiết bị dùng “Serial Number”.
- Phiếu sự cố bỏ luồng “Xử lý tại chỗ”, chỉ còn báo sự cố và chuyển sửa chữa.
- Phiếu sửa chữa giữ 4 trạng thái: Đang xử lý, Chờ linh kiện, Đã hoàn thành, Không sửa được.
- Hình thức sửa chữa: Nội bộ, Bảo hành, Thuê ngoài.
- Bảo dưỡng/kiểm định làm gọn theo Version 1.0.

## Cách chạy
Chạy file:

CHAY_PHAN_MEM.bat

hoặc mở terminal trong thư mục này và chạy:

npm start

Sau đó mở:

http://localhost:3000
