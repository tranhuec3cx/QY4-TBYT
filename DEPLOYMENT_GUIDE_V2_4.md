# Hướng dẫn vận hành QY4-TTBYT V2.4

## 1. Cài đặt nhanh

```bash
npm install
npm start
```

Mở trình duyệt tại:

```text
http://localhost:5000
```

Nếu dùng trong mạng nội bộ, chạy trên máy chủ nội bộ rồi truy cập bằng IP LAN, ví dụ:

```text
http://192.168.1.10:5000
```

## 2. Quy trình sửa chữa rút gọn

Phần mềm đang áp dụng quy trình tạm thời:

```text
Khoa/phòng báo hỏng
→ Khoa Trang bị tiếp nhận
→ Xử lý sửa chữa
→ Nghiệm thu/kết luận
→ Đóng phiếu
```

Tạm thời chưa bắt buộc phân công kỹ sư. Trường “Đơn vị/người xử lý” chỉ dùng để ghi nhận khi cần.

## 3. Sao lưu dữ liệu

Vào **Vận hành hệ thống → Tạo bản sao lưu ngay**.

Khuyến nghị:

- Sao lưu trước khi import dữ liệu.
- Sao lưu trước khi cập nhật phiên bản.
- Sao lưu cuối mỗi ngày làm việc.
- Lưu thêm một bản ra USB/ổ mạng nội bộ.

## 4. Kiểm tra sức khỏe hệ thống

Vào **Vận hành hệ thống** để xem:

- Tình trạng database.
- Bản sao lưu gần nhất.
- Phiếu sự cố chưa đóng.
- Phiếu sửa chữa chưa hoàn thành.
- Vật tư dưới mức tối thiểu.
- Dữ liệu thiết bị còn thiếu.

## 5. Báo cáo vận hành Excel

Vào **Vận hành hệ thống → Xuất báo cáo vận hành Excel**.

File gồm các sheet:

- Tổng quan.
- Thiết bị.
- Cảnh báo.
- Chất lượng dữ liệu.
- Sửa chữa.

## 6. Việc cần làm hằng ngày

1. Mở Dashboard kiểm tra cảnh báo.
2. Xem phiếu báo hỏng mới.
3. Cập nhật phiếu sửa chữa đang xử lý.
4. Kiểm tra thiết bị đến hạn bảo dưỡng/kiểm định.
5. Sao lưu database cuối ngày.

## 7. Việc cần làm hằng tuần

1. Xuất báo cáo vận hành Excel.
2. Rà soát dữ liệu còn thiếu.
3. Kiểm tra vật tư tồn kho thấp.
4. Kiểm tra các phiếu sửa chữa quá hạn.
