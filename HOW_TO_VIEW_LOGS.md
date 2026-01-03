# Cách xem Logs trên Netlify

## Cách 1: Xem Function Logs (Khuyến nghị)

1. Đăng nhập vào Netlify Dashboard: https://app.netlify.com
2. Chọn site của bạn: **melodic-kulfi-59da7f**
3. Vào tab **Functions** (hoặc tìm "Functions" trong menu bên trái)
4. Click vào function `/api/excel/account`
5. Xem phần **Logs** - sẽ hiển thị tất cả console.log và console.error

## Cách 2: Xem Deploy Logs

1. Vào Netlify Dashboard
2. Chọn site của bạn
3. Vào tab **Deploys**
4. Click vào deploy mới nhất (màu vàng hoặc xanh)
5. Scroll xuống phần **Function logs** hoặc **Build logs**

## Cách 3: Xem Real-time Logs

1. Vào Netlify Dashboard
2. Chọn site của bạn
3. Click vào **Site configuration** > **Functions**
4. Tìm function `/api/excel/account`
5. Click vào để xem logs real-time

## Những gì cần tìm trong logs:

Tìm các dòng bắt đầu bằng:
- `[API]` - Logs từ API routes
- `[Google Sheets]` - Logs từ Google Sheets functions

Ví dụ:
```
[API] POST /api/excel/account - Request received
[Google Sheets] Initializing authentication...
[Google Sheets] Using environment variables for auth
[Google Sheets] Service Account Email: hi-garment-ggacount@...
```

Nếu thấy lỗi, sẽ có:
```
[API] Error creating account: [error details]
[Google Sheets] Error getting sheet "account": [error details]
```

## Copy toàn bộ logs và gửi lại

Sau khi xem logs, copy toàn bộ nội dung (đặc biệt là các dòng có `[API]` hoặc `[Google Sheets]` và các dòng error) và gửi lại để tôi có thể phân tích chính xác vấn đề.

