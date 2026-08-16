# QL TRANG THIẾT BỊ Y TẾ - V1.0 hoàn thiện

Bản này đã gom lại các chỉnh sửa chính theo cấu trúc 6 module:

1. Thiết bị: danh sách, lý lịch, QR, hồ sơ/tài liệu, phụ kiện, nhật ký vận hành.
2. Sự cố: 2 trạng thái `Mới báo`, `Đã chuyển sửa chữa`, liên kết mở phiếu sửa chữa.
3. Sửa chữa: danh sách phiếu, tạo phiếu, cập nhật tiến độ, nhật ký tự sinh, hủy phiếu thay xóa, ghi chú/file đính kèm.
4. Bảo dưỡng: lập phiếu, lịch sử, file đính kèm.
5. Kiểm định: kiểm định, hiệu chuẩn, ATBX, file chứng nhận.
6. Báo cáo: Dashboard, Kho - Vật tư, Kiểm kê, Thống kê/BM báo cáo.

## Chạy thử WiFi nội bộ

- Máy tính và điện thoại cùng kết nối một WiFi.
- Lấy IPv4 của máy tính bằng `ipconfig`.
- Truy cập từ điện thoại: `http://<IPv4-máy-tính>:5000/index.html`.
- Ví dụ: `http://192.168.1.5:5000/index.html`.

## Ghi chú quan trọng

Không chạy nhầm bản cũ. Hãy mở CMD ngay trong thư mục bản này rồi chạy:

```cmd
npm install
node server.js
```

Nếu trình duyệt còn hiện giao diện cũ, bấm `Ctrl + F5`.
