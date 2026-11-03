'use client';
import {useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import Link from 'next/link';
import {Check,ClipboardPaste,ExternalLink,Flower2,Pause,Play,Radio,RefreshCw,ScanLine,Trash2,WifiOff} from 'lucide-react';
import {Shell} from './shell';
import {useStore} from '@/context/store';
import {addLead} from '@/lib/family-operations';
import {allowedUrl,identity,parseCommentLines,UNKNOWN_AUTHOR,type Candidate,type Platform} from '@/lib/live-assistant';
import {money} from '@/lib/math';

type Crop={x:number;y:number;w:number;h:number};
type OcrWorker=Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;
type ScanSummary={chars:number;lines:number;orders:number;at:string};
const RIGHT:Crop={x:68,y:5,w:31,h:90};
const LEFT:Crop={x:1,y:5,w:33,h:90};
const ALL:Crop={x:0,y:0,w:100,h:100};
const CROP_HINT='Kéo trên khung hình để chọn đúng cột bình luận. Không cần chọn cả video.';

export function LiveAssistant(){
 const {data,ready,cloud,email,unauthorized}=useStore();
 const [platform,setPlatform]=useState<Platform>('Facebook');
 const [liveUrl,setLiveUrl]=useState('');
 const [mode,setMode]=useState<'screen'|'paste'>('screen');
 const [lines,setLines]=useState('');
 const [items,setItems]=useState<Candidate[]>([]);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [working,setWorking]=useState(false);
 const [capturing,setCapturing]=useState(false);
 const [autoScan,setAutoScan]=useState(false);
 const [crop,setCrop]=useState<Crop>(RIGHT);
 const [cropImage,setCropImage]=useState('');
 const [sourceText,setSourceText]=useState('');
 const [scanSummary,setScanSummary]=useState<ScanSummary|null>(null);
 const [scanStatus,setScanStatus]=useState('Chưa nhận diện. Bấm “Bắt đầu quét màn hình”.');
 const [scanBusy,setScanBusy]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null);
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const workerRef=useRef<OcrWorker|null>(null);
 const intervalRef=useRef<ReturnType<typeof setInterval>|null>(null);
 const busyRef=useRef(false);
 const seenRef=useRef<Map<string,number>>(new Map());
 const cropRef=useRef(crop);
 const dragStartRef=useRef<{x:number;y:number}|null>(null);
 const liveRef=useRef(liveUrl);
 useEffect(()=>{cropRef.current=crop},[crop]);
 useEffect(()=>{liveRef.current=liveUrl},[liveUrl]);
 const products=useMemo(()=>data.products.filter(p=>p.active).flatMap(p=>p.variants.filter(v=>v.active).map(v=>({id:v.id,name:`${p.name} • ${v.label}`,sku:v.sku,price:v.price}))),[data.products]);
 const linkValid=!liveUrl.trim()||allowedUrl(liveUrl,platform);
 const stop=()=>{
  if(intervalRef.current){clearInterval(intervalRef.current);intervalRef.current=null;}
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  if(videoRef.current)videoRef.current.srcObject=null;
  const worker=workerRef.current;workerRef.current=null;
  if(worker)void worker.terminate().catch(()=>{});
  setCapturing(false);setAutoScan(false);busyRef.current=false;setScanBusy(false);
 };
 useEffect(()=>()=>{
  if(intervalRef.current)clearInterval(intervalRef.current);
  streamRef.current?.getTracks().forEach(t=>t.stop());
  const worker=workerRef.current;
  if(worker)void worker.terminate().catch(()=>{});
 },[]);
 const accept=(fresh:Candidate[],origin:'manual'|'ocr')=>{
  const now=Date.now();
  setItems(prev=>{
   const existing=new Set(prev.map(c=>identity(c,platform,liveRef.current)));
   const additions:Candidate[]=[];
   for(const c of fresh){
    const key=identity(c,platform,liveRef.current),last=seenRef.current.get(key);
    if(existing.has(key)||(last!==undefined&&now-last<180000))continue;
    seenRef.current.set(key,now);existing.add(key);additions.push(c);
   }
   return [...additions,...prev].slice(0,150);
  });
  if(origin==='manual')setMessage(fresh.length?`Đã nhận diện ${fresh.length} bình luận có dấu hiệu mua hàng. Kiểm tra rồi duyệt.`:'Chưa tìm thấy câu chốt có tên khách. Thử dạng “Tên khách | Chốt 2 LAN-11”.');
  else if(fresh.length)setMessage('Đã phát hiện bình luận có thể là đơn hàng. Vui lòng kiểm tra tên và sản phẩm.');
 };
 const parseManual=()=>{
  setError('');if(!linkValid){setError('Link livestream chưa hợp lệ. Bạn có thể để trống nếu không cần lưu link.');return;}
  accept(parseCommentLines(lines,products,'manual'),'manual');
 };
 const scanFrame=async()=>{
  const video=videoRef.current,canvas=canvasRef.current,worker=workerRef.current;
  if(!video||!canvas||!worker||busyRef.current||document.hidden||video.readyState<2)return;
  busyRef.current=true;setScanBusy(true);
  try{
   const {x,y,w,h}=cropRef.current;
   const sx=Math.floor(video.videoWidth*x/100),sy=Math.floor(video.videoHeight*y/100);
   const sw=Math.max(1,Math.floor(video.videoWidth*Math.min(w,100-x)/100));
   const sh=Math.max(1,Math.floor(video.videoHeight*Math.min(h,100-y)/100));
   // Upscale narrow comment columns so recognition can distinguish small text.
   const scale=Math.max(1,Math.min(3,2400/sw,2400/sh));
   canvas.width=Math.max(1,Math.round(sw*scale));
   canvas.height=Math.max(1,Math.round(sh*scale));
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw new Error('Không tạo được ảnh để nhận diện.');
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.filter='grayscale(1) contrast(1.7)';
   ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
   ctx.filter='none';
   setCropImage(canvas.toDataURL('image/jpeg',0.8));
   const result=await worker.recognize(canvas);
   if(!streamRef.current)return;
   const detected=result.data.text.slice(0,8000);
   const candidates=parseCommentLines(detected,products,'ocr');
   setSourceText(detected);
   setScanSummary({chars:detected.trim().length,lines:detected.split(/\r?\n/).filter(s=>s.trim()).length,orders:candidates.length,at:new Date().toLocaleTimeString('vi-VN')});
   if(detected.trim().length<8)setScanStatus('Không đọc được chữ. Hãy kéo chọn cột bình luận, phóng to chữ Facebook rồi quét thử.');
   else if(!candidates.length)setScanStatus('Đã đọc được chữ, nhưng chưa nhận ra câu chốt. Mở “Chữ OCR” để kiểm tra và sửa nếu cần.');
   else {setScanStatus(`Phát hiện ${candidates.length} bình luận có dấu hiệu đặt hàng. Kiểm tra hàng chờ bên dưới.`);accept(candidates,'ocr');}
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Không đọc được vùng màn hình.');setScanStatus('OCR gặp lỗi. Thử quét lại hoặc chọn một vùng nhỏ hơn.');}
  finally{busyRef.current=false;setScanBusy(false);}
 };
 const start=async()=>{
  setError('');setMessage('');
  if(!linkValid){setError('Link livestream chưa hợp lệ. Có thể để trống link nếu chỉ thử OCR.');return;}
  if(!navigator.mediaDevices?.getDisplayMedia){setError('Thiết bị/trình duyệt chưa hỗ trợ chia sẻ màn hình. Dùng Chrome/Edge trên máy tính hoặc chọn Dán bình luận.');return;}
  setWorking(true);setScanStatus('Đang mở chia sẻ màn hình...');
  try{
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
   streamRef.current=stream;
   const track=stream.getVideoTracks()[0];if(track)track.onended=()=>{stop();setScanStatus('Đã dừng chia sẻ màn hình.');};
   const video=videoRef.current;if(!video)throw new Error('Không tạo được khung xem trước.');
   video.srcObject=stream;await video.play();
   setCapturing(true);
   setScanStatus('Đang tải bộ nhận diện tiếng Việt. Chỉ quét nội dung đã chia sẻ, không gọi Facebook/TikTok.');
   const {createWorker}=await import('tesseract.js');
   const worker=await createWorker(['vie','eng']);
   if(!streamRef.current){await worker.terminate();return;}
   workerRef.current=worker;
   setAutoScan(true);
   setScanStatus('Đã kết nối màn hình. Đang đọc cột bình luận mỗi 5 giây. Kéo chọn vùng nếu chưa chính xác.');
   await scanFrame();
   intervalRef.current=setInterval(()=>{void scanFrame()},5000);
  }catch(e){
   stop();
   if((e as Error).name==='NotAllowedError')setScanStatus('Bạn đã hủy chọn màn hình. Chưa thực hiện OCR.');
   else setError(e instanceof Error?e.message:'Không bắt đầu được OCR.');
  }finally{setWorking(false);}
 };
 const toggleAuto=()=>{
  if(!capturing||!workerRef.current)return;
  if(intervalRef.current){clearInterval(intervalRef.current);intervalRef.current=null;setAutoScan(false);setScanStatus('Đã tạm dừng tự quét. Bạn có thể quét thử từng lần.');}
  else {intervalRef.current=setInterval(()=>{void scanFrame()},5000);setAutoScan(true);void scanFrame();}
 };
 const asPoint=(e:PointerEvent<HTMLDivElement>)=>{
  const r=e.currentTarget.getBoundingClientRect();
  return {x:Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100)),y:Math.min(100,Math.max(0,(e.clientY-r.top)/r.height*100))};
 };
 const dragStart=(e:PointerEvent<HTMLDivElement>)=>{
  if(!capturing)return;
  const at=asPoint(e);dragStartRef.current=at;
  e.currentTarget.setPointerCapture(e.pointerId);
  setCrop({x:at.x,y:at.y,w:1,h:1});
 };
 const dragMove=(e:PointerEvent<HTMLDivElement>)=>{
  const startPoint=dragStartRef.current;if(!startPoint)return;
  const p=asPoint(e);
  const next={x:Math.min(startPoint.x,p.x),y:Math.min(startPoint.y,p.y),w:Math.abs(p.x-startPoint.x),h:Math.abs(p.y-startPoint.y)};
  setCrop(next);
 };
 const dragEnd=(e:PointerEvent<HTMLDivElement>)=>{
  const startPoint=dragStartRef.current;
  if(!startPoint)return;
  const p=asPoint(e);
  const next={x:Math.min(startPoint.x,p.x),y:Math.min(startPoint.y,p.y),w:Math.abs(p.x-startPoint.x),h:Math.abs(p.y-startPoint.y)};
  setCrop(next.w<5||next.h<5?RIGHT:next);
  dragStartRef.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const update=(id:string,patch:Partial<Candidate>)=>setItems(prev=>prev.map(item=>item.id===id?{...item,...patch}:item));
 const save=async(item:Candidate)=>{
  setError('');setMessage('');
  if(!item.author.trim()||item.author===UNKNOWN_AUTHOR||!item.variantId||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>1000){setError('Cần xác nhận tên khách, sản phẩm và số lượng trước khi duyệt.');return;}
  if(item.profileUrl&&!allowedUrl(item.profileUrl,platform)){setError('Link hồ sơ phải thuộc đúng nền tảng đã chọn.');return;}
  setWorking(true);
  try{
   const source=[item.comment,liveUrl?`[Live: ${liveUrl}]`:'',item.profileUrl?`[Hồ sơ: ${item.profileUrl}]`:'',`[Nguồn: ${item.origin==='ocr'?'OCR màn hình':'Dán bình luận'}]`].filter(Boolean).join(' ');
   await addLead({platform,source_comment:source.slice(0,2000),customer_name:item.author.trim(),customer_phone:'',customer_address:'',variant_id:item.variantId,quantity:item.quantity,shipping_fee:0});
   setItems(prev=>prev.filter(c=>c.id!==item.id));
   setMessage(`Đã đưa bình luận của ${item.author} vào Sổ vận hành → Livestream. Chưa tạo đơn, chưa trừ kho.`);
  }catch(e){setError(e instanceof Error?e.message:'Không lưu được. Kiểm tra cấu hình Supabase và migration V7.');}
  finally{setWorking(false);}
 };
 const changePlatform=(v:Platform)=>{stop();setPlatform(v);setItems([]);seenRef.current.clear();setCrop(RIGHT);};
 if(!ready||unauthorized||(cloud&&!email))return <Shell title="Trợ lý livestream"><p>Đang xác minh quyền truy cập...</p></Shell>;
 return <Shell title="Robot livestream" subtitle="Đọc bình luận, gợi ý đơn và kiểm tra trước khi ghi nhận.">
  <div className="live-assistant-v2">
   <section className="panel live-workspace">
    <div className="live-workspace-top"><div className="live-workspace-icon"><Radio size={22}/></div><div><h2>Nhận đơn khi đang LIVE</h2><p>Chọn cách lấy bình luận, robot sẽ lọc câu chốt hàng vào danh sách chờ.</p></div><span className="live-workspace-count">{items.length} chờ duyệt</span></div>
    <div className="live-workspace-modes" role="group" aria-label="Cách nhận bình luận">
     <button type="button" className={mode==='screen'?'is-active':''} onClick={()=>setMode('screen')}><ScanLine size={17}/> Quét màn hình</button>
     <button type="button" className={mode==='paste'?'is-active':''} onClick={()=>setMode('paste')}><ClipboardPaste size={17}/> Dán bình luận</button>
    </div>
    <div className="live-platform-line">
     <label className="field">Nền tảng<select className="select" value={platform} onChange={e=>changePlatform(e.target.value as Platform)}><option>Facebook</option><option>TikTok</option></select></label>
     <details className="live-link-details"><summary>Thêm link buổi LIVE (không bắt buộc)</summary><div className="live-link-input"><input className="input" type="url" value={liveUrl} onChange={e=>{setLiveUrl(e.target.value.trim());seenRef.current.clear();}} placeholder={platform==='Facebook'?'https://www.facebook.com/...':'https://www.tiktok.com/@.../live'}/>{liveUrl&&linkValid&&<a href={liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline"><ExternalLink size={15}/> Mở live</a>}</div>{!linkValid&&<small className="live-link-invalid">Link không hợp lệ. Hãy sửa hoặc xóa link.</small>}</details>
    </div>
    {mode==='screen'?<div className="live-screen-mode">
      <div className="live-primary-actions">
       {!capturing?<button className="btn btn-primary" disabled={working||!linkValid} onClick={()=>void start()}><Play size={18}/>{working?'Đang kết nối...':'Bắt đầu đọc bình luận'}</button>:<><button className="btn btn-outline" disabled={working} onClick={toggleAuto}>{autoScan?<Pause size={17}/>:<Play size={17}/>} {autoScan?'Tạm dừng':'Tiếp tục quét'}</button><button className="btn btn-outline" disabled={!workerRef.current||scanBusy} onClick={()=>void scanFrame()}><RefreshCw size={16}/> Quét thử ngay</button><button className="btn btn-outline" onClick={()=>{stop();setScanStatus('Đã dừng nhận diện.');}}><Pause size={16}/> Dừng hẳn</button></>}
      </div>
      {!capturing&&<div className="live-start-help">Mở Facebook Live trên máy tính, phóng to khu vực bình luận. Bấm nút xanh → chọn tab đang mở LIVE → cho phép chia sẻ màn hình.</div>}
      <div className="live-video-stage" style={!capturing?{display:'none'}:undefined} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}>
       <video className="live-video-feed" muted playsInline ref={videoRef} aria-label="Màn hình đang chia sẻ"/>
       <div className="live-selection" style={{left:`${crop.x}%`,top:`${crop.y}%`,width:`${crop.w}%`,height:`${crop.h}%`}}><span>Vùng đọc bình luận</span></div>
      </div>
      <canvas ref={canvasRef} hidden />
      {capturing&&<div className="live-crop-controls"><span>{CROP_HINT}</span><div><button type="button" onClick={()=>setCrop(RIGHT)}>Bên phải</button><button type="button" onClick={()=>setCrop(LEFT)}>Bên trái</button><button type="button" onClick={()=>setCrop(ALL)}>Toàn màn hình</button></div></div>}
      <div className="live-scan-feedback" role="status"><div className={`live-scan-bullet ${capturing?'is-on':''}`}/><div><strong>{scanBusy?'Đang nhận diện chữ...':capturing?(autoScan?'Đang tự quét':'Tạm dừng quét'):'Chưa quét'}</strong><p>{scanStatus}</p>{scanSummary&&<small>Lần cuối {scanSummary.at} · {scanSummary.chars} ký tự · {scanSummary.lines} dòng · {scanSummary.orders} gợi ý</small>}</div></div>
      {cropImage&&<details className="live-debug-details"><summary>Xem vùng chữ robot đang đọc</summary><p>Ảnh dưới đây chỉ hiển thị trên thiết bị của bạn. Nếu chữ nhỏ hoặc vùng chọn sai, hãy kéo lại trên khung hình.</p><img className="live-crop-image" alt="Vùng ảnh đã chọn để OCR" src={cropImage}/></details>}
      {scanSummary&&<details className="live-debug-details"><summary>Xem và sửa chữ OCR ({scanSummary.chars} ký tự)</summary><p>Robot có thể đọc được chữ nhưng chưa hiểu câu chốt. Bạn có thể chỉnh lại nội dung rồi phân tích lại.</p><textarea className="textarea live-ocr-edit" value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="Chữ OCR sẽ xuất hiện ở đây"/><button type="button" className="btn btn-outline" onClick={()=>accept(parseCommentLines(sourceText,products,'ocr'),'manual')}><Check size={16}/> Phân tích lại chữ</button></details>}
    </div>:<div className="live-paste-mode"><p>Dán nhiều dòng theo mẫu <code>Tên khách | Chốt 2 LAN-11</code> hoặc <code>Tên khách: Lấy 1 Hồ điệp hồng</code>.</p><textarea className="textarea" value={lines} onChange={e=>setLines(e.target.value)} maxLength={18000} placeholder={'Nguyễn Mai | Chốt 2 LAN-11\nHoa Lan: Lấy 1 Hồ điệp hồng'}/><button className="btn btn-primary" disabled={!lines.trim()||working||!linkValid} onClick={parseManual}><Check size={17}/> Nhận diện đơn hàng</button></div>}
   </section>
   <section className="panel live-review-section"><div className="live-review-head"><div><h2>Đơn đang chờ kiểm tra <span>{items.length}</span></h2><p>Chọn đúng sản phẩm và số lượng, sau đó duyệt vào Sổ vận hành.</p></div><Link className="btn btn-outline" href="/operations?tab=live">Sổ livestream</Link></div>
    {error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="notice" role="status">{message}</div>}
    {!items.length?<div className="live-empty-v2"><Flower2 size={31}/><b>Chưa có bình luận chốt hàng</b><p>{scanSummary?.chars?'Đã có chữ OCR. Nếu chưa có đơn, xem phần chữ nhận diện và kiểm tra vùng chọn.':'Bắt đầu quét màn hình hoặc dán bình luận để nhận gợi ý.'}</p></div>:<div className="live-review-list">{items.map(c=><article className="live-order-candidate" key={c.id}><div className="live-order-top"><div><strong>{c.author}</strong><small>{c.origin==='ocr'?'OCR màn hình':'Dán thủ công'} · {new Date(c.capturedAt).toLocaleTimeString('vi-VN')}</small></div><button type="button" className="live-remove-v2" onClick={()=>setItems(prev=>prev.filter(x=>x.id!==c.id))} aria-label="Bỏ bình luận"><Trash2 size={17}/></button></div><blockquote>{c.comment}</blockquote><div className="live-candidate-fields"><label className="field">Tên khách<input className="input" value={c.author} maxLength={80} onChange={e=>update(c.id,{author:e.target.value})}/></label><label className="field">Số lượng<input className="input" type="number" min="1" max="1000" value={c.quantity} onChange={e=>update(c.id,{quantity:Number(e.target.value)})}/></label></div><label className="field">Sản phẩm<select className="select" value={c.variantId} onChange={e=>update(c.id,{variantId:e.target.value})}><option value="">Chọn sản phẩm cho đúng</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku} · {money(p.price)}</option>)}</select></label><details className="live-link-details"><summary>Link hồ sơ khách (nếu có)</summary><input className="input" type="url" value={c.profileUrl} onChange={e=>update(c.id,{profileUrl:e.target.value})} placeholder={platform==='Facebook'?'https://www.facebook.com/...':'https://www.tiktok.com/@...'}/></details><button className="btn btn-primary" disabled={working||!c.variantId||!c.author.trim()||c.author===UNKNOWN_AUTHOR||!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>1000} onClick={()=>void save(c)}><Check size={17}/> Duyệt vào sổ</button></article>)}</div>}
   </section>
   <p className="live-privacy-note"><WifiOff size={16}/> OCR chỉ đọc màn hình do bạn chia sẻ, không tự kết nối API Facebook/TikTok, không tự lấy liên kết hồ sơ và không đảm bảo đọc đủ bình luận khi chat chạy nhanh. Người nhà phải duyệt trước khi tạo đơn.</p>
  </div>
 </Shell>;
}
