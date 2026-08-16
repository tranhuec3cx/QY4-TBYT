# Hoàn thiện nghiệp vụ Sự cố / Sửa chữa / Hồ sơ thiết bị

## 1. Sự cố
- Giữ đúng 3 trạng thái: `Mới ghi nhận`, `Đã chuyển sửa chữa`, `Đã xử lý tại chỗ`.
- Khi chọn hoặc bấm `Xử lý tại chỗ`, bắt buộc nhập **Nội dung xử lý tại chỗ**.
- Nội dung xử lý tại chỗ được lưu riêng vào `local_resolution_note` và hiển thị trong bảng/chi tiết sự cố.
- Sự cố đã chuyển sửa chữa không được xóa.

## 2. Sửa chữa
- Bảng sửa chữa đổi mốc thời gian chính thành **Thời gian tiếp nhận**.
- Bổ sung các trường thời gian kỹ thuật trong database:
  - `received_at` - thời gian tiếp nhận
  - `updated_at` - thời gian cập nhật gần nhất
  - `completed_at` - thời gian hoàn thành
- Khi tạo/sửa phiếu, hệ thống tự cập nhật các mốc thời gian phù hợp.
- Chỉ cho xóa phiếu sửa chữa khi còn `Mới tiếp nhận` và chưa có lịch sử xử lý quan trọng.

## 3. Lịch sử sửa chữa
- Chuyển lịch sử xử lý sang dạng bảng gồm:
  - STT
  - Thời gian
  - Người cập nhật
  - Trạng thái
  - Nội dung thực hiện
  - Kinh phí
  - Ghi chú

## 4. Hồ sơ thiết bị
- Tách `Sự cố ghi nhận` thành tab riêng.
- Tab `Nhật ký sửa chữa` chỉ hiển thị ngắn gọn phần sửa chữa:
  - STT
  - Thời gian tiếp nhận
  - Nguyên nhân hỏng
  - Trạng thái
  - Kinh phí
  - Kết quả
  - Xem chi tiết
- Bỏ cột `Mã phiếu` khỏi bảng Nhật ký sửa chữa.
- Khi bấm `Xem chi tiết`, mở thông tin phiếu sửa chữa và bảng lịch sử xử lý.

## Cách test nhanh
1. Vào `tickets.html`, tạo sự cố mới.
2. Chọn `Đã xử lý tại chỗ` nhưng không nhập nội dung xử lý: hệ thống phải cảnh báo.
3. Nhập nội dung xử lý tại chỗ và lưu: bảng sự cố phải hiển thị nội dung này.
4. Tạo sự cố khác, bấm `Chuyển sửa chữa`: hệ thống mở đúng phiếu sửa chữa.
5. Cập nhật phiếu sửa chữa nhiều lần, bấm `Lịch sử`: lịch sử phải hiển thị dạng bảng.
6. Vào `device-detail.html`, mở tab `Sự cố ghi nhận` và `Nhật ký sửa chữa` để kiểm tra dữ liệu đã tách riêng.
