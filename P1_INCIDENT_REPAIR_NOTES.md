# QY4-TTBYT - P1 Toàn vẹn luồng Sự cố -> Sửa chữa

## Trạng thái sự cố

Sự cố chỉ có 3 trạng thái nghiệp vụ:

1. `Mới ghi nhận` (giao diện hiển thị `Mới báo`).
2. `Đã chuyển sửa chữa` - chỉ xuất hiện khi đã có phiếu sửa chữa liên kết.
3. `Đã xử lý tại chỗ` - kết thúc tại sự cố, không tạo phiếu sửa chữa.

Sự cố `Đã xử lý tại chỗ` không được tự chuyển ngược thành `Mới báo` trên giao diện.

## Liên kết thiết bị

- Sau khi tạo phiếu sửa chữa, `device_id` của phiếu bị khóa.
- Sự cố đã liên kết phiếu sửa chữa cũng không được đổi sang thiết bị khác.
- Nếu nhập nhầm thiết bị, hủy phiếu sai và tạo phiếu mới; không sửa liên kết lịch sử.

## Hủy phiếu sửa chữa

Nếu phiếu được tạo từ sự cố và bị hủy:

- Nếu không còn phiếu sửa chữa khác liên kết sự cố đó, sự cố được mở lại thành `Mới ghi nhận`.
- Thiết bị giữ trạng thái `Chờ sửa chữa` để không làm mất cảnh báo một sự cố chưa được giải quyết.
- Nếu thiết bị còn phiếu sửa chữa đang mở khác, trạng thái thiết bị tiếp tục là `Chờ sửa chữa`.

## Luồng cũ localStorage

Luồng `repair_prefill_from_incident` đã bị vô hiệu. Luồng chuẩn là:

`Sự cố -> Chuyển SC -> server tạo phiếu sửa chữa + liên kết incident_id -> mở đúng phiếu vừa tạo`.

## Kiểm tra

```bash
npm run check:safety
```

Lệnh kiểm tra xác nhận các lớp P0 + P1 còn khớp với `server.js` và kiểm tra cú pháp của lớp sửa frontend P1.
