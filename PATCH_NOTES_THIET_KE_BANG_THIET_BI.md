# Ghi chú bản sửa: Thiết kế lại bảng Thiết bị y tế

## Nội dung đã chỉnh

1. Trang `index.html` / Thiết bị y tế:
   - Đổi tiêu đề thống kê từ **Thực lực chi tiết:** thành **Tổng thiết bị:**.
   - Bảng danh sách thiết bị chỉ giữ các cột:
     - STT
     - Mã thiết bị
     - Tên thiết bị
     - Khoa sử dụng
     - Hãng SX
     - Model
     - Serial Number
     - Năm SD
     - Vị trí
     - Tình trạng
     - Thao tác

2. Bỏ khỏi bảng ngang các cột:
   - Loại trang bị
   - Nguồn nhập
   - Giá tiền
   - Mã bảo hiểm
   - Ghi chú
   - Cấp chất lượng

3. Cột thao tác:
   - Bỏ biểu tượng icon.
   - Đổi thành nút chữ: **Xem hồ sơ**, **Sửa**, **Xóa**.

4. Giao diện bảng:
   - Cột **Tên thiết bị** rộng hơn.
   - Cột **Mã thiết bị** có chiều rộng cố định.
   - Cột **Tình trạng** giữ dạng badge.
   - Bảng vẫn cho phép cuộn ngang khi màn hình nhỏ nhưng dễ quan sát hơn.

## File đã sửa

- `public/index.html`
- `public/devices.js`
- `public/styles.css`

## Cách test nhanh

1. Chạy:

```bash
npm start
```

2. Mở:

```text
http://localhost:5000/index.html
```

3. Kiểm tra:
   - Tiêu đề bảng hiển thị **Tổng thiết bị:**.
   - Bảng không còn cột Loại trang bị, Nguồn nhập, Giá tiền, Mã bảo hiểm, Ghi chú.
   - Nút thao tác hiển thị bằng chữ.
   - Cột Tên thiết bị dễ đọc hơn.
   - Bấm **Xem hồ sơ**, **Sửa**, **Xóa** hoạt động bình thường.
