'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,CheckCheck,ChevronRight,Flower2,Plus,Printer,RefreshCw,Search,Share2,Trash2,Wifi} from 'lucide-react';
import {Shell} from './shell';
import {useStore} from '@/context/store';
import {browserDb} from '@/lib/supabase';
import './live-notes-v22.css';

type Platform='Facebook'|'TikTok'|'Truc tiep'|'Khac';
type NoteStatus='pending'|'packed'|'cancelled';
type PrintState='queued'|'printing'|'sent'|'error';
type LiveNote={id:string;note_code:string;platform:Platform;customer_name:string;customer_phone:string;account_name:string;item_summary:string;quantity:number;packing_note:string;status:NoteStatus;created_at:string};
type PrintJob={id:string;note_id:string;state:PrintState;created_at:string;error_hint:string};
type Draft={platform:Platform;customer_name:string;customer_phone:string;account_name:string;item_summary:string;quantity:number;packing_note:string};
const KEY='thanh-nha-live-notes-v22';
const emptyDraft=():Draft=>({platform:'Facebook',customer_name:'',customer_phone:'',account_name:'',item_summary:'',quantity:1,packing_note:''});
const sourceName=(v:Platform)=>v==='Truc tiep'?'Tại cửa hàng':v==='Khac'?'Khác':v;
const timeVN=(x:string)=>new Date(x).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
const shortTimeVN=(x:string)=>{const d=new Date(x);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
const newCode=(id:string,d:Date)=>`LN-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${id.replace(/-/g,'').slice(0,8).toUpperCase()}`;
function demoLoad():LiveNote[]{try{return (JSON.parse(localStorage.getItem(KEY)||'[]') as LiveNote[]).slice(0,150)}catch{return []}}
function NotePaper({note,printedAt}:{note:LiveNote;printedAt:string}){
 const shortCode=note.note_code.replace(/^LN-/, '');
 const source=note.platform==='Facebook'?'FB':note.platform==='TikTok'?'TT':note.platform==='Truc tiep'?'SHOP':'KHAC';
 const handle=note.account_name.trim().replace(/^@\s*/, '');
 return <article className="tn22-paper tn221-paper" aria-label={`Phiếu ghi chú ${note.note_code}`}>
  <div className="tn22-paper-code">NOTE {shortCode}</div>
  <div className="tn22-paper-name">{note.customer_name}</div>
  {note.customer_phone&&<div className="tn22-paper-phone">{note.customer_phone}</div>}
  {handle&&<div className="tn22-paper-account">@{handle}</div>}
  {note.item_summary&&<div className="tn22-paper-product">{note.item_summary} × {note.quantity}</div>}
  {note.packing_note&&<div className="tn22-paper-extra">{note.packing_note}</div>}
  <div className="tn22-paper-date"><span data-printed-at="true">{printedAt}</span><span className="tn22-paper-platform"> · {source}</span></div>
 </article>;
}
export function LiveNotesV22(){
 const {ready,cloud,unauthorized,email}=useStore();
 const [draft,setDraft]=useState<Draft>(emptyDraft);
 const [notes,setNotes]=useState<LiveNote[]>([]);
 const [jobs,setJobs]=useState<PrintJob[]>([]);
 const [selectedId,setSelectedId]=useState('');
 const [search,setSearch]=useState('');
 const [saving,setSaving]=useState(false);
 const [sending,setSending]=useState(false);
 const [busyId,setBusyId]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [printedAt,setPrintedAt]=useState(()=>shortTimeVN(new Date().toISOString()));
 const paperRef=useRef<HTMLDivElement>(null);
 const saveLock=useRef(false);
 const selected=notes.find(n=>n.id===selectedId)||null;
 const latestJob=selected?jobs.filter(j=>j.note_id===selected.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]:undefined;
 const viewNotes=useMemo(()=>notes.filter(n=>n.status!=='cancelled'&&[n.note_code,n.customer_name,n.customer_phone,n.account_name,n.item_summary].join(' ').toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))),[notes,search]);
 const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(old=>({...old,[key]:value}));
 const reload=async()=>{
  if(!cloud){setNotes(demoLoad());setJobs([]);return;}
  const db=browserDb();if(!db)throw new Error('Không có kết nối Supabase');
  const [a,b]=await Promise.all([
   db.from('family_live_notes').select('id,note_code,platform,customer_name,customer_phone,account_name,item_summary,quantity,packing_note,status,created_at').order('created_at',{ascending:false}).limit(150),
   db.from('family_live_note_print_jobs').select('id,note_id,state,created_at,error_hint').order('created_at',{ascending:false}).limit(150)
  ]);
  if(a.error)throw new Error('Không đọc được note. Hãy chạy migration 007_live_note_print_v22.sql. '+a.error.message);
  if(b.error)throw new Error('Không đọc được hàng đợi in: '+b.error.message);
  setNotes(a.data as LiveNote[]);setJobs(b.data as PrintJob[]);
 };
 useEffect(()=>{if(!ready||unauthorized||(cloud&&!email))return;let active=true;void (async()=>{try{await reload()}catch(e){if(active)setError(e instanceof Error?e.message:'Không đọc được note')}})();return()=>{active=false}},[ready,cloud,unauthorized,email]);
 const save=async()=>{
  if(saveLock.current)return;
  setError('');setMessage('');
  const name=draft.customer_name.trim(),account=draft.account_name.trim();
  if(!name){setError('Nhập tên khách để dán note lên hàng.');return}
  const phone=draft.customer_phone.trim(),digits=phone.replace(/\D/g,'');
  if(phone&&(!/^[+0-9().\s-]+$/.test(phone)||digits.length<9||digits.length>12)){setError('Số điện thoại cần có 9–12 chữ số.');return}
  if(draft.quantity<1||draft.quantity>999||!Number.isInteger(draft.quantity)){setError('Số lượng phải từ 1 đến 999.');return}
  if(account.length>120||draft.item_summary.length>240||draft.packing_note.length>400){setError('Thông tin quá dài, vui lòng rút gọn.');return}
  saveLock.current=true;setSaving(true);
  const id=crypto.randomUUID(),at=new Date();
  const row:LiveNote={id,note_code:newCode(id,at),platform:draft.platform,customer_name:name,customer_phone:phone,account_name:account,item_summary:draft.item_summary.trim(),quantity:draft.quantity,packing_note:draft.packing_note.trim(),status:'pending',created_at:at.toISOString()};
  try{
   if(cloud){const db=browserDb();if(!db)throw new Error('Chưa kết nối Supabase');const r=await db.from('family_live_notes').insert(row);if(r.error)throw new Error(r.error.message)}
   else{const next=[row,...demoLoad()].slice(0,150);localStorage.setItem(KEY,JSON.stringify(next))}
   setNotes(prev=>[row,...prev].slice(0,150));setSelectedId(id);setPrintedAt(shortTimeVN(at.toISOString()));setDraft(emptyDraft());
   setMessage('Đã lưu phiếu tạm. Chọn “In qua máy cửa hàng” hoặc “In qua app Android” bên dưới.');
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   requestAnimationFrame(()=>paperRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
  }catch(e){setError(e instanceof Error?e.message:'Không lưu được note')}
  finally{saveLock.current=false;setSaving(false)}
 };
 const setStatus=async(note:LiveNote,status:NoteStatus)=>{
  setBusyId(note.id);setError('');
  try{
   if(cloud){const db=browserDb();if(!db)throw new Error('Chưa kết nối Supabase');const r=await db.from('family_live_notes').update({status}).eq('id',note.id).eq('status','pending').select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Trạng thái đã thay đổi, hãy tải lại');}
   else{const all=demoLoad().map(n=>n.id===note.id?{...n,status}:n);localStorage.setItem(KEY,JSON.stringify(all))}
   setNotes(prev=>prev.map(n=>n.id===note.id?{...n,status}:n));
   setMessage(status==='packed'?'Đã đánh dấu kẹp hàng.':'Đã hủy phiếu tạm.');
  }catch(e){setError(e instanceof Error?e.message:'Không đổi được trạng thái')}
  finally{setBusyId('')}
 };
 const queue=async()=>{
  if(!selected||!cloud)return;
  if(selected.status==='cancelled'){setError('Không thể in phiếu đã hủy.');return}
  if(latestJob&&['queued','printing'].includes(latestJob.state)){setError('Phiếu đã có lệnh in đang chờ. Không gửi lại để tránh trùng.');return}
  if(latestJob?.state==='sent'&&!window.confirm('Phiếu này đã từng gửi tới máy in. Bạn có chắc muốn in lại?'))return;
  setSending(true);setError('');setMessage('');
  try{
   const db=browserDb();if(!db)throw new Error('Chưa kết nối Supabase');
   const r=await db.from('family_live_note_print_jobs').insert({note_id:selected.id}).select('id,note_id,state,created_at,error_hint').single();
   if(r.error)throw new Error(r.error.message);
   setJobs(prev=>[r.data as PrintJob,...prev]);
   setMessage('Đã đưa vào hàng đợi. Máy tính Windows cần mở cầu nối V22 để tự in qua LAN.');
  }catch(e){setError(e instanceof Error?e.message:'Không gửi được lệnh in')}
  finally{setSending(false)}
 };
 const png=async():Promise<File>=>{
  if(!selected||!paperRef.current)throw new Error('Hãy lưu hoặc chọn một phiếu trước.');
  const paper=paperRef.current.querySelector<HTMLElement>('.tn22-paper');if(!paper)throw new Error('Không tìm thấy phiếu in');
  const {toBlob}=await import('html-to-image');
  const host=document.createElement('div');host.className='tn22-export-host';
  Object.assign(host.style,{position:'fixed',top:'0',left:'-10000px',width:'302px',zIndex:'-1',pointerEvents:'none'});
  const clone=paper.cloneNode(true) as HTMLElement;clone.classList.add('tn22-export-paper');
  const at=shortTimeVN(new Date().toISOString());clone.querySelector('[data-printed-at]')!.textContent=at;
  host.appendChild(clone);document.body.appendChild(host);
  try{
   if(document.fonts?.ready)await document.fonts.ready;
   const h=Math.max(1,Math.ceil(clone.getBoundingClientRect().height));
   if(h>6000)throw new Error('Phiếu quá dài. Rút gọn nội dung.');
   const blob=await toBlob(clone,{width:302,height:h,pixelRatio:2,backgroundColor:'#ffffff',cacheBust:true,skipFonts:true});
   if(!blob)throw new Error('Không tạo được ảnh note');
   return new File([blob],`${selected.note_code}.png`,{type:'image/png'});
  }finally{host.remove()}
 };
 const share=async()=>{
  if(!selected)return;setSending(true);setError('');setMessage('');
  try{
   const file=await png();
   if(navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({files:[file],title:`Note ${selected.note_code}`});
    setMessage('Đã mở chia sẻ. Hãy chọn ứng dụng in đã kết nối với máy ZyWell.');
   }else{
    const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    setMessage('Đã tải ảnh note PNG. Mở ảnh trong ứng dụng in Android để in.');
   }
   setPrintedAt(shortTimeVN(new Date().toISOString()));
  }catch(e){if((e as Error).name!=='AbortError')setError(e instanceof Error?e.message:'Không chia sẻ được phiếu')}
  finally{setSending(false)}
 };
 const nativePrint=()=>{if(!selected)return;setPrintedAt(shortTimeVN(new Date().toISOString()));setTimeout(()=>window.print(),120)};
 if(!ready||unauthorized||(cloud&&!email))return <Shell title="In note livestream"><p>Đang kiểm tra phiên đăng nhập...</p></Shell>;
 return <Shell title="In note livestream" subtitle="Ghi nhanh tên khách đang xem live, in phiếu nhỏ và kẹp lên hàng. Không tự tạo đơn.">
  <div className="tn22-page">
   <section className="tn22-intro"><div><span className="tn22-overline"><Flower2 size={15}/> THAO TÁC NHANH KHI ĐANG LIVE</span><h2>Ghi khách. In note. Kẹp hàng.</h2><p>Không cần API Facebook/TikTok. Mỗi phiếu có mã riêng; khi chốt đơn chính thức mới tính tiền và trừ tồn.</p></div><div className="tn22-stats"><div><b>{notes.filter(n=>n.status==='pending').length}</b><span>Chờ kẹp</span></div><div><b>{notes.filter(n=>n.status==='packed').length}</b><span>Đã kẹp</span></div></div></section>
   <div className="tn22-grid">
    <section className="tn22-card tn22-editor">
     <div className="tn22-card-head"><span className="tn22-step">01</span><div><h3>Khách vừa chốt trên live</h3><p>Nhập thông tin đã biết, có thể để trống điện thoại.</p></div></div>
     <div className="tn22-field"><span>Nguồn khách</span><div className="tn22-source-row" role="group" aria-label="Nguồn khách">{(['Facebook','TikTok','Truc tiep','Khac'] as Platform[]).map(x=><button type="button" key={x} aria-pressed={draft.platform===x} className={draft.platform===x?'active':''} onClick={()=>set('platform',x)}>{sourceName(x)}</button>)}</div></div>
     <div className="tn22-form">
      <label className="tn22-field">Tên khách hàng <b>*</b><input className="tn22-input" autoComplete="off" value={draft.customer_name} onChange={e=>set('customer_name',e.target.value)} maxLength={120} placeholder="Ví dụ: Kim Trang"/></label>
      <label className="tn22-field">Số điện thoại<input type="tel" inputMode="tel" className="tn22-input" autoComplete="off" value={draft.customer_phone} onChange={e=>set('customer_phone',e.target.value)} maxLength={25} placeholder="Có thể bổ sung sau"/></label>
      <label className="tn22-field">Tên tài khoản / nickname<input className="tn22-input" autoComplete="off" value={draft.account_name} onChange={e=>set('account_name',e.target.value)} maxLength={120} placeholder="Ví dụ: kimtrangg154"/></label>
      <label className="tn22-field">Sản phẩm / loại hoa<input className="tn22-input" value={draft.item_summary} onChange={e=>set('item_summary',e.target.value)} maxLength={240} placeholder="Ví dụ: Hồ điệp trắng 2 cành"/></label>
      <div className="tn22-field"><span>Số lượng</span><div className="tn22-quantity"><button type="button" aria-label="Giảm số lượng" disabled={draft.quantity<=1} onClick={()=>set('quantity',Math.max(1,draft.quantity-1))}>−</button><strong>{draft.quantity}</strong><button type="button" aria-label="Tăng số lượng" disabled={draft.quantity>=999} onClick={()=>set('quantity',Math.min(999,draft.quantity+1))}>+</button></div></div>
      <label className="tn22-field tn22-full">Ghi chú kẹp hàng<textarea className="tn22-input" rows={2} maxLength={400} value={draft.packing_note} onChange={e=>set('packing_note',e.target.value)} placeholder="Màu, size, yêu cầu riêng, chưa đủ thông tin..."/></label>
     </div>
     <button type="button" className="tn22-primary" disabled={saving} onClick={()=>void save()}><Plus size={19}/>{saving?'Đang lưu...':'Lưu note tạm'}</button>
    </section>
    <section className="tn22-card tn22-preview">
     <div className="tn22-card-head"><span className="tn22-step">02</span><div><h3>In note và kẹp vào hàng</h3><p>Phiếu 80mm ngắn, chữ lớn, dễ nhận diện.</p></div></div>
     <div className="tn22-paper-backdrop" ref={paperRef}>{selected?<NotePaper note={selected} printedAt={printedAt}/>:<div className="tn22-empty-paper"><Printer size={28}/><p>Nhập và lưu một note để xem trước phiếu in.</p></div>}</div>
     {selected&&<div className="tn22-selected-row"><b>{selected.note_code}</b><span>{selected.status==='pending'?'Chờ kẹp':selected.status==='packed'?'Đã kẹp hàng':'Đã hủy'}</span></div>}
     <div className="tn22-actions"><button type="button" disabled={!selected||!cloud||sending||selected.status==='cancelled'} onClick={()=>void queue()} className="tn22-primary"><Wifi size={18}/>{sending?'Đang gửi...':'In qua máy cửa hàng'}</button><button type="button" disabled={!selected||sending} onClick={()=>void share()} className="tn22-secondary"><Share2 size={17}/> In qua app Android</button><button type="button" disabled={!selected} onClick={nativePrint} className="tn22-secondary"><Printer size={17}/> In qua hộp thoại</button></div>
     <p className="tn22-help">In qua máy cửa hàng: cần laptop Windows đang chạy cầu nối V22, máy in LAN và Supabase. Chế độ demo chỉ hỗ trợ chia sẻ ảnh hoặc hộp thoại in.</p>
    </section>
   </div>
   {(error||message)&&<div role={error?'alert':'status'} className={`tn22-feedback ${error?'error':''}`}>{error||message}</div>}
   <section className="tn22-card tn22-list"><div className="tn22-card-head"><span className="tn22-step">03</span><div><h3>Sổ note livestream</h3><p>Lưu lại các phiếu để tìm kiếm, in lại hoặc đánh dấu đã kẹp.</p></div><button type="button" onClick={()=>void reload().catch(e=>setError(e instanceof Error?e.message:'Không tải được'))} className="tn22-refresh" aria-label="Làm mới"><RefreshCw size={18}/></button></div>
    <label className="tn22-search"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, số điện thoại hoặc mã note" aria-label="Tìm note"/></label>
    {!viewNotes.length?<div className="tn22-list-empty">Chưa có note phù hợp. Nhập khách vừa chốt ở biểu mẫu phía trên.</div>:<div className="tn22-list-items">{viewNotes.map(n=><div key={n.id} className={`tn22-list-item ${selectedId===n.id?'selected':''}`}><button type="button" className="tn22-list-pick" onClick={()=>{setSelectedId(n.id);setPrintedAt(shortTimeVN(new Date().toISOString()));setError('');setMessage('')}}><span><b>{n.customer_name}</b><small>{n.note_code} · {sourceName(n.platform)} · {timeVN(n.created_at)}</small></span><ChevronRight size={18}/></button><div className="tn22-list-side"><span className={`tn22-chip ${n.status}`}>{n.status==='pending'?'Chờ kẹp':'Đã kẹp'}</span>{n.status==='pending'&&<><button type="button" disabled={busyId===n.id} onClick={()=>void setStatus(n,'packed')}><CheckCheck size={15}/> Đã kẹp</button><button type="button" className="tn22-cancel" disabled={busyId===n.id} onClick={()=>{if(confirm(`Hủy note ${n.note_code}?`))void setStatus(n,'cancelled')}}><Trash2 size={14}/> Hủy</button></>}</div></div>)}</div>}
    <p className="tn22-help">Các phiếu chỉ phục vụ gom hàng. Đơn chính thức vẫn cần tạo ở trang <Link href="/new-order">Chốt đơn <ArrowRight size={13}/></Link>. Không tự tính doanh thu, tồn kho hoặc thanh toán.</p>
   </section>
  </div>
 </Shell>;
}
