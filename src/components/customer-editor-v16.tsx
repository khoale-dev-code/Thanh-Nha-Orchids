'use client';
import {useMemo,useState} from 'react';
import {Plus,Trash2,X,Phone,MapPin,CheckCircle2,AlertTriangle} from 'lucide-react';
import {useStore} from '@/context/store';
import {DeliveryAddressV15} from './delivery-address-v15';
import {allCustomerPhones,cleanCustomerAddresses,cleanCustomerPhones,matchingCustomer,normalizeCustomerPhone} from '@/lib/customer-directory-v16';
import type {Customer,CustomerAddressV16,CustomerPhoneV16,NewCustomer} from '@/lib/types';
import './customer-editor-v16.css';

export function CustomerEditor({onClose,onSaved,current,onOpenExisting}:{onClose:()=>void;onSaved?:(c:Customer)=>void;current?:Customer;onOpenExisting?:(c:Customer)=>void}){
 const {data,saveCustomer,busy}=useStore();
 const [form,setForm]=useState<NewCustomer>({id:current?.id||'',name:current?.name||'',phone:current?.phone||'',address:current?.address||'',province_code:current?.province_code||'',district_code:current?.district_code||'',ward_code:current?.ward_code||'',notes:current?.notes||'',active:current?.active??true,phone_numbers:current?.phone_numbers||[],delivery_addresses:current?.delivery_addresses||[]});
 const [err,setErr]=useState('');const [conflict,setConflict]=useState<Customer|null>(null);
 const setField=(k:keyof NewCustomer,v:string)=>setForm(p=>({...p,[k]:v}));
 const phones=form.phone_numbers||[];
 const addresses=form.delivery_addresses||[];
 const phoneCandidate=useMemo(()=>[form.phone,...phones.map(x=>x.value)].filter(Boolean).map(x=>matchingCustomer(data.customers,x,form.id)).find(Boolean)||null,[data.customers,form.id,form.phone,phones]);
 const updatePhone=(id:string,key:keyof CustomerPhoneV16,value:string)=>setForm(p=>({...p,phone_numbers:(p.phone_numbers||[]).map(x=>x.id===id?{...x,[key]:value}:x)}));
 const updateAddress=(id:string,key:keyof CustomerAddressV16,value:string)=>setForm(p=>({...p,delivery_addresses:(p.delivery_addresses||[]).map(x=>x.id===id?{...x,[key]:value}:x)}));
 const makePrimaryPhone=(entry:CustomerPhoneV16)=>setForm(p=>({...p,phone:entry.value,phone_numbers:[...(p.phone? [{id:crypto.randomUUID(),label:'Số cũ',value:p.phone}]:[]),...(p.phone_numbers||[]).filter(x=>x.id!==entry.id)]}));
 const makePrimaryAddress=(entry:CustomerAddressV16)=>setForm(p=>({...p,address:entry.value,delivery_addresses:[...(p.address?[{id:crypto.randomUUID(),label:'Địa chỉ cũ',value:p.address}]:[]),...(p.delivery_addresses||[]).filter(x=>x.id!==entry.id)]}));
 const submit=async(e:React.FormEvent)=>{
   e.preventDefault();setErr('');setConflict(null);
   const primaryPhone=form.phone.trim();const cleanedPhones=cleanCustomerPhones(phones,primaryPhone);
   const primaryAddress=form.address.trim();const cleanedAddresses=cleanCustomerAddresses(addresses,primaryAddress);
   const activeNumbers=[primaryPhone,...cleanedPhones.map(x=>x.value)].filter(Boolean);
   for(const number of activeNumbers){
     const digits=number.replace(/\D/g,'');
     if(!/^[+0-9().\s-]+$/.test(number)||digits.length<9||digits.length>12){setErr('Số điện thoại cần từ 9 đến 12 chữ số, không chứa ký tự lạ.');return;}
   }
   const normalized=activeNumbers.map(normalizeCustomerPhone);
   if(new Set(normalized).size!==normalized.length){setErr('Trong cùng hồ sơ không được lặp lại một số điện thoại.');return;}
   const original=current?allCustomerPhones(current).map(normalizeCustomerPhone):[];
   const matches=activeNumbers.map(x=>({number:x,found:matchingCustomer(data.customers,x,form.id)})).find(x=>x.found&&!original.includes(normalizeCustomerPhone(x.number)));
   if(matches?.found){setConflict(matches.found);setErr('Số điện thoại mới này đã thuộc một hồ sơ khác. Hãy mở hồ sơ cũ hoặc xem xét hợp nhất.');return;}
   if(!form.name.trim()){setErr('Vui lòng nhập tên khách hàng.');return;}
   try{
     const payload:NewCustomer={...form,name:form.name.trim(),phone:primaryPhone,address:primaryAddress,phone_numbers:cleanedPhones,delivery_addresses:cleanedAddresses};
     const saved=await saveCustomer(payload);onSaved?.(saved);onClose();
   }catch(ex){setErr(ex instanceof Error?ex.message:'Không lưu được khách hàng. Kiểm tra migration V16 trên Supabase.');}
 };
 const existing=conflict||phoneCandidate;
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="modal tn16-customer-modal" role="dialog" aria-modal="true" aria-label={current?'Sửa hồ sơ khách hàng':'Thêm khách hàng'}>
   <div className="modal-head"><div><h2>{current?'Sửa hồ sơ khách hàng':'Thêm khách hàng'}</h2><p>Giữ một hồ sơ, thêm nhiều số liên hệ và địa chỉ nhận hàng.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>
   <form onSubmit={submit} className="tn16-customer-form">
    <label className="field">Tên khách hàng <span className="required">*</span>
      <input className="input" required autoComplete="name" maxLength={120} placeholder="Ví dụ: Chị Hoa" value={form.name} onChange={e=>setField('name',e.target.value)}/>
    </label>
    <section className="tn16-form-section"><div className="tn16-form-title"><strong><Phone size={17}/> Số điện thoại</strong><small>Chọn số chính để dùng khi chốt đơn</small></div>
      <label className="field">Số liên hệ chính
        <input className="input" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} placeholder="09xx xxx xxx" value={form.phone} onChange={e=>setField('phone',e.target.value)}/>
      </label>
      {phones.map((p,i)=><div className="tn16-edit-extra" key={p.id}>
       <div className="tn16-edit-extra-heading"><strong>Số phụ {i+1}</strong><button type="button" className="tn16-remove" aria-label={`Xóa số phụ ${i+1}`} onClick={()=>setForm(s=>({...s,phone_numbers:(s.phone_numbers||[]).filter(x=>x.id!==p.id)}))}><Trash2 size={16}/></button></div>
       <div className="tn16-extra-grid"><label className="field">Nhãn<input className="input" maxLength={35} value={p.label} onChange={e=>updatePhone(p.id,'label',e.target.value)} placeholder="Zalo / Người nhà"/></label><label className="field">Số liên hệ<input className="input" type="tel" inputMode="tel" maxLength={20} value={p.value} onChange={e=>updatePhone(p.id,'value',e.target.value)} placeholder="09xx xxx xxx"/></label></div>
       <button type="button" className="tn16-inline-action" disabled={!p.value.trim()} onClick={()=>makePrimaryPhone(p)}><CheckCircle2 size={14}/> Đặt làm số chính</button>
      </div>)}
      <button type="button" className="tn16-add" onClick={()=>setForm(s=>({...s,phone_numbers:[...(s.phone_numbers||[]),{id:crypto.randomUUID(),label:'Số phụ',value:''}]}))}><Plus size={16}/> Thêm số điện thoại</button>
    </section>
    {existing&&<div className="tn16-conflict" role="alert"><AlertTriangle size={19}/><div><strong>Số điện thoại trùng với hồ sơ: {existing.name}</strong><p>Nếu đang sửa thông tin cũ, bạn vẫn có thể lưu các thay đổi không liên quan đến số điện thoại. Chỉ hợp nhất khi chắc chắn cùng một người.</p><button type="button" onClick={()=>{onOpenExisting?.(existing);if(!onOpenExisting){onSaved?.(existing);onClose();}}}>Mở hồ sơ {existing.name}</button></div></div>}
    <section className="tn16-form-section"><div className="tn16-form-title"><strong><MapPin size={17}/> Địa chỉ giao hàng</strong><small>Có thể lưu nhà riêng, cửa hàng, nơi nhận hộ</small></div>
      <div className="tn16-main-address"><span className="tn16-address-tag">Địa chỉ chính</span><DeliveryAddressV15 key={`main-${current?.id||'new'}`} value={form.address} onChange={v=>setField('address',v)}/></div>
      {addresses.map((a,i)=><div className="tn16-edit-extra" key={a.id}>
       <div className="tn16-edit-extra-heading"><strong>Địa chỉ phụ {i+1}</strong><button type="button" className="tn16-remove" aria-label={`Xóa địa chỉ phụ ${i+1}`} onClick={()=>setForm(s=>({...s,delivery_addresses:(s.delivery_addresses||[]).filter(x=>x.id!==a.id)}))}><Trash2 size={16}/></button></div>
       <label className="field">Ghi chú địa chỉ<input className="input" maxLength={35} value={a.label} onChange={e=>updateAddress(a.id,'label',e.target.value)} placeholder="Nhà riêng / Cửa hàng"/></label>
       <DeliveryAddressV15 value={a.value} onChange={v=>updateAddress(a.id,'value',v)}/>
       <button type="button" className="tn16-inline-action" disabled={!a.value.trim()} onClick={()=>makePrimaryAddress(a)}><CheckCircle2 size={14}/> Đặt làm địa chỉ chính</button>
      </div>)}
      <button type="button" className="tn16-add" onClick={()=>setForm(s=>({...s,delivery_addresses:[...(s.delivery_addresses||[]),{id:crypto.randomUUID(),label:'Địa chỉ khác',value:''}]}))}><Plus size={16}/> Thêm địa chỉ giao hàng</button>
    </section>
    <details className="tn16-ems"><summary>Mã vận chuyển VNPost / EMS (nếu có)</summary><p>Các mã này do đơn vị vận chuyển cung cấp. Không tự lấy mã hành chính để điền.</p><div className="tn16-extra-grid">
      <label className="field">Mã tỉnh EMS<input className="input" value={form.province_code} onChange={e=>setField('province_code',e.target.value)}/></label>
      <label className="field">Mã quận EMS<input className="input" value={form.district_code} onChange={e=>setField('district_code',e.target.value)}/></label>
      <label className="field">Mã phường EMS<input className="input" value={form.ward_code} onChange={e=>setField('ward_code',e.target.value)}/></label>
    </div></details>
    <label className="field">Ghi chú khách hàng<input className="input" maxLength={500} value={form.notes} onChange={e=>setField('notes',e.target.value)} placeholder="Sở thích, lưu ý giao hàng..."/></label>
    {err&&<p className="form-error" role="alert">{err}</p>}
    <div className="modal-foot tn16-editor-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Đang lưu...':'Lưu hồ sơ khách'}</button></div>
   </form>
  </div>
 </div>;
}
