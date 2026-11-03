# V10: Trợ lý bình luận livestream (thử nghiệm)

## Chức năng đang có

- Tạo một phiên dựa trên URL live Facebook hoặc TikTok (URL chỉ là nhãn nguồn, không kết nối API).
- Nhập nhanh nhiều bình luận ở dạng `Tên | Nội dung | URL hồ sơ (không bắt buộc)` hoặc `Tên: Nội dung`.
- Phân tích những từ khóa như “chốt 2”, “lấy 1 cây”, gợi ý số lượng và mã SKU hoặc tên sản phẩm có sẵn.
- Người nhà duyệt từng gợi ý vào `family_livestream_leads`. Quy trình tạo đơn chính thức vẫn diễn ra qua Sổ vận hành → Livestream.
- Trên trình duyệt desktop hỗ trợ `getDisplayMedia`, người dùng có thể tự chia sẻ một tab/màn hình và bật OCR cục bộ thử nghiệm bằng Tesseract.js. OCR lấy các frame tối đa một lần mỗi 5 giây, không gọi Facebook/TikTok.
- Screenshot OCR chỉ nằm trong RAM của trình duyệt, không tải lên Supabase. Dữ liệu đã được duyệt sẽ lưu vào hàng chờ livestream theo schema V7, có mô tả URL buổi live và URL hồ sơ *nếu người dùng điền vào*.

## Giới hạn bắt buộc công khai

- Dán link không tạo kết nối realtime tới Facebook/TikTok. Để đọc những bình luận chưa xuất hiện trên màn hình, cần nguồn được cấp quyền hoặc tích hợp chính thức.
- OCR màn hình không có ID bình luận hoặc URL hồ sơ đáng tin cậy. Người dùng cần sao chép URL hồ sơ thủ công từ giao diện được phép. Không hứa lấy được tên/đường dẫn của mọi khách.
- OCR có thể sai dấu tiếng Việt, nhầm bình luận, lẫn câu thoại và bỏ sót dòng khi live nhanh. Không được tự tạo đơn chỉ dựa vào OCR.
- Screen Capture API cần thao tác chia sẻ của người dùng, HTTPS (hoặc localhost), phụ thuộc hỗ trợ từng trình duyệt. iPhone thường không hỗ trợ cùng luồng capture này.
- Tesseract.js tải worker và mô hình ngôn ngữ khi chạy lần đầu, cần Internet; gói npm được thêm vào dependencies. Dùng máy tính để thử, không khuyến nghị chạy OCR liên tục trên điện thoại yếu.
- Dữ liệu khách hàng thu thập chỉ để xử lý đơn, cần thông báo và tuân thủ điều kiện nền tảng/pháp luật liên quan. Không thu thập dữ liệu cá nhân không cần thiết. Không có cơ chế né chống bot.
- Hàng đợi trong màn hình này chỉ nằm trong RAM; tải lại sẽ mất gợi ý chưa duyệt. Lead đã duyệt lưu trong Supabase (nếu đã cài V7) hoặc demo localStorage.
- Trước khi dùng thật cần chạy `npm run typecheck`, `npm run build` và kiểm tra trong Chrome/Edge với một buổi live hợp pháp. V10 không được kiểm thử trên tài khoản FB/TikTok thật.

## Quy trình

1. Bật live theo cách bình thường. Trên máy tính mở WebApp → `Trợ lý livestream`.
2. Chọn nền tảng, dán link buổi live, mở live trong tab mới.
3. Dán các bình luận theo mẫu hoặc tự chia sẻ tab màn hình live và chọn vùng OCR gần khung chat.
4. Xác minh TÊN, MÃ SẢN PHẨM, SỐ LƯỢNG và URL HỒ SƠ (nếu có).
5. Duyệt từng bình luận. Vào `Sổ vận hành → Livestream` để bổ sung số điện thoại, địa chỉ do khách cung cấp và tạo đơn.

## Các bước chưa triển khai

- Kết nối API chính thức với Meta/TikTok nếu có quyền.
- Nhận bình luận với ID gốc, tên định danh người dùng, avatar, URL hồ sơ theo quyền được cấp.
- Đồng bộ realtime trên nhiều máy, lọc spam thông minh, phân tích bình luận bằng mô hình AI và hỗ trợ phản hồi khách qua kênh được cấp phép.
