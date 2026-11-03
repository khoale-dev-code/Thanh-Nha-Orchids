'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Flower2,Search,Plus,Minus,ShoppingBag,UserRoundPlus,PackagePlus,CheckCircle2,ArrowRight,Store,Truck,Info} from 'lucide-react';
import {Shell} from './shell';
import {useStore} from '@/context/store';
import {money,safeNonNeg,variantsOf} from '@/lib/math';
import type {OrderDraft,CartonOrderDraft} from '@/lib/types';
import {listPendingLeads,finishLead,type LeadRow} from '@/lib/family-operations';
import {CheckoutCustomerV11,type CustomerSource} from './checkout-customer-v11';
import {allCustomerPhones,allCustomerAddresses,matchingCustomer,normalizeCustomerPhone} from '@/lib/customer-directory-v16';
import {CustomerEditor,ProductEditor} from './editors';
import {PosMoneyInput} from './pos-money-input';

type SaleMode='delivery'|'instore';

export function NewOrder(){
  const {data,ready,cloud,createOrder,createWalkInOrder,createCartonOrder,saveCustomer,busy}=useStore();
  const router=useRouter();
  const [mode,setMode]=useState<SaleMode>('delivery');
  const [unitMode,setUnitMode]=useState<'retail'|'carton'>('retail');
  const [cartonVariantId,setCartonVariantId]=useState('');
  const [cartonCount,setCartonCount]=useState(1);
  const [unitsPerCarton,setUnitsPerCarton]=useState(100);
  const [pricePerCarton,setPricePerCarton]=useState(0);
  const [search,setSearch]=useState('');
  const [customerId,setCustomerId]=useState('');
  const [customerSource,setCustomerSource]=useState<CustomerSource>('walkin');
  const [guestName,setGuestName]=useState('');
  const [guestPhone,setGuestPhone]=useState('');
  const [guestAddress,setGuestAddress]=useState('');
  const [savedPhone,setSavedPhone]=useState('');
  const [savedAddress,setSavedAddress]=useState('');
  const [rememberContact,setRememberContact]=useState(true);
  const [pendingLeads,setPendingLeads]=useState<LeadRow[]>([]);
  const [selectedLead,setSelectedLead]=useState<LeadRow|null>(null);
  const [leadError,setLeadError]=useState('');
  const [createdOrderId,setCreatedOrderId]=useState('');
  const [savedContactId,setSavedContactId]=useState('');
  const [savedContactPhone,setSavedContactPhone]=useState('');
  const [showCustomer,setShowCustomer]=useState(false);
  const [showProduct,setShowProduct]=useState(false);
  const [cart,setCart]=useState<{id:string;qty:number}[]>([]);
  const [shippingFee,setShippingFee]=useState<number|null>(null);
  const [shippingCost,setShippingCost]=useState(0);
  const [discount,setDiscount]=useState(0);
  const [method,setMethod]=useState('Chuyển khoản');
  const [paid,setPaid]=useState(false);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const [submitKey,setSubmitKey]=useState(()=>crypto.randomUUID());

  const selectLead=(lead:LeadRow)=>{
    setSelectedLead(lead);
    setCustomerSource(lead.platform==='TikTok'?'tiktok':lead.platform==='Facebook'?'facebook':'walkin');
    setCustomerId('');
    setSavedPhone('');setSavedAddress('');
    setGuestName(lead.customer_name==='Khách livestream'?'':lead.customer_name);
    setGuestPhone(lead.customer_phone||'');
    setGuestAddress(lead.customer_address||'');
    setShippingFee(lead.shipping_fee);
    setUnitMode('retail');
    setCart([{id:lead.variant_id,qty:Math.max(1,lead.quantity)}]);
    setMode('delivery');
    setMethod('Chuyển khoản');
    setPaid(false);
    setSubmitKey(lead.request_id);
    setSavedContactId('');
    setSavedContactPhone('');
    setError('');
  };
  const reloadLeads=async()=>{
    setLeadError('');
    try{setPendingLeads(await listPendingLeads());}
    catch(e){setLeadError(e instanceof Error?e.message:'Không tải được danh sách khách chờ chốt');}
  };
  useEffect(()=>{
    if(!ready)return;
    let alive=true;
    listPendingLeads().then(rows=>{
      if(!alive)return;
      setPendingLeads(rows);
      const leadId=new URLSearchParams(window.location.search).get('lead');
      if(leadId){
        const pending=rows.find(row=>row.id===leadId);
        if(pending)selectLead(pending);
        else setLeadError('Khách livestream này không còn trong danh sách chờ hoặc chưa được đồng bộ.');
      }
    }).catch(e=>{if(alive)setLeadError(e instanceof Error?e.message:'Không tải được khách livestream');});
    return()=>{alive=false};
  },[ready,cloud]);
  const changeSource=(next:CustomerSource)=>{
    setCustomerSource(next);
    setCustomerId('');
    setSavedPhone('');setSavedAddress('');
    setSelectedLead(null);
    setSubmitKey(crypto.randomUUID());
    setSavedContactId('');
    setSavedContactPhone('');
    setError('');
    if(next==='saved')setGuestName('');
  };

  const selected=data.customers.find(x=>x.id===customerId);
  const foundItems=variantsOf(data.products,search);
  const chosen=useMemo(()=>cart.map(({id,qty})=>{
    const found=data.products.flatMap(p=>p.variants.map(v=>({p,v}))).find(x=>x.v.id===id);
    return found?{...found,qty}:null;
  }).filter((x):x is NonNullable<typeof x>=>x!==null),[data.products,cart]);
  const selectedCarton=useMemo(()=>{
    for(const p of data.products){const v=p.variants.find(x=>x.id===cartonVariantId);if(v)return {p,v};}
    return null;
  },[cartonVariantId,data.products]);
  const totalPlants=cartonCount*unitsPerCarton;
  const cartonSubtotal=cartonCount*pricePerCarton;
  const retailSubtotal=chosen.reduce((s,x)=>s+x.qty*x.v.price,0);
  const subtotal=unitMode==='carton'?cartonSubtotal:retailSubtotal;
  const tax=unitMode==='carton'
    ?Math.round(Math.max(0,cartonSubtotal-safeNonNeg(discount))*Math.max(0,Math.min(100,selectedCarton?.p.tax_rate??0))/100)
    :chosen.reduce((s,x)=>s+Math.round((x.qty*x.v.price-(subtotal>0?safeNonNeg(discount)*x.qty*x.v.price/subtotal:0))*x.p.tax_rate/100),0);
  const hasProducts=unitMode==='carton'?!!selectedCarton:chosen.length>0;
  const bulkIsValid=unitMode!=='carton'||(!!selectedCarton&&Number.isInteger(cartonCount)&&Number.isInteger(unitsPerCarton)&&cartonCount>=1&&cartonCount<=100&&unitsPerCarton>=1&&unitsPerCarton<=1000&&totalPlants<=10000&&Number.isSafeInteger(pricePerCarton)&&Number.isSafeInteger(pricePerCarton*cartonCount)&&pricePerCarton>0&&pricePerCarton<=1000000000000&&pricePerCarton<=selectedCarton.v.price*unitsPerCarton&&(selectedCarton.v.stock_quantity===null||totalPlants<=selectedCarton.v.stock_quantity));
  const sf=mode==='instore'?0:(shippingFee===null?data.settings.default_shipping_fee:shippingFee);
  const total=Math.max(0,subtotal-safeNonNeg(discount))+tax+safeNonNeg(sf);
  const isCounter=mode==='instore';

  const selectMode=(next:SaleMode)=>{
    setMode(next);
    setError('');
    setMethod(next==='instore'?'Tiền mặt':'Chuyển khoản');
    setPaid(next==='instore');
  };
  const pickCarton=(id:string)=>{
    const v=data.products.flatMap(p=>p.variants).find(x=>x.id===id);
    if(!v)return;
    setCartonVariantId(id);
    setPricePerCarton(v.price*unitsPerCarton);
  };
  const updatePackSize=(raw:number)=>{
    const size=Math.min(1000,Math.max(1,Math.trunc(raw)||1));
    setUnitsPerCarton(size);
    if(selectedCarton)setPricePerCarton(selectedCarton.v.price*size);
  };
  const add=(id:string)=>setCart(prev=>prev.some(x=>x.id===id)
    ?prev.map(x=>x.id===id?{...x,qty:Math.min(10000,x.qty+1)}:x)
    :[...prev,{id,qty:1}]);
  const change=(id:string,delta:number)=>setCart(prev=>prev.map(x=>x.id===id?{...x,qty:x.qty+delta}:x).filter(x=>x.qty>0));

  const create=async()=>{
    setError('');
    if(!hasProducts){setError('Hãy chọn ít nhất một sản phẩm.');return;}
    if(!bulkIsValid){setError('Kiểm tra số thùng, số cây, tồn kho và giá sỉ. Giá thùng phải lớn hơn 0 và không cao hơn giá bán lẻ tương ứng.');return;}
    if(discount>subtotal){setError('Giảm giá không thể lớn hơn tiền hàng.');return;}
    if(createdOrderId){setError('Đơn đã được tạo. Không bấm chốt lần hai; hãy mở hóa đơn đã tạo.');return;}
    const fromSocial=customerSource==='facebook'||customerSource==='tiktok';
    const name=customerSource==='saved'?selected?.name?.trim()||'':guestName.trim();
    const phone=customerSource==='saved'?(savedPhone||selected?.phone?.trim()|| (selected?allCustomerPhones(selected)[0]:'') ||''):guestPhone.trim();
    const address=customerSource==='saved'?(savedAddress||selected?.address?.trim()||(selected?allCustomerAddresses(selected)[0]:'')||''):guestAddress.trim();
    if(customerSource==='saved'&&!selected){setError('Hãy chọn một khách đã lưu.');return;}
    if(fromSocial&&!name){setError('Hãy nhập tên khách Facebook/TikTok.');return;}
    if(!isCounter&&(!name||!phone||!address)){
      setError('Đơn giao hàng cần tên khách, số điện thoại và địa chỉ nhận hàng.');return;
    }
    const phoneDigits=phone.replace(/\D/g,'');
    if(phone && (!/^[+0-9().\s-]+$/.test(phone)||phoneDigits.length<9||phoneDigits.length>12)){
      setError('Số điện thoại cần có 9–12 chữ số. Vui lòng kiểm tra lại.');return;
    }
    if(selectedLead && unitMode==='carton'){
      setError('Khách livestream đã chọn theo từng cây. Vui lòng chọn bán lẻ để giữ đúng sản phẩm và số lượng bình luận.');return;
    }
    const sourceLabel=customerSource==='facebook'?'Facebook':customerSource==='tiktok'?'TikTok':customerSource==='saved'?'Khách đã lưu':'Khách vãng lai';
    const description=[`Nguồn khách: ${sourceLabel}`,selectedLead?`Bình luận: ${selectedLead.source_comment.slice(0,350)}`:'',note.trim()].filter(Boolean).join(' | ');
    try{
      let resolvedCustomerId=customerSource==='saved'?selected?.id||null:null;
      if(fromSocial&&rememberContact&&name&&phone){
        const normalized=normalizeCustomerPhone(phone);
        const known=matchingCustomer(data.customers,phone);
        if(known){
          resolvedCustomerId=known.id;
          const existingAddresses=allCustomerAddresses(known);
          if(address && !existingAddresses.some(x=>x.toLocaleLowerCase('vi-VN')===address.toLocaleLowerCase('vi-VN'))){
            await saveCustomer({...known,address:known.address||address,delivery_addresses:known.address?[...(known.delivery_addresses||[]),{id:crypto.randomUUID(),label:'Địa chỉ livestream',value:address}]:(known.delivery_addresses||[])});
          }
        }
        else if(savedContactId&&savedContactPhone===normalized)resolvedCustomerId=savedContactId;
        else{
          const added=await saveCustomer({id:'',name,phone,address,province_code:'',district_code:'',ward_code:'',notes:`Khách từ ${sourceLabel}`,active:true});
          resolvedCustomerId=added.id;
          setSavedContactId(added.id);
          setSavedContactPhone(normalized);
        }
      }
      const draft:OrderDraft={
        customer_id:resolvedCustomerId,
        customer_name:name||'Khách lẻ',
        customer_phone:phone,
        customer_address:isCounter?'':address,
        recipient_province_code:isCounter||address!==(selected?.address||'')?'':(selected?.province_code||''),
        recipient_district_code:isCounter||address!==(selected?.address||'')?'':(selected?.district_code||''),
        recipient_ward_code:isCounter||address!==(selected?.address||'')?'':(selected?.ward_code||''),
        items:unitMode==='carton'&&selectedCarton?[{variant_id:selectedCarton.v.id,quantity:totalPlants}]:cart.map(x=>({variant_id:x.id,quantity:x.qty})),
        shipping_fee:isCounter?0:safeNonNeg(sf),
        shipping_cost:isCounter?0:safeNonNeg(shippingCost),
        discount:safeNonNeg(discount),
        payment_method:method,
        payment_status:isCounter?'paid':(paid?'paid':'unpaid'),
        note:description
      };
      const result=unitMode==='carton'&&selectedCarton
        ?await createCartonOrder({
            ...draft,variant_id:selectedCarton.v.id,carton_count:cartonCount,
            units_per_carton:unitsPerCarton,price_per_carton:pricePerCarton,
            mode:isCounter?'instore':'delivery'
          } as CartonOrderDraft,submitKey)
        :isCounter?await createWalkInOrder(draft,submitKey):await createOrder(draft,submitKey);
      setCreatedOrderId(result.id);
      if(selectedLead){
        try{await finishLead(selectedLead,result.id);}
        catch(e){
          setError(`Đơn ${result.code} đã tạo thành công nhưng chưa đánh dấu khách livestream đã xử lý: ${e instanceof Error?e.message:'Lỗi đồng bộ'}. Không chốt lại. Mở hóa đơn bên dưới.`);
          return;
        }
      }
      setSubmitKey(crypto.randomUUID());
      router.push(`/print/${result.id}`);
    }catch(x){
      setError(x instanceof Error?x.message:'Không tạo được đơn hàng');
      // Keep submitKey to make retries idempotent on the server.
    }
  };

  return <Shell title="Chốt đơn hàng mới" subtitle="Bán trực tiếp hoặc giao tận nhà. Chọn hàng, hệ thống tự tính và xuất hóa đơn.">
    <section className="sale-mode-section" aria-label="Hình thức bán hàng">
      <div className="sale-mode-title">Hình thức bán hàng <span>Chọn trước khi chốt đơn</span></div>
      <div className="sale-mode-selector" role="group" aria-label="Chọn hình thức bán hàng">
        <button type="button" className={`sale-mode-option ${isCounter?'active':''}`} aria-pressed={isCounter} onClick={()=>selectMode('instore')}>
          <Store size={24}/><span><b>Bán trực tiếp</b><small>Khách đến mua, không tính phí ship</small></span>
        </button>
        <button type="button" className={`sale-mode-option ${!isCounter?'active':''}`} aria-pressed={!isCounter} onClick={()=>selectMode('delivery')}>
          <Truck size={24}/><span><b>Giao hàng</b><small>Chốt đơn rồi vận chuyển cho khách</small></span>
        </button>
      </div>
      {isCounter&&<p className="sale-mode-hint"><Info size={16}/> Đơn trực tiếp sẽ được ghi nhận là đã bán, đã thanh toán, trừ tồn kho và lên báo cáo ngay khi chốt.</p>}
    </section>

    <section className="bulk-mode-switch" aria-label="Quy cách bán hàng">
      <div><strong>Quy cách bán</strong><p>Chọn một cách bán cho đơn này. Bán thùng V9 hỗ trợ một loại và một màu/kích thước mỗi đơn.</p></div>
      <div role="group" aria-label="Chọn quy cách bán">
        <button className={unitMode==='retail'?'selected':''} aria-pressed={unitMode==='retail'} onClick={()=>{setUnitMode('retail');setError('');}}>Bán lẻ từng cây</button>
        <button className={unitMode==='carton'?'selected':''} aria-pressed={unitMode==='carton'} onClick={()=>{setUnitMode('carton');setError('');}}>Bán sỉ theo thùng</button>
      </div>
    </section>
    <div className="order-layout">
      <section className="panel">
        <div className="panel-head"><div><h2><span className="badge-number" style={{display:'inline-grid',marginRight:8}}>1</span> Chọn sản phẩm</h2><p>{unitMode==='carton'?'Chọn một biến thể để đóng thùng':'Chạm vào sản phẩm để thêm vào đơn'}</p></div><button className="btn btn-soft btn-sm" onClick={()=>setShowProduct(true)}><PackagePlus size={16}/> Thêm nhanh</button></div>
        <div className="searchbox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, màu hoa, kích thước hoặc mã..." aria-label="Tìm sản phẩm"/></div>
        <div className="product-choice-grid">{foundItems.slice(0,60).map(({product:p,variant:v})=><button className="product-choice" key={v.id} disabled={v.stock_quantity===0} onClick={()=>unitMode==='carton'?pickCarton(v.id):add(v.id)} aria-pressed={unitMode==='carton'&&cartonVariantId===v.id}><span className="flower-square"><Flower2 size={21}/></span><span style={{minWidth:0,flex:1}}><strong>{p.name}</strong><small>{v.label} {v.stock_quantity!==null?`• Còn ${v.stock_quantity}`:''}</small><b>{v.stock_quantity===0?'Hết hàng':money(v.price)}</b></span><Plus className="add-icon" size={18}/></button>)}</div>
        {!foundItems.length&&<div className="empty"><Flower2 size={36}/><h3>Chưa tìm thấy sản phẩm</h3><p>Chọn “Thêm nhanh” để tạo sản phẩm mà không rời màn hình chốt đơn.</p></div>}
      </section>

      <div className="checkout-sticky"><section className="panel">
        <div className="panel-head"><div><h2><span className="badge-number" style={{display:'inline-grid',marginRight:8}}>2</span> {unitMode==='carton'?'Thông tin thùng hàng':'Giỏ hàng'}</h2><p>{unitMode==='carton'?`${totalPlants.toLocaleString('vi-VN')} cây trong ${cartonCount} thùng`:`${cart.reduce((s,x)=>s+x.qty,0)} sản phẩm trong đơn`}</p></div><ShoppingBag color="#009d4b" size={20}/></div>
        {unitMode==='carton'?<div className="bulk-carton-editor">
          {!selectedCarton?<p className="bulk-empty">Chọn một sản phẩm bên trái để bắt đầu bán theo thùng.</p>:<>
            <div className="bulk-selection"><Flower2 size={19}/><div><strong>{selectedCarton.p.name}</strong><small>{selectedCarton.v.label} · Giá lẻ {money(selectedCarton.v.price)}/cây</small></div></div>
            <div className="bulk-fields">
              <label className="field">Số thùng<input className="input" type="number" min="1" max="100" inputMode="numeric" value={cartonCount} onChange={e=>setCartonCount(Math.min(100,Math.max(1,Math.trunc(Number(e.target.value))||1)))}/></label>
              <label className="field">Số cây / thùng<input className="input" type="number" min="1" max="1000" inputMode="numeric" value={unitsPerCarton} onChange={e=>updatePackSize(Number(e.target.value))}/></label>
              <label className="field bulk-full">Giá sỉ / thùng <PosMoneyInput value={pricePerCarton} onChange={setPricePerCarton} ariaLabel="Giá sỉ một thùng"/></label>
            </div>
            <div className="bulk-result"><span>Kho sẽ trừ <b>{totalPlants.toLocaleString('vi-VN')} cây</b></span><strong>{money(cartonSubtotal)}</strong></div>
            {selectedCarton.v.stock_quantity!==null?<p className={totalPlants>selectedCarton.v.stock_quantity?'bulk-stock-warning':'bulk-stock-hint'}>Tồn kho hiện có: {selectedCarton.v.stock_quantity.toLocaleString('vi-VN')} cây{totalPlants>selectedCarton.v.stock_quantity?' · Không đủ để chốt đơn':''}</p>:<p className="bulk-stock-hint">Sản phẩm chưa theo dõi tồn kho. Hãy tự kiểm tra số cây thực tế trước khi chốt.</p>}
            <p className="bulk-stock-hint">Giá mặc định tính theo giá lẻ. Bạn có thể giảm giá theo thùng; giá chốt không được cao hơn giá lẻ tương ứng ở V9.</p>
          </>}
        </div>:!chosen.length?<div className="empty" style={{padding:20}}><ShoppingBag size={35}/><h3>Chưa có sản phẩm</h3><p>Chạm vào một sản phẩm để thêm vào giỏ.</p></div>:chosen.map(({p,v,qty})=><div key={v.id} className="cart-line"><span className="flower-square"><Flower2 size={19}/></span><span className="cart-info"><strong>{p.name}</strong><small>{v.label} · {money(v.price)}</small></span><div className="qty-control"><button aria-label={`Giảm ${p.name}`} onClick={()=>change(v.id,-1)}><Minus size={14}/></button><strong>{qty}</strong><button aria-label={`Tăng ${p.name}`} disabled={v.stock_quantity!==null&&qty>=v.stock_quantity} onClick={()=>change(v.id,1)}><Plus size={14}/></button></div></div>)}
        <div className="divider"/>
        <CheckoutCustomerV11
          customers={data.customers}
          source={customerSource}
          onSourceChange={changeSource}
          customerId={customerId}
          onCustomerIdChange={id=>{setCustomerId(id);setSavedPhone('');setSavedAddress('');}}
          selectedPhone={savedPhone}
          onSelectedPhoneChange={setSavedPhone}
          selectedAddress={savedAddress}
          onSelectedAddressChange={setSavedAddress}
          guestName={guestName}
          onGuestNameChange={setGuestName}
          guestPhone={guestPhone}
          onGuestPhoneChange={setGuestPhone}
          guestAddress={guestAddress}
          onGuestAddressChange={setGuestAddress}
          rememberContact={rememberContact}
          onRememberContactChange={setRememberContact}
          leads={pendingLeads}
          selectedLead={selectedLead}
          onLeadChoose={id=>{const lead=pendingLeads.find(x=>x.id===id);if(lead)selectLead(lead);else if(!id){setSelectedLead(null);setSubmitKey(crypto.randomUUID());}}}
          onReloadLeads={reloadLeads}
          leadError={leadError}
          onAddCustomer={()=>setShowCustomer(true)}
          isCounter={isCounter}
        />
        <div className="divider"/>
        <div className="subheading"><b><span className="badge-number" style={{display:'inline-grid',marginRight:8}}>4</span> {isCounter?'Thanh toán trực tiếp':'Tiền hàng & giao hàng'}</b></div>
        <div className="pos-payment-grid">
          {!isCounter&&<>
            <label className="field"><span>Phí ship thu khách</span><PosMoneyInput value={sf} onChange={amount=>setShippingFee(amount)} ariaLabel="Phí ship thu khách"/></label>
            <label className="field"><span>Phí ship thực trả</span><PosMoneyInput value={shippingCost} onChange={setShippingCost} ariaLabel="Phí ship thực trả"/></label>
            <p className="pos-payment-help">Phí ship thực trả chỉ dùng để tính lãi, không cộng vào số tiền khách trả.</p>
          </>}
          <label className="field"><span>Giảm giá</span><PosMoneyInput value={discount} onChange={setDiscount} ariaLabel="Giảm giá"/></label>
          <label className="field"><span>Hình thức thanh toán</span><select className="select" value={method} onChange={e=>setMethod(e.target.value)}><option>Chuyển khoản</option><option>Tiền mặt</option>{!isCounter&&<option>COD</option>}</select></label>
          {!isCounter&&<label className="pos-paid-row"><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}/><span>Khách đã thanh toán</span></label>}
          {isCounter&&<p className="pos-payment-help pos-payment-help-success">Thanh toán trực tiếp được đánh dấu <strong>đã thanh toán</strong> và <strong>hoàn tất</strong> khi chốt. Nếu chưa thu tiền, không sử dụng chế độ này.</p>}
          <label className="field pos-field-full"><span>Ghi chú đơn hàng (không bắt buộc)</span><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder={isCounter?'Ví dụ: khách lấy trực tiếp':'Ghi chú gói hàng, hẹn giao...'}/></label>
        </div>
        <div className="divider"/>
        <div className="money-summary">
          <div><span>Tiền sản phẩm</span><strong>{money(subtotal)}</strong></div>
          {tax>0&&<div><span>Thuế (theo sản phẩm)</span><strong>{money(tax)}</strong></div>}
          {discount>0&&<div><span>Giảm giá</span><strong>-{money(discount)}</strong></div>}
          {!isCounter&&<div><span>Phí vận chuyển</span><strong>{money(sf)}</strong></div>}
          <div className="total"><span>KHÁCH CẦN TRẢ</span><strong>{money(total)}</strong></div>
        </div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        {createdOrderId&&<a href={`/print/${createdOrderId}`} className="btn btn-outline btn-full">Đơn đã tạo, mở hóa đơn</a>}
        <button disabled={busy||!hasProducts||!bulkIsValid||!!createdOrderId} className="btn btn-primary btn-full pos-submit" onClick={create}><CheckCircle2 size={20}/>{busy?'Đang lưu đơn...':isCounter?'Thanh toán & in hóa đơn':'Chốt đơn & tạo hóa đơn'}<ArrowRight size={18}/></button>
        <p className="hint" style={{textAlign:'center',marginTop:10}}>Sau khi chốt sẽ mở phiếu 80mm để in hoặc gửi ảnh.</p>
      </section></div>
    </div>
    {showCustomer&&<CustomerEditor onClose={()=>setShowCustomer(false)} onSaved={c=>{setCustomerSource('saved');setSelectedLead(null);setCustomerId(c.id);setSavedPhone('');setSavedAddress('');setSubmitKey(crypto.randomUUID());}}/>}
    {showProduct&&<ProductEditor onClose={()=>setShowProduct(false)}/>}
  </Shell>;
}
