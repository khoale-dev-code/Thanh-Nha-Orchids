# V11 – Chốt đơn theo nguồn khách & Sổ vận hành

## Thay đổi giao diện

- Đổi tên trang `/operations` từ **Sổ vận hành gia đình** thành **Sổ vận hành**.
- Hàng chờ livestream không tạo hóa đơn trực tiếp nữa. Chọn **Chuyển sang Chốt đơn** để mở `/new-order?lead=...`.
- Màn hình Chốt đơn có 4 nguồn: **Khách vãng lai**, **Facebook**, **TikTok**, **Khách đã lưu**.
- Bổ sung tên, số điện thoại, địa chỉ nhận hàng và lưu khách xã hội vào danh bạ (tùy chọn).
- Có thể lấy khách đang chờ từ livestream ngay trong form, tự điền sản phẩm, số lượng, liên hệ và phí ship.
- Chỉ đánh dấu lead **đã chuyển đơn** sau khi tạo đơn thành công. Nếu đồng bộ trạng thái lead lỗi, không tạo đơn thứ hai.
- Giữ chế độ bán tại quầy, giao hàng, bán lẻ và bán thùng V9.

## Dữ liệu & giới hạn

- Không yêu cầu migration mới. Nguồn Facebook/TikTok được lưu trong **ghi chú đơn**; không tạo cột source mới.
- Thông tin khách xã hội có thể được lưu vào danh bạ theo số điện thoại, không tự cập nhật khách trùng số.
- Khách vãng lai mua tại quầy có thể để trống thông tin. Đơn giao hàng yêu cầu tên, số điện thoại, địa chỉ.
- Cần có bảng `family_livestream_leads` (migration 003) để lấy khách từ livestream trên Supabase.
- Không đọc bình luận Facebook/TikTok trực tiếp; giữ nguyên cơ chế thủ công hoặc OCR có giám sát của V10.2.
- Đơn bán tại quầy (V6) và bán thùng (V9) tiếp tục dùng các RPC hiện có.

## Thử sau cập nhật

1. Mở Sổ vận hành > Livestream > ghi bình luận thử, chọn sản phẩm.
2. Bấm **Chuyển sang Chốt đơn**, kiểm tra tên, số điện thoại, địa chỉ, sản phẩm và số lượng.
3. Thử **Khách vãng lai** mua tại quầy, không có số điện thoại.
4. Thử **Facebook/TikTok** giao hàng và bật lưu khách vào danh bạ.
5. Chốt một đơn TEST, kiểm tra hóa đơn, tên người nhận, ghi chú nguồn và trạng thái lead.
6. Kiểm tra đơn bán thùng V9 vẫn hoạt động.

Trước khi dùng thật: sao lưu Supabase, kiểm thử với đơn hàng mẫu. Không đưa dữ liệu khách thật vào chế độ Demo.
