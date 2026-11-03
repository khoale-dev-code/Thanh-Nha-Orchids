'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {Printer,Share2,Download,ArrowLeft} from 'lucide-react';
import {useStore} from '@/context/store';
import {browserDb} from '@/lib/supabase';
import type {Order,CartonDetails} from '@/lib/types';
import {money} from '@/lib/math';
import './invoice-image-v15.css';

const FACEBOOK_URL='https://www.facebook.com/vuonlanthanhnha/?locale=vi_VN';
const FACEBOOK_LABEL='facebook.com/vuonlanthanhnha';
const BRAND_ADDRESS='1 Hẻm số 17 Lạc Long Quân, Hiệp Định, Thanh Điền, Tây Ninh, Việt Nam';
const ORDER_STATUS:Record<Order['status'],string>={new:'Mới tạo',confirmed:'Đã xác nhận',packing:'Đang đóng gói',shipped:'Đang giao',delivered:'Đã giao',cancelled:'Đã hủy'};

function QR({order,settings}:{order:Order;settings:{bank_id:string;bank_account:string;bank_owner:string}}){
  if(!settings.bank_id.trim()||!settings.bank_account.trim()) return null;
  const params=new URLSearchParams({bank:settings.bank_id.trim(),account:settings.bank_account.trim(),amount:String(order.total),addInfo:order.code,accountName:settings.bank_owner.trim()});
  return <div className="invoice-qr">
    <p className="invoice-qr-title"><strong>Quét mã để chuyển khoản</strong></p>
    <img src={`/api/qr?${params.toString()}`} alt="Mã QR thanh toán VietQR" crossOrigin="anonymous"/>
    <p>{settings.bank_id.toUpperCase()} • {settings.bank_account}</p>
    <p>{settings.bank_owner}</p>
    <p>Nội dung chuyển khoản: <strong>{order.code}</strong></p>
  </div>;
}

export function InvoiceContent({order,carton,settings}:{order:Order;carton?:CartonDetails|null;settings:{shop_name:string;shop_phone:string;shop_address:string;bank_id:string;bank_account:string;bank_owner:string;invoice_note:string}}){
  const counter=order.shipping_provider==='Bán trực tiếp';
  const paid=order.payment_status==='paid';
  const created=new Date(order.created_at).toLocaleString('vi-VN');
  const shopAddress=settings.shop_address||BRAND_ADDRESS;
  const quantity=order.items.reduce((sum,item)=>sum+item.quantity,0);
  const cartonValue=carton??order.carton;
  const isCarton=!!cartonValue;
  const beforeManualDiscount=cartonValue?cartonValue.carton_count*cartonValue.price_per_carton:order.subtotal;
  const manualDiscount=cartonValue?Math.max(0,order.discount-cartonValue.bulk_discount):order.discount;

  return <article className="invoice-sheet cafe-receipt" aria-label={`Hóa đơn ${order.code}`}>
    <header className="receipt-header">
      <img className="receipt-logo" src="/brand/logo-doc-sang.png" alt="Logo Vườn Lan Thanh Nhã"/>
      <h1>{settings.shop_name}</h1>
      <p className="receipt-address">{shopAddress}</p>
      {settings.shop_phone&&<p>Hotline: {settings.shop_phone}</p>}
      <div className="receipt-separator" aria-hidden="true"/>
      <h2>{counter?'PHIẾU THANH TOÁN':'PHIẾU BÁN HÀNG'}</h2>
      <p className="receipt-bill-kind">{isCarton?'BÁN SỈ THEO THÙNG':counter?'BÁN TRỰC TIẾP':'ĐƠN HÀNG GIAO TẬN NƠI'}</p>
    </header>

    <div className="receipt-info">
      <div><span>Mã đơn</span><strong>{order.code}</strong></div>
      <div><span>Ngày bán</span><span>{created}</span></div>
      <div><span>Khách hàng</span><strong>{order.customer_name}</strong></div>
      {order.customer_phone&&<div><span>Điện thoại</span><span>{order.customer_phone}</span></div>}
      {!counter&&order.customer_address&&<div className="receipt-address-line"><span>Giao đến</span><span>{order.customer_address}</span></div>}
      {order.tracking_code&&<div><span>Vận đơn</span><strong>{order.tracking_code}</strong></div>}
    </div>

    <div className="receipt-separator" aria-hidden="true"/>
    <div className="receipt-line-header"><span>SẢN PHẨM</span><span>THÀNH TIỀN</span></div>
    <div className="receipt-items">
      {order.items.map((item,index)=><div className="receipt-item" key={item.id}>
        <div className="receipt-product-name"><span>{index+1}. {item.product_name}</span><strong>{money(isCarton&&cartonValue?beforeManualDiscount:item.line_subtotal)}</strong></div>
        {item.variant_label&&<div className="receipt-variant">{item.variant_label}</div>}
        {isCarton&&cartonValue?<div className="receipt-quantity">{cartonValue.carton_count} thùng × {cartonValue.units_per_carton} cây = {quantity} cây</div>:<div className="receipt-quantity">{item.quantity} × {money(item.unit_price)}</div>}
        {isCarton&&cartonValue&&<div className="receipt-quantity">Đơn giá thùng: {money(cartonValue.price_per_carton)}</div>}
      </div>)}
    </div>
    <div className="receipt-count">Tổng số lượng: <strong>{isCarton&&cartonValue?`${cartonValue.carton_count} thùng / ${quantity} cây`:`${quantity} sản phẩm`}</strong></div>
    <div className="receipt-separator" aria-hidden="true"/>

    <div className="receipt-totals">
      <div><span>{isCarton?'Tiền hàng theo thùng':'Tiền hàng'}</span><strong>{money(beforeManualDiscount)}</strong></div>
      {manualDiscount>0&&<div><span>Giảm giá thêm</span><strong>-{money(manualDiscount)}</strong></div>}
      {order.tax_total>0&&<div><span>Thuế bán hàng</span><strong>{money(order.tax_total)}</strong></div>}
      {!counter&&<div><span>Phí vận chuyển</span><strong>{money(order.shipping_fee)}</strong></div>}
    </div>
    <div className="receipt-grand-total"><span>TỔNG THANH TOÁN</span><strong>{money(order.total)}</strong></div>
    <div className="receipt-paid-row"><span>Hình thức</span><strong>{order.payment_method}</strong></div>
    <div className="receipt-payment-state">{order.status==='cancelled'?'ĐƠN ĐÃ HỦY - CẦN ĐỐI SOÁT':paid?'ĐÃ THANH TOÁN':'CHƯA THANH TOÁN'}</div>
    {order.status!=='cancelled'&&!paid&&order.payment_method!=='COD'&&<QR order={order} settings={settings}/>}
    {order.note&&<div className="receipt-note"><strong>Ghi chú:</strong> {order.note}</div>}
    <footer className="receipt-footer">
      <div className="receipt-separator" aria-hidden="true"/>
      <strong>{settings.invoice_note||'Cảm ơn quý khách đã mua hàng!'}</strong>
      <p>Facebook: fb.com/vuonlanthanhnha</p>
      {settings.shop_phone&&<p>Liên hệ: {settings.shop_phone}</p>}
      <p className="receipt-small">Phiếu bán hàng nội bộ, không thay thế hóa đơn điện tử theo quy định.</p>
    </footer>
  </article>;
}

export function InvoicePage(){
  const {id}=useParams<{id:string}>();
  const {data,ready,cloud}=useStore();
  const ref=useRef<HTMLDivElement>(null);
  const [order,setOrder]=useState<Order|null>(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [savedCarton,setSavedCarton]=useState<CartonDetails|null>(null);

  useEffect(()=>{
    if(!ready) return;
    const found=data.orders.find(o=>o.id===id);
    if(found){ setOrder(found); return; }
    if(cloud){
      browserDb()?.from('orders').select('*,items:order_items(*)').eq('id',id).single().then(r=>{ if(r.data) setOrder(r.data as Order); });
    }
  },[id,ready,data.orders,cloud]);

  useEffect(()=>{
    if(!ready||!cloud||!id)return;
    let active=true;
    browserDb()?.from('order_carton_lines').select('variant_id,carton_count,units_per_carton,price_per_carton,reference_unit_price,bulk_discount').eq('order_id',id).maybeSingle().then(r=>{
      if(active&&r.data)setSavedCarton(r.data as CartonDetails);
    });
    return()=>{active=false;};
  },[id,ready,cloud]);

  const toBlob=async()=>{
    if(!ref.current) throw new Error('Không tìm thấy mẫu hóa đơn');
    const paper=ref.current.querySelector<HTMLElement>('.cafe-receipt');
    if(!paper) throw new Error('Không tìm thấy nội dung phiếu in');
    const {toBlob:renderBlob}=await import('html-to-image');
    // An offscreen clone decouples capture from the iPhone viewport and CSS page zoom.
    const host=document.createElement('div');
    host.className='print-page';
    Object.assign(host.style,{
      position:'fixed',left:'-10000px',top:'0',width:'302px',height:'auto',
      overflow:'visible',pointerEvents:'none',backgroundColor:'#fff',zIndex:'-1'
    });
    const copy=paper.cloneNode(true) as HTMLElement;
    copy.classList.add('tn15-export-paper');
    host.appendChild(copy);
    document.body.appendChild(host);
    try{
      if(document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(copy.querySelectorAll('img')).map(async img=>{
        if(img.complete&&img.naturalWidth>0)return;
        await new Promise<void>(resolve=>{
          const finish=()=>resolve();
          img.addEventListener('load',finish,{once:true});
          img.addEventListener('error',finish,{once:true});
          setTimeout(finish,3000);
        });
      }));
      const height=Math.max(1,Math.ceil(copy.getBoundingClientRect().height));
      if(height>15500) throw new Error('Hóa đơn quá dài để lưu một ảnh trên iPhone. Hãy in hoặc tách đơn thành nhiều ảnh.');
      const pixelRatio=height>7300?1:2;
      const blob=await renderBlob(copy,{
        width:302,height,pixelRatio,backgroundColor:'#ffffff',cacheBust:true,skipFonts:true
      });
      if(!blob)throw new Error('Không tạo được ảnh hóa đơn. Vui lòng thử nút Chia sẻ ảnh.');
      return blob;
    }finally{host.remove();}
  };

  const download=async()=>{
    setBusy(true); setMsg('');
    try{
      const blob=await toBlob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`Hoa-don-${order?.code||'Thanh-Nha'}.png`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
    }catch(e){
      setMsg(e instanceof Error?e.message:'Không xuất được hình ảnh');
    }finally{ setBusy(false); }
  };

  const share=async()=>{
    setBusy(true); setMsg('');
    try{
      const blob=await toBlob();
      const file=new File([blob],`Hoa-don-${order?.code||'Thanh-Nha'}.png`,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:`Hóa đơn ${order?.code}`});
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=file.name;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url),2000);
        setMsg('Thiết bị chưa hỗ trợ chia sẻ file trực tiếp. Đã tải ảnh để bạn gửi qua Zalo/Messenger.');
      }
    }catch(e){
      if((e as Error).name!=='AbortError') setMsg(e instanceof Error?e.message:'Không chia sẻ được ảnh');
    }finally{ setBusy(false); }
  };

  if(!ready) return <div className="loading-app">Đang chuẩn bị hóa đơn...</div>;
  if(!order) return <div className="loading-app"><h2>Không tìm thấy hóa đơn</h2><p>Nếu đang ở chế độ demo, hóa đơn chỉ có trên thiết bị tạo đơn.</p><Link href="/orders" className="btn btn-primary">Quay lại danh sách đơn</Link></div>;

  return <div className="print-screen print-page">
    <div className="print-actions">
      <Link href="/orders" className="btn btn-outline"><ArrowLeft size={17}/> Đơn hàng</Link>
      <button onClick={()=>window.print()} className="btn btn-primary"><Printer size={17}/> In hóa đơn 80mm</button>
      <button onClick={share} disabled={busy} className="btn btn-outline"><Share2 size={17}/> Chia sẻ ảnh</button>
      <button onClick={download} disabled={busy} className="btn btn-outline"><Download size={17}/> Lưu ảnh PNG</button>
    </div>
    {msg&&<div className="notice hide-print" style={{maxWidth:700,margin:'12px auto'}}>{msg}</div>}
    <div className="invoice-wrap" ref={ref}><InvoiceContent order={order} carton={savedCarton??order.carton} settings={data.settings}/></div>
    <p className="hint hide-print" style={{textAlign:'center',marginTop:16}}>Để in chính xác 80mm, chọn đúng khổ giấy trong cài đặt máy in. Đây là phiếu bán hàng nội bộ, không thay thế hóa đơn điện tử hợp pháp khi pháp luật yêu cầu.</p>
  </div>;
}
