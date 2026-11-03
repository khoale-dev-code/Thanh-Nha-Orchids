# V7 - Sổ vận hành dành cho cửa hàng gia đình

## Mục tiêu

Chức năng chốt đơn hiện có vẫn hoạt động như cũ. V7 thêm một menu duy nhất **Sổ vận hành** với tám tab để gia đình ghi nhận việc phát sinh hằng ngày. Không có chấm công, ca làm, bảng lương hay KPI nhân viên.

## Cài đặt

1. Sao lưu source và database. Đảm bảo migration `001_initial.sql` đã chạy. Nếu dùng bán trực tiếp thì chạy `002_instore_sales.sql` trước.
2. Chạy `ThanhNha-Family-Operations-V7.ps1 -DryRun` để kiểm tra source và danh sách file.
3. Chạy script không có `-DryRun`. Script chỉ thay mã nguồn trên máy, **không tự chạy SQL**.
4. Mở Supabase SQL Editor, chạy `supabase/migrations/003_family_operations.sql`. Kiểm tra bảng và RLS. Trên Supabase đã có dữ liệu thật, nên thử trên môi trường staging trước.
5. Chạy `npm run typecheck`, `npm run check:logic`, `npm run build`, `npm run dev`.

## Tám tính năng và giới hạn

| Tính năng | Có thể sử dụng ở V7 | Chưa có hoặc cần xác thực |
| --- | --- | --- |
| Thu chi | Ghi khoản chi vận hành, chi nhập hàng và khoản thu khác; nhập ngày, danh mục, số tiền, ghi chú; không thể xóa trực tiếp | Không tự động lấy tiền bán hàng từ sao kê, không ghi đè giá vốn đơn |
| Đặt cọc & giữ cây | Ghi người đặt, biến thể, số lượng, cọc, hạn nhận. Supabase bảo vệ số lượng đã giữ khi biến thể có theo dõi tồn kho | Chưa tự chuyển phiếu giữ thành đơn, chưa tự cấn cọc, biến thể không theo dõi tồn là giữ mềm |
| Bảng xử lý đơn | Đơn mới -> xác nhận -> đóng gói -> giao -> đã giao. Trạng thái lấy từ đơn thật | Không cập nhật trạng thái từ EMS tự động |
| Đối soát | Nhập giao dịch từ sao kê; xác nhận ghép đúng một giao dịch đủ số tiền với một đơn chuyển khoản chưa thanh toán | Không có webhook ngân hàng tự động; không ghép khoản cọc / thanh toán một phần |
| Lãi lỗ | Tổng hợp doanh thu đơn đã giao, thu khác, giá vốn, chi ship và chi phí vận hành theo 12 tháng | Chưa phản ánh hoàn tiền, công nợ chưa thu, thuế thu nhập, chi phí chưa khai báo hoặc giá vốn để trống |
| Livestream | Nhập bình luận thủ công, chọn sản phẩm và tạo đơn giao hàng qua RPC cũ, dùng request ID cố định | Không đọc bình luận Facebook/TikTok qua API, không tự gửi tin nhắn |
| Mất mạng | Ghi chú sản phẩm lưu trong IndexedDB, trang dự phòng được cache qua service worker | Không ghi thông tin khách nhạy cảm, không tự tạo đơn/trừ kho/đồng bộ nền |
| Nhật ký | Trigger ghi thay đổi đơn, đối soát, phiếu giữ, thu chi và livestream sau khi migration chạy | Không có bản ghi lịch sử trước ngày chạy migration; không phải hệ thống kiểm toán pháp lý |

## Các nguyên tắc bảo vệ tiền hàng

- **Không cộng tiền cọc vào doanh thu.** Khi chốt đơn cần đối chiếu tiền cọc trong phiếu giữ.
- **Nhập hàng không phải chi phí vận hành trừ lãi lần hai.** Chọn loại **Chi nhập hàng**, vì giá vốn của cây được tính khi bán.
- **Không nhập tiền bán hàng vào Thu khác.** Nếu ghi nhập kép, lợi nhuận sẽ bị cao sai.
- **Không nhấn xác nhận chuyển khoản chỉ vì đã thấy ảnh QR hoặc ảnh chụp giao dịch.** Phải đối chiếu sao kê ngân hàng thật.
- **Cây đang giữ bằng Supabase có theo dõi tồn** được bảo vệ bởi trigger: khi bán, database từ chối số lượng còn lại thấp hơn số đã giữ. Muốn chốt đơn, giải phóng/đánh dấu phiếu giữ đã hoàn tất trước, sau đó tạo đơn và kiểm tra thanh toán.
- Offline chỉ lưu nháp *mặt hàng*, không nhập dữ liệu khách hàng hoặc thanh toán, không tự gửi dữ liệu.
- Family account dùng bảng `app_members` hiện có. Có thể có nhiều người nhà có tài khoản riêng để ghi nhật ký. Không cần mô hình tuyển dụng nhân viên.

## Phân quyền và nhật ký

Các bảng V7 chỉ cấp quyền cho tài khoản đăng nhập có `app_members.active=true` thông qua `public.is_staff()` của dự án cũ. Tài khoản ẩn danh không được đọc/ghi. Phần chuyển khoản dùng RPC để xác nhận đồng thời đơn và giao dịch trong một database transaction. Nhật ký lưu thao tác, mã đối tượng, số tiền và trạng thái mà không chép thông tin liên hệ khách vào trường log.

## Khi phát sinh lỗi

- Lỗi `relation ... does not exist`: chưa chạy migration 003 hoặc chạy sai Supabase project.
- Lỗi không đủ tồn khi bán: có phiếu giữ cây chưa được giải phóng.
- Lỗi chưa có bảng/không ghi được: kiểm tra Supabase Auth, `app_members` và RLS.
- Lỗi khi `-DryRun`: dừng và gửi log; script không ghi đè source không khớp.

## Rollback

Script báo thư mục backup sau khi chạy. Khôi phục mã nguồn bằng `-Rollback -BackupPath "<thu_muc_backup>"` khi chưa chỉnh file sau vá. **Rollback PowerShell không rollback migration/database data**. Muốn đảo SQL phải lập migration ngược riêng, sau khi sao lưu và đánh giá dữ liệu hiện có.
