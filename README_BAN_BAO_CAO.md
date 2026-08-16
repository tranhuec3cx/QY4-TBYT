# QY4-TTBYT V3.0 - Bản ổn định báo cáo Hội đồng khoa

Đây là bản chạy cục bộ trên máy tính để báo cáo trước Hội đồng khoa, ưu tiên ổn định và dễ demo.

## Cách chạy nhanh trên Windows

1. Giải nén file ZIP.
2. Mở thư mục phần mềm.
3. Nhấp đúp `CAI_DAT_VA_CHAY.bat`.
4. Trình duyệt sẽ mở: `http://localhost:5000`.

## Yêu cầu

- Windows 10/11.
- Node.js LTS.
- Có Internet trong lần chạy đầu để tải thư viện bằng `npm install`.

## Điểm đã hoàn thiện cho bản báo cáo

- Giữ SQLite để chạy độc lập trên máy tính.
- Dashboard, thiết bị, khoa/phòng, nhóm thiết bị.
- Hồ sơ thiết bị và lịch sử.
- Sự cố, sửa chữa rút gọn, bảo dưỡng, kiểm định.
- QR thiết bị dùng link ngắn `/q/MÃ_THIẾT_BỊ`.
- QR tạo nội bộ, không phụ thuộc website tạo QR ngoài.
- Sao lưu/phục hồi database.
- Báo cáo Excel vận hành.
- Nhật ký thao tác và kiểm tra sức khỏe hệ thống.

## Ghi chú QR

- Chạy trên máy báo cáo: dùng `http://localhost:5000`.
- Điện thoại cùng Wi-Fi/LAN: dùng địa chỉ IP của máy báo cáo, ví dụ `http://192.168.0.xxx:5000`.
- Điện thoại ngoài mạng: cần public URL, tên miền hoặc tunnel.

