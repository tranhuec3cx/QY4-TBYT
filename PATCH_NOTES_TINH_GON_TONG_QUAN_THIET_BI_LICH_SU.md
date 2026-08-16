# Ghi chú bản chỉnh giao diện Tổng quan / Thiết bị / Lịch sử sửa chữa

## Nội dung đã chỉnh

### 1. Tab Tổng quan
- Bỏ khối “Thiết bị cần chú ý”.
- Bỏ khối “Truy cập nhanh” để màn hình tối giản hơn.
- Giữ các nhóm chính:
  - Tổng thiết bị / Đang hoạt động / Chờ sửa chữa / Ngừng hoạt động.
  - Sự cố.
  - Sửa chữa.
  - Công việc sắp tới: bảo dưỡng và kiểm định sắp đến hạn.

### 2. Tab Thiết bị y tế
- Bổ sung bộ lọc “Nguồn kinh phí”.
- Bảng thiết bị giữ nguyên các cột đang có.
- Cột “Khoa sử dụng” hiển thị mã khoa và tên khoa đầy đủ hơn, tránh mất chữ.
- Nút “Sửa” đổi thành “Cập nhật”.

### 3. Tab Sửa chữa
- Modal “Lịch sử sửa chữa” được mở rộng gần full màn hình.
- Bảng lịch sử không bị bó hẹp, giảm tình trạng tiêu đề cột bị nhảy dòng.
- Cột STT cố định đủ rộng để không bị tách thành 2 hàng.

## Test đã thực hiện
- `node --check server.js`: PASS
- `node --check public/*.js`: PASS

## Cách test nhanh trên trình duyệt
1. Mở `dashboard.html`: kiểm tra không còn khối “Thiết bị cần chú ý”, giao diện gọn hơn.
2. Mở `index.html`: kiểm tra có bộ lọc “Nguồn kinh phí”, lọc thử một nguồn kinh phí.
3. Kiểm tra bảng thiết bị: cột Khoa sử dụng hiển thị rõ hơn, nút thao tác là “Xem hồ sơ / Cập nhật / Xóa”.
4. Mở `maintenance.html`: bấm “Lịch sử”, kiểm tra modal rộng hơn và bảng dễ đọc hơn.
