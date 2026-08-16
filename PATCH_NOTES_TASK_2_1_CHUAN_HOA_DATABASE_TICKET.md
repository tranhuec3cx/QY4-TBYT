# TASK 2.1 - Chuẩn hóa database Ticket/Sự cố

## Nội dung đã chỉnh

### 1. Bổ sung cột cho bảng `incidents`
Các cột mới:
- `incident_code`: mã sự cố tự sinh, ví dụ `SC-20260626-0001`
- `device_code_snapshot`: mã thiết bị tại thời điểm ghi nhận
- `device_name_snapshot`: tên thiết bị tại thời điểm ghi nhận
- `department_snapshot`: khoa/phòng tại thời điểm ghi nhận
- `location_snapshot`: vị trí tại thời điểm ghi nhận
- `created_at`: thời điểm tạo bản ghi
- `updated_at`: thời điểm cập nhật gần nhất
- `updated_by`: người cập nhật gần nhất

Các cột đã có trước đó vẫn giữ:
- `reporter_phone`
- `local_resolution_note`

### 2. Tự migrate dữ liệu cũ
Khi chạy `npm start`, hệ thống tự:
- thêm cột còn thiếu bằng `ALTER TABLE`
- sinh mã sự cố cho dữ liệu cũ
- lưu snapshot mã thiết bị/tên thiết bị/khoa/vị trí cho dữ liệu cũ

### 3. Đồng bộ khi tạo sự cố
Các API sau tự hoàn thiện thông tin sự cố:
- `POST /api/incidents`
- `POST /api/qr/incidents`
- `POST /api/qr/checks` khi chọn “Có vấn đề”

### 4. Đồng bộ khi cập nhật sự cố
`PUT /api/incidents/:id` tự cập nhật:
- `updated_at`
- `updated_by`
- snapshot thiết bị nếu thay đổi thiết bị

### 5. Đồng bộ khi chuyển sửa chữa
Khi bấm “Chuyển sửa chữa”, sự cố được cập nhật:
- `status = Đã chuyển sửa chữa`
- `updated_at`
- `updated_by`

## Test nhanh
1. Chạy:
```bash
npm start
```
2. Mở:
```text
http://localhost:5000/tickets.html
```
3. Tạo một sự cố mới.
4. Kiểm tra bản ghi lưu thành công.
5. Nếu muốn kiểm tra database, mở SQLite và xem bảng `incidents` có các cột mới.
