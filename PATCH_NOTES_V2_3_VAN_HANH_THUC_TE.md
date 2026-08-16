# QY4-TTBYT V2.3 - Hoàn thiện vận hành thực tế

## Mục tiêu
Tập trung vào các chức năng cần cho phần mềm sử dụng hằng ngày tại Khoa Trang bị, không theo hướng luận văn.

## Nội dung đã bổ sung

### 1. Trang Vận hành hệ thống
- Thêm menu **Vận hành**.
- Trang mới: `/operations.html`.
- Hiển thị nhanh số lượng hồ sơ thiết bị, sự cố, phiếu sửa chữa và dung lượng CSDL.

### 2. Sao lưu dữ liệu
- API tạo sao lưu: `POST /api/backups`.
- API danh sách sao lưu: `GET /api/backups`.
- API tải file sao lưu: `GET /api/backups/:filename/download`.
- API phục hồi dữ liệu: `POST /api/backups/:filename/restore`.
- Khi phục hồi, hệ thống tự tạo một bản sao lưu trước khi ghi đè database.
- Sau khi phục hồi cần tắt server và chạy lại `npm start` để nạp lại database.

### 3. Nhật ký thao tác
- Trang vận hành hiển thị nhật ký thao tác gần đây.
- Dùng để truy vết các thay đổi khi vận hành thực tế.

### 4. Cảnh báo vận hành
- Hiển thị cảnh báo bảo dưỡng, kiểm định, bảo hành và phiếu sửa chữa quá hạn.
- Phù hợp theo quy trình rút gọn: Báo hỏng → Tiếp nhận → Xử lý sửa chữa → Nghiệm thu/đóng phiếu.

### 5. Vật tư/linh kiện
- Hiển thị cảnh báo vật tư có tồn kho thấp hơn mức tối thiểu.

## Cách chạy
```bash
npm install
npm start
```
Mở trình duyệt: `http://localhost:5000`

## Lưu ý triển khai thực tế
- Không nén kèm `node_modules` khi bàn giao.
- Trước khi import/xóa/sửa dữ liệu lớn nên tạo bản sao lưu.
- Nên sao lưu database hằng ngày vào ổ khác hoặc máy chủ nội bộ.
