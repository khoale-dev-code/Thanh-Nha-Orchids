# Robot livestream V10.2: chẩn đoán và chọn vùng OCR

## Lý do V10 bỏ sót bình luận

- Vùng mặc định trên phiên Facebook Live có thể lấy cả video, thanh công cụ và bình luận rất nhỏ.
- OCR có thể trả về text nhưng bộ lọc chỉ nhận câu chốt có tác giả và sản phẩm được người nhà xác nhận.
- Bản V10 hiển thị "Đang quan sát" kể cả khi nhận được 0 ký tự hoặc chưa phát hiện được đơn.

## Cách sử dụng mới

1. Mở buổi Facebook/TikTok Live trong Chrome/Edge trên máy tính. Chọn bố cục có cột bình luận rộng nhất, tăng zoom trang nếu chữ nhỏ.
2. Trong mục Robot livestream, chọn Facebook/TikTok, nhấn **Bắt đầu đọc bình luận** và chọn tab livestream khi được trình duyệt yêu cầu chia sẻ.
3. Khung hình sẽ hiển thị vùng viền xanh. Kéo trực tiếp trên hình để khoanh cột bình luận; hoặc dùng **Bên phải** / **Bên trái**.
4. Dùng **Quét thử ngay** rồi mở **Xem vùng chữ robot đang đọc**. Nếu chữ ở đây không nhìn rõ, OCR cũng khó đọc.
5. Xem số ký tự / dòng đã đọc và mục **Xem và sửa chữ OCR**. Chỉnh lại chữ khi cần rồi chọn **Phân tích lại chữ**.
6. Chọn sản phẩm, kiểm tra tên và số lượng, nhấn **Duyệt vào sổ**. Đơn chưa được tạo và chưa trừ kho ở bước này.

## Giới hạn

- Không thể bảo đảm bắt đủ chat đang trôi nhanh; 5 giây giữa các lượt đọc có thể bỏ sót. Không nhận link hồ sơ tự động.
- Mã OCR chỉ xử lý video màn hình được người dùng chủ động chia sẻ. Không gọi API nền tảng, không vượt CAPTCHA hoặc giới hạn truy cập.
- Ứng dụng vẫn cần người nhà kiểm tra thông tin để tránh giao sai và tránh dùng nhầm tên OCR cho khách hàng.
- Trên iPhone Safari, chia sẻ màn hình qua Web API này có thể không được hỗ trợ; dùng dán bình luận để dự phòng.
- Trong chế độ demo, không nhập thông tin khách thật.
