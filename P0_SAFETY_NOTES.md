# QY4-TTBYT - Lưu ý an toàn P0

## Cách chạy production

Dùng một trong các cách sau:

- `CHAY_PHAN_MEM.bat`
- `CAI_DAT_VA_CHAY.bat`
- `npm start`

Các cách này đều chạy qua `safe-start.js`.

**Không chạy trực tiếp `node server.js` trên dữ liệu thật**, vì cách đó bỏ qua lớp bảo vệ P0.

## 4 lớp bảo vệ đang áp dụng

1. Không tự chạy `refreshDemoTodayData()` khi production.
2. `/api/reset-seed` bị vô hiệu khi production.
3. Không tự chuyển Serial hãng sang mã HIS/BHXH và không tự xóa Serial.
4. Không cho xóa cứng thiết bị nếu đã phát sinh lịch sử nghiệp vụ.

## Chế độ demo

Chỉ dùng với database demo riêng:

```bash
npm run demo
```

hoặc đặt `DEMO_MODE=true`.

Không bật DEMO_MODE trên database đang dùng thật.

## Tự kiểm tra lớp bảo vệ

```bash
npm run check:p0
```

Lệnh này kiểm tra đủ các điểm vá và kiểm tra cú pháp source sau khi áp dụng, nhưng không mở database và không khởi động server.
