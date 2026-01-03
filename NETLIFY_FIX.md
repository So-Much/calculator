# Hướng dẫn fix lỗi Netlify deployment

## Lỗi hiện tại:
```
Cannot find module './cjs/react.development.js'
```

## Giải pháp:

### Cách 1: Sử dụng Netlify Next.js Plugin (Khuyến nghị)

1. **Cài đặt plugin trong Netlify UI:**
   - Vào Netlify Dashboard
   - Chọn site của bạn
   - Vào **Site settings** > **Plugins**
   - Tìm và cài **"Next.js"** plugin (hoặc "@netlify/plugin-nextjs")
   - Plugin sẽ tự động được cài đặt

2. **Hoặc thêm vào netlify.toml:**
   File `netlify.toml` đã được tạo với cấu hình cơ bản. Nếu cần plugin, thêm:
   ```toml
   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

### Cách 2: Cấu hình Build Settings thủ công

1. Vào Netlify Dashboard
2. **Site settings** > **Build & deploy**
3. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `.next`
4. **Environment variables:**
   - Thêm `NODE_VERSION`: `20`

### Cách 3: Kiểm tra Next.js version

Next.js 16.1.1 có thể cần cấu hình đặc biệt. Đảm bảo:
- Node version: 18+ (khuyến nghị 20)
- Build command đúng: `npm run build`
- Publish directory: `.next`

## Sau khi fix:

1. Commit và push file `netlify.toml` lên repository
2. Trigger deploy mới trên Netlify
3. Kiểm tra build logs để đảm bảo build thành công

## Lưu ý:

- File `netlify.toml` đã được tạo với cấu hình cơ bản
- Nếu vẫn lỗi, thử cài plugin Next.js trong Netlify UI
- Đảm bảo Node version phù hợp (18+)

