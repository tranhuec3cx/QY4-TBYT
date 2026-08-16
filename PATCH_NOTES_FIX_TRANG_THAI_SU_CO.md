# Patch: Sửa triệt để trạng thái sự cố

## Đã sửa

- Module Sự cố chỉ còn 3 trạng thái hợp lệ:
  - Mới ghi nhận
  - Đã chuyển sửa chữa
  - Đã xử lý tại chỗ
- Bỏ trạng thái “Đã chuyển sửa chữa” khỏi dropdown form ghi nhận sự cố. Trạng thái này chỉ do hệ thống tự cập nhật khi bấm “Chuyển sửa chữa”.
- Chuẩn hóa dữ liệu cũ khi server khởi động:
  - Chờ linh kiện / Đang kiểm tra / Đang sửa chữa / Đã sửa xong / Bàn giao sử dụng → Đã chuyển sửa chữa
  - Đang xử lý / Theo dõi / Đã ghi nhận → Mới ghi nhận
  - Đã xử lý / Đóng / Không cần sửa chữa → Đã xử lý tại chỗ
- Khi GET /api/incidents, backend luôn trả về trạng thái sự cố đã chuẩn hóa.
- Frontend tickets.js cũng chuẩn hóa lại trạng thái để tránh dữ liệu cũ hiển thị sai.
- Nếu sự cố có linked_repair_id thì trạng thái hiển thị là “Đã chuyển sửa chữa”.
- Nút thao tác theo đúng trạng thái:
  - Mới ghi nhận: Xem HS / Chuyển sửa chữa / Xử lý tại chỗ
  - Đã chuyển sửa chữa: Xem HS / Mở phiếu sửa chữa
  - Đã xử lý tại chỗ: Xem HS

## Cách test

1. Chạy `npm start`.
2. Mở `http://localhost:5000/tickets.html`.
3. Kiểm tra bảng Sự cố không còn hiển thị:
   - Chờ linh kiện
   - Đang xử lý
   - Theo dõi
   - Đã ghi nhận
   - Đang kiểm tra
   - Đang sửa chữa
   - Bàn giao sử dụng
4. Tạo sự cố mới → bảng hiển thị “Mới ghi nhận”.
5. Bấm “Chuyển sửa chữa” → bảng hiển thị “Đã chuyển sửa chữa”.
6. Bấm “Mở phiếu sửa chữa” → mở đúng phiếu sửa chữa liên kết.
7. Tạo sự cố khác rồi bấm “Xử lý tại chỗ” → bảng hiển thị “Đã xử lý tại chỗ”.
