# Patch: Chuẩn hóa Lịch sử sửa chữa dạng Timeline

## Đã sửa

1. Lịch sử sửa chữa không còn hiển thị dạng bảng trong popup chính.
2. Chuyển sang giao diện Timeline, dễ đọc theo thứ tự thời gian.
3. Khi chuyển sự cố sang sửa chữa, hệ thống chỉ tạo 1 dòng lịch sử:
   - Trạng thái: Đang xử lý
   - Nội dung: Tạo phiếu sửa chữa từ sự cố SC-...
   - Chi phí: 0 đ
   - Loại: Tự động
4. Không còn hiển thị đồng thời hai dòng:
   - "Từ sự cố #..."
   - "Tiếp nhận từ sự cố..."
5. API `/api/repairs/:id/history` có chuẩn hóa dữ liệu lịch sử cũ để tránh hiển thị trùng dòng khi phiếu được tạo từ sự cố.
6. Lịch sử khi cập nhật phiếu sửa chữa sẽ ghi rõ:
   - Cập nhật
   - Hoàn thành
   - Tự động
7. Hồ sơ thiết bị khi bấm "Xem chi tiết" phiếu sửa chữa cũng hiển thị lịch sử dạng Timeline.

## File đã sửa

- `server.js`
- `public/maintenance.html`
- `public/maintenance.js`
- `public/device-detail.js`
- `public/styles.css`

## Cách test

1. Chạy:
   ```cmd
   npm start
   ```
2. Vào tab Sự cố.
3. Tạo sự cố mới.
4. Bấm "Chuyển sửa chữa".
5. Mở phiếu sửa chữa vừa tạo.
6. Bấm "Lịch sử".
7. Kiểm tra chỉ có 1 dòng đầu tiên dạng:
   "Tạo phiếu sửa chữa từ sự cố SC-..."
8. Cập nhật phiếu qua các trạng thái:
   - Đang xử lý
   - Chờ linh kiện
   - Đã hoàn thành
9. Kiểm tra Timeline tăng thêm từng mốc xử lý, không bị trùng thời gian.
