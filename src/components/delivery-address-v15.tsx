'use client';
import {useEffect,useMemo,useState} from 'react';
import './delivery-address-v15.css';

type Place={code:string;name:string};
type CurrentProvince=Place&{wards:Place[]};
type LegacyDistrict=Place&{parent:string};
type LegacyWard=Place&{parent:string};
type CurrentData={provinces:CurrentProvince[]};
type LegacyData={provinces:Place[];districts:LegacyDistrict[];wards:LegacyWard[]};
type Props={value:string;onChange:(address:string)=>void;required?:boolean};

/** Address codes are administrative references, NOT VNPost/EMS service IDs. */
export function DeliveryAddressV15({value,onChange,required=false}:Props){
 const [version,setVersion]=useState<'current'|'legacy'>('current');
 const [province,setProvince]=useState('');
 const [district,setDistrict]=useState('');
 const [ward,setWard]=useState('');
 const [street,setStreet]=useState('');
 const [manual,setManual]=useState(Boolean(value.trim()));
 const [current,setCurrent]=useState<CurrentData|null>(null);
 const [legacy,setLegacy]=useState<LegacyData|null>(null);
 const [loadError,setLoadError]=useState('');
 useEffect(()=>{
   let active=true;
   fetch('/data/tn-vn-current-v15.json').then(r=>{if(!r.ok)throw Error('Không tải được danh mục địa chỉ mới');return r.json() as Promise<CurrentData>})
    .then(data=>{if(active)setCurrent(data)}).catch(()=>{if(active)setLoadError('Không tải được danh mục. Bạn vẫn có thể nhập địa chỉ thủ công.')});
   return()=>{active=false};
 },[]);
 useEffect(()=>{
   if(version!=='legacy'||legacy)return;
   let active=true;
   fetch('/data/tn-vn-legacy-v15.json').then(r=>{if(!r.ok)throw Error('Không tải được dữ liệu địa chỉ cũ');return r.json() as Promise<LegacyData>})
    .then(data=>{if(active){setLegacy(data);setLoadError('')}}).catch(()=>{if(active)setLoadError('Không tải được địa chỉ ba cấp. Bạn có thể nhập thủ công.')});
   return()=>{active=false};
 },[version,legacy]);
 const provinces=version==='current'?current?.provinces??[]:legacy?.provinces??[];
 const districts=useMemo(()=>version==='legacy'?(legacy?.districts??[]).filter(x=>x.parent===province):[],[version,legacy,province]);
 const wards=useMemo(()=>version==='current'?current?.provinces.find(x=>x.code===province)?.wards??[]:(legacy?.wards??[]).filter(x=>x.parent===district),[version,current,legacy,province,district]);
 const fullAddress=(p:string,d:string,w:string,s:string,ver:'current'|'legacy')=>{
   const list=ver==='current'?current?.provinces??[]:legacy?.provinces??[];
   const pName=list.find(x=>x.code===p)?.name||'';
   const dName=ver==='legacy'?(legacy?.districts??[]).find(x=>x.code===d)?.name||'':'';
   const wName=ver==='current'?(current?.provinces.find(x=>x.code===p)?.wards??[]).find(x=>x.code===w)?.name||'':(legacy?.wards??[]).find(x=>x.code===w)?.name||'';
   if(!pName||!wName||!s.trim()||(ver==='legacy'&&!dName))return '';
   return [s.trim(),wName,dName,pName].filter(Boolean).join(', ');
 };
 const change=(p:string,d:string,w:string,s:string,ver:'current'|'legacy')=>{
   setProvince(p);setDistrict(d);setWard(w);setStreet(s);
   onChange(fullAddress(p,d,w,s,ver));
 };
 const resetToPicker=()=>{setManual(false);setProvince('');setDistrict('');setWard('');setStreet('');onChange('')};
 const versionChange=(v:'current'|'legacy')=>{setVersion(v);change('','','','',v);setLoadError('')};
 return <div className="tn15-address" aria-label="Địa chỉ nhận hàng">
   <div className="tn15-address-top"><strong>Địa chỉ nhận hàng {required&&<span aria-label="Bắt buộc">*</span>}</strong><small>Chọn địa chỉ để hạn chế giao nhầm</small></div>
   {manual?<>
     <label className="field">Địa chỉ đã nhập
       <textarea className="textarea" rows={3} maxLength={500} value={value} onChange={e=>onChange(e.target.value)} placeholder="Số nhà, đường, xã/phường, tỉnh/thành phố"/>
     </label>
     <button type="button" className="tn15-address-switch" onClick={resetToPicker}>Chọn lại địa chỉ theo danh mục</button>
   </>:<>
     <div className="tn15-address-modes" role="group" aria-label="Chọn phiên bản địa chỉ">
       <button type="button" aria-pressed={version==='current'} className={version==='current'?'selected':''} onClick={()=>versionChange('current')}>Địa chỉ hiện hành (2025+)</button>
       <button type="button" aria-pressed={version==='legacy'} className={version==='legacy'?'selected':''} onClick={()=>versionChange('legacy')}>Địa chỉ cũ (3 cấp)</button>
     </div>
     <div className="tn15-address-fields">
       <label className="field">Tỉnh / Thành phố
         <select className="select" value={province} onChange={e=>change(e.target.value,'','','',version)}><option value="">Chọn tỉnh / thành phố</option>{provinces.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>
       </label>
       {version==='legacy'&&<label className="field">Quận / Huyện (trước 2025)
         <select className="select" disabled={!province} value={district} onChange={e=>change(province,e.target.value,'','',version)}><option value="">Chọn quận / huyện</option>{districts.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>
       </label>}
       <label className="field">Phường / Xã
         <select className="select" disabled={!province||(version==='legacy'&&!district)} value={ward} onChange={e=>change(province,district,e.target.value,street,version)}><option value="">Chọn phường / xã</option>{wards.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>
       </label>
       <label className="field tn15-address-street">Số nhà, ngõ/ngách, tên đường
         <input className="input" autoComplete="street-address" value={street} onChange={e=>change(province,district,ward,e.target.value,version)} maxLength={250} placeholder="Ví dụ: Số 12, ngõ 45, đường Lê Lợi"/>
       </label>
     </div>
     {value?<div className="tn15-address-preview"><span>Địa chỉ đơn hàng</span><strong>{value}</strong></div>:<p className="tn15-address-note">Vui lòng chọn địa phương và nhập số nhà/đường để hoàn thành địa chỉ.</p>}
     {loadError&&<p className="tn15-address-error">{loadError} <button type="button" onClick={()=>setManual(true)}>Nhập tay</button></p>}
     <button type="button" className="tn15-address-switch" onClick={()=>{setManual(true);}}>Nhập địa chỉ thủ công</button>
     <small className="tn15-address-source">Địa chỉ hiện hành: Open Admin Data (CC BY 4.0). Địa chỉ ba cấp cũ: madnh/hanhchinhvn (cập nhật 2023). Mã hành chính không phải mã EMS.</small>
   </>}
 </div>;
}
