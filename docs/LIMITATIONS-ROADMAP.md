# Phạm vi MVP và những hạng mục cần triển khai tiếp

## Đã có trong source

- Giao diện Next.js App Router + Tailwind CSS v4 + responsive.
- Chốt đơn và in phiếu 80mm, tạo ảnh PNG chia sẻ, QR VietQR nếu cấu hình.
- Sản phẩm có biến thể, giá bán/vốn, thuế tùy chọn, tồn kho tùy chọn.
- Khách hàng và lịch sử từ những đơn đang tải; tìm kiếm, chỉnh sửa, lưu trữ.
- Trạng thái đơn và thanh toán; nhập mã vận đơn thủ công.
- Dashboard 7/14/30/365 ngày, báo cáo cả năm chọn nhiều tháng, doanh thu đơn đã giao và lãi gộp.
- Demo trong localStorage; Supabase Auth + RLS + SQL RPC tạo đơn atomic.
- PWA manifest và service worker cache tài nguyên không nhạy cảm.
- Cổng EMS tạo vận đơn tùy cấu hình, **chưa kiểm thử bằng credentials đối tác thật**.

## Chưa có / không nên nhầm với tính năng đã hoàn thiện

- Đồng bộ **tự động** trạng thái từ Vietnam Post/EMS, đối soát COD, lấy cước và nhãn vận đơn trực tuyến.
- Xác nhận chuyển khoản tự động qua webhook ngân hàng / SePay.
- Máy in ESC/POS không hộp thoại, kết nối trực tiếp USB/Bluetooth từ mọi thiết bị.
- Gửi tin nhắn tự động qua Zalo OA/Facebook/TikTok; hiện chỉ xuất ảnh, sao chép link để gửi bằng ứng dụng chat.
- Quản lý kho nhập xuất tồn chi tiết theo lô, hạn hàng, kiểm kê, trả hàng, hoàn tiền.
- Hệ thống quản lý nhiều cửa hàng, gói SaaS, subscription và phân quyền chi tiết cho từng quyền.
- Hóa đơn điện tử hợp lệ theo cơ quan thuế.
- Báo cáo kế toán đầy đủ, thuế thu nhập, phân bổ chi phí cố định và sổ quỹ.
- Tự động thử nghiệm cross-device / máy in thật; cần kiểm chứng triển khai.

## Thứ tự triển khai hợp lý

1. Test chốt đơn thực tế với 2-3 người bán lớn tuổi, sửa các thao tác khó.
2. Đăng nhập Supabase, thử RLS, chốt đơn, hủy, kiểm tra tồn kho và snapshot.
3. Nhập danh mục thực, khách có sự đồng ý, thiết lập địa chỉ/bank, kiểm tra hóa đơn trên máy in thật.
4. Khi nhận token EMS, đối chiếu mapping địa chỉ/trọng lượng và test môi trường EMS trước khi bật tạo vận đơn.
5. Thêm công cụ nhập sản phẩm Excel, báo cáo khách hàng tổng hợp SQL, phân quyền theo chức năng, audit log và backup tự động.
6. Chỉ sau giai đoạn ổn định mới phát triển phần tự động hóa vận chuyển/đối soát thanh toán, đa cửa hàng SaaS.
