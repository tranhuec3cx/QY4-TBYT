# PATCH NOTES - QR công khai kiểu VCAS

## Mục tiêu
Tạo QR theo kiểu VCAS: QR chứa đường dẫn công khai HTTPS, điện thoại chỉ cần có Internet là mở được trang kiểm tra/báo sự cố, không bắt buộc chung mạng LAN với máy tính.

## Nội dung đã chỉnh

### 1. Link QR công khai
- QR mới sinh link dạng:
  - `https://qy4.benhvien.vn/inspect.html?id=<device_id>`
- Có thể đổi domain trong popup QR tại ô **Tên miền công khai dùng cho QR**.
- Link không còn mặc định dùng `localhost` hoặc IP LAN.

### 2. Trang public mới
Thêm file:
- `public/inspect.html`
- `public/inspect.js`

Trang này chỉ hiển thị thông tin an toàn:
- Tên thiết bị
- Mã thiết bị
- Khoa/Phòng
- Vị trí
- Model
- Trạng thái
- Form kiểm tra/báo sự cố

Không hiển thị:
- Giá tiền
- Hồ sơ kỹ thuật
- Lịch sử sửa chữa chi tiết
- Chi phí
- Báo cáo
- Tài liệu nội bộ

### 3. API public an toàn
Thêm API:
- `GET /api/public/device/:id`

API này chỉ trả dữ liệu tối thiểu cho trang QR công khai.

### 4. Luồng kiểm tra
Sau khi quét QR:
- Chọn **Bình thường** → lưu lịch sử kiểm tra.
- Chọn **Có vấn đề** → hiện mô tả, mức độ, ảnh/video → gửi về module Sự cố.

### 5. Upload ảnh/video
Trang public dùng lại API hiện có:
- `POST /api/qr/checks`

Giới hạn vẫn giữ:
- Tối đa 5 ảnh
- Tối đa 1 video
- Ảnh tối đa 5MB/file
- Video tối đa 30MB

## Lưu ý triển khai thật
Để điện thoại 4G/5G truy cập được, cần deploy QY4 lên server có domain thật, ví dụ:
- `https://qy4.benhvien.vn`
- `https://ttbyt-qy4.benhvien.vn`

Nếu chưa có domain thật, có thể demo bằng Cloudflare Tunnel/ngrok hoặc dùng IP LAN tạm thời.
