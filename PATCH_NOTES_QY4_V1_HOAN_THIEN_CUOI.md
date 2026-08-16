# QY4 v1 - Hoàn thiện cuối

## Các nội dung đã chuẩn hóa

### 1. Dashboard / Tổng quan
- Bỏ số liệu Sự cố và Sửa chữa khỏi Tổng quan để tránh rối.
- Giữ 3 nhóm chính:
  - Tình trạng thiết bị: Tổng thiết bị / Đang hoạt động / Chờ sửa chữa / Ngừng hoạt động
  - Kiểm tra hôm nay: Đã kiểm tra / Bình thường / Có vấn đề
  - Cảnh báo đến hạn: Bảo dưỡng sắp đến hạn / Kiểm định sắp đến hạn

### 2. Bộ trạng thái thống nhất
- Thiết bị: Đang hoạt động / Chờ sửa chữa / Ngừng hoạt động
- Sự cố: Mới ghi nhận / Đã xử lý tại chỗ / Đã chuyển sửa chữa
- Sửa chữa: Đang xử lý / Chờ linh kiện / Đã hoàn thành / Không sửa được
- Kiểm tra thiết bị: Bình thường / Có vấn đề

### 3. Sự cố
- Bảng danh sách bỏ cột Khoa để thoáng hơn.
- Thêm cột Ảnh/Video.
- Form sự cố thêm Số điện thoại và Ảnh/Video đính kèm.
- Hỗ trợ ảnh/video cho sự cố:
  - Ảnh: jpg, jpeg, png, webp
  - Video: mp4, mov
  - Tối đa 5 ảnh/sự cố, mỗi ảnh 5MB
  - Tối đa 1 video/sự cố, video 30MB
- Ảnh/video có thể xem trực tiếp bằng modal.

### 4. QR điện thoại
- Form kiểm tra QR đồng bộ với sự cố.
- Chỉ có 2 kết quả: Bình thường / Có vấn đề.
- Nếu Có vấn đề mới hiện Mức độ, Mô tả vấn đề, Ảnh/Video.
- Có số điện thoại liên hệ.
- Nếu Có vấn đề thì tự tạo sự cố Mới ghi nhận.

### 5. Hồ sơ thiết bị
- Thu gọn đầu trang hồ sơ thiết bị.
- Thêm khối Tình trạng hiện tại:
  - Tình trạng
  - Bảo dưỡng gần nhất
  - Kiểm định gần nhất
  - Sự cố đang mở
  - Phiếu sửa chữa đang xử lý
- Thu nhỏ các ô thống kê nhanh.

### 6. Sửa chữa
- Bỏ trạng thái Mới tiếp nhận.
- Sửa chữa dùng 4 trạng thái: Đang xử lý / Chờ linh kiện / Đã hoàn thành / Không sửa được.
- Khi chuyển sự cố sang sửa chữa, phiếu mặc định là Đang xử lý.

## Cách test nhanh
1. Chạy `npm start`.
2. Mở `http://localhost:5000/dashboard.html`.
3. Kiểm tra Dashboard chỉ còn thiết bị, kiểm tra hôm nay và cảnh báo đến hạn.
4. Vào Sự cố, tạo sự cố kèm ảnh/video.
5. Kiểm tra cột Ảnh/Video hiển thị thumbnail/nút video.
6. Quét QR bằng điện thoại cùng mạng LAN, chọn Bình thường và Có vấn đề.
7. Khi Có vấn đề, kiểm tra sự cố mới xuất hiện trong tab Sự cố.
8. Mở Hồ sơ thiết bị, kiểm tra khối tình trạng hiện tại và thống kê nhanh.
