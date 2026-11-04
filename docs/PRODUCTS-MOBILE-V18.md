# V18 - Danh muc san pham tren dien thoai

## Thay doi

- Giữ luồng chỉnh sửa, ngừng bán, trạng thái và biến thể sản phẩm hiện có.
- Màn hình <= 767px: chỉ hiển thị card mobile; màn hình lớn: chỉ hiển thị bảng.
- Ô tìm kiếm dùng cỡ chữ 16px trên mobile, có nút xóa, không can thiệp viewport.
- Bộ lọc hai trạng thái: Đang bán / Tất cả (bao gồm sản phẩm đã ngừng bán).
- Nút chỉnh sửa và ngừng bán có vùng chạm tối thiểu 49px; thao tác ngừng bán vẫn yêu cầu xác nhận.
- CSS riêng nằm tại `src/components/product-directory-v18.css`, không ghi đè `globals.css`.

## Tai lieu tham khao thiet ke

- Baoyu Design: https://github.com/JimLiu/baoyu-design
- Archive baoyu-design: https://github.com/JimLiu/baoyu-design/tree/main/archive/baoyu-design

## Kiem tra

- Thử các chiều rộng 320 / 360 / 375 / 390 / 430 / 768px.
- Thử tìm kiếm, chuyển trạng thái, chỉnh sửa, ngừng bán, và một sản phẩm không còn biến thể hoạt động.
- Nếu có thay đổi source mà script không nhận diện, sử dụng -DryRun để xem lỗi trước, không tự ghi đè.
