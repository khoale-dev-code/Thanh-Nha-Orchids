# V15: Ảnh hóa đơn iPhone và địa chỉ hành chính

## Xuất ảnh hóa đơn

- Tạo bản sao phiếu 80 mm ở vùng ẩn, cố định 302 CSS px, không lấy kích thước bị co theo màn hình iPhone.
- Giữ nội dung nhiều dòng, địa chỉ dài, số tiền; ảnh PNG có nền trắng và tỉ lệ điểm ảnh thích hợp.
- Chức năng chia sẻ và tải ảnh dùng cùng một đường kết xuất. Lệnh in 80 mm không bị thay đổi.
- Kiểm thử thực tế trên Safari iOS với hóa đơn nhiều sản phẩm, địa chỉ dài và QR. Nếu Safari giới hạn kích thước canvas, giảm hệ số điểm ảnh tự động.

## Địa chỉ khách

- Hiện hành từ ngày 1/7/2025: Tỉnh/Thành phố > Xã/Phường > Số nhà/Đường (không có Quận/Huyện).
- Ba cấp trước năm 2025: Tỉnh/Thành phố > Quận/Huyện > Xã/Phường > Số nhà/Đường. Chỉ dùng cho địa chỉ cũ.
- Dữ liệu hiện hành nguồn Open Admin Data, CC BY 4.0, https://github.com/open-admin-data/vietnam-administrative-divisions (dữ liệu theo Quyết định 19/2025/QĐ-TTg, cần đối chiếu thay đổi mới trước khi sử dụng lâu dài).
- Dữ liệu cũ nguồn madnh/hanhchinhvn, https://github.com/madnh/hanhchinhvn (changelog 2023-04-08).
- Lưu chuỗi địa chỉ đầy đủ trong các trường `address`/`customer_address` hiện có. Các mã lựa chọn KHÔNG điền tự động vào trường mã EMS/VNPost vì hệ quy chiếu của đối tác có thể khác.
- Địa chỉ từ livestream hoặc khách đã có vẫn cho sửa tay. Khi chọn lại theo danh mục, cần chọn đủ địa phương và nhập số nhà/đường.
- Không cần sửa Supabase schema.

## Kiểm tra

1. Chốt đơn Facebook/TikTok, điền tỉnh/phường/số nhà, kiểm tra đơn và phiếu in có toàn bộ địa chỉ.
2. Chuyển sang địa chỉ ba cấp, chọn tỉnh/quận/xã, kiểm tra đúng danh sách phụ thuộc.
3. Chọn khách livestream có địa chỉ sẵn: dữ liệu giữ nguyên cho đến khi chọn lại.
4. Sửa một khách trong Danh bạ, kiểm tra giữ nguyên mã EMS nếu nhập tay.
5. Lưu ảnh PNG trên iPhone Safari/PWA, kiểm tra 100% phần bên phải và dưới cuối phiếu.
6. Kiểm tra `npm run typecheck`, `npm run check:logic`, `npm run build`.
