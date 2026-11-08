# V24 - Chot don livestream mobile-first

## Luong moi tren dien thoai
1. Khach moi: chi can ten/nickname. So dien thoai va dia chi co the bo trong.
2. Chon san pham co san hoac Them nhanh: cay le / combo.
3. Kiem tra phi ship (mac dinh 40.000d), gia va tao hoa don.
4. Sau khi co lien he: Don hang > Chi tiet > Bo sung thong tin nguoi nhan.

## Luu y nghiep vu
- Don moi van tru kho theo RPC create_sale, nhung khong ghi doanh thu giao thanh cong cho den khi trang thai giao hoan tat.
- Don chua co so dien thoai va dia chi khong duoc chuyen sang dang giao/da giao, khong tao van don EMS.
- Combo nhanh duoc tao thanh **mot don vi ban** voi nhan Combo N cay va gia tron bo. V24 khong tu lien ket kho cay le; khi can tru kho dung N cay, su dung san pham le va quy trinh quan ly kho rieng hoac trien khai module bundle atomic.
- Khong thay doi gia tri da chot khi sua thong tin nguoi nhan.
- EMS yeu cau ma tinh/huyen/xa rieng, du lieu dia chi dang text khong tu cap nhat cac ma nay.

## Supabase
Can chay migration `supabase/migrations/008_live_checkout_v24.sql` trong SQL Editor sau khi sao luu du lieu, de cho phep cap nhat ten/SĐT/dia chi va doi phi ship mac dinh.

## DryRun
Chay ban va V24 voi `-DryRun`, chi ap dung that neu khoi dong va kiem tra thanh cong.
