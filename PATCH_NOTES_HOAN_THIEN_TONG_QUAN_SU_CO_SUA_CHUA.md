# Hoàn thiện Tổng quan / Sự cố / Sửa chữa / Hồ sơ thiết bị

## Nội dung đã hoàn thiện

### 1. Tab Tổng quan
- Thiết kế lại Dashboard theo hướng gọn, đọc nhanh trong 5 giây.
- Hàng thiết bị gồm: Tổng thiết bị, Đang hoạt động, Chờ sửa chữa, Ngừng hoạt động.
- Khối Sự cố gồm: Tổng sự cố, Xử lý tại chỗ, Chuyển sửa chữa.
- Khối Sửa chữa gồm: Đang xử lý, Chờ linh kiện, Hoàn thành.
- Bổ sung bảng Thiết bị cần chú ý, giới hạn 5 dòng.
- Bổ sung Bảo dưỡng sắp đến hạn và Kiểm định sắp đến hạn, mỗi nhóm giới hạn 5 dòng.
- Không thêm biểu đồ phức tạp hoặc KPI thừa.

### 2. Module Sự cố
- Bổ sung card thống kê theo bộ lọc hiện tại: Tổng sự cố, Mới ghi nhận, Đã chuyển sửa chữa, Đã xử lý tại chỗ.
- Form ghi nhận sự cố chỉ hiển thị trường “Nội dung xử lý tại chỗ” khi trạng thái = “Đã xử lý tại chỗ”.
- Nếu chọn “Mới ghi nhận”, trường xử lý tại chỗ tự ẩn và không gửi nội dung thừa.
- Vẫn giữ nguyên quy tắc: Sự cố chỉ có 3 trạng thái nghiệp vụ.

### 3. Module Sửa chữa
- Modal lịch sử đổi tên thành “Lịch sử sửa chữa”.
- Modal lịch sử sửa chữa mở rộng để dễ đọc.
- Bảng lịch sử gồm: STT, Thời gian, Người cập nhật, Trạng thái, Nội dung thực hiện, Kinh phí, Ghi chú.
- Cột nội dung và ghi chú cho phép xuống dòng, hạn chế kéo ngang.
- Chuẩn hóa thêm trạng thái cũ “Đang xử lý” thành “Đang sửa chữa”.

### 4. Hồ sơ thiết bị
- Giữ Nhật ký sửa chữa ngắn gọn.
- Nút “Xem chi tiết” mở thông tin phiếu và lịch sử sửa chữa dạng bảng.

## Cách test nhanh
1. Mở `/dashboard.html`, kiểm tra Dashboard chỉ hiển thị các nhóm KPI chính và các bảng ngắn.
2. Mở `/tickets.html`, chọn trạng thái “Mới ghi nhận”: ô “Nội dung xử lý tại chỗ” phải ẩn.
3. Chọn trạng thái “Đã xử lý tại chỗ”: ô “Nội dung xử lý tại chỗ” phải hiện và bắt buộc nhập.
4. Lọc sự cố, kiểm tra 4 card thống kê thay đổi theo kết quả lọc.
5. Mở `/maintenance.html`, bấm “Lịch sử”: modal phải hiện tiêu đề “Lịch sử sửa chữa”, rộng và dễ đọc.
6. Mở Hồ sơ thiết bị, vào Nhật ký sửa chữa, bấm “Xem chi tiết” để xem lịch sử sửa chữa.

## Test đã chạy trong môi trường sửa code
- Kiểm tra cú pháp JS bằng `node -c`: PASS.
- Kiểm tra cú pháp `server.js` bằng `node -c`: PASS.
- Không chạy được server thực tế trong sandbox vì dependency native `better-sqlite3` cần tải/build node headers nhưng môi trường không truy cập được mạng. Trên máy của bạn đã có `node_modules` hoặc chạy được `npm install` thì có thể test bằng `npm start`.
