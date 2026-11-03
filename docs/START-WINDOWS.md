# Hướng dẫn khởi tạo trên Windows

## 1. Chuẩn bị

- Windows 10/11, PowerShell 5.1+, Node.js 22 LTS khuyến nghị (tối thiểu 20.9).
- Kết nối Internet cho lần `npm install` đầu tiên; dùng VS Code.
- File ZIP nằm ở `C:\Users\Bin77\Downloads\Vuon-Lan-Thanh-Nha-WebApp.zip`.
- Giải nén nguyên thư mục `vuon-lan-thanh-nha` vào `D:\freetime\` để được đường dẫn `D:\freetime\vuon-lan-thanh-nha`.

## 2. Chạy theo đúng thứ tự

```powershell
cd "D:\freetime\vuon-lan-thanh-nha"
code .

# Xem trước, không ghi dữ liệu
powershell -NoProfile -ExecutionPolicy Bypass -File ".\setup.ps1" -DryRun

# Kiểm tra môi trường, không sửa file
powershell -NoProfile -ExecutionPolicy Bypass -File ".\setup.ps1" -Check

# Tạo .env.local nếu chưa có, cài package, chạy development
powershell -NoProfile -ExecutionPolicy Bypass -File ".\setup.ps1"
```

Mở http://localhost:3000. Nếu `.env.local` chưa cấu hình Supabase, ứng dụng tự vào chế độ **Demo** có dữ liệu ví dụ, chỉ lưu trong trình duyệt. Không nhập dữ liệu khách thật trong Demo.

## 3. Cấu hình sử dụng thật

1. Đọc `docs/SUPABASE.md` và tạo tài khoản Supabase.
2. Thêm URL + anon key vào `.env.local`, đặt quyền RLS + member.
3. Đọc `docs/PRINT-PWA.md` trước khi kết nối máy in.
4. Nếu ký hợp đồng EMS, đọc `docs/VNPOST.md` để cấu hình API; mặc định cổng này tắt.
5. Kiểm tra production bằng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\setup.ps1" -Production
```

`-Production` chạy `npm run typecheck` và `npm run build`, không tự thay đổi database, không tự deploy. Cài trong thư mục riêng, không ghi đè dự án đang có.

## 4. Lưu ý

- `setup.ps1` không ghi đè `.env.local` có sẵn.
- `-DryRun` và `-Check` không ghi file, không cài package.
- Nếu cần khôi phục source, giải nén một bản ZIP khác sang thư mục mới; dữ liệu Supabase không nằm trong ZIP.
- Để chạy cổng 3000, đóng ứng dụng khác đang chiếm cổng hoặc dùng `npm run dev -- -p 3001`.
