# V19: Mobile-first danh sach don hang

## Pham vi

- Chi sua UI/UX trang `/orders`, khong doi Supabase, schema, logic tao don, thanh toan hay xu ly EMS.
- Desktop giu bang don hang va bo loc cu. Mobile <=767px dung the co ma don, trang thai, khach, ngay, so luong, tien, thanh toan.
- Nut Xem chi tiet mo hop thoai co the cuon; nut Hoa don mo trang phieu ban hang dang ton tai.
- Bo loc trang thai va tim kiem van su dung state hien co o `orders.tsx`.
- Tranh Safari iOS tu zoom khi cham input bang font-size >=16px o mobile. Khong khoa pinch-to-zoom.

## Kiem tra

1. Chay -DryRun va ap dung PS 5.1.
2. `npm run typecheck`, `npm run check:logic`, `npm run build`.
3. Test o 320, 375, 390, 430, 767, 768 px. Tren 767 tro xuong chi the mobile; 768 tro len chi bang desktop.
4. Tim theo ma don, ten khach, so dien thoai; bam xoa tu khoa; loc tung trang thai.
5. Mo chi tiet, doi trang thai/thanh toan, test don ban truc tiep va don giao EMS.
6. Mo hoa don, kiem tra iPhone Safari/PWA khi focus tim kiem, khi ban phim mo/dong va khi xoay ngang.
7. Voi app PWA da cai, can cap nhat ban deploy va tai lai trang de nhan CSS moi.

## Ghi chu

- Khong chay migration.
- Script co DryRun, sao luu truoc khi ghi, rollback co kiem tra hash, chay lai khong chen trung.
- Neu source da sua khac anchor trong script, script se dung, khong tu ghi de.
