# Vườn Lan Thanh Nhã | Product Editor V8

## Mục tiêu

- Thêm/sửa sản phẩm theo 2 bước: tên & nhóm; giá & biến thể.
- Nhóm sản phẩm được chọn từ danh mục có sẵn thay vì gõ lại.
- Một mẫu bán mặc định; chuyển sang nhiều mẫu khi cần.
- Mỗi mẫu có giá bán, giá vốn tùy chọn, màu hoa, kích thước và tồn kho tùy chọn.
- SKU, trọng lượng và thuế để trong phần nâng cao.

## Bảo toàn nghiệp vụ

- Không sửa `products`, `product_variants`, `orders`, giá vốn lịch sử hoặc các RPC chốt đơn.
- Giữ `products.category` là `text` để tương thích với dữ liệu cũ.
- Khi xóa mẫu đang tồn tại, `saveProduct()` hiện tại đánh dấu biến thể cũ `active=false` trên Supabase, không xóa đơn hàng lịch sử.
- Tồn kho `null` có nghĩa không theo dõi; `0` có nghĩa đã theo dõi nhưng hết hàng.
- Giá vốn `null` là chưa khai báo; `0` là giá vốn thực sự bằng 0.
- Số tiền vẫn được gửi dưới dạng number nguyên; dấu phẩy chỉ dùng để hiển thị.

## Danh mục nhóm

- **Demo:** Danh mục nhóm mới lưu vào `localStorage` của trình duyệt đang dùng, không đồng bộ đa thiết bị.
- **Supabase:** Chạy `supabase/migrations/004_product_categories.sql` trong SQL Editor trước khi tạo nhóm mới. Danh mục đã lưu ở Supabase dùng chung cho các thiết bị đăng nhập cùng cửa hàng.
- Danh sách chọn luôn tổng hợp cả nhóm của sản phẩm hiện có và nhóm mặc định, kể cả khi chưa chạy migration.
- Khi tạo nhóm mới trên Supabase, nếu migration thiếu hoặc RLS không cho phép, UI báo lỗi rõ ràng; không nói đã lưu thành công.

## Hướng dẫn Windows

```powershell
cd 'D:\freetime\vuon-lan-thanh-nha'
$script = 'C:\Users\Bin77\Downloads\ThanhNha-Product-Editor-V8.ps1'
powershell -NoProfile -ExecutionPolicy Bypass -File $script -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File $script
npm run typecheck
npm run check:logic
npm run build
npm run dev
```

## Kiểm thử thủ công

1. Thêm "Hồ điệp", chọn nhóm "Hoa lan", giá 180,000 ₫, lưu.
2. Tạo nhóm mới "Lan rừng" rồi thêm sản phẩm khác; kiểm tra nhóm xuất hiện ở lần mở sau.
3. Tạo sản phẩm có hai biến thể Hồng / Trắng với giá khác nhau; chốt thử mỗi loại.
4. Bật theo dõi tồn kho nhưng nhập 0 để xác nhận không nhầm với "không theo dõi".
5. Chỉnh giá một sản phẩm đã có đơn, kiểm tra hóa đơn cũ không bị thay đổi.
6. Chạy thử ở 320px, máy tính, và màn hình điện thoại.

**Giới hạn:** chưa có chức năng đổi tên/xóa nhóm trên toàn danh mục. Chỉnh nhóm sản phẩm bằng dropdown của từng sản phẩm; đổi tên nhóm hàng loạt cần migration có kiểm soát riêng.
