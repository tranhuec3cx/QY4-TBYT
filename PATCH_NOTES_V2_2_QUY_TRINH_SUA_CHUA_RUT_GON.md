# PATCH NOTES V2.2 - Quy trình sửa chữa rút gọn

## Mục tiêu
Tạm thời bỏ qua bước phân công kỹ sư riêng trong quy trình sửa chữa để phù hợp vận hành nhanh tại Khoa Trang bị.

## Luồng xử lý hiện tại
1. Khoa/phòng báo hỏng hoặc Khoa Trang bị tạo phiếu sửa chữa.
2. Khoa Trang bị tiếp nhận phiếu.
3. Ghi nhận nội dung kiểm tra/xử lý.
4. Cập nhật trạng thái xử lý: Đang xử lý, Chờ linh kiện, Đã hoàn thành, Không sửa được.
5. Khi hoàn tất, cập nhật tình trạng thiết bị sau sửa và lưu lịch sử.

## Thay đổi giao diện
- Đổi nhãn "Người thực hiện" thành "Đơn vị/người xử lý".
- Thêm ghi chú: tạm thời không phân công kỹ sư.
- Cập nhật mô tả trang sửa chữa theo quy trình rút gọn.
- Cập nhật nội dung prefill khi chuyển sự cố sang sửa chữa.

## Thay đổi kỹ thuật
- Không thêm bảng phân công kỹ sư.
- Không bắt buộc chọn kỹ sư phụ trách.
- Trường person vẫn được giữ để lưu đơn vị/người xử lý nếu cần truy vết.
- Giữ nguyên lịch sử xử lý và nhật ký phiếu sửa chữa.
