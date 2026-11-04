# V22.1 - Mau note gon, can giua, tiet kiem giay

- Khong thay doi thong tin note, ma note trong Supabase, hang cho in, trang thai, hay nghiep vu chot don.
- Ban giay: NOTE + ma rut gon de hien thi (van giu du 8 ky tu ngau nhien), ten khach, dien thoai va nickname neu co, san pham x so luong neu co, ghi chu neu co, gio in va nguon FB/TT.
- Tat ca dong can giua theo chieu ngang giay 80 mm.
- Bridge Windows: bo tieu de dai, gach ngang va footer, rut ngan chieu cao anh raster, giam 3 xuong dong thanh 1 truoc lenh cat giay ESC/POS.
- Khoang trang bat buoc giua dau in va luoi cat la gioi han vat ly cua may, khong the loai bo hoan toan.

## Cap nhat

```powershell
cd 'D:\freetime\vuon-lan-thanh-nha'
$script='C:\Users\Bin77\Downloads\ThanhNha-Live-Note-Compact-V22-1.ps1'
powershell -NoProfile -ExecutionPolicy Bypass -File $script -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File $script
npm run typecheck
npm run check:logic
npm run build
```

Khong can Supabase migration moi. Sau khi da kiem tra xong, push ma nguon va cho Vercel deploy.

**Quan trong:** Dung cau noi dang chay bang Ctrl+C, sau do chay lai:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File '.\docs\ThanhNha-Live-Note-Printer-Bridge-V22.ps1' -PrinterIp '192.168.1.222' -Port 9100
```

Chay 2 note thu, mot ghi chu ngan va mot ghi chu dai. Can kiem tra bang giay that tren ZyWell ZY-Q822 vi do dai thuc te phu thuoc dao cat cua may.

Rollback: `powershell -NoProfile -ExecutionPolicy Bypass -File $script -Rollback` khi source chua bi sua boi nguoi khac sau ban va.
