# Bán trực tiếp trực tiếp và hóa đơn nhiệt 80mm (V6)

## Hai hình thức chốt đơn

- **Bán trực tiếp:** chọn sản phẩm, có thể chọn khách cũ hoặc để "Khách lẻ", giảm giá nếu có, chọn Tiền mặt hoặc Chuyển khoản, rồi chốt. Không tính phí vận chuyển, không cần địa chỉ khách. Đơn được ghi nhận **Đã giao / Đã thanh toán**, trừ tồn kho và xuất hiện trong báo cáo doanh thu.
- **Giao hàng:** giữ quy trình cũ, bao gồm khách hàng, phí vận chuyển, phương thức COD nếu cần và trạng thái vận chuyển.

Hiện tại bán trực tiếp chỉ hỗ trợ các giao dịch **đã thanh toán đầy đủ**. Giao dịch ghi nợ chưa được xây dựng để tránh ghi nhận doanh thu/tiền thu không chính xác.

## Supabase: bước bắt buộc trước khi bán trực tiếp bằng dữ liệu thật

Vào **Supabase Dashboard > SQL Editor**. Chạy nội dung file:

`supabase/migrations/002_instore_sales.sql`

File này tạo hàm `public.create_sale_pos`, gọi lại nghiệp vụ `create_sale` hiện có để đảm bảo giá bán/thuế/trừ tồn kho do database tính. Hàm cập nhật hoàn tất bán hàng trong **cùng một giao dịch**. Nếu chưa chạy migration, chế độ Demo vẫn chạy được nhưng Supabase sẽ báo lỗi khi tạo đơn trực tiếp.

Không sửa, xóa hoặc chạy lại `001_initial.sql` trên database có dữ liệu thật chỉ để cập nhật V6.

## In hóa đơn

1. Chốt đơn mới và mở trang phiếu in.
2. Chọn **In hóa đơn 80mm**.
3. Trong hộp thoại in, chọn máy in nhiệt, khổ giấy 80mm, lề tối thiểu (0-2mm), tỉ lệ 100%, tắt header/footer của trình duyệt.
4. In thử một hóa đơn có nhiều sản phẩm và ký tự tiếng Việt. Điều chỉnh driver giấy thực tế nếu bị cắt chữ.

Web/PWA không thể bỏ qua hộp thoại in trên mọi thiết bị. In tự động không hộp thoại phải dùng cầu nối riêng hoặc chế độ kiosk được cấu hình phù hợp. Mẫu in này là **phiếu bán hàng nội bộ**, không thay thế hóa đơn điện tử theo quy định.

## Gửi ảnh

Tại trang hóa đơn có nút chia sẻ và lưu PNG. Trên thiết bị hỗ trợ Web Share API, có thể chia sẻ trực tiếp; nếu không, hệ thống tải ảnh để gửi Zalo/Messenger thủ công.

## Kiểm tra nghiệp vụ

- Bán trực tiếp: phí ship bằng 0, chọn tiền mặt, chốt đơn, in phiếu, xem trạng thái "Bán trực tiếp" trong danh sách và báo cáo.
- Giao hàng: phí ship thu khách khác phí ship thực trả, chọn COD, tạo đơn mới, không tự chuyển thành đã giao.
- Kiểm tra tồn kho trước/sau bán trực tiếp. Hủy đơn phải hoàn tồn một lần như luồng cũ.
- Bấm chốt lại sau lỗi mạng: dùng lại mã request id để hạn chế đơn trùng. Kiểm tra đơn mới có xuất hiện trong danh sách trước khi chốt lại bằng thao tác thủ công.
- Thử in hóa đơn 80mm dài, nhiều biến thể, giá lớn như `3.500.000 ₫`, mã QR khi chưa thanh toán.
