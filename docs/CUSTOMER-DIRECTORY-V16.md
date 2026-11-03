# V16 — Danh bạ khách hàng, nhiều liên hệ và địa chỉ, sửa zoom iPhone

## Mục tiêu
- Một hồ sơ khách hàng chứa tên chính, số điện thoại chính, các số phụ có nhãn; địa chỉ chính và các địa chỉ giao hàng phụ.
- Khi chốt đơn từ khách đã lưu, chọn **số và địa chỉ cho đơn này** mà không làm đổi hóa đơn lịch sử.
- Khi chốt đơn Facebook/TikTok, tìm khách theo cả số chính và số phụ. Nếu số đã tồn tại, tái sử dụng hồ sơ, thêm địa chỉ giao mới nếu cần, không tạo thêm khách có chung số.
- Danh bạ có tìm kiếm theo số phụ/địa chỉ phụ. Ở iPhone dùng thẻ một cột thay cho bảng rộng, chữ input >=16px để tránh Safari zoom khi focus.
- Những khách đã tồn tại có chung số được gợi ý để **kiểm tra thủ công rồi xác nhận hợp nhất**, không gộp tự động. Tên khách khác được lưu ở ghi chú. Đơn hàng cũ giữ nguyên snapshot tên/số/địa chỉ và số tiền; chỉ chuyển khóa `orders.customer_id` về hồ sơ chính.

## Cập nhật Supabase bắt buộc

1. Sao lưu cơ sở dữ liệu hoặc tạo bản sao trước khi làm trên dữ liệu thật.
2. Mở Supabase Dashboard > SQL Editor. Chạy toàn bộ file `supabase/migrations/006_customer_directory_v16.sql` **một lần** (có thể chạy lại do có `IF NOT EXISTS` và `CREATE OR REPLACE`, nhưng không cần thiết).
3. Reload ứng dụng sau khi SQL chạy thành công. Hệ thống giữ dữ liệu cũ ở `phone`/`address`, bổ sung hai cột JSONB `phone_numbers` và `delivery_addresses` mặc định `[]`.
4. Trong Danh bạ, mở **một hồ sơ** và thử thêm một số phụ/địa chỉ phụ. Kiểm tra tải lại trang vẫn giữ đủ các trường.
5. Với hai hồ sơ đang trùng số, đối chiếu họ tên, địa chỉ và lịch sử giao dịch. Chỉ nhấn Gộp nếu thực sự cùng một người.

V16 không tự động tạo/đổi schema khi tải web. Nếu chưa chạy migration, phần lưu hồ sơ nhiều thông tin sẽ hiện lỗi hướng dẫn; màn hình chỉ đọc vẫn mở được. Không chạy lại migration V1 trên dữ liệu thật.

## Quy tắc dữ liệu

- Số `090...`, `84...` và `+84...` cùng chuẩn hóa để kiểm tra trùng, nhưng giao diện vẫn hiển thị số đã nhập.
- Cơ sở dữ liệu ngăn cấp lại số điện thoại đã thuộc **hồ sơ đang hoạt động khác**, kể cả thao tác đồng thời. Những bản ghi trùng đã tồn tại không bị xóa.
- Số phụ có nhãn, địa chỉ phụ có nhãn; không được thay đổi mã EMS chỉ vì người dùng chọn một địa chỉ khác trong đơn.
- Hợp nhất chỉ khi hai hồ sơ đang hoạt động **chia sẻ số điện thoại chuẩn hóa**. Quá trình cập nhật khoá đơn hàng, cất lưu hồ sơ cũ, thêm số/địa chỉ là một giao dịch Supabase; lỗi ở bất kỳ bước nào sẽ rollback DB.
- Hóa đơn gốc lưu `customer_name`, `customer_phone`, `customer_address` tại thời điểm tạo đơn; các cột này không bị sửa bởi việc gộp khách.

## Kiểm thử sau khi cập nhật

1. Safari iPhone: vào /customers, chạm ô Tìm kiếm, xác nhận trang không tự zoom, không cuộn ngang; thử 320, 375, 390, 430px.
2. Thêm khách mới A, thêm số phụ, địa chỉ phụ; lưu, tải lại, mở sửa để kiểm tra dữ liệu.
3. Tạo khách B với số đã có của A: hệ thống báo khách trùng, không thêm B.
4. Đối với hai hồ sơ cũ trùng số, so sánh và nhấn **Giữ hồ sơ A**; kiểm tra khách B chuyển lưu trữ, lịch sử đơn trỏ sang A nhưng hóa đơn cũ giữ thông tin cũ.
5. Chốt đơn với Khách đã lưu: chọn **số phụ** và **địa chỉ phụ**, mở hóa đơn kiểm tra thông tin.
6. Chốt đơn Facebook/TikTok dùng số phụ đã lưu: dùng hồ sơ hiện có, không tạo hồ sơ thứ hai.
7. Thử nhập khách mới với số điện thoại khác; kiểm tra luồng Supabase, chức năng chốt đơn, đơn bán thùng, kho và thống kê không thay đổi.

## Giới hạn

- Hệ thống chưa tạo tên biệt danh thành trường riêng; tên khác trong hồ sơ bị gộp sẽ nằm trong ghi chú.
- Chỉ gợi ý gộp dựa trên số trùng, không thể xác định chắc chắn hai hồ sơ là cùng một người.
- Số đơn/tổng mua trong Danh bạ dựa trên tối đa 500 đơn gần nhất được tải, không thay thế báo cáo tổng hợp toàn kỳ.
