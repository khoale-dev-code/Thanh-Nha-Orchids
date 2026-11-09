'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Clock3,RefreshCcw,Search,ShieldAlert,Trash2} from 'lucide-react';
import {useStore} from '@/context/store';
import {browserDb} from '@/lib/supabase';
import {money} from '@/lib/math';
import type {Order} from '@/lib/types';
import './order-trash-v27.css';

const DAY=24*60*60*1000;
function daysLeft(iso:string|null|undefined){
  if(!iso)return 0;
  return Math.max(0,Math.ceil((new Date(iso).getTime()+30*DAY-Date.now())/DAY));
}
export function OrderTrashV27(){
  const {cloud,refresh}=useStore();
  const [rows,setRows]=useState<Order[]>([]);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(false);
  const [working,setWorking]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    if(!cloud)return;
    const db=browserDb();if(!db)return;
    setLoading(true);setError('');
    try{
      const r=await db.from('orders').select('*,items:order_items(*)').not('deleted_at','is',null)
        .order('deleted_at',{ascending:false}).limit(200);
      if(r.error)throw new Error(r.error.message);
      setRows((r.data||[]) as Order[]);
    }catch(e){setError(e instanceof Error?e.message:'Không thể đọc thùng rác. Kiểm tra migration 010.');}
    finally{setLoading(false);}
  },[cloud]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>rows.filter(o=>`${o.code} ${o.customer_name} ${o.customer_phone}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))),[rows,query]);
  const restore=async(o:Order)=>{
    if(!window.confirm(`Khôi phục đơn ${o.code}? Hệ thống sẽ kiểm tra và trừ lại số cây trong kho.`))return;
    const db=browserDb();if(!db)return;
    setWorking(o.id);setError('');setNotice('');
    try{
      const r=await db.rpc('restore_order_v27',{p_order_id:o.id});
      if(r.error)throw new Error(r.error.message);
      await refresh();await load();setNotice(`Đã khôi phục ${o.code} vào danh sách đơn hàng.`);
    }catch(e){setError(e instanceof Error?e.message:'Không khôi phục được đơn.');}
    finally{setWorking('');}
  };
  if(!cloud)return <section className="tn27-trash-panel"><h3>Thùng rác hóa đơn</h3><p>Chức năng khôi phục và dọn tự động 30 ngày chỉ chạy khi ứng dụng kết nối Supabase, không hoạt động ở chế độ demo.</p></section>;
  return <section className="tn27-trash-panel">
    <div className="tn27-trash-heading"><div><h2><Trash2 size={22}/> Thùng rác hóa đơn</h2><p>Đơn sai chưa thanh toán được giữ 30 ngày. Sau thời hạn này, Supabase Cron tự dọn dữ liệu nếu đơn không thuộc diện phải lưu trữ.</p></div><button type="button" className="tn27-refresh" disabled={loading||!!working} onClick={()=>void load()}><RefreshCcw size={16}/> Tải lại</button></div>
    <div className="tn27-trash-search"><Search size={18}/><input className="input" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã đơn hoặc tên khách..." aria-label="Tìm trong thùng rác"/></div>
    <div className="tn27-trash-policy"><ShieldAlert size={18}/><span>Không thể đưa đơn đã thanh toán, đã giao, bán tại quầy hoặc có đối soát ngân hàng vào thùng rác. Các chứng từ kế toán cần được lưu riêng theo quy định.</span></div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {notice&&<p role="status" className="tn27-success">{notice}</p>}
    {loading?<p className="tn27-empty">Đang tải đơn đã xóa...</p>:!filtered.length?<p className="tn27-empty">{query?'Không có đơn nào phù hợp.':'Thùng rác đang trống.'}</p>:<div className="tn27-trash-list">
      {filtered.map(o=><article className="tn27-trash-card" key={o.id}>
        <div className="tn27-trash-top"><div><strong>{o.code}</strong><span>{o.customer_name}</span></div><span className="tn27-days"><Clock3 size={15}/> {daysLeft(o.deleted_at)} ngày</span></div>
        <div className="tn27-trash-products">{o.items.map(line=><span key={line.id}>{line.product_name} × {line.quantity}</span>)}</div>
        <div className="tn27-trash-bottom"><div><small>Tổng đơn cũ</small><strong>{money(o.total)}</strong></div><button type="button" disabled={!!working||daysLeft(o.deleted_at)===0} onClick={()=>void restore(o)}><RefreshCcw size={16}/>{working===o.id?'Đang khôi phục...':'Khôi phục'}</button></div>
      </article>)}
    </div>}
    {rows.length>=200&&<p className="hint">Chỉ hiển thị 200 đơn mới xóa gần nhất. Các đơn còn lại vẫn được lưu và dọn theo lịch database.</p>}
  </section>;
}
