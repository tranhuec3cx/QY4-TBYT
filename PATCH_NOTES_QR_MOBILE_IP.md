# Hoàn thiện QR để quét trên điện thoại

## Đã sửa

- QR không còn phụ thuộc cứng vào `localhost`.
- Modal QR có thêm ô **Địa chỉ dùng cho điện thoại**.
- Hệ thống tự gợi ý IP LAN của máy tính, ví dụ `http://172.20.10.5:5000`.
- Khi mở phần mềm bằng `localhost`, QR sẽ tự ưu tiên địa chỉ IP LAN nếu lấy được.
- Có nút **Áp dụng** để lưu địa chỉ QR. Sau khi lưu, các QR mới sẽ dùng địa chỉ này.
- Thêm API:
  - `GET /api/system/qr-origins`
- Khi chạy server, terminal sẽ in thêm dòng:
  - `QR/mobile LAN URL: http://<IP>:5000`

## Cách test nhanh

1. Chạy phần mềm:

```bash
npm start
```

2. Xem terminal, tìm dòng:

```text
QR/mobile LAN URL: http://172.20.10.5:5000
```

3. Trên điện thoại mở thử địa chỉ đó:

```text
http://172.20.10.5:5000
```

4. Nếu điện thoại mở được, vào Hồ sơ thiết bị hoặc Thiết bị y tế > bấm **QR**.

5. Kiểm tra ô **Địa chỉ dùng cho điện thoại** đang là IP máy tính, không phải `localhost`.

6. Bấm **Áp dụng**, sau đó quét lại QR.

## Lưu ý

- Điện thoại và máy tính phải cùng mạng Wi-Fi/LAN.
- Không dùng QR chứa `localhost`, vì trên điện thoại `localhost` là chính điện thoại, không phải máy tính.
- Nếu dùng thật trong bệnh viện, nên đổi sang IP máy chủ cố định hoặc tên miền nội bộ cố định, ví dụ:

```text
http://ttbyt-qy4:5000
```
