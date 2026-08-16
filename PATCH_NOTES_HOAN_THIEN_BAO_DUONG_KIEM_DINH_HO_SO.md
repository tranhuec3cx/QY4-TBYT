# Ghi chú bản hoàn thiện Bảo dưỡng / Kiểm định / Hồ sơ thiết bị

## Nội dung đã chỉnh

1. Kiểm định / Hiệu chuẩn
- Khi bấm Cập nhật, trường Thời gian thực hiện tự hiện lại đúng thời gian cũ.
- Sửa hàm datetime để dữ liệu cũ chỉ có ngày vẫn hiển thị được trong input datetime-local.
- Nút Sửa được đổi thành Cập nhật.
- File đính kèm: nếu không có file thì để trống; nếu có file thì hiển thị nút Tải file và tên file bên dưới.
- Có thể mở trang kiểm định với `inspections.html?edit_id=<id>` để tự đưa bản ghi vào form cập nhật.

2. Bảo dưỡng
- Đổi nhãn chọn file thành Tải file đính kèm.
- File đính kèm: nếu không có file thì để trống; nếu có file thì hiển thị nút Tải file và tên file bên dưới.
- Nút Sửa đổi thành Cập nhật.

3. Hồ sơ thiết bị
- Tab Bảo dưỡng hiển thị file đính kèm dạng gọn: Tải file + tên file, nếu không có thì để trống.
- Tab Kiểm định bổ sung thao tác Cập nhật và Xóa.
- Tab Hồ sơ / Tài liệu chỉ còn 2 thao tác: Cập nhật và Xóa.
- Các nút Sửa đổi thành Cập nhật để thống nhất thuật ngữ.

4. Thiết bị y tế
- Khung lọc phía trên được ép thành một hàng ngang gọn hơn.
- Vẫn giữ nguyên thông tin bảng hiện tại.
- Cột Khoa sử dụng cho phép hiển thị rõ hơn, hạn chế mất chữ.

5. Giao diện lịch sử sửa chữa
- Modal lịch sử sửa chữa đã có cấu hình rộng hơn và tiêu đề cột không bị tách dòng bất thường.

## Cách test nhanh

1. Kiểm định
- Vào Kiểm định.
- Bấm Cập nhật một bản ghi cũ.
- Kiểm tra Thời gian thực hiện có tự hiện lại.
- Chọn file mới hoặc không chọn file rồi lưu.
- Kiểm tra bảng hiển thị đúng file: có file thì nút Tải file + tên file, không có thì trống.

2. Bảo dưỡng
- Vào Bảo dưỡng.
- Tạo/cập nhật bản ghi có file và không có file.
- Kiểm tra cột FILE hiển thị đúng.

3. Hồ sơ thiết bị
- Mở một thiết bị.
- Tab Kiểm định: kiểm tra có nút Cập nhật / Xóa.
- Tab Hồ sơ / Tài liệu: kiểm tra chỉ còn Cập nhật / Xóa.
- Tab Bảo dưỡng: kiểm tra cột file đính kèm.

4. Thiết bị y tế
- Vào danh sách thiết bị.
- Kiểm tra bộ lọc nằm gọn một hàng.
- Kiểm tra cột Khoa sử dụng dễ đọc hơn.
