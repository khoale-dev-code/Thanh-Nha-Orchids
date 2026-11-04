'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCircle2,Copy,Download,ExternalLink,FileImage,Info,Printer,Router,Share2,Smartphone,Wifi} from 'lucide-react';
import {Shell} from './shell';
import './printer-center-v21.css';

const STORAGE_KEY='thanh-nha-printer-profile-v21';
const RAWBT_URL='https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter';
type PrinterProfile={label:string;ip:string;port:string;paper:'80mm'|'58mm'};
const DEFAULT_PROFILE:PrinterProfile={label:'ZyWell ZY-Q822',ip:'',port:'9100',paper:'80mm'};

function validIPv4(value:string){
 const bits=value.trim().split('.');
 return bits.length===4&&bits.every(part=>/^\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255);
}
function makeTestImage(){
 const canvas=document.createElement('canvas');
 canvas.width=576;canvas.height=620;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Khong tao duoc anh in thu');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#111111';ctx.textAlign='center';
 ctx.font='bold 36px Arial, sans-serif';ctx.fillText('VUON LAN THANH NHA',288,85);
 ctx.font='bold 27px Arial, sans-serif';ctx.fillText('PHIEU KIEM TRA MAY IN',288,147);
 ctx.fillRect(32,180,512,3);
 ctx.font='26px Arial, sans-serif';
 ctx.fillText('ZY-Q822  /  80mm',288,243);
 ctx.fillText('LAN  /  ESC-POS',288,299);
 ctx.fillText('1 2 3 4 5 6 7 8 9 0',288,359);
 ctx.fillRect(32,394,512,2);
 ctx.font='23px Arial, sans-serif';
 ctx.fillText('Neu nhin thay phieu nay:',288,459);
 ctx.font='bold 28px Arial, sans-serif';ctx.fillText('IN THU THANH CONG',288,508);
 ctx.font='20px Arial, sans-serif';ctx.fillText('Thanh Nha - Android Print',288,566);
 const base64=canvas.toDataURL('image/png').split(',')[1];
 const binary=atob(base64);const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new File([bytes],'ThanhNha-InThu-80mm.png',{type:'image/png'});
}

export function PrinterCenterV21(){
 const [profile,setProfile]=useState<PrinterProfile>(DEFAULT_PROFILE);
 const [saved,setSaved]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState(false);
 const [device,setDevice]=useState('');
 useEffect(()=>{
   try{
     const raw=window.localStorage.getItem(STORAGE_KEY);
     if(raw){const v=JSON.parse(raw) as Partial<PrinterProfile>;
       setProfile({label:typeof v.label==='string'?v.label:DEFAULT_PROFILE.label,
         ip:typeof v.ip==='string'?v.ip:'',port:typeof v.port==='string'?v.port:'9100',
         paper:v.paper==='58mm'?'58mm':'80mm'});
       setSaved(true);
     }
   }catch{setNotice('Khong doc duoc cau hinh tren thiet bi nay.');}
   setDevice(/Android/i.test(navigator.userAgent)?'android':'other');
 },[]);
 const change=(key:keyof PrinterProfile,value:string)=>{
   setProfile(old=>({...old,[key]:value}));setSaved(false);setNotice('');setError(false);
 };
 const save=()=>{
   if(profile.ip.trim()&&!validIPv4(profile.ip)){setError(true);setNotice('IP khong hop le. VD: 192.168.1.222.');return;}
   const port=Number(profile.port);
   if(!/^\d{1,5}$/.test(profile.port)||port<1||port>65535){setError(true);setNotice('Cong TCP phai tu 1 den 65535.');return;}
   try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify({...profile,ip:profile.ip.trim()}));setSaved(true);setError(false);setNotice('Da luu ghi chu cau hinh tren dien thoai nay. WebApp khong tu ket noi truc tiep den IP may in.');}
   catch{setError(true);setNotice('Khong luu duoc cau hinh tren thiet bi.');}
 };
 const copy=async(value:string)=>{
   try{await navigator.clipboard.writeText(value);setError(false);setNotice('Da sao chep. Hay dan vao phan cai dat may in trong ung dung Android.');}
   catch{setError(true);setNotice('Khong sao chep duoc. Hay nhap thu cong.');}
 };
 const test=async()=>{
   setNotice('');setError(false);
   try{
     // The file is created synchronously while the user gesture is active.
     const file=makeTestImage();
     if(navigator.share&&navigator.canShare?.({files:[file]})){
       await navigator.share({files:[file],title:'Phieu kiem tra may in Thanh Nha'});
       setNotice('Da mo bang chia se. Hay chon RawBT hoac ung dung in co ho tro nhan anh.');
     }else{
       const url=URL.createObjectURL(file);
       const a=document.createElement('a');a.href=url;a.download=file.name;a.click();
       setTimeout(()=>URL.revokeObjectURL(url),10000);
       setNotice('Trinh duyet khong ho tro chia se anh truc tiep. Da tai anh in thu; mo anh va chon In / Chia se.');
     }
   }catch(ex){if((ex as Error).name!=='AbortError'){setError(true);setNotice(ex instanceof Error?ex.message:'Khong mo duoc ung dung in.');}}
 };
 return <Shell title="Máy in hóa đơn" subtitle="Chuẩn bị máy in 80mm để in đơn từ điện thoại Android.">
   <div className="tn21-layout">
     <div className="tn21-hero">
       <div className="tn21-hero-icon"><Printer size={28}/></div>
       <div><span className="tn21-overline">IN HÓA ĐƠN · ANDROID</span><h2>In nhanh từ Thanh Nhã</h2><p>Tạo phiếu trong WebApp, chuyển ngay sang ứng dụng in trên điện thoại. Không cần lưu ảnh rồi tìm lại trong Thư viện.</p></div>
     </div>
     <div className="tn21-note" role="note"><Info size={19}/><p><strong>Giới hạn của PWA:</strong> ZyWell ZY-Q822 là máy USB + LAN, không có Bluetooth theo tem máy. Website không thể tự mở kết nối TCP 9100 để in trực tiếp. Phần này hỗ trợ chuẩn bị cấu hình và mở ứng dụng in Android; cần ứng dụng cầu nối cho chế độ in hoàn toàn tự động.</p></div>
     <section className="tn21-card" aria-labelledby="tn21-setup-title">
       <div className="tn21-card-head"><span className="tn21-circle"><Router size={19}/></span><div><h3 id="tn21-setup-title">Thông tin máy in</h3><p>Ghi nhớ thông số để dễ nhập vào RawBT hoặc ứng dụng in.</p></div><span className="tn21-chip">Trên thiết bị này</span></div>
       <div className="tn21-form">
         <label><span>Model máy in</span><input value={profile.label} onChange={e=>change('label',e.target.value)} autoComplete="off"/></label>
         <label><span>IP máy in trong mạng LAN</span><input inputMode="decimal" autoComplete="off" placeholder="Ví dụ: 192.168.1.222" value={profile.ip} onChange={e=>change('ip',e.target.value)} aria-describedby="tn21-ip-hint"/><small id="tn21-ip-hint">Chỉ nhập khi đã xác minh IP thật. 192.168.1.222 hiện mới là IP bạn từng cấu hình trong app, chưa chắc là IP của máy.</small></label>
         <div className="tn21-form-row"><label><span>Cổng TCP</span><input inputMode="numeric" autoComplete="off" value={profile.port} onChange={e=>change('port',e.target.value)}/></label><label><span>Khổ giấy</span><select value={profile.paper} onChange={e=>change('paper',e.target.value)}><option value="80mm">80mm</option><option value="58mm">58mm</option></select></label></div>
       </div>
       <div className="tn21-actions"><button type="button" onClick={save} className="tn21-primary"><CheckCircle2 size={18}/>{saved?'Đã lưu thông số':'Lưu thông số'}</button>{profile.ip.trim()&&<button type="button" onClick={()=>copy(`${profile.ip.trim()}:${profile.port}`)} className="tn21-secondary"><Copy size={17}/> Sao chép IP:Port</button>}</div>
       <p className="tn21-caption">Các thông số được lưu riêng trong trình duyệt này. Chúng không gửi đến Supabase, không kiểm tra kết nối TCP và không làm thay đổi dữ liệu đơn hàng.</p>
     </section>
     <section className="tn21-card" aria-labelledby="tn21-test-title"><div className="tn21-card-head"><span className="tn21-circle"><FileImage size={19}/></span><div><h3 id="tn21-test-title">In thử qua ứng dụng Android</h3><p>Thử kết nối và căn giấy trước khi in hóa đơn thật.</p></div></div>
       <ol className="tn21-steps"><li><Wifi size={17}/> Cắm LAN máy in vào router và kết nối điện thoại cùng mạng Wi-Fi.</li><li><Smartphone size={17}/> Cài RawBT hoặc dùng ứng dụng in có hỗ trợ nhận ảnh PNG và ESC/POS qua LAN.</li><li><Printer size={17}/> Cấu hình IP thật của máy, TCP 9100 nếu đúng, khổ giấy 80mm trong ứng dụng in.</li><li><Share2 size={17}/> Chạm “Gửi phiếu in thử”, rồi chọn ứng dụng in từ bảng chia sẻ Android.</li></ol>
       <div className="tn21-actions"><button type="button" className="tn21-primary" onClick={test}><Share2 size={18}/> Gửi phiếu in thử</button><a className="tn21-secondary" href={RAWBT_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Cài RawBT</a></div>
       {device==='other'&&<p className="tn21-caption">Bạn đang dùng trình duyệt không nhận diện là Android. Chức năng chia sẻ có thể khác, hoặc chỉ tải xuống ảnh.</p>}
       <p className="tn21-caption">Lưu ý: mở bảng chia sẻ không có nghĩa là máy đã in thành công. Hãy kiểm tra giấy in thực tế.</p>
     </section>
     {notice&&<p className={`tn21-message ${error?'is-error':''}`} role={error?'alert':'status'}>{notice}</p>}
     <div className="tn21-footer-links"><Link href="/orders"><ArrowLeft size={17}/> Xem đơn hàng</Link><Link href="/settings"><Download size={17}/> Về Cài đặt</Link></div>
   </div>
 </Shell>;
}
