'use client';
import {useMemo,useState} from 'react';
import {Search,Plus,Users,Phone,MapPin,Edit3,Archive,GitMerge,AlertCircle} from 'lucide-react';
import {Shell} from './shell';
import {useStore} from '@/context/store';
import {money} from '@/lib/math';
import {CustomerEditor} from './editors';
import {allCustomerAddresses,allCustomerPhones,normalizeCustomerPhone,sharedCustomerPhone} from '@/lib/customer-directory-v16';
import type {Customer} from '@/lib/types';
import './customers-v16.css';

export function Customers(){
 const {data,archiveCustomer,mergeCustomers,busy}=useStore();
 const [filter,setFilter]=useState('');
 const [editing,setEditing]=useState<Customer|undefined|false>(false);
 const [showArchived,setShowArchived]=useState(false);
 const [message,setMessage]=useState('');
 const list=useMemo(()=>data.customers.filter(c=>{
   const haystack=[c.name,c.phone,c.address,c.notes,...allCustomerPhones(c),...allCustomerAddresses(c)].join(' ').toLocaleLowerCase('vi-VN');
   const needle=filter.trim().toLocaleLowerCase('vi-VN');
   return (showArchived||c.active) && (!needle||haystack.includes(needle)||normalizeCustomerPhone(c.phone).includes(normalizeCustomerPhone(filter))&&normalizeCustomerPhone(filter).length>=4);
 }),[data.customers,filter,showArchived]);
 const duplicatePairs=useMemo(()=>{
   const lookup=new Map<string,Customer>();const pairs:{first:Customer;second:Customer;phone:string}[]=[];const added=new Set<string>();
   for(const customer of data.customers.filter(c=>c.active)){
     for(const phone of allCustomerPhones(customer)){
       const key=normalizeCustomerPhone(phone);if(key.length<9)continue;
       const prior=lookup.get(key);
       if(prior && prior.id!==customer.id){const pairKey=[prior.id,customer.id].sort().join(':');if(!added.has(pairKey)){pairs.push({first:prior,second:customer,phone:sharedCustomerPhone(prior,customer)||phone});added.add(pairKey);}}
       else lookup.set(key,customer);
     }
   }
   return pairs;
 },[data.customers]);
 const stats=(c:Customer)=>{const orders=data.orders.filter(o=>o.customer_id===c.id&&o.status!=='cancelled');return {count:orders.length,total:orders.reduce((s,o)=>s+o.total,0)};};
 const doMerge=async(keep:Customer,remove:Customer)=>{
   const confirmed=window.confirm(`HỢP NHẤT KHÁCH HÀNG\n\nGiữ: ${keep.name} (${keep.phone})\nGộp vào: ${remove.name} (${remove.phone})\n\nToàn bộ đơn liên kết của hồ sơ thứ hai sẽ chuyển sang hồ sơ giữ. Tên, số điện thoại và địa chỉ trên hóa đơn cũ không thay đổi.\n\nCHỈ tiếp tục nếu chắc chắn đây là cùng một người.`);
   if(!confirmed)return;
   setMessage('');
   try{await mergeCustomers(keep.id,remove.id);setMessage(`Đã hợp nhất hồ sơ ${remove.name} vào ${keep.name}.`)}
   catch(e){setMessage(e instanceof Error?e.message:'Không hợp nhất được hồ sơ.');}
 };
 const archive=async(c:Customer)=>{
   if(!window.confirm(`Lưu trữ khách hàng ${c.name}? Đơn hàng cũ sẽ được giữ nguyên.`))return;
   setMessage('');try{await archiveCustomer(c.id)}catch(e){setMessage(e instanceof Error?e.message:'Không lưu trữ được khách.');}
 };
 const actions=(c:Customer)=><div className="tn16-actions">
   <button type="button" className="tn16-mini-btn" onClick={()=>setEditing(c)}><Edit3 size={15}/> Sửa</button>
   {c.active&&<button type="button" className="tn16-mini-btn tn16-mini-muted" disabled={busy} onClick={()=>archive(c)}><Archive size={15}/> Lưu trữ</button>}
 </div>;
 return <Shell title="Khách hàng thân thiết" subtitle="Một khách, nhiều số liên hệ và địa chỉ giao hàng." action={<button type="button" onClick={()=>setEditing(undefined)} className="btn btn-primary"><Plus size={17}/> Thêm khách hàng</button>}>
  <section className="panel tn16-directory">
   <div className="panel-head tn16-panel-head"><div><h2>Danh bạ khách hàng</h2><p>Tra cứu nhanh, quản lý số liên hệ và địa chỉ nhận hàng</p></div><span className="soft-tag"><Users size={16}/> {data.customers.filter(c=>c.active).length} khách</span></div>
   <div className="tn16-toolbar">
     <label className="searchbox tn16-search"><Search size={20} aria-hidden="true"/><input type="search" autoComplete="off" aria-label="Tìm kiếm khách hàng" placeholder="Tìm tên, số điện thoại hoặc địa chỉ..." value={filter} onChange={e=>setFilter(e.target.value)}/></label>
     <label className="tn16-check"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Hiện khách lưu trữ</label>
   </div>
   {message&&<div className="notice tn16-message" role="status">{message}</div>}
   {duplicatePairs.length>0&&<section className="tn16-duplicates" aria-label="Hồ sơ có số điện thoại trùng">
    <div className="tn16-duplicate-title"><AlertCircle size={19}/><strong>{duplicatePairs.length} nhóm hồ sơ có chung số điện thoại</strong></div>
    <p>Chung số điện thoại chưa chắc là cùng người. Kiểm tra tên và địa chỉ trước khi gộp. Các hồ sơ không bị tự động xóa.</p>
    {duplicatePairs.map(({first,second,phone})=><div className="tn16-duplicate-row" key={[first.id,second.id].sort().join(':')}>
      <div><strong>{phone}</strong><small>{first.name} • {first.address||'Chưa có địa chỉ'}</small><small>{second.name} • {second.address||'Chưa có địa chỉ'}</small></div>
      <div className="tn16-merge-actions"><button type="button" disabled={busy} onClick={()=>doMerge(first,second)}><GitMerge size={15}/> Giữ {first.name}</button><button type="button" disabled={busy} onClick={()=>doMerge(second,first)}><GitMerge size={15}/> Giữ {second.name}</button></div>
    </div>)}
   </section>}
   <div className="tn16-cards">
     {list.map(c=>{const s=stats(c);const phones=allCustomerPhones(c);const addresses=allCustomerAddresses(c);return <article key={c.id} className="tn16-card">
       <div className="tn16-card-head"><div className="tn16-avatar"><Users size={20}/></div><div className="tn16-card-name"><strong>{c.name}</strong><small>{c.active?'Hồ sơ khách hàng':'Đã lưu trữ'}</small></div>{actions(c)}</div>
       <div className="tn16-card-detail"><Phone size={16}/><span>{phones.length?phones.join(' · '):'Chưa có số liên hệ'}</span></div>
       <div className="tn16-card-detail"><MapPin size={16}/><span>{addresses[0]||'Chưa có địa chỉ'}{addresses.length>1&&<small>+{addresses.length-1} địa chỉ khác</small>}</span></div>
       <div className="tn16-card-stats"><span><strong>{s.count}</strong> đơn gần đây</span><span><strong>{money(s.total)}</strong> đã mua</span></div>
     </article>})}
   </div>
   <div className="tn16-desktop-table table-wrap"><table className="data-table"><thead><tr><th>KHÁCH HÀNG</th><th>LIÊN HỆ</th><th>ĐỊA CHỈ</th><th>SỐ ĐƠN</th><th>ĐÃ MUA</th><th>THAO TÁC</th></tr></thead><tbody>{list.map(c=>{const s=stats(c),phones=allCustomerPhones(c),addresses=allCustomerAddresses(c);return <tr key={c.id}><td><strong>{c.name}</strong>{!c.active&&<span className="tag status-red">Đã lưu trữ</span>}</td><td>{phones[0]||'–'}{phones.length>1&&<small className="tn16-secondary">+{phones.length-1} số khác</small>}</td><td className="tn16-address-cell">{addresses[0]||'–'}{addresses.length>1&&<small className="tn16-secondary">+{addresses.length-1} địa chỉ</small>}</td><td>{s.count}</td><td><strong>{money(s.total)}</strong></td><td>{actions(c)}</td></tr>})}</tbody></table></div>
   {!list.length&&<div className="empty"><Users size={34}/><h3>Không tìm thấy khách hàng</h3><p>Thử từ khóa khác hoặc tạo hồ sơ khách mới.</p></div>}
  </section>
  <p className="hint" style={{marginTop:13}}>Số đơn và tổng mua ở đây tính trên tối đa 500 đơn gần nhất đã tải. Lịch sử hóa đơn lưu thông tin người nhận tại thời điểm bán.</p>
  {editing!==false&&<CustomerEditor key={editing?.id||"new"} current={editing||undefined} onClose={()=>setEditing(false)} onOpenExisting={c=>setEditing(c)}/>}
 </Shell>;
}
