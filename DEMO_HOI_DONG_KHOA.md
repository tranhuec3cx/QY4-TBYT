# Kịch bản báo cáo Hội đồng khoa - QY4 TTBYT

## 1. Chuẩn bị trước khi báo cáo

1. Cài Node.js bản LTS trên máy tính báo cáo.
2. Giải nén thư mục phần mềm.
3. Chạy file `CAI_DAT_VA_CHAY.bat`.
4. Mở trình duyệt tại `http://localhost:5000`.
5. Nếu cần làm mới dữ liệu mẫu, vào trang **Vận hành hệ thống** và dùng chức năng tạo lại dữ liệu mẫu.

## 2. Các chức năng nên demo

### Tổng quan
- Dashboard tổng số thiết bị, thiết bị hoạt động, thiết bị hỏng/chờ sửa, cảnh báo bảo dưỡng/kiểm định.
- Biểu đồ thiết bị theo khoa/phòng và nhóm thiết bị.

### Hồ sơ thiết bị
- Mở danh sách thiết bị.
- Xem chi tiết một thiết bị.
- Trình bày thông tin: mã thiết bị, serial, model, khoa sử dụng, vị trí, tình trạng, bảo hành.
- Xem lịch sử: sửa chữa, bảo dưỡng, kiểm định, tài liệu.

### QR thiết bị
- Bấm nút QR trên một thiết bị.
- QR dùng link ngắn dạng `/q/MÃ_THIẾT_BỊ`.
- Có thể mở trên chính máy báo cáo bằng trình duyệt.
- Nếu điện thoại cùng Wi-Fi/LAN và nhập đúng IP máy báo cáo, có thể quét để mở trang kiểm tra nhanh.
- QR được tạo nội bộ trong phần mềm, không phụ thuộc website tạo QR bên ngoài.

### Sự cố và sửa chữa
- Tạo một sự cố báo hỏng.
- Chuyển sự cố sang phiếu sửa chữa.
- Cập nhật trạng thái xử lý: Đang xử lý, Chờ linh kiện, Đã hoàn thành, Không sửa được.
- Khi hoàn thành, trạng thái thiết bị được cập nhật lại.

### Bảo dưỡng và kiểm định
- Thêm lịch bảo dưỡng.
- Thêm lịch kiểm định.
- Xem cảnh báo sắp đến hạn hoặc quá hạn.

### Báo cáo và vận hành
- Xuất Excel báo cáo vận hành.
- Sao lưu database.
- Xem nhật ký thao tác.
- Kiểm tra sức khỏe hệ thống.

## 3. Câu trả lời khi Hội đồng hỏi về triển khai thực tế

- Bản hiện tại chạy ổn định cục bộ bằng SQLite để báo cáo và chạy thử tại Khoa Trang bị.
- Khi triển khai chính thức có thể đặt trên máy chủ nội bộ bệnh viện.
- Nếu dùng máy chủ SQL Server hiện có, phần mềm có thể nâng cấp sang Microsoft SQL Server để quản lý nhiều người dùng hơn.
- QR không phụ thuộc cơ sở dữ liệu; QR chỉ chứa đường dẫn hồ sơ thiết bị. Sau này đổi SQLite sang SQL Server vẫn giữ được nguyên quy trình quét QR.
- Nếu chỉ dùng trong mạng bệnh viện: QR trỏ về IP nội bộ.
- Nếu muốn dùng ngoài bệnh viện: cần tên miền/reverse proxy hoặc Cloudflare Tunnel/VPS.

## 4. Tài khoản demo

Phần mềm hiện chưa bắt buộc đăng nhập để thuận tiện báo cáo nhanh. Khi triển khai thực tế sẽ bật phân quyền:

- Quản trị viên Khoa Trang bị
- Kỹ thuật viên TTBYT
- Khoa/phòng sử dụng thiết bị
- Lãnh đạo chỉ xem báo cáo

