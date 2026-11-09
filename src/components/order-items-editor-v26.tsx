'use client';
import {useMemo,useState} from 'react';
import {Check,Minus,Plus,Search,Trash2,X} from 'lucide-react';
import {useStore} from '@/context/store';
import {money} from '@/lib/math';
import {buildCheckoutProductIndex,searchCheckoutProducts} from '@/lib/checkout-product-search-v25';
import type {Order,Line} from '@/lib/types';
import './order-items-editor-v26.css';

export type CorrectionLineV26={line_id?:string;variant_id?:string;quantity:number};
export function canEditOrderItemsV26(o:Order,hasCarton=false):boolean{
  return !hasCarton && !o.carton && o.shipping_provider!=='Bán trực tiếp'
    && (o.status==='new'||o.status==='confirmed'||o.status==='packing')
    && (!o.tracking_code||!o.tracking_code.trim()) && (!o.shipping_request_state||o.shipping_request_state==='idle');
}

type EditRow={key:string;line_id?:string;variant_id?:string;quantity:number;name:string;label:string;price:number;cost:number|null;tax_rate:number};
const oldVariantId=(line:Line,order:Order,products:ReturnType<typeof useStore>['data']['products']):string|undefined=>{
  if(line.variant_id)return line.variant_id;
  // Demo orders from old versions did not store variant_id in their item snapshot.
  const match=products.flatMap(p=>p.variants.map(v=>({p,v}))).find(x=>
    x.v.sku && x.v.sku===line.sku && x.p.name===line.product_name && x.v.label===line.variant_label);
  return match?.v.id;
};

export function OrderItemsEditorV26({order,onClose,onSaved,hasCarton=false}:{
  order:Order;onClose:()=>void;onSaved:(saved:Order)=>void;hasCarton?:boolean;
}){
  const {data,editOrderItemsV26,busy}=useStore();
  const [rows,setRows]=useState<EditRow[]>(()=>order.items.map(line=>({
    key:`old:${line.id}`,line_id:line.id,
    variant_id:oldVariantId(line,order,data.products),quantity:line.quantity,
    name:line.product_name,label:line.variant_label,price:line.unit_price,
    cost:line.unit_cost,tax_rate:line.tax_rate
  })));
  const [query,setQuery]=useState('');
  const [error,setError]=useState('');
  const index=useMemo(()=>buildCheckoutProductIndex(data.products),[data.products]);
  const matches=useMemo(()=>searchCheckoutProducts(index,query,8).items,[index,query]);
  const available=canEditOrderItemsV26(order,hasCarton);
  const editQty=(key:string,newQty:number)=>{
    const qty=Math.min(10000,Math.max(1,Math.trunc(newQty)||1));
    setRows(old=>old.map(r=>r.key===key?{...r,quantity:qty}:r));setError('');
  };
  const addVariant=(variantId:string)=>{
    const picked=matches.find(x=>x.variant.id===variantId);
    if(!picked)return;
    const {product:p,variant:v}=picked;
    if(v.stock_quantity!==null&&v.stock_quantity<=0){setError('Cây này đã hết hàng.');return;}
    setRows(old=>{
      const exists=old.find(r=>r.variant_id===variantId);
      if(exists)return old.map(r=>r.key===exists.key?{...r,quantity:Math.min(10000,r.quantity+1)}:r);
      return [...old,{key:`new:${variantId}`,variant_id:variantId,quantity:1,
        name:p.name,label:v.label,price:v.price,cost:v.cost_price,tax_rate:p.tax_rate}];
    });
    setError('');
  };
  const subtotal=rows.reduce((sum,r)=>sum+r.price*r.quantity,0);
  const tax=rows.reduce((sum,r)=>sum+Math.round((r.price*r.quantity-(subtotal>0?order.discount*r.price*r.quantity/subtotal:0))*r.tax_rate/100),0);
  const newTotal=subtotal-order.discount+tax+order.shipping_fee;
  const changed=rows.length!==order.items.length||rows.some(r=>{
    const old=order.items.find(line=>line.id===r.line_id);
    return !old||old.quantity!==r.quantity;
  });
  const invalid=rows.length===0||order.discount>subtotal||!Number.isSafeInteger(newTotal)||newTotal<0;

  const save=async()=>{
    if(!available){setError('Đơn này đã giao, đã tạo vận đơn hoặc là đơn bán thùng. Không thể sửa trực tiếp.');return;}
    if(!changed){setError('Số lượng chưa thay đổi.');return;}
    if(invalid){setError('Phải còn ít nhất một cây, tiền hàng phải đủ bù phần giảm giá.');return;}
    if(order.payment_status==='paid'&&newTotal!==order.total){
      if(!window.confirm('Đơn đã ghi nhận thanh toán nhưng tổng tiền thay đổi. Sau khi lưu, đơn chuyển về CHƯA THANH TOÁN để bạn đối soát hoặc hoàn chênh lệch thủ công. Tiếp tục?'))return;
    }
    setError('');
    try{
      const draft:CorrectionLineV26[]=rows.map(r=>r.line_id?
        {line_id:r.line_id,quantity:r.quantity}:
        {variant_id:r.variant_id,quantity:r.quantity});
      const saved=await editOrderItemsV26(order.id,order.updated_at,draft);
      onSaved(saved);
    }catch(e){setError(e instanceof Error?e.message:'Không sửa được đơn hàng.');}
  };

  return <div className="tn26-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="tn26-editor" role="dialog" aria-modal="true" aria-label="Sửa sản phẩm đã chốt">
      <header className="tn26-head">
        <div><small>ĐƠN {order.code}</small><h2>Sửa cây đã chốt</h2><p>Lưu xong, hóa đơn cùng mã đơn sẽ cập nhật để in lại.</p></div>
        <button className="tn26-icon" type="button" onClick={onClose} aria-label="Đóng"><X size={21}/></button>
      </header>
      <div className="tn26-body">
        {!available&&<p className="tn26-warning">Đơn đã giao, có vận đơn, bán trực tiếp hoặc bán thùng không được chỉnh tại đây.</p>}
        <h3>Giỏ hàng hiện tại</h3>
        {rows.map(r=><div key={r.key} className="tn26-item">
          <div className="tn26-item-name"><strong>{r.name}</strong><span>{r.label&&r.label.toLocaleLowerCase('vi-VN')!=='mặc định'?`${r.label} · `:''}{money(r.price)} / đơn vị</span></div>
          <div className="tn26-item-actions">
            <div className="tn26-qty">
              <button type="button" disabled={busy||r.quantity<=1||!available} onClick={()=>editQty(r.key,r.quantity-1)} aria-label={`Giảm ${r.name}`}><Minus size={17}/></button>
              <input type="number" min={1} max={10000} inputMode="numeric" disabled={busy||!available} aria-label={`Số lượng ${r.name}`} value={r.quantity} onChange={e=>editQty(r.key,Number(e.target.value))}/>
              <button type="button" disabled={busy||r.quantity>=10000||!available} onClick={()=>editQty(r.key,r.quantity+1)} aria-label={`Tăng ${r.name}`}><Plus size={17}/></button>
            </div>
            <button type="button" className="tn26-remove" disabled={busy||!available} onClick={()=>setRows(old=>old.filter(x=>x.key!==r.key))} aria-label={`Xóa ${r.name}`}><Trash2 size={17}/></button>
          </div>
        </div>)}
        <div className="tn26-product-search">
          <h3>Thêm cây bị bỏ sót</h3>
          <div className="tn26-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên cây, không dấu cũng được" aria-label="Tìm cây thêm vào đơn"/></div>
          <div className="tn26-suggestions">
            {matches.map(({product:p,variant:v})=><button type="button" key={v.id} disabled={busy||!available||v.stock_quantity===0} onClick={()=>addVariant(v.id)}>
              <span><b>{p.name}</b><small>{v.label} · {money(v.price)}</small></span>
              <Plus size={18}/>
            </button>)}
            {matches.length===0&&<p>Không tìm thấy cây phù hợp.</p>}
          </div>
        </div>
        <div className="tn26-summary">
          <div><span>Tiền hàng cũ</span><b>{money(order.subtotal)}</b></div>
          <div><span>Tiền hàng mới</span><b>{money(subtotal)}</b></div>
          {order.discount>0&&<div><span>Giảm giá giữ nguyên</span><b>-{money(order.discount)}</b></div>}
          {tax>0&&<div><span>Thuế dự kiến</span><b>{money(tax)}</b></div>}
          <div><span>Ship giữ nguyên</span><b>{money(order.shipping_fee)}</b></div>
          <div className="tn26-total"><span>Khách cần trả sau sửa</span><strong>{money(newTotal)}</strong></div>
          {order.total!==newTotal&&<p>Chênh lệch so với đơn cũ: <b>{money(newTotal-order.total)}</b>. Hãy đối soát nếu khách đã thanh toán hoặc đã nhận hóa đơn cũ.</p>}
        </div>
        {error&&<p className="tn26-error" role="alert">{error}</p>}
      </div>
      <footer className="tn26-footer">
        <button type="button" className="tn26-cancel" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="button" className="tn26-save" onClick={save} disabled={!available||busy||!changed||invalid}><Check size={18}/>{busy?'Đang lưu...':'Lưu thay đổi'}</button>
      </footer>
    </section>
  </div>;
}
