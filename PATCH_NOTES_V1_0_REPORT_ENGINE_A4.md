# PATCH V1.0 - Report Engine Excel A4

Đã hoàn thiện cơ chế xuất báo cáo theo biểu mẫu hành chính, phục vụ in khổ A4 từ phần mềm.

## Nội dung chính

- Bổ sung API `/api/reports/export-a4` để xuất Excel có định dạng sẵn.
- Không xuất bảng thô DataGrid cho nút chính `Xuất Excel A4`.
- Báo cáo có đầy đủ:
  - CỤC HẬU CẦN - KỸ THUẬT QUÂN KHU 4
  - BỆNH VIỆN QUÂN Y 4
  - Mã biểu mẫu BM-BV-TB
  - Tên báo cáo
  - Thời gian từ ngày đến ngày
  - Bảng thống kê có border, căn giữa, font Times New Roman
  - Cấu hình A4, Landscape, Fit to width = 1 page
  - Khu vực chữ ký: Người lập, Trưởng khoa Trang bị, Ban Giám đốc

## Các loại báo cáo đã hỗ trợ xuất A4

- Danh sách thiết bị
- Sự cố thiết bị
- Sửa chữa thiết bị
- Bảo dưỡng thiết bị
- Kiểm định/Hiệu chuẩn/ATBX
- Thống kê tình hình sử dụng trang bị quân y
- Nhập - xuất - tồn kho vật tư
- Kiểm kê kho vật tư

## Cách dùng

Vào `Báo cáo` → chọn loại báo cáo → chọn từ ngày/đến ngày/khoa/nhóm → bấm `Xuất Excel A4`.

## Ghi chú kỹ thuật

Tên đơn vị, đơn vị cấp trên, khoa và địa danh có thể cấu hình bằng biến môi trường:

- `REPORT_UPPER_UNIT`
- `REPORT_UNIT_NAME`
- `REPORT_DEPARTMENT_NAME`
- `REPORT_PLACE`

