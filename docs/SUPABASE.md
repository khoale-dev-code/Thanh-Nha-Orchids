# Kết nối Supabase và bảo mật dữ liệu

## 1. Tạo project Supabase

1. Tạo project trên https://supabase.com; lưu mật khẩu database ở nơi an toàn.
2. Mở SQL Editor và chạy **toàn bộ** nội dung `supabase/migrations/001_initial.sql` **một lần** trên project mới, chưa có bảng trùng tên.
3. Trong Supabase Authentication → Users, tạo/invite tài khoản nhân viên hoặc chủ cửa hàng có email và mật khẩu.
4. Sao chép `UUID` của user vừa tạo. Vào SQL Editor và **thay UUID bên dưới bằng giá trị thật**:

```sql
insert into public.app_members (user_id,full_name,role,active)
values ('THAY-UUID-USER-DUOC-TAO-TRONG-AUTH','Chủ vườn lan','owner',true);
```

Không để khách lạ tự đăng ký. Tài khoản authenticated nhưng chưa được cho vào `app_members` sẽ không đọc được dữ liệu.

## 2. Thêm biến môi trường

Mở `.env.local` ở thư mục gốc:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Chỉ dùng **anon/publishable key** tại client. **Không** đưa `service_role`, mật khẩu Supabase hoặc EMS token vào `NEXT_PUBLIC_*`.

Sau khi chỉnh, tắt dev server và chạy lại `setup.ps1`. Đăng nhập tại trang chính bằng tài khoản đã thêm ở bước 3.

## 3. Cơ chế an toàn

- RLS được bật cho bảng sản phẩm, biến thể, khách hàng, đơn hàng, chi tiết và cài đặt.
- Tài khoản phải nằm trong `app_members` đang hoạt động; user không nằm trong danh sách bị từ chối.
- `create_sale` là RPC atomic, lấy giá/vốn/thuế từ database, không tin dữ liệu gửi lên của trình duyệt.
- `order_items` đã chốt là snapshot, không cho sửa giá/vốn bằng API client thông thường.
- Mã hóa đơn không đoán được theo URL tìm kiếm; link tra cứu dùng token UUID riêng, chỉ trả về trạng thái và mã vận đơn, không trả về SĐT/địa chỉ khách.
- Chốt đơn dùng `client_request_id` để chống tạo lặp khi nhấn nhiều lần; tồn kho được trừ trong cùng transaction nếu quản lý tồn.
- Đơn hủy hoàn tồn đúng một lần. Đơn đã hủy không được mở lại.

## 4. Cần chú ý trước production

- Sao lưu Supabase định kỳ và kiểm tra khôi phục dữ liệu.
- Xây chính sách quyền nhân viên/owner chi tiết hơn trước khi triển khai cho nhiều cửa hàng, vì MVP đang có **một cửa hàng** và nhân viên trong `app_members` đều có quyền thao tác dữ liệu của cửa hàng.
- Danh sách giao diện chỉ tải 500 đơn gần nhất nhằm giữ tốc độ, trong khi báo cáo doanh thu/lợi nhuận tổng hợp dùng RPC `report_daily` lấy từ mọi đơn đã giao trong khoảng chọn.
- Số đơn/tổng mua tại bảng khách hàng được tính từ 500 đơn đã tải; cần làm RPC lịch sử toàn bộ cho quy mô lớn.
- Cần kế hoạch lưu trữ, quyền riêng tư và xóa/ẩn thông tin khách hàng phù hợp pháp luật Việt Nam.
- Không sử dụng phương thức Demo localStorage để vận hành thật.
