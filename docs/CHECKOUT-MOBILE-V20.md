# Vườn Lan Thanh Nhã - Chốt đơn mobile V20

## Mục tiêu

Thiết kế lại riêng trang `/new-order` trên điện thoại theo luồng ba bước: Chọn hàng → Khách nhận → Thanh toán. Phương pháp phân cấp thông tin lấy cảm hứng từ [baoyu-design](https://github.com/JimLiu/baoyu-design); không sao chép thư viện hoặc mã nguồn bên ngoài.

## Nghiệp vụ được giữ nguyên

Bán trực tiếp, giao hàng, bán lẻ, bán thùng V9, khách vãng lai/Facebook/TikTok/đã lưu, địa chỉ V15, danh bạ V16, lựa chọn khách livestream V11, tính tiền, thuế, giảm giá, vận chuyển, đánh dấu thanh toán và tạo đơn có idempotency key. Desktop không đổi.

## Giao diện mobile

- 1. Chọn hình thức bán, quy cách bán, tìm sản phẩm và điều chỉnh giỏ.
- 2. Chọn nguồn khách, số liên hệ và địa chỉ nhận.
- 3. Kiểm tra tóm tắt giỏ, tên khách, phí ship, giảm giá, hình thức thanh toán, sau đó chốt đơn.
- Mỗi bước giữ nguyên state; không gọi API mới khi chuyển bước.
- Tiếp tục chỉ khi dữ liệu cần thiết đã hợp lệ; nút xác nhận cuối vẫn sử dụng logic chốt đơn hiện tại.
- Không tạo thanh cố định mới che tabbar; ô nhập trên iPhone đặt cỡ chữ tối thiểu 16px để giảm zoom tự động.

## Kiểm thử sau cài đặt

1. iPhone Safari/PWA ở 320, 375, 390 và 430px; Android và desktop.
2. Bán trực tiếp thu tiền mặt; bán giao hàng chưa thanh toán; COD; khách Facebook/TikTok; khách đã lưu nhiều địa chỉ; khách livestream.
3. Bán thùng: số thùng, cây/thùng, giá sỉ, tồn kho.
4. Thử thiếu thông tin và giá trị không hợp lệ, quay lại từng bước và xác nhận dữ liệu còn nguyên.
5. Kiểm tra hóa đơn, tồn kho, trạng thái đơn và không tạo đơn trùng.

Bản vá chỉ sửa `src/components/new-order.tsx` và thêm CSS riêng; không đụng migration hoặc backend. Dùng `-DryRun` trước khi cài, và chạy `npm run typecheck`, `npm run check:logic`, `npm run build`.
