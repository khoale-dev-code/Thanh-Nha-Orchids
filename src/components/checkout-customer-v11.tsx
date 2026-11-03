'use client';
import {Facebook,RefreshCw,UserRoundPlus,Users,Video,ShoppingBasket} from 'lucide-react';
import type {Customer} from '@/lib/types';
import type {LeadRow} from '@/lib/family-operations';
import './checkout-customer-v11.css';
import {DeliveryAddressV15} from './delivery-address-v15';

export type CustomerSource='walkin'|'facebook'|'tiktok'|'saved';
const sources:{id:CustomerSource;label:string;help:string}[]=[
 {id:'walkin',label:'Khách vãng lai',help:'Mua tại cửa hàng'},
 {id:'facebook',label:'Facebook',help:'Bình luận, tin nhắn'},
 {id:'tiktok',label:'TikTok',help:'Livestream, tin nhắn'},
 {id:'saved',label:'Khách đã lưu',help:'Không nhập lại thông tin'}
];
type Props={
 customers:Customer[];source:CustomerSource;onSourceChange:(v:CustomerSource)=>void;
 customerId:string;onCustomerIdChange:(v:string)=>void;
 guestName:string;onGuestNameChange:(v:string)=>void;
 guestPhone:string;onGuestPhoneChange:(v:string)=>void;
 guestAddress:string;onGuestAddressChange:(v:string)=>void;
 rememberContact:boolean;onRememberContactChange:(v:boolean)=>void;
 leads:LeadRow[];selectedLead:LeadRow|null;
 onLeadChoose:(id:string)=>void;onReloadLeads:()=>void;leadError:string;
 onAddCustomer:()=>void;isCounter:boolean;
};
export function CheckoutCustomerV11(p:Props){
 const selected=p.customers.find(c=>c.id===p.customerId);
 const social=p.source==='facebook'||p.source==='tiktok';
 return <section className="pos-contact-v11" aria-labelledby="pos-contact-title">
   <div className="pos-contact-head">
     <div><h3 id="pos-contact-title"><span className="badge-number">3</span> Khách hàng</h3><p>Chọn nguồn khách, điền liên hệ một lần trước khi in hóa đơn.</p></div>
     <button type="button" className="btn btn-soft btn-sm" onClick={p.onAddCustomer}><UserRoundPlus size={16}/> Thêm khách</button>
   </div>
   <div className="pos-customer-sources" role="group" aria-label="Nguồn khách hàng">
     {sources.map(s=><button type="button" key={s.id} className={p.source===s.id?'active':''} aria-pressed={p.source===s.id} onClick={()=>p.onSourceChange(s.id)}>
       <span className="pos-customer-source-icon" aria-hidden="true">{s.id==='walkin'?<ShoppingBasket size={19}/>:s.id==='facebook'?<Facebook size={19}/>:s.id==='tiktok'?<Video size={19}/>:<Users size={19}/>}</span>
       <strong>{s.label}</strong><small>{s.help}</small>
     </button>)}
   </div>
   {p.source==='saved'?<label className="field pos-contact-field">Chọn khách trong danh bạ
     <select className="select" value={p.customerId} onChange={e=>p.onCustomerIdChange(e.target.value)}>
       <option value="">Chọn khách hàng...</option>
       {p.customers.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` • ${c.phone}`:''}</option>)}
     </select>
     {selected&&<div className="pos-selected-customer"><strong>{selected.name}</strong><span>{selected.phone||'Chưa có SĐT'}</span><span>{selected.address||'Chưa có địa chỉ'}</span></div>}
   </label>:<div className="pos-customer-detail-grid">
       <label className="field pos-contact-field">Tên khách hàng {social&&<b>*</b>}
         <input className="input" value={p.guestName} onChange={e=>p.onGuestNameChange(e.target.value)} maxLength={120} placeholder={social?'Tên Facebook/TikTok của khách':'Khách lẻ (không bắt buộc tại quầy)'}/>
       </label>
       <label className="field pos-contact-field">Số điện thoại {(!p.isCounter)&&<b>*</b>}
         <input type="tel" inputMode="tel" autoComplete="tel" className="input" value={p.guestPhone} onChange={e=>p.onGuestPhoneChange(e.target.value)} maxLength={20} placeholder="09xx xxx xxx"/>
       </label>
       <div className="pos-contact-full">
         <DeliveryAddressV15 key={p.selectedLead?.id||p.source} value={p.guestAddress} onChange={p.onGuestAddressChange} required={!p.isCounter}/>
       </div>
       {social&&<label className="pos-contact-checkbox pos-contact-full">
         <input type="checkbox" checked={p.rememberContact} onChange={e=>p.onRememberContactChange(e.target.checked)}/>
         <span>Lưu khách này vào danh bạ để lần sau chốt nhanh hơn <small>Chỉ lưu khi có tên và số điện thoại. Nếu đã có SĐT, dùng khách cũ.</small></span>
       </label>}
     </div>}
   <details className="pos-leads-picker">
     <summary><span><Video size={17}/> Lấy khách đang chờ từ livestream</span><span className="pos-leads-count">{p.leads.length} khách</span></summary>
     <div className="pos-leads-inner">
       <p>Chọn một khách từ Sổ vận hành để tự điền tên, số điện thoại, địa chỉ, sản phẩm và phí ship. Bạn vẫn sửa lại được trước khi chốt.</p>
       <div className="pos-leads-row">
         <select className="select" value={p.selectedLead?.id||''} onChange={e=>p.onLeadChoose(e.target.value)} aria-label="Khách đang chờ từ livestream">
           <option value="">Chọn khách đang chờ...</option>
           {p.leads.map(l=><option key={l.id} value={l.id}>{l.platform} • {l.customer_name} • {l.quantity} cây</option>)}
         </select>
         <button type="button" className="btn btn-outline" onClick={p.onReloadLeads} aria-label="Tải lại khách chờ" title="Tải lại khách chờ"><RefreshCw size={17}/></button>
       </div>
       {p.selectedLead&&<p className="pos-lead-note">Bình luận: {p.selectedLead.source_comment||'Không có nội dung'}</p>}
       {p.leadError&&<p className="form-error" role="alert">{p.leadError}</p>}
     </div>
   </details>
   {!p.isCounter&&<p className="pos-contact-tip">Đơn giao hàng cần tên, điện thoại và địa chỉ để tránh nhầm người nhận. Hãy kiểm tra lại trước khi bấm Chốt đơn.</p>}
 </section>;
}
