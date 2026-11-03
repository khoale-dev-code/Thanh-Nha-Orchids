# Tích hợp Vietnam Post / EMS

## Phân biệt nhà vận chuyển

VNPost/EMS KHÁC Viettel Post. Mã vận đơn, hợp đồng và các API không dùng chung.

Adapter hiện hỗ trợ **gửi yêu cầu tạo bưu gửi EMS** tại endpoint được công bố:
`POST https://customerconnect.ems.com.vn/api/Shipment/ShipmentCreate`.
Tài liệu tham khảo: https://document.ems.com.vn/reference/van-don/tao-buu-gui

## Điều kiện cần có

1. Hợp đồng EMS/Vietnam Post và tài khoản đối tác, token API do EMS cấp.
2. Mã khách hàng/mã người gửi, bộ mã bưu chính của điểm lấy hàng theo EMS.
3. Thông tin người nhận đầy đủ: số điện thoại, địa chỉ và mã tỉnh/quận/phường **theo EMS**. Không sử dụng mã Viettel Post/GHN để thay thế.
4. Kiểm thử với EMS theo tài khoản, phiên bản API và hợp đồng thực tế trước khi bật production.

## Cấu hình server-side `.env.local`

```dotenv
VNPOST_ENABLED=false
EMS_API_TOKEN=
EMS_CUSTOMER_CODE=
EMS_SENDER_CODE=
EMS_SENDER_PROVINCE_ID=
EMS_SENDER_DISTRICT_ID=
EMS_SENDER_WARD_ID=
```

Chỉ thay `VNPOST_ENABLED=true` sau khi đã kiểm thử với EMS. Trên Vercel, thiết lập các biến này trong môi trường server (không dùng NEXT_PUBLIC).

## Quy trình trong WebApp

1. Chốt đơn có khách hàng đã lưu địa chỉ và mã EMS.
2. Vào Đơn hàng → Chi tiết → Tạo vận đơn EMS (nếu được bật).
3. Server kiểm tra tài khoản nhân viên, dữ liệu người nhận, khóa trạng thái gửi đơn rồi mới gọi EMS.
4. Khi EMS phản hồi chấp thuận, hệ thống cập nhật `shipping_request_state=submitted`; nếu EMS trả mã vận đơn, lưu mã đó.
5. Nếu mạng timeout, trạng thái được đánh dấu `unknown` để người dùng tra cứu trực tiếp trên cổng EMS trước khi gửi lại, giảm rủi ro vận đơn trùng.
6. Có thể nhập mã vận đơn bằng tay trong màn hình chi tiết khi chưa có quyền API.

### Giới hạn adapter ở bản đầu

- Chưa có đồng bộ tracking tự động, webhook, đối soát COD hoặc lấy nhãn in EMS.
- Chưa tự tính giá cước EMS; phí ship hiện do nhân viên nhập hoặc lấy từ giá mặc định.
- Trọng lượng đang dùng giá trị ước lượng 500 gram/mặt hàng; **phải xác nhận trọng lượng thật trước khi tạo vận đơn**, đặc biệt với cây lan cồng kềnh.
- EMS có các phiên bản tài liệu/API khác nhau. Phải xác nhận response Code và mapping thực tế từ tài khoản đối tác; không coi một mã HTTP 200 đơn thuần là tạo thành công.
- Nếu thay đổi địa chỉ người nhận sau khi chốt, MVP chưa có màn hình sửa snapshot của đơn. Hãy xử lý theo quy trình huỷ/tạo lại đơn sau khi đối chiếu EMS.
- Thao tác xác nhận “Đã giao” là thủ công cho tới khi tích hợp tracking được kiểm thử.

Cơ sở tài liệu: https://document.ems.com.vn/gioi-thieu
