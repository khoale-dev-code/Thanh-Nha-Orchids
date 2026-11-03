# In hóa đơn, gửi ảnh và PWA

## Hóa đơn

- `/print/<id>` hiển thị hóa đơn bán hàng nội bộ của đơn.
- Nút In mở trình in của trình duyệt. Chọn máy in nhiệt 80mm, đúng driver/khổ giấy, margin nhỏ; thử với giấy thật trước khi dùng.
- Không hứa hẹn tự in bỏ qua hộp thoại bằng trình duyệt/PWA thường. Muốn in im lặng trên Windows nên triển khai kiosk theo chính sách máy hoặc cầu nối desktop hỗ trợ ESC/POS; Android/iOS cần giải pháp in tương thích riêng.
- Nút Lưu ảnh PNG tạo ảnh từ mẫu HTML; nút Chia sẻ ảnh sử dụng Web Share API khi trình duyệt hỗ trợ chia sẻ file, còn lại tự tải PNG để gửi qua Zalo/Messenger.
- QR chuyển khoản dùng Quick Link VietQR theo cấu hình ngân hàng trong Settings và route proxy cùng origin. Cần Internet để tải ảnh QR khi tạo hóa đơn. Kiểm tra số tài khoản trước khi gửi khách.
- Phiếu bán hàng nội bộ **không thay thế** hóa đơn điện tử thuế theo quy định áp dụng.

## PWA

- `manifest.webmanifest` + biểu tượng 192/512 PNG có sẵn.
- Service worker lưu các tài nguyên giao diện/brand không nhạy cảm. Dữ liệu khách, đơn hàng, đường dẫn tra cứu và API KHÔNG được cache qua service worker.
- Supabase mất kết nối sẽ không chốt đơn offline để tránh đơn trùng, tồn kho sai và báo cáo không đồng nhất; có trang offline hướng dẫn kết nối lại.
- PWA cần HTTPS khi triển khai công khai (localhost được trình duyệt hỗ trợ trong quá trình phát triển).
- Android: Chrome/Edge → cài ứng dụng khi hiện lời mời.
- iOS Safari: Share → Add to Home Screen (Thêm vào Màn hình chính).
- Khả năng cài đặt, chia sẻ ảnh và in phụ thuộc hệ điều hành, trình duyệt và thiết bị.
