# V9 – Bán thùng một biến thể

## Chức năng
- Chốt đơn giao hàng hoặc bán trực tiếp, chọn **Bán sỉ theo thùng**.
- Chọn **một** biến thể sản phẩm, điền số thùng, số cây/thùng, giá thùng và giảm giá thêm (nếu có).
- Tồn kho dùng **cây**: số trừ = số thùng x số cây/thùng. Mỗi đơn thùng V9 tối đa 10.000 cây, 100 thùng, 1.000 cây/thùng.
- Giá thùng > 0 và không cao hơn số cây tương ứng tính theo giá lẻ tham chiếu. Chỉ dùng giá sỉ giảm so với giá lẻ trong giai đoạn này.
- Hóa đơn 80mm hiển thị số thùng, số cây, giá/thùng. Phiếu gốc `orders` và `order_items` giữ nguyên; bảng `order_carton_lines` lưu quy cách thùng.
- Giảm giá sỉ được lưu vào `orders.discount` cùng giảm giá thêm để tận dụng phép tính thuế, tổng tiền, chiết khấu và giá vốn của backend hiện tại. Hóa đơn tách lại giảm giá thêm để dễ đọc.

## Dữ liệu Supabase
1. Sao lưu cơ sở dữ liệu và làm trên staging trước.
2. Phải chạy `001_initial.sql` và `002_instore_sales.sql`; V7/V8 nếu đang dùng thì giữ migrations đã áp dụng.
3. Chạy **005_single_variant_cartons.sql** trong Supabase SQL Editor.
4. Kiểm tra quyền bảng `order_carton_lines` và function `create_sale_carton`.
5. Thử tạo 1 đơn thùng. Kiểm tra `order_items.quantity = carton_count * units_per_carton`, tồn kho giảm cùng lượng; tổng tiền đúng sau giảm giá/thuế/phí ship.
6. Thử bấm chốt hai lần với cùng `request_id` để xác nhận không sinh thêm đơn.
7. Thử hủy đơn đã tạo và kiểm tra hoàn kho theo trigger 001. Thử vượt tồn kho và kiểm tra DB không thay đổi.

## Lưu ý
- V9 **chưa hỗ trợ thùng trộn màu**, nhiều biến thể trong cùng đơn bán thùng, hoặc giao nhiều đợt. Bán lẻ giữ cách xử lý cũ.
- Nếu chưa chạy migration, không thể chốt đơn thùng trên Supabase; ở Demo vẫn dùng thử được.
- Không dùng đơn thùng để giữ hàng/chia lô. Giữ hàng từ V7 chỉ ghi riêng; chưa tự cấn trừ tiền cọc.
- Bán trực tiếp vẫn yêu cầu đã nhận đủ tiền; đơn giao hàng có thể chưa thanh toán.
- Với biến thể chưa theo dõi tồn kho, app không thể chặn bán vượt số cây thực tế.
