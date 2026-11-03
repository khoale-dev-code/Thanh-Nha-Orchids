# Design system và nguyên tắc tâm lý người dùng

## Cảm hứng

Hình ảnh logo của chính Vườn Lan Thanh Nhã, cách thiết kế theo ngữ cảnh từ `baoyu-design`, và các nguyên tắc accessibility/pragmatic UX.

- Primary `#00A651` xanh hoa lan, primary hover `#00873E`.
- Secondary soft accent `#E491C9` hồng cánh hoa, không dùng bừa bãi cho CTA.
- Dark `#182B22`, background `#F7F9F7`, surface trắng.
- Typography: **Be Vietnam Pro**, fallback sans-serif.
- Spacing tập trung 8,12,16,24,32; corner radius 12-19px.
- Mục tiêu diện tích tương tác >=44px cho điều khiển quan trọng; chữ có tương phản rõ.

## Tâm lý người lớn tuổi

1. Mỗi màn hình chỉ có 1 hành động chính: Chốt đơn/Thêm sản phẩm/Lưu thông tin.
2. Người dùng không cần nhớ giá: sản phẩm hiển thị ngay tên, biến thể, giá.
3. Giỏ hàng luôn thấy cộng tiền thời gian thực; các chi phí minh bạch.
4. Khách cũ chọn từ danh sách, tự lấy địa chỉ/điện thoại.
5. Khi chốt xong chuyển thẳng hóa đơn để in hoặc gửi khách, không bắt tìm lại đơn.
6. Tránh màu đỏ trừ khi lỗi hoặc hủy; giảm tải nhận thức bằng nhãn rõ và ít lựa chọn cùng lúc.
7. Mobile dùng điều hướng dưới, các trang dài cuộn dọc; bảng đơn chuyển thành card.
8. Tôn trọng `prefers-reduced-motion` và không dùng animation nặng trong form.

## Roadmap khả năng tiếp cận

Thử thực địa với người dùng lớn tuổi, kiểm tra cỡ chữ 200%, keyboard, trình đọc màn hình, nhập liệu khi bàn phím mobile hiện ra, thử touch targets trên màn hình 320px.
