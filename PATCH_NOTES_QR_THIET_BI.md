# Hoàn thiện chức năng QR thiết bị - QY4 TTBYT

## Nội dung đã bổ sung

### 1. QR trong danh sách thiết bị
- Thêm nút `QR` tại cột thao tác của bảng Thiết bị y tế.
- Bấm `QR` sẽ mở popup mã QR của thiết bị.
- Popup hiển thị:
  - Mã QR
  - Mã thiết bị
  - Tên thiết bị
  - Model
  - Serial
  - Link mở trang kiểm tra QR
  - Nút `In mã QR`

### 2. QR trong hồ sơ thiết bị
- Thêm nút `QR` ở phần đầu Hồ sơ thiết bị.
- Cho phép mở/in mã QR trực tiếp từ hồ sơ máy.

### 3. Trang mobile quét QR
Tạo mới:

```text
public/qr-check.html
public/qr-check.js
```

Trang này tối ưu cho điện thoại, không có sidebar, dùng dạng card gọn.

Sau khi quét QR, hệ thống mở:

```text
/qr-check.html?device_id=<id>
```

và hiển thị:
- Mã thiết bị
- Tên thiết bị
- Khoa sử dụng
- Vị trí
- Hãng / Model
- Serial
- Tình trạng hiện tại
- Bảo dưỡng gần nhất
- Kiểm định gần nhất
- Phiếu sửa chữa đang mở nếu có

### 4. Kiểm tra nhanh thiết bị từ QR
Form gồm:
- Tên người kiểm tra
- Tình trạng kiểm tra: `Tốt`, `Có vấn đề`, `Nghiêm trọng`
- Mô tả vấn đề
- Ảnh/tệp đính kèm
- Ghi chú
- Tùy chọn tạo sự cố nếu có vấn đề/nghiêm trọng

Nếu chọn `Tốt`, hệ thống chỉ lưu vào `daily_checks`.

Nếu chọn `Có vấn đề` hoặc `Nghiêm trọng`, có thể tạo sự cố từ kết quả kiểm tra.

### 5. Báo sự cố nhanh từ QR
Form gồm:
- Người báo
- Mức độ: `Thấp`, `Trung bình`, `Cao`
- Mô tả sự cố
- Ảnh/tệp đính kèm
- Ghi chú

Khi gửi, hệ thống tạo bản ghi trong tab Sự cố với trạng thái `Mới ghi nhận`.

### 6. Backend API mới
Bổ sung:

```text
GET  /api/qr/device/:id
GET  /api/qr/device-code/:code
POST /api/qr/checks
POST /api/qr/incidents
```

Tệp đính kèm từ QR được lưu tại:

```text
uploads/qr/
```

và đồng thời ghi vào hồ sơ tài liệu của thiết bị.

## Lưu ý

Mã QR đang dùng dịch vụ tạo ảnh QR dạng URL để tiện chạy ngay trên trình duyệt. Khi triển khai nội bộ bệnh viện, có thể thay bằng thư viện QR nội bộ để không phụ thuộc internet.

## Cách test nhanh

1. Chạy:

```bash
npm start
```

2. Mở:

```text
http://localhost:5000/index.html
```

3. Bấm nút `QR` ở một thiết bị.
4. Bấm `Mở trang kiểm tra QR` hoặc quét QR bằng điện thoại.
5. Test kiểm tra nhanh:
   - Chọn `Tốt` → lưu nhật ký kiểm tra.
   - Chọn `Có vấn đề` + tick tạo sự cố → kiểm tra tab Sự cố có bản ghi mới.
6. Test báo sự cố nhanh → kiểm tra tab Sự cố có bản ghi mới.
7. Kiểm tra Hồ sơ thiết bị → Hồ sơ/Tài liệu có tệp đính kèm nếu đã upload ảnh/tệp.
