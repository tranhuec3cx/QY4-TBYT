# QY4-TTBYT v5.0.0 - Bản chính thức

Ngày chốt nghiệm thu: 17/08/2026

Nhánh phát hành: `release/v5.0.0`

## 1. Phạm vi đã nghiệm thu

- Thiết bị: tạo/cập nhật, mã thiết bị, Serial Number, hồ sơ thiết bị và liên kết lịch sử.
- Sự cố -> Sửa chữa: chuyển phiếu đúng thiết bị, cập nhật xử lý, hoàn thành và trả tình trạng thiết bị về hoạt động.
- Bảo dưỡng: chọn thiết bị bằng gợi ý, tự điền khoa/vị trí, lưu hồ sơ, ngày lần tiếp theo và file.
- Kiểm định/Hiệu chuẩn: chọn thiết bị bằng gợi ý, tự điền khoa/vị trí, lưu đơn vị thực hiện, hạn và file.
- Lý lịch thiết bị: hiển thị đúng số bản ghi sửa chữa, bảo dưỡng, kiểm định và thông tin kỹ thuật.
- QR điện thoại: quét trong LAN, kiểm tra bình thường, báo có vấn đề, tạo sự cố đúng thiết bị và nhận ảnh đính kèm.
- Excel A4: Thiết bị/Sự cố/Sửa chữa/Bảo dưỡng/Kiểm định/Trung tâm Báo cáo dùng cùng engine A4 phía server.
- Giao diện: nút `+ Thêm bảo dưỡng` và `+ Thêm kiểm định` đồng bộ ở góc trên phải.
- Đăng nhập, phân quyền, session, audit, scope theo khoa, signed QR, upload nội bộ và SQLite foreign key/WAL đã được hardening P0-P8.

## 2. Mẫu Excel A4 chuẩn

Các báo cáo chính thức sử dụng phần đầu hành chính:

```text
CỤC HẬU CẦN - KỸ THUẬT QUÂN KHU 4
BỆNH VIỆN QUÂN Y 4

[TÊN BÁO CÁO]
(Từ ngày ... đến ngày ...)

TT | ...
```

Cuối báo cáo có khu vực ký `NGƯỜI LẬP` và `KHOA TRANG BỊ` theo loại báo cáo phù hợp.

## 3. Dữ liệu bản phát hành

Source chính thức KHÔNG chứa dữ liệu nghiệm thu hoặc dữ liệu bệnh viện:

- không theo dõi `db/*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`;
- không theo dõi `uploads/`;
- không theo dõi `.env`;
- không theo dõi `db/qr-signing-secret`.

Khi cài mới, phần mềm tạo database production trắng: danh mục nền + 01 tài khoản quản trị, không có thiết bị demo.

Chỉ dùng dữ liệu demo khi chủ động chạy `npm run demo` hoặc đặt `DEMO_MODE=true` trong một môi trường demo riêng.

## 4. Cài mới trên máy production

Khuyến nghị Node.js 20.x.

1. Giải nén source v5.0.0 vào thư mục riêng.
2. Chạy `CAI_DAT_VA_CHAY.bat` hoặc mở CMD tại thư mục source và chạy:

```bat
npm ci
npm audit --omit=dev
npm run check:safety
npm start
```

3. Mở `http://localhost:5000`.
4. Đăng nhập tài khoản admin được khởi tạo ở lần chạy đầu và đổi mật khẩu ngay.
5. Nếu dùng QR trong cùng Wi-Fi/LAN, sử dụng IP LAN hiển thị trên cửa sổ server.
6. Nếu dùng QR ngoài mạng nội bộ, cấu hình `QR_PUBLIC_BASE_URL` và `TRUST_PROXY` đúng môi trường triển khai.

## 5. Nâng cấp từ máy đang có dữ liệu thật

Trước khi nâng cấp PHẢI tắt server và sao lưu nguyên bộ:

```text
db/qy4_ttbyt.sqlite
db/qy4_ttbyt.sqlite-wal
db/qy4_ttbyt.sqlite-shm
db/qr-signing-secret
uploads/
.env
```

Không tách riêng file SQLite khi WAL chưa được checkpoint. Nếu còn `-wal`/`-shm`, sao lưu cùng lúc cả bộ sau khi đã dừng server.

Sau đó cài source v5.0.0 mới, chạy `npm ci` + `npm run check:safety`, rồi mới chuyển dữ liệu đã sao lưu sang bản mới.

## 6. Checklist trước khi dùng dữ liệu thật

- [x] Nghiệm thu luồng Sự cố -> Sửa chữa trên Windows.
- [x] Nghiệm thu Bảo dưỡng và Kiểm định.
- [x] Nghiệm thu QR điện thoại, gồm báo sự cố và ảnh đính kèm.
- [x] Nghiệm thu Excel A4 từ màn hình nghiệp vụ và Trung tâm Báo cáo.
- [x] Nút Thêm Bảo dưỡng/Kiểm định đồng bộ topbar.
- [x] `npm run check:safety` trên RC đã PASS.
- [x] Source Git không chứa DB, WAL/SHM, uploads, `.env` hoặc khóa QR cục bộ.
- [ ] Chạy gate tự động trên nhánh `release/v5.0.0`.
- [ ] Tạo bản sao lưu đầu tiên ngay sau khi nhập dữ liệu thật.

## 7. Quy tắc vận hành

- Production luôn để `DEMO_MODE=false`.
- Không chạy `npm run demo` trên thư mục dữ liệu thật.
- Không đưa `db`, `uploads`, `.env`, khóa QR hoặc dữ liệu bệnh viện lên repository public.
- Sao lưu database, khóa QR và uploads cùng một thời điểm.
- Khi thay máy chủ mà giữ QR đã in, phải chuyển cả `db/qr-signing-secret`.
