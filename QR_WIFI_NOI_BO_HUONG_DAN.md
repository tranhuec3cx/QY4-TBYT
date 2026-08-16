# Hướng dẫn dùng QR qua WiFi nội bộ Khoa Trang bị

## Mô hình dùng

- Máy tính chạy phần mềm là **máy chủ**.
- Điện thoại và máy chủ phải kết nối **cùng một WiFi**.
- QR phải trỏ về địa chỉ IP WiFi/LAN của máy chủ, ví dụ:

```text
http://192.168.1.105:5000/q/A10.DT.0001
```

Không dùng `localhost` để in QR vì điện thoại sẽ không mở được.

## Cách lấy IP máy chủ trên Windows

Mở CMD và gõ:

```cmd
ipconfig
```

Tìm dòng:

```text
Wireless LAN adapter Wi-Fi
IPv4 Address . . . . . . . . . . : 192.168.1.105
```

Sau đó trong phần QR nhập:

```text
http://192.168.1.105:5000
```

## Cách kiểm tra nhanh

Trên điện thoại đang kết nối cùng WiFi, mở trình duyệt và gõ:

```text
http://192.168.1.105:5000
```

Nếu mở được phần mềm thì QR sẽ dùng được.

## Khuyến nghị

Nên đặt IP tĩnh cho máy chủ, ví dụ:

```text
192.168.1.10
```

Khi đó QR luôn dùng:

```text
http://192.168.1.10:5000/q/MaThietBi
```

Như vậy không phải in lại QR khi khởi động lại máy/router.
