'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {Check,ChevronDown,Copy,Flower2,Layers3,Plus,Save,Trash2,X} from 'lucide-react';
import {useStore} from '@/context/store';
import {browserDb} from '@/lib/supabase';
import type {NewProduct,Product,Variant} from '@/lib/types';

type EditorProps={onClose:()=>void;onSaved?:()=>void;current?:Product};
const DEMO_CATEGORIES='thanh-nha-product-categories-v8';
const DEFAULT_CATEGORIES=['Hoa lan','Vật tư','Phụ kiện'];
const cleanName=(name:string)=>name.trim().replace(/\s+/g,' ');
function uniqueCategories(all:string[]){
  const seen=new Set<string>();
  return all.map(cleanName).filter(x=>{
    if(!x||seen.has(x.toLocaleLowerCase('vi-VN')))return false;
    seen.add(x.toLocaleLowerCase('vi-VN'));return true;
  }).sort((a,b)=>a.localeCompare(b,'vi'));
}
function newVariant(label='Mặc định'):Variant{
  return {id:crypto.randomUUID(),product_id:'',label,color:'',size:'',sku:'',price:0,cost_price:null,stock_quantity:null,weight_grams:500,active:true};
}
function formatted(value:number|null){return value===null?'':Math.max(0,Math.floor(value)).toLocaleString('en-US');}
function PriceInput({value,onChange,placeholder,allowEmpty=false,ariaLabel}:{value:number|null;onChange:(n:number|null)=>void;placeholder?:string;allowEmpty?:boolean;ariaLabel:string}){
  const inputRef=useRef<HTMLInputElement>(null);
  const restoreDigits=useRef<number|null>(null);
  const display=formatted(value);
  useLayoutEffect(()=>{
    const count=restoreDigits.current;
    if(count===null)return;
    restoreDigits.current=null;
    const input=inputRef.current;
    if(!input||document.activeElement!==input)return;
    let index=0,found=0;
    while(index<display.length&&found<count){if(/\d/.test(display[index]))found++;index++;}
    input.setSelectionRange(index,index);
  },[display]);
  return <div className="tnp-money"><input ref={inputRef} className="input tnp-money-input" type="text" inputMode="numeric" autoComplete="off" aria-label={ariaLabel} value={display} placeholder={placeholder||'0'}
    onFocus={event=>event.currentTarget.select()} onChange={event=>{
      const input=event.currentTarget;
      const cursor=input.selectionStart??input.value.length;
      restoreDigits.current=(input.value.slice(0,cursor).match(/\d/g)||[]).length;
      const digits=input.value.replace(/\D/g,'').slice(0,12);
      onChange(digits?Number(digits):(allowEmpty?null:0));
    }}/><span className="tnp-money-unit">₫</span></div>;
}
function makeLabel(v:Pick<Variant, 'color' | 'size'>){return [v.color,v.size].map(x=>x.trim()).filter(Boolean).join(' · ')||'Mặc định';}

export function ProductEditor({onClose,current,onSaved}:EditorProps){
  const {saveProduct,busy,data,cloud}=useStore();
  const [form,setForm]=useState<NewProduct>(()=>({
    id:current?.id,name:current?.name||'',description:current?.description||'',
    category:current?.category||'Hoa lan',tax_rate:current?.tax_rate??0,active:current?.active??true,
    variants:current?(current.variants.filter(v=>v.active).length?current.variants.filter(v=>v.active).map(v=>({...v})):[newVariant()]):[newVariant()]
  }));
  const [mode,setMode]=useState<'single'|'multi'>(()=>(current?.variants.filter(v=>v.active).length??0)>1?'multi':'single');
  const [savedCategories,setSavedCategories]=useState<string[]>([]);
  const [loadingCategories,setLoadingCategories]=useState(false);
  const [categoryError,setCategoryError]=useState('');
  const [addingCategory,setAddingCategory]=useState(false);
  const [newCategory,setNewCategory]=useState('');
  const [creatingCategory,setCreatingCategory]=useState(false);
  const [error,setError]=useState('');
  const [advanced,setAdvanced]=useState(false);
  const [openDetails,setOpenDetails]=useState<string[]>([]);
  const mounted=useRef(true);

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;}},[]);
  const usedCategories=useMemo(()=>data.products.map(p=>p.category),[data.products]);
  const colorSuggestions=useMemo(()=>uniqueCategories(data.products.flatMap(p=>p.variants.map(v=>v.color))),[data.products]);
  const sizeSuggestions=useMemo(()=>uniqueCategories(data.products.flatMap(p=>p.variants.map(v=>v.size))),[data.products]);
  const categories=useMemo(()=>uniqueCategories([...DEFAULT_CATEGORIES,...usedCategories,...savedCategories,form.category]),[usedCategories,savedCategories,form.category]);

  useEffect(()=>{
    if(!cloud){
      try{
        const raw=localStorage.getItem(DEMO_CATEGORIES);
        if(raw){const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed))setSavedCategories(parsed.filter((x):x is string=>typeof x==='string'));}
      }catch{setCategoryError('Không đọc được danh mục đã lưu trên trình duyệt.');}
      return;
    }
    const db=browserDb();
    if(!db)return;
    let cancelled=false;
    setLoadingCategories(true);
    db.from('product_categories').select('name').order('name').then(({data:rows,error:queryError})=>{
      if(cancelled)return;
      setLoadingCategories(false);
      if(queryError){setCategoryError('Chưa có bảng nhóm sản phẩm trên Supabase. Cần chạy migration 004_product_categories.sql.');return;}
      setSavedCategories((rows||[]).map(row=>row.name));
      setCategoryError('');
    });
    return()=>{cancelled=true;};
  },[cloud]);

  const set=(key:keyof NewProduct,value:string|boolean|number)=>setForm(old=>({...old,[key]:value}));
  const updateVariant=(id:string,key:keyof Variant,value:string|number|null|boolean)=>{
    setForm(old=>({...old,variants:old.variants.map(variant=>{
      if(variant.id!==id)return variant;
      const updated={...variant,[key]:value};
      if(key==='color'||key==='size'){
        const oldAuto=makeLabel(variant);
        if(variant.label==='Mặc định'||variant.label===oldAuto||/^Mẫu \d+$/.test(variant.label))updated.label=makeLabel(updated);
      }
      return updated;
    })}));
  };
  const appendVariant=()=>{
    setMode('multi');
    setForm(old=>({...old,variants:[...old.variants,newVariant(`Mẫu ${old.variants.length+1}`)]}));
  };
  const duplicateVariant=(id:string)=>{
    setMode('multi');
    setForm(old=>{
      const source=old.variants.find(v=>v.id===id);
      if(!source)return old;
      return {...old,variants:[...old.variants,{...source,id:crypto.randomUUID(),label:`${source.label} (bản sao)`,sku:'',stock_quantity:null}]};
    });
  };
  const removeVariant=(id:string)=>{
    if(form.variants.length<=1){setError('Sản phẩm phải có ít nhất một mẫu bán.');return;}
    const existing=current?.variants.some(v=>v.id===id);
    if(existing&&!window.confirm('Ẩn biến thể này khỏi danh sách bán? Hóa đơn đã chốt vẫn giữ nguyên.'))return;
    setForm(old=>({...old,variants:old.variants.filter(v=>v.id!==id)}));
    setOpenDetails(old=>old.filter(x=>x!==id));
  };
  const saveCategory=useCallback(async()=>{
    const name=cleanName(newCategory);
    if(!name){setCategoryError('Nhập tên nhóm mới trước khi lưu.');return;}
    if(name.length>70){setCategoryError('Tên nhóm tối đa 70 ký tự.');return;}
    const existing=categories.find(x=>x.toLocaleLowerCase('vi-VN')===name.toLocaleLowerCase('vi-VN'));
    if(existing){set('category',existing);setAddingCategory(false);setNewCategory('');setCategoryError('');return;}
    setCreatingCategory(true);setCategoryError('');
    try{
      if(cloud){
        const db=browserDb();
        if(!db)throw new Error('Không kết nối được Supabase.');
        const {error:writeError}=await db.from('product_categories').insert({name});
        if(writeError){
          if(writeError.code==='23505')throw new Error('Nhóm đã tồn tại. Hãy tải lại trang để chọn nhóm.');
          throw new Error('Không lưu được nhóm trên Supabase. Kiểm tra migration 004 và quyền RLS: '+writeError.message);
        }
      }else{
        localStorage.setItem(DEMO_CATEGORIES,JSON.stringify(uniqueCategories([...savedCategories,name])));
      }
      if(!mounted.current)return;
      setSavedCategories(old=>uniqueCategories([...old,name]));
      set('category',name);setNewCategory('');setAddingCategory(false);
    }catch(e){if(mounted.current)setCategoryError(e instanceof Error?e.message:'Không tạo được nhóm');}
    finally{if(mounted.current)setCreatingCategory(false);}
  },[newCategory,categories,cloud,savedCategories]);

  const validate=()=>{
    if(!cleanName(form.name))return 'Bạn chưa nhập tên sản phẩm.';
    if(form.name.trim().length>160)return 'Tên sản phẩm tối đa 160 ký tự.';
    if(!cleanName(form.category))return 'Hãy chọn nhóm sản phẩm.';
    if(!Number.isFinite(form.tax_rate)||form.tax_rate<0||form.tax_rate>100)return 'Thuế suất phải từ 0 đến 100%.';
    if(!form.variants.length)return 'Cần có ít nhất một mẫu bán.';
    const skus=new Set<string>(), labels=new Set<string>();
    for(const [index,v] of form.variants.entries()){
      const pos=index+1;
      if(!v.label.trim())return `Mẫu ${pos}: cần có tên mẫu.`;
      if(labels.has(v.label.trim().toLocaleLowerCase('vi-VN')))return `Tên mẫu “${v.label}” bị trùng.`;
      labels.add(v.label.trim().toLocaleLowerCase('vi-VN'));
      if(!Number.isSafeInteger(v.price)||v.price<=0)return `Mẫu ${pos}: giá bán cần lớn hơn 0 ₫.`;
      if(v.cost_price!==null&&(!Number.isSafeInteger(v.cost_price)||v.cost_price<0))return `Mẫu ${pos}: giá vốn không hợp lệ.`;
      if(v.stock_quantity!==null&&(!Number.isInteger(v.stock_quantity)||v.stock_quantity<0))return `Mẫu ${pos}: tồn kho không hợp lệ.`;
      if(!Number.isInteger(v.weight_grams)||v.weight_grams<=0)return `Mẫu ${pos}: khối lượng phải lớn hơn 0.`;
      const sku=v.sku.trim().toLocaleLowerCase('vi-VN');
      if(sku){if(skus.has(sku))return `Mẫu ${pos}: mã SKU bị trùng trong sản phẩm.`;skus.add(sku);}
    }
    return '';
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');
    const invalid=validate();if(invalid){setError(invalid);return;}
    try{
      await saveProduct({
        ...form,
        name:cleanName(form.name),category:cleanName(form.category),description:form.description.trim(),
        variants:form.variants.map(v=>({...v,label:cleanName(v.label),sku:v.sku.trim(),color:cleanName(v.color),size:cleanName(v.size)}))
      });
      onSaved?.();onClose();
    }catch(e){setError(e instanceof Error?e.message:'Không lưu được sản phẩm.');}
  };

  return <div className="modal-backdrop tnp-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="modal tnp-dialog" role="dialog" aria-modal="true" aria-labelledby="tnp-title">
      <div className="tnp-head">
        <div className="tnp-head-icon"><Flower2 size={24}/></div>
        <div className="tnp-head-copy"><div className="tnp-kicker">DANH MỤC SẢN PHẨM</div><h2 id="tnp-title">{current?'Chỉnh sửa sản phẩm':'Thêm sản phẩm mới'}</h2><p>Điền thông tin cần thiết trước, các mục nâng cao có thể bổ sung sau.</p></div>
        <button type="button" className="tnp-close" onClick={onClose} aria-label="Đóng cửa sổ"><X size={21}/></button>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="tnp-body">
          <datalist id="tnp-v8-colors">{colorSuggestions.map(color=><option value={color} key={color}/>)}</datalist>
          <datalist id="tnp-v8-sizes">{sizeSuggestions.map(size=><option value={size} key={size}/>)}</datalist>
          <section className="tnp-section">
            <div className="tnp-section-heading"><span className="tnp-step">1</span><div><h3>Thông tin sản phẩm</h3><p>Chọn nhóm đã lưu, không phải nhập lại mỗi lần.</p></div></div>
            <div className="tnp-grid">
              <label className="field tnp-span"><span>Tên sản phẩm <b className="required">*</b></span><input className="input tnp-input" autoFocus required maxLength={160} value={form.name} onChange={event=>set('name',event.target.value)} placeholder="Ví dụ: Lan hồ điệp"/></label>
              <div className="field tnp-span">
                <div className="tnp-field-title"><span>Nhóm sản phẩm <b className="required">*</b></span><button type="button" className="tnp-link" onClick={()=>{setAddingCategory(x=>!x);setCategoryError('')}}><Plus size={15}/> Tạo nhóm mới</button></div>
                <select className="select tnp-input" value={form.category} onChange={event=>set('category',event.target.value)} aria-label="Nhóm sản phẩm">
                  {categories.map(category=><option key={category} value={category}>{category}</option>)}
                </select>
                {loadingCategories&&<span className="tnp-helper">Đang tải danh mục...</span>}
                {addingCategory&&<div className="tnp-category-add"><input className="input tnp-input" value={newCategory} onChange={event=>setNewCategory(event.target.value)} maxLength={70} placeholder="Tên nhóm mới, ví dụ: Lan rừng" aria-label="Tên nhóm mới" onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void saveCategory();}}}/><button type="button" className="btn btn-primary" disabled={creatingCategory} onClick={()=>void saveCategory()}>{creatingCategory?'Đang lưu...':'Lưu nhóm'}</button><button type="button" className="tnp-cancel-mini" onClick={()=>{setAddingCategory(false);setCategoryError('')}} aria-label="Hủy thêm nhóm"><X size={18}/></button></div>}
                {categoryError&&<p className="tnp-warning" role="status">{categoryError}</p>}
              </div>
            </div>
          </section>

          <section className="tnp-section">
            <div className="tnp-section-heading"><span className="tnp-step">2</span><div><h3>Giá bán và các mẫu</h3><p>Một loại lan có thể có nhiều màu hoa, kích thước và mức giá.</p></div></div>
            <div className="tnp-mode" role="group" aria-label="Loại sản phẩm">
              <button type="button" className={mode==='single'?'tnp-mode-button selected':'tnp-mode-button'} onClick={()=>{if(form.variants.length>1){setError('Muốn chuyển sang một mẫu, hãy xóa bớt các mẫu còn lại.');return;}setMode('single');setError('');}}><Check size={18}/> Một mẫu / một giá</button>
              <button type="button" className={mode==='multi'?'tnp-mode-button selected':'tnp-mode-button'} onClick={()=>{setMode('multi');setError('')}}><Layers3 size={18}/> Nhiều mẫu / nhiều giá</button>
            </div>
            <div className="tnp-variant-list">
              {form.variants.map((v,index)=>{
                const detailsOpen=openDetails.includes(v.id);
                return <article key={v.id} className="tnp-variant-card">
                  <div className="tnp-variant-head">
                    <div className="tnp-variant-name"><span className="tnp-variant-number">{index+1}</span><div><strong>{mode==='single'?'Mẫu bán chính':`Mẫu ${index+1}`}</strong><small>{v.label||'Chưa đặt tên'}</small></div></div>
                    <div className="tnp-variant-actions">
                      {mode==='multi'&&<button type="button" className="tnp-icon-btn" title="Nhân đôi mẫu" aria-label={`Nhân đôi mẫu ${index+1}`} onClick={()=>duplicateVariant(v.id)}><Copy size={17}/></button>}
                      {form.variants.length>1&&<button type="button" className="tnp-icon-btn danger" title="Xóa mẫu" aria-label={`Xóa mẫu ${index+1}`} onClick={()=>removeVariant(v.id)}><Trash2 size={17}/></button>}
                    </div>
                  </div>
                  <div className="tnp-grid">
                    <label className="field"><span>Giá bán <b className="required">*</b></span><PriceInput value={v.price} onChange={value=>updateVariant(v.id,'price',value??0)} ariaLabel={`Giá bán mẫu ${index+1}, đồng`}/></label>
                    <label className="field"><span>Giá vốn <small className="tnp-optional">(nếu có)</small></span><PriceInput value={v.cost_price} onChange={value=>updateVariant(v.id,'cost_price',value)} allowEmpty placeholder="Chưa khai báo" ariaLabel={`Giá vốn mẫu ${index+1}, đồng`}/></label>
                    <label className="field"><span>Màu hoa</span><input list="tnp-v8-colors" className="input tnp-input" value={v.color} onChange={event=>updateVariant(v.id,'color',event.target.value)} placeholder="Ví dụ: Hồng"/></label>
                    <label className="field"><span>Kích thước / quy cách</span><input list="tnp-v8-sizes" className="input tnp-input" value={v.size} onChange={event=>updateVariant(v.id,'size',event.target.value)} placeholder="Ví dụ: Chậu nhỏ"/></label>
                    <label className="field tnp-span"><span>Tên mẫu hiển thị khi chốt đơn <b className="required">*</b></span><input className="input tnp-input" value={v.label} onChange={event=>updateVariant(v.id,'label',event.target.value)} placeholder="Ví dụ: Hồng · Chậu nhỏ"/></label>
                    <div className="tnp-stock-row tnp-span">
                      <label className="tnp-switch-label"><input type="checkbox" checked={v.stock_quantity!==null} onChange={event=>updateVariant(v.id,'stock_quantity',event.target.checked?0:null)}/><span>Theo dõi tồn kho</span></label>
                      {v.stock_quantity!==null&&<label className="tnp-stock-value"><span>Số lượng hiện có</span><input className="input tnp-input" type="number" min="0" step="1" inputMode="numeric" value={v.stock_quantity} onChange={event=>updateVariant(v.id,'stock_quantity',Math.max(0,Math.floor(Number(event.target.value)||0)))}/></label>}
                      {v.stock_quantity===null&&<small>Không theo dõi số lượng, vẫn có thể chốt đơn.</small>}
                    </div>
                  </div>
                  <button type="button" className="tnp-details-toggle" aria-expanded={detailsOpen} onClick={()=>setOpenDetails(old=>detailsOpen?old.filter(id=>id!==v.id):[...old,v.id])}><ChevronDown size={16} className={detailsOpen?'tnp-rotated':''}/> SKU, cân nặng và trạng thái bán</button>
                  {detailsOpen&&<div className="tnp-grid tnp-variant-more">
                    <label className="field"><span>Mã SKU</span><input className="input tnp-input" value={v.sku} onChange={event=>updateVariant(v.id,'sku',event.target.value)} placeholder="Không bắt buộc"/></label>
                    <label className="field"><span>Khối lượng (gram)</span><input className="input tnp-input" type="number" min="1" step="1" inputMode="numeric" value={v.weight_grams} onChange={event=>updateVariant(v.id,'weight_grams',Math.max(1,Math.floor(Number(event.target.value)||1)))}/></label>
                    <label className="tnp-switch-label tnp-span"><input type="checkbox" checked={v.active} onChange={event=>updateVariant(v.id,'active',event.target.checked)}/><span>Mẫu này đang được bán</span></label>
                  </div>}
                </article>;
              })}
            </div>
            {mode==='multi'&&<button type="button" className="tnp-add-variant" onClick={appendVariant}><Plus size={20}/> Thêm màu / kích thước / giá khác</button>}
          </section>
          <section className="tnp-section">
            <button type="button" className="tnp-advanced-btn" aria-expanded={advanced} onClick={()=>setAdvanced(x=>!x)}><span><strong>Thiết lập nâng cao</strong><small>Mô tả, thuế và trạng thái sản phẩm</small></span><ChevronDown size={19} className={advanced?'tnp-rotated':''}/></button>
            {advanced&&<div className="tnp-grid tnp-advanced-content">
              <label className="field tnp-span"><span>Mô tả sản phẩm</span><textarea className="textarea" rows={3} value={form.description} onChange={event=>set('description',event.target.value)} placeholder="Ghi chú đặc điểm, cách chăm sóc..."/></label>
              <label className="field"><span>Thuế suất (%)</span><input className="input tnp-input" type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={event=>set('tax_rate',Number(event.target.value)||0)}/><small className="tnp-helper">Chỉ khai báo theo nghĩa vụ thuế thực tế.</small></label>
              <label className="tnp-switch-label tnp-active"><input type="checkbox" checked={form.active} onChange={event=>set('active',event.target.checked)}/><span>Sản phẩm đang kinh doanh</span></label>
            </div>}
          </section>
          {error&&<p role="alert" className="tnp-error">{error}</p>}
        </div>
        <div className="tnp-footer"><div className="tnp-footer-info"><Flower2 size={18}/><span>{form.variants.length} mẫu bán · {form.category}</span></div><div className="tnp-footer-buttons"><button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary tnp-save" disabled={busy}><Save size={17}/>{busy?'Đang lưu...':current?'Lưu thay đổi':'Lưu sản phẩm'}</button></div></div>
      </form>
    </div>
  </div>;
}
