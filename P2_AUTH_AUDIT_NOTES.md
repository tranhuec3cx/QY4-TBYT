# P2 - Xác thực, phân quyền và audit

## Nội dung đã triển khai

- Đăng nhập bằng tài khoản trong bảng `users`; mật khẩu lưu bằng `crypto.scrypt` + salt riêng, không lưu mật khẩu rõ.
- Phiên đăng nhập lưu token băm SHA-256 trong SQLite; cookie `HttpOnly`, `SameSite=Lax`, tự bật `Secure` khi dùng HTTPS.
- Thời hạn phiên mặc định 8 giờ (`AUTH_SESSION_HOURS`).
- Giới hạn đăng nhập sai: 5 lần/15 phút theo IP + username.
- Bắt buộc đổi mật khẩu sau khi cấp mật khẩu tạm thời.
- Vai trò:
  - `Quản trị viên`: toàn quyền.
  - `Kỹ sư/Kỹ thuật TTBYT`: nghiệp vụ kỹ thuật; không quản lý tài khoản/cấu hình lõi.
  - `Người dùng khoa`: chỉ xem thiết bị/sự cố trong phạm vi khoa và chỉ được báo/cập nhật sự cố của khoa mình.
- Mọi request thay đổi dữ liệu sau khi xác thực được ghi vào `security_audit_logs` với người dùng thật, vai trò, thời gian, HTTP method, đường dẫn, mã trạng thái và IP.
- `/api/users` không trả `password_hash` hoặc `password_salt` ra frontend.
- Trang Người dùng có nút 🔑 để Quản trị viên cấp lại mật khẩu tạm thời.
- `uploads/documents` và `uploads/qr` không còn public toàn bộ; phải có phiên và kiểm tra phạm vi khoa.
- QR công khai vẫn dùng các endpoint `/api/qr/...`; gửi kiểm tra QR được giới hạn 30 lượt/IP/giờ để giảm spam.

## Tài khoản quản trị lần đầu

Có thể tạo file `.env` và đặt:

```env
ADMIN_INITIAL_PASSWORD=MatKhauTamThoiManh123!
AUTH_SESSION_HOURS=8
```

Nếu chưa đặt `ADMIN_INITIAL_PASSWORD`, lần chạy P2 đầu tiên hệ thống tự sinh một mật khẩu tạm thời và in **một lần** trong cửa sổ chạy phần mềm. Sau đăng nhập, hệ thống bắt buộc đổi mật khẩu.

## Lưu ý dữ liệu production

P2 sửa nốt hai điểm legacy còn sót:

1. `initExtendedModules()` chỉ sinh dữ liệu mẫu khi `DEMO_MODE=true`.
2. Backend production không tự suy `Serial Number` từ `insurance_code`; frontend cũng loại listener legacy tự điền Serial từ ô Mã bảo hiểm.

Serial hãng và mã HIS/BHXH phải được coi là các trường dữ liệu độc lập; nếu cần quy tắc chuyển đổi HIS → Serial thì nên triển khai bằng trường HIS riêng và thao tác nhập/chuyển đổi có chủ đích.

## Kiểm tra

```bash
npm run check:safety
```

Kiểm tra cú pháp và điểm vá P0 + P1 + P2 mà không mở database thật.
