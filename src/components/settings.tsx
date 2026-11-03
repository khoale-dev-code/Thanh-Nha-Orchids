'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {
  Check, Smartphone, Store, Truck, Download, RefreshCw, Shield,
  MapPin, Phone, Copy, ExternalLink, ChevronDown, Flower2, CheckCircle2,
  AlertCircle, CreditCard, PackageCheck
} from 'lucide-react';
import {Shell} from './shell';
import {useStore} from '@/context/store';
import type {Settings} from '@/lib/types';

type BeforeInstall = Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};

const SHOP_PRESET = {
  name: 'Vườn Lan Thanh Nhã',
  phone: '0976350159',
  address: '1 Hẻm số 17 Lạc Long Quân, Hiệp Định, Thanh Điền, Tây Ninh, Việt Nam',
  note: 'Cảm ơn quý khách đã tin yêu Vườn Lan Thanh Nhã! Chúc quý khách luôn có những mùa hoa thật đẹp 🌸'
};
const FACEBOOK_URL='https://www.facebook.com/vuonlanthanhnha/?locale=vi_VN';
const MAP_EMBED='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3912.5104545445242!2d106.1184594748125!3d11.297352188884794!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x310b6b27d5d2a791%3A0x56fb8f624ec10529!2zVsaw4budbiBMYW4gVGhhbmggTmjDow!5e0!3m2!1svi!2s!4v1793675910986!5m2!1svi!2s';
const MAP_LINK='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(SHOP_PRESET.address);

const formatVnd=(value:number)=>Math.max(0,Math.floor(value)).toLocaleString('en-US');
const parseVnd=(value:string)=>Number(value.replace(/\D/g,'').slice(0,15))||0;

export function SettingsPage(){
  const {data,saveSettings,busy,cloud}=useStore();
  const [form,setForm]=useState<Settings>(data.settings);
  const [status,setStatus]=useState('');
  const [error,setError]=useState(false);
  const [install,setInstall]=useState<BeforeInstall|null>(null);
  const [mapOpen,setMapOpen]=useState(false);

  useEffect(()=>setForm(data.settings),[data.settings]);
  useEffect(()=>{
    const handler=(event:Event)=>{event.preventDefault();setInstall(event as BeforeInstall)};
    window.addEventListener('beforeinstallprompt',handler);
    return()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const set=(key:keyof Settings,value:string|number)=>{
    setForm(current=>({...current,[key]:value}));
    setStatus('');
  };
  const changed=JSON.stringify(form)!==JSON.stringify(data.settings);
  const qrReady=Boolean(form.bank_id.trim()&&form.bank_account.trim()&&form.bank_owner.trim());
  const applyPreset=()=>{
    setForm(current=>({...current,shop_name:SHOP_PRESET.name,shop_phone:SHOP_PRESET.phone,shop_address:SHOP_PRESET.address,invoice_note:SHOP_PRESET.note}));
    setError(false);
    setStatus('Đã điền thông tin mẫu. Nhấn “Lưu thay đổi” để cập nhật hóa đơn.');
  };
  const copy=async(value:string,label:string)=>{
    try { await navigator.clipboard.writeText(value); setError(false); setStatus(`Đã sao chép ${label}.`); }
    catch { setError(true); setStatus(`Không sao chép được ${label}. Hãy sao chép thủ công.`); }
  };
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setStatus('');
    setError(false);
    try {await saveSettings(form); setStatus('Đã lưu thông tin cửa hàng thành công.');}
    catch(exception){setError(true);setStatus(exception instanceof Error?exception.message:'Không lưu được cài đặt.');}
  };

  return <Shell title="Cài đặt cửa hàng" subtitle="Thiết lập một lần để dùng thống nhất trên đơn hàng, hóa đơn và các thiết bị.">
    <div className="tn5-settings">
      <div className="tn5-intro">
        <div className="tn5-intro-brand">
          <img src="/icons/icon-192.png" alt="Biểu tượng Vườn Lan Thanh Nhã"/>
          <div>
            <span className="tn5-eyebrow">HỒ SƠ CỬA HÀNG</span>
            <strong>{form.shop_name||SHOP_PRESET.name}</strong>
            <p>Thông tin rõ ràng, hóa đơn chỉn chu, quản lý dễ dàng.</p>
          </div>
        </div>
        <span className="tn5-environment"><span className="tn5-dot"/> {cloud?'Đồng bộ Supabase':'Dữ liệu demo trên máy'}</span>
      </div>

      <form className="tn5-settings-form" onSubmit={save}>
        <section className="tn5-section" id="thong-tin-cua-hang">
          <div className="tn5-section-head">
            <span className="tn5-icon"><Store size={20}/></span>
            <div><h2>Thông tin & liên hệ</h2><p>Chỉnh sửa tại đây, hệ thống dùng cùng một thông tin cho hóa đơn.</p></div>
            <button type="button" className="tn5-secondary-button tn5-preset" onClick={applyPreset}><RefreshCw size={16}/> Điền thông tin mẫu</button>
          </div>
          <div className="tn5-section-body">
            <div className="tn5-fields">
              <label className="tn5-field"><span>Tên cửa hàng <b>*</b></span><input className="tn5-input" required value={form.shop_name} onChange={e=>set('shop_name',e.target.value)} placeholder="Tên thương hiệu"/></label>
              <label className="tn5-field"><span>Số điện thoại liên hệ</span><input className="tn5-input" type="tel" inputMode="tel" value={form.shop_phone} onChange={e=>set('shop_phone',e.target.value)} placeholder="0976350159"/></label>
              <label className="tn5-field tn5-span"><span>Địa chỉ cửa hàng</span><textarea className="tn5-input tn5-textarea" rows={2} value={form.shop_address} onChange={e=>set('shop_address',e.target.value)} placeholder={SHOP_PRESET.address}/></label>
              <label className="tn5-field tn5-span"><span>Lời cảm ơn trên hóa đơn</span><input className="tn5-input" value={form.invoice_note} onChange={e=>set('invoice_note',e.target.value)} placeholder="Cảm ơn quý khách..."/></label>
            </div>
            <div className="tn5-contact-row" aria-label="Liên hệ nhanh">
              <a className="tn5-contact-link" href={form.shop_phone?`tel:${form.shop_phone.replace(/[^0-9+]/g,'')}`:'#thong-tin-cua-hang'} aria-disabled={!form.shop_phone}><Phone size={17}/><span>Gọi cửa hàng</span><ExternalLink size={14}/></a>
              <a className="tn5-contact-link" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"><Flower2 size={17}/><span>Facebook cửa hàng</span><ExternalLink size={14}/></a>
              <a className="tn5-contact-link" href={MAP_LINK} target="_blank" rel="noopener noreferrer"><MapPin size={17}/><span>Chỉ đường</span><ExternalLink size={14}/></a>
            </div>
            <div className="tn5-map-heading">
              <div><strong>Vị trí trên Google Maps</strong><p>Xem khi cần, không chiếm diện tích màn hình.</p></div>
              <button type="button" aria-expanded={mapOpen} aria-controls="tn5-map-preview" className="tn5-map-toggle" onClick={()=>setMapOpen(value=>!value)}>{mapOpen?'Thu gọn':'Xem bản đồ'} <ChevronDown className={mapOpen?'tn5-rotated':''} size={17}/></button>
            </div>
            {mapOpen&&<div id="tn5-map-preview" className="tn5-map-preview"><iframe title="Bản đồ vị trí Vườn Lan Thanh Nhã" src={MAP_EMBED} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/><div className="tn5-map-actions"><span>{SHOP_PRESET.address}</span><button type="button" onClick={()=>copy(SHOP_PRESET.address,'địa chỉ')}><Copy size={15}/> Sao chép địa chỉ</button></div></div>}
          </div>
        </section>

        <section className="tn5-section" id="thanh-toan">
          <div className="tn5-section-head">
            <span className="tn5-icon"><CreditCard size={20}/></span>
            <div><h2>Thanh toán & giao hàng</h2><p>Cấu hình tài khoản VietQR và phí giao hàng mặc định.</p></div>
            <span className={`tn5-state ${qrReady?'is-ok':'is-warn'}`}>{qrReady?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>} {qrReady?'Đã nhập VietQR':'Chưa đủ thông tin QR'}</span>
          </div>
          <div className="tn5-section-body">
            <div className="tn5-fields">
              <label className="tn5-field"><span>Mã ngân hàng</span><input className="tn5-input" value={form.bank_id} onChange={e=>set('bank_id',e.target.value)} placeholder="VCB, MB, 970436..." autoComplete="off"/></label>
              <label className="tn5-field"><span>Số tài khoản</span><input className="tn5-input" value={form.bank_account} inputMode="numeric" onChange={e=>set('bank_account',e.target.value)} placeholder="Nhập số tài khoản" autoComplete="off"/></label>
              <label className="tn5-field"><span>Tên chủ tài khoản</span><input className="tn5-input" value={form.bank_owner} onChange={e=>set('bank_owner',e.target.value)} placeholder="Tên theo ngân hàng" autoComplete="off"/></label>
              <label className="tn5-field"><span>Phí vận chuyển mặc định</span><div className="tn5-money-wrap"><input className="tn5-input" type="text" inputMode="numeric" value={formatVnd(form.default_shipping_fee)} onChange={e=>set('default_shipping_fee',parseVnd(e.target.value))} onFocus={e=>e.currentTarget.select()} aria-label="Phí vận chuyển mặc định, đồng"/><span>₫</span></div></label>
            </div>
            <div className="tn5-info-note"><Shield size={17}/><p>Hãy đối chiếu tên ngân hàng, chủ tài khoản và số tài khoản trước khi gửi QR. Hệ thống chỉ tạo mã chuyển khoản, không tự xác nhận đã nhận được tiền.</p></div>
          </div>
        </section>

        <div className="tn5-savebar">
          <div className="tn5-save-status"><span className={`tn5-change-dot ${changed?'unsaved':''}`}/><span>{changed?'Có thay đổi chưa lưu':'Thông tin đã đồng bộ với biểu mẫu'}</span></div>
          <button type="submit" className="tn5-save-button" disabled={busy||!changed}><Check size={18}/>{busy?'Đang lưu...':'Lưu thay đổi'}</button>
        </div>
        {status&&<div role={error?'alert':'status'} className={`tn5-feedback ${error?'is-error':''}`}>{status}</div>}
      </form>

      <section className="tn5-section tn5-service-section" id="tich-hop">
        <div className="tn5-section-head"><span className="tn5-icon"><PackageCheck size={20}/></span><div><h2>Ứng dụng & tích hợp</h2><p>Trạng thái sử dụng ứng dụng trên thiết bị và kết nối vận chuyển.</p></div></div>
        <div className="tn5-services">
          <div className="tn5-service-row"><span className="tn5-service-icon"><Smartphone size={20}/></span><div><h3>Cài WebApp lên điện thoại</h3><p>Sử dụng như ứng dụng trên thiết bị hỗ trợ, qua HTTPS.</p></div>{install?<button type="button" className="tn5-secondary-button" onClick={async()=>{await install.prompt();setInstall(null)}}><Download size={16}/> Cài ứng dụng</button>:<span className="tn5-service-note">Chrome/Edge: Cài đặt ứng dụng; iPhone: Chia sẻ → Thêm vào Màn hình chính.</span>}</div>
          <div className="tn5-service-row"><span className="tn5-service-icon"><Truck size={20}/></span><div><h3>Vietnam Post / EMS</h3><p>Cần tài khoản đối tác, token và mã gửi hàng để tạo vận đơn.</p></div><span className="tn5-state is-warn">Cần cấu hình API</span></div>
        </div>
      </section>

      <details className="tn5-disclosure"><summary><Shield size={19}/><strong>Dữ liệu & an toàn</strong><span>Hướng dẫn và thao tác nâng cao</span><ChevronDown size={17}/></summary><div className="tn5-disclosure-content"><p>{cloud?'Đang sử dụng Supabase. Hãy phân quyền tài khoản nhân viên, kiểm tra RLS và duy trì sao lưu định kỳ.':'Chế độ demo lưu dữ liệu trong localStorage của chính trình duyệt này. Xóa dữ liệu trình duyệt có thể mất đơn hàng mẫu. Không nhập dữ liệu khách hàng thật để thử demo.'}</p><p>Hướng dẫn kỹ thuật nằm trong thư mục <strong>docs/</strong> của dự án.</p>{!cloud&&<button type="button" className="tn5-danger-button" onClick={()=>{if(window.confirm('Xóa toàn bộ dữ liệu DEMO hiện tại và nạp lại dữ liệu mẫu?')){localStorage.removeItem('thanh-nha-demo-v1');window.location.reload();}}}><RefreshCw size={16}/> Đặt lại dữ liệu demo</button>}</div></details>
    </div>
  </Shell>;
}
