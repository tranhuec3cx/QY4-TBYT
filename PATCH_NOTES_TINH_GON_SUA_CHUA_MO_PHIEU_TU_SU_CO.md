# Patch: Tinh gọn trạng thái Sửa chữa + mở đúng phiếu từ Sự cố

## Nội dung đã sửa

### 1. Module Sửa chữa
Chỉ còn 5 trạng thái xử lý:
- Mới tiếp nhận
- Đang sửa chữa
- Chờ linh kiện
- Đã hoàn thành
- Không sửa được

Đã bỏ khỏi dropdown/bộ lọc/giao diện:
- Đang kiểm tra
- Đã sửa xong
- Bàn giao sử dụng
- Hủy

Dữ liệu cũ được chuẩn hóa khi hiển thị/API:
- Đang kiểm tra -> Mới tiếp nhận
- Đã sửa xong / Bàn giao sử dụng -> Đã hoàn thành
- Hủy -> Không sửa được

### 2. Đồng bộ tình trạng thiết bị
Khi lưu phiếu sửa chữa:
- Đã hoàn thành -> thiết bị: Đang hoạt động
- Không sửa được -> thiết bị: Ngừng hoạt động
- Mới tiếp nhận / Đang sửa chữa / Chờ linh kiện -> thiết bị: Chờ sửa chữa

### 3. Luồng Sự cố → Sửa chữa
Khi bấm “Chuyển sửa chữa” ở tab Sự cố:
- Tạo phiếu sửa chữa nếu chưa có.
- Gắn repairs.incident_id = incidents.id.
- Cập nhật sự cố thành “Đã chuyển sửa chữa”.
- Cập nhật thiết bị thành “Chờ sửa chữa”.
- Tự chuyển sang trang Sửa chữa và mở đúng phiếu vừa tạo:
  maintenance.html?repair_id=<id>&from=tickets

Phiếu sửa chữa tự điền sẵn:
- Thiết bị, mã thiết bị, tên thiết bị, khoa/vị trí, model/serial.
- Nguyên nhân hỏng = mô tả sự cố.
- Nội dung sửa chữa = “Tiếp nhận từ sự cố, chờ kiểm tra xử lý”.
- Người thực hiện = “Khoa Trang bị”.
- Hình thức = “Nội bộ”.
- Trạng thái = “Mới tiếp nhận”.
- Tình trạng thiết bị sau sửa = “Chờ sửa chữa”.

### 4. Dữ liệu cũ đã chuyển nhưng chưa có phiếu
Nếu sự cố đang là “Đã chuyển sửa chữa” nhưng chưa có phiếu liên kết, nút thao tác sẽ hiện “Tạo phiếu sửa chữa” để tạo lại liên kết đúng.

## Cách test nhanh
1. Mở `tickets.html`.
2. Tạo một sự cố mới, kiểm tra trạng thái là “Mới ghi nhận”.
3. Bấm “Chuyển sửa chữa”.
4. Kiểm tra hệ thống tự mở `maintenance.html?repair_id=...` và mở sẵn modal phiếu sửa chữa.
5. Kiểm tra các thông tin thiết bị/sự cố đã được điền sẵn.
6. Trong phiếu sửa chữa, thử đổi trạng thái:
   - Chờ linh kiện
   - Đang sửa chữa
   - Đã hoàn thành
   - Không sửa được
7. Kiểm tra bộ lọc trạng thái sửa chữa chỉ còn 5 trạng thái.
