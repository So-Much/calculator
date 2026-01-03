# Hướng dẫn xử lý lỗi Google Sheets

## Lỗi 500 khi tạo account

### Bước 1: Kiểm tra Service Account có quyền truy cập

**QUAN TRỌNG**: Bạn phải share Google Sheet với **Service Account Email** cụ thể, không phải chỉ "Anyone with the link".

1. Mở Google Sheet: https://docs.google.com/spreadsheets/d/1hPkAlkmDIUUzTisBxPijxHKh_aIvACyn6nUqmOPro3o/edit
2. Click nút **"Share"** (góc trên bên phải)
3. Trong ô "Add people and groups", nhập email: **hi-garment-ggacount@hi-garment-synch-data.iam.gserviceaccount.com**
4. Chọn quyền **"Editor"**
5. Bỏ tick **"Notify people"** (không cần gửi email)
6. Click **"Share"**

### Bước 2: Kiểm tra Environment Variables trên Netlify

Vào Netlify Dashboard > Site settings > Environment variables và kiểm tra:

1. **GOOGLE_SHEETS_SPREADSHEET_ID**
   - Giá trị: `1hPkAlkmDIUUzTisBxPijxHKh_aIvACyn6nUqmOPro3o`
   - Không có khoảng trắng ở đầu/cuối

2. **GOOGLE_SERVICE_ACCOUNT_EMAIL**
   - Giá trị: `hi-garment-ggacount@hi-garment-synch-data.iam.gserviceaccount.com`
   - Chính xác từng ký tự

3. **GOOGLE_PRIVATE_KEY**
   - Phải copy TOÀN BỘ private key, bao gồm:
     - `-----BEGIN PRIVATE KEY-----`
     - Toàn bộ các dòng key
     - `-----END PRIVATE KEY-----`
   - Trong Netlify, paste trực tiếp (có thể nhiều dòng)
   - Không được có khoảng trắng thừa ở đầu/cuối

### Bước 3: Xem Error Logs trên Netlify

1. Vào Netlify Dashboard
2. Chọn site của bạn
3. Vào tab **Functions** (hoặc **Deploys** > chọn deploy mới nhất)
4. Xem **Function logs** để thấy error message chi tiết

Error message sẽ cho biết:
- Credentials có đúng không
- Service account có quyền truy cập không
- Sheet có tồn tại không
- Headers có được set đúng không

### Bước 4: Test lại

Sau khi:
1. ✅ Share sheet với service account email
2. ✅ Kiểm tra environment variables
3. ✅ Redeploy (nếu cần)

Thử lại và kiểm tra error message trong:
- Browser console (Network tab)
- Netlify function logs

## Các lỗi thường gặp

### "Failed to access Google Sheet: Requested entity was not found"
- **Nguyên nhân**: SPREADSHEET_ID sai hoặc service account không có quyền
- **Giải pháp**: Kiểm tra lại SPREADSHEET_ID và share sheet với service account

### "Failed to access Google Sheet: The caller does not have permission"
- **Nguyên nhân**: Service account chưa được share với quyền Editor
- **Giải pháp**: Share sheet với email service account với quyền Editor

### "Sheet has no headers. Call setSheetHeaders first"
- **Nguyên nhân**: Sheet mới được tạo nhưng chưa set headers
- **Giải pháp**: Code sẽ tự động set headers, nhưng nếu vẫn lỗi thì có thể do quyền write bị hạn chế

