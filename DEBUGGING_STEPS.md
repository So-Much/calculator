# Hướng dẫn Debug Function Crash

## Lỗi hiện tại:
Function crash với "An unknown error has occurred"

## Các bước debug:

### 1. Xem Function Logs trên Netlify

1. Vào Netlify Dashboard: https://app.netlify.com
2. Chọn site: **melodic-kulfi-59da7f**
3. Vào tab **Functions**
4. Click vào function bị crash (có thể là `/api/excel/account`)
5. Xem phần **Logs** để thấy error message chi tiết

### 2. Kiểm tra Environment Variables

Đảm bảo các biến sau đã được set trên Netlify:
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

### 3. Test endpoint đơn giản

Thử truy cập test endpoint để xem function có chạy được không:
```
https://melodic-kulfi-59da7f.netlify.app/api/test-google-sheets
```

### 4. Kiểm tra Build Logs

Vào **Deploys** > chọn deploy mới nhất > xem **Build logs** để đảm bảo build thành công.

### 5. Common Issues

- **Missing environment variables**: Function sẽ crash nếu không có credentials
- **Invalid credentials**: Private key format sai
- **Permission errors**: Service account chưa được share với Google Sheet
- **Module import errors**: Dependencies chưa được bundle đúng

## Sau khi xem logs:

Copy toàn bộ error message từ Netlify Function Logs và gửi lại để tôi có thể phân tích chính xác.

