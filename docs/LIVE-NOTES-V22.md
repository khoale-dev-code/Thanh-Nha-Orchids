# V22: Phiếu note livestream thủ công, in trên Android không cần API mạng xã hội

## Mục tiêu

- Thành viên gia đình nhập nhanh tên, điện thoại (tùy chọn), nickname Facebook/TikTok, sản phẩm, số lượng và ghi chú khi đang livestream.
- Lưu phiếu tạm với mã LN-YYMMDD-XXXXXXXX để tránh nhầm hàng. Có trạng thái Chờ kẹp / Đã kẹp, cho phép tra cứu và chọn in lại.
- In giấy nhiệt nhỏ 80 mm, chữ lớn, kẹp vào hoa. Phiếu tạm không tạo đơn, không thanh toán, không trừ kho, không ghi doanh thu.
- Không xin API Facebook/TikTok, không tự đọc bình luận, không lấy dữ liệu khách ngoài những gì người nhà nhập.

## Triển khai

1. Áp dụng `ThanhNha-Live-Note-V22.ps1 -DryRun` rồi áp dụng thật khi phù hợp.
2. Sao lưu Supabase, mở SQL Editor, chạy `supabase/migrations/007_live_note_print_v22.sql` một lần, sau migration 003.
3. Kiểm tra `npm run typecheck`, `npm run check:logic`, `npm run build`.
4. Mở `/live-notes` bằng menu hamburger trên điện thoại.

## In trực tiếp vào máy LAN qua laptop Windows

- Chỉ chạy cầu nối trên laptop đáng tin cậy, cùng LAN với ZyWell ZY-Q822 (đã kiểm tra IP 192.168.1.222 cổng 9100).
- Trên laptop có `D:\freetime\vuon-lan-thanh-nha\.env.local`, mở PowerShell 5.1:

```powershell
cd 'D:\freetime\vuon-lan-thanh-nha'
powershell -NoProfile -ExecutionPolicy Bypass -File '.\docs\ThanhNha-Live-Note-Printer-Bridge-V22.ps1' -PrinterIp '192.168.1.222' -Port 9100
```

- Đăng nhập bằng tài khoản Supabase Auth của thành viên được cấp quyền. Email và mật khẩu chỉ dùng trong phiên chạy trên laptop; không lưu mật khẩu vào file.
- Để cửa sổ PowerShell mở khi livestream. Trên Android mở PWA, lưu note, nhấn `In qua máy cửa hàng`. Vài giây sau cầu nối Windows sẽ nhận một job và gửi lệnh ESC/POS raster qua LAN.
- Nếu laptop tắt, job vẫn chờ. Nếu ghi `error`, kiểm tra giấy/máy trước khi chọn in lại. Không tự retry khi lệnh in có thể đã được máy nhận, để giảm nguy cơ in trùng.
- `sent` chỉ xác nhận laptop đã gửi dữ liệu tới cổng máy in, KHÔNG có biên nhận cảm biến xác thực giấy đã in.

## Phương án dự phòng

- Nút `In qua app Android` tạo PNG từ phiếu 80mm và mở bảng chia sẻ Android để chuyển cho ứng dụng in tương thích (hoặc tải về nếu không hỗ trợ).
- Nút `In qua hộp thoại` dùng hệ thống in của trình duyệt. PWA không tự mở kết nối raw TCP 9100 từ HTTPS tới địa chỉ LAN riêng.

## An toàn dữ liệu

- Hai bảng mới có RLS, chỉ `is_staff()` mới đọc và ghi. Không cấp quyền truy cập cho `anon`. Không dùng service-role key trong trình duyệt hoặc cầu nối.
- Máy tính Windows đăng nhập qua Supabase Auth rồi lấy job theo RPC; RPC claim jobs bằng `FOR UPDATE SKIP LOCKED`, ngăn hai cầu nối lấy cùng một job.
- Thao tác gửi job thủ công, không tự động in theo lịch hoặc bình luận. Giới hạn một job queued/printing cho cùng phiếu.
- Trạng thái In qua máy cửa hàng chỉ hoạt động trong chế độ Supabase; demo localStorage chỉ nằm trên thiết bị hiện tại.
- Không dùng phiếu note tạm thay hóa đơn hoặc vận đơn giao hàng.

## Kiểm thử khuyến nghị

- Tạo note giả rồi in trên máy 80mm trước khi nhập dữ liệu khách thật.
- Test ký tự tiếng Việt, tên dài, số điện thoại, nickname, ngày giờ; đúng mã trên giấy và trong hàng chờ.
- Tắt cầu nối: job chờ. Bật lại: mỗi job được lấy một lần.
- Hai người cùng xem danh sách note: bản cập nhật xuất hiện khi bấm Làm mới.
- Trước khi in lại, kiểm tra giấy có in hay chưa để tránh trùng.
