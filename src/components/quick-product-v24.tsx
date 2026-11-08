'use client';
import {useState} from 'react';
import {Flower2,Layers3,PackagePlus,X,CheckCircle2} from 'lucide-react';
import {useStore} from '@/context/store';
import {PosMoneyInput} from './pos-money-input';
import {money} from '@/lib/math';

type Props={onClose:()=>void;onSaved:(sku:string,name:string)=>void};
export function QuickProductV24({onClose,onSaved}:Props){
 const {saveProduct,busy}=useStore();
 const [type,setType]=useState<'single'|'combo'>('single');
 const [name,setName]=useState('');
 const [price,setPrice]=useState(0);
 const [count,setCount]=useState(3);
 const [error,setError]=useState('');
 const submit=async()=>{
   setError('');
   const cleaned=name.trim().replace(/\s+/g,' ');
   if(!cleaned){setError('Nhập tên sản phẩm trước khi lưu.');return;}
   if(cleaned.length>160){setError('Tên tối đa 160 ký tự.');return;}
   if(!Number.isSafeInteger(price)||price<=0||price>1000000000000){setError('Giá bán phải lớn hơn 0 và hợp lệ.');return;}
   if(type==='combo'&&(!Number.isInteger(count)||count<2||count>100)){setError('Combo cần từ 2 đến 100 cây.');return;}
   const sku='TNQ-'+crypto.randomUUID().replace(/-/g,'').slice(0,20).toUpperCase();
   try{
     await saveProduct({
       name:cleaned,description:type==='combo'?`Combo gồm ${count} cây, giá trọn bộ ${money(price)}. Tồn kho cây lẻ chưa tự liên kết.`:'',
       category:'Hoa lan',tax_rate:0,active:true,
       variants:[{id:crypto.randomUUID(),label:type==='combo'?`Combo ${count} cây`:'Mặc định',color:'',size:'',sku,price,cost_price:null,stock_quantity:null,weight_grams:type==='combo'?count*500:500,active:true}]
     });
     onSaved(sku,cleaned);
   }catch(e){setError(e instanceof Error?e.message:'Không lưu được sản phẩm');}
 };
 return <div className="modal-backdrop tn24-quick-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <div className="modal tn24-quick-dialog" role="dialog" aria-modal="true" aria-label="Thêm nhanh sản phẩm">
     <div className="tn24-quick-head"><div><span>THÊM HÀNG NGAY KHI LIVE</span><h2>Thêm sản phẩm nhanh</h2><p>Nhập tên và giá, lưu xong tự thêm vào giỏ.</p></div><button type="button" onClick={onClose} aria-label="Đóng"><X size={22}/></button></div>
     <div className="tn24-quick-body">
       <div className="tn24-quick-modes" role="group" aria-label="Loại bán">
         <button type="button" className={type==='single'?'active':''} onClick={()=>setType('single')}><Flower2 size={18}/> Cây lẻ</button>
         <button type="button" className={type==='combo'?'active':''} onClick={()=>setType('combo')}><Layers3 size={18}/> Combo</button>
       </div>
       <label className="field">Tên cây / sản phẩm<input className="input" autoFocus value={name} maxLength={160} onChange={e=>setName(e.target.value)} placeholder="Ví dụ: Hồng sắc pháo"/></label>
       {type==='combo'&&<label className="field">Một combo gồm bao nhiêu cây?
         <div className="tn24-quick-count"><button type="button" onClick={()=>setCount(v=>Math.max(2,v-1))}>−</button><input className="input" inputMode="numeric" type="number" min={2} max={100} value={count} onChange={e=>setCount(Math.max(2,Math.min(100,Math.floor(Number(e.target.value)||2))))}/><button type="button" onClick={()=>setCount(v=>Math.min(100,v+1))}>+</button></div>
       </label>}
       <div className="field"><span>{type==='combo'?'Giá trọn bộ combo':'Giá một cây'} (đ)</span><PosMoneyInput value={price} onChange={setPrice} ariaLabel="Giá bán"/></div>
       <div className="tn24-quick-preview"><span>{type==='combo'?`${cleanedPreview(name)} · Combo ${count} cây`:(cleanedPreview(name))}</span><strong>{money(price)}</strong></div>
       {type==='combo'&&<p className="tn24-quick-warning">Combo được lưu là 1 đơn vị bán giá trọn bộ. Chưa tự trừ {count} cây từ kho hàng lẻ; hãy quản lý tồn kho combo riêng hoặc kiểm tra tay.</p>}
       {error&&<p className="form-error" role="alert">{error}</p>}
     </div>
     <div className="tn24-quick-footer"><button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}><PackagePlus size={18}/>{busy?'Đang lưu...':'Lưu & thêm vào giỏ'}<CheckCircle2 size={16}/></button></div>
   </div>
 </div>;
}
function cleanedPreview(name:string){return name.trim()||'Tên sản phẩm';}
