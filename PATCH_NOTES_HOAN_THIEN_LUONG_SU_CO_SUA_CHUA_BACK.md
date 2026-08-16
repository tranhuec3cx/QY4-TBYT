# Hoàn thiện luồng Sự cố → Sửa chữa + nút ←

## Nội dung đã chỉnh

1. Module Sự cố
- Đổi cột `Trạng thái xử lý` thành `Trạng thái sự cố`.
- Giữ 3 trạng thái nghiệp vụ:
  - Mới ghi nhận
  - Đã chuyển sửa chữa
  - Đã xử lý tại chỗ
- Bỏ thao tác rườm rà ở bảng Sự cố; bảng chỉ còn thao tác theo luồng:
  - Mới ghi nhận: Xem HS, Chuyển sửa chữa, Xử lý tại chỗ
  - Đã chuyển sửa chữa: Xem HS, Mở phiếu sửa chữa
  - Đã xử lý tại chỗ: Xem HS
- Không hiển thị trạng thái sửa chữa như `Chờ linh kiện`, `Đang sửa chữa` trong bảng Sự cố nữa.

2. Mở đúng phiếu sửa chữa
- API `/api/incidents` trả thêm:
  - `linked_repair_id`
  - `linked_repair_status`
- Nút `Mở phiếu sửa chữa` mở đúng phiếu theo `repair_id`, không chỉ mở tab Sửa chữa chung.
- Link mở dạng:
  - `/maintenance.html?repair_id=<id>&from=tickets`
- Trang Sửa chữa tự mở modal đúng phiếu sửa chữa liên kết và highlight dòng tương ứng.

3. Nút quay lại
- Bổ sung nút `←` ở đầu tiêu đề trang.
- Chỉ hiển thị ký hiệu mũi tên, không có chữ “Quay lại”.
- Có xử lý `from` trên URL:
  - `from=tickets` → về `tickets.html`
  - `from=maintenance` → về `maintenance.html`
  - `from=reports` → về `reports.html`
  - `from=device-detail&device_id=...` → về đúng hồ sơ thiết bị
- Nếu không có `from`, hệ thống dùng `history.back()`, nếu không có lịch sử thì về `index.html`.

4. Sửa chữa
- Đổi tiêu đề cột `Ngày sửa chữa` thành `Thời gian sửa chữa`.
- Khi mở phiếu từ sự cố, modal hiển thị nhãn nguồn: `Nguồn: Sự cố #...`.
- Thống kê nhanh dùng đúng trạng thái `Đang sửa chữa` thay vì `Đang xử lý`.

## Cách test nhanh

1. Vào `tickets.html`.
2. Tạo một sự cố mới.
3. Bấm `Chuyển sửa chữa`.
4. Sau khi tạo, bản ghi sự cố chuyển thành `Đã chuyển sửa chữa`.
5. Bấm `Mở phiếu sửa chữa`.
6. Hệ thống phải chuyển sang `maintenance.html?repair_id=...&from=tickets` và tự mở đúng phiếu sửa chữa.
7. Bấm nút `←` ở đầu trang Sửa chữa, hệ thống quay về Sự cố.
8. Kiểm tra bảng Sự cố không còn hiển thị trạng thái kiểu `Chờ linh kiện`, `Đang sửa chữa`.
