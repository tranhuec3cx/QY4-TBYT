# QY4-TTBYT

Phần mềm quản lý trang thiết bị y tế cho **Khoa Trang bị - Bệnh viện Quân y 4**.

## Công nghệ

- Node.js + Express
- SQLite
- HTML/CSS/JavaScript thuần
- Excel export/import
- QR hồ sơ thiết bị

## Chức năng chính

- Quản lý danh mục thiết bị y tế.
- Quản lý khoa/phòng, nhóm thiết bị, người dùng.
- Quản lý sự cố, chuyển sự cố sang phiếu sửa chữa.
- Quản lý sửa chữa, chi phí, kết quả xử lý, trạng thái sau sửa chữa.
- Quản lý bảo dưỡng, kiểm định, hồ sơ tài liệu.
- Quét QR để xem nhanh hồ sơ thiết bị và báo sự cố từ thiết bị.
- Dashboard cảnh báo: quá hạn/sắp hạn bảo dưỡng, kiểm định, bảo hành, phiếu sửa chữa quá hạn.
- Báo cáo tổng hợp, báo cáo lực lượng thiết bị, xuất Excel.
- Nhật ký thao tác và nền tảng mở rộng vật tư, điều chuyển, thanh lý.

## Bản hoàn thiện nhanh V2.1

Bản này đã bổ sung:

- Tự động tạo bảng nghiệp vụ mở rộng: `audit_logs`, `notifications`, `spare_parts`, `inventory_transactions`, `transfers`, `liquidations`.
- Bổ sung trường mở rộng cho thiết bị: mã tài sản, nhà cung cấp, lịch bảo dưỡng/kiểm định gần nhất, downtime.
- API cảnh báo vận hành `/api/alerts`.
- API nhật ký thao tác `/api/audit-logs`.
- API vật tư, nhập/xuất kho.
- API điều chuyển thiết bị.
- API lập hồ sơ thanh lý.
- Dashboard mới có KPI, cảnh báo ưu tiên, biểu đồ theo khoa/phòng và trạng thái.
- Loại bỏ `node_modules` khỏi gói bàn giao để tránh lỗi sai hệ điều hành khi chạy.

## Cài đặt và chạy

```bash
npm install
npm start
```

Sau đó mở trình duyệt:

```text
http://localhost:5000
```

Nếu muốn đổi cổng:

```bash
PORT=3000 npm start
```

Trên Windows PowerShell:

```powershell
$env:PORT=3000; npm start
```

## Lưu ý triển khai

Không copy `node_modules` từ máy khác. Mỗi máy cần chạy lại:

```bash
npm install
```

Vì thư viện `better-sqlite3` có file biên dịch riêng theo hệ điều hành.

## Tài khoản/Giao diện

Phiên bản hiện tại đang chạy dạng nội bộ phục vụ demo và hoàn thiện nghiệp vụ. Khi triển khai chính thức cần bật thêm:

- Đăng nhập bắt buộc.
- Phân quyền Admin/Kỹ sư/Khoa sử dụng.
- Sao lưu tự động cơ sở dữ liệu.
- Phân quyền xóa/sửa dữ liệu quan trọng.


## Cập nhật V2.2 - Quy trình sửa chữa rút gọn

Tạm thời bỏ qua bước phân công kỹ sư riêng. Quy trình sửa chữa hiện dùng theo luồng thực tế nội bộ:

1. Khoa/phòng báo hỏng hoặc Khoa Trang bị tạo phiếu.
2. Khoa Trang bị tiếp nhận phiếu.
3. Ghi nhận nội dung kiểm tra/xử lý, hình thức sửa chữa, chi phí nếu có.
4. Cập nhật trạng thái: Đang xử lý, Chờ linh kiện, Đã hoàn thành hoặc Không sửa được.
5. Khi hoàn thành, cập nhật tình trạng thiết bị sau sửa và lưu lịch sử xử lý.

Trường “Đơn vị/người xử lý” chỉ dùng để ghi nhận đơn vị hoặc người thực tế xử lý nếu cần, không phải bước bắt buộc phân công kỹ sư.


## QR dùng điện thoại qua Internet

Để điện thoại quét QR mở được trang kiểm tra/báo sự cố mà không cần cùng mạng với máy tính, cấu hình biến môi trường:

```bash
QR_PUBLIC_BASE_URL=https://ten-mien-cong-khai npm start
```

Ví dụ demo có thể dùng Cloudflare Tunnel/ngrok. Khi đổi địa chỉ public, cần in/quét lại QR mới. Xem chi tiết trong `QR_PUBLIC_GUIDE.md`.
