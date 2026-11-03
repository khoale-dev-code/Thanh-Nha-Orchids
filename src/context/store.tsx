'use client';
import {createContext,useContext,useEffect,useMemo,useState,useCallback} from 'react';
import type {Database,Order,OrderDraft,Product,Customer,Settings,NewProduct,NewCustomer,DayReport,OrderStatus,PaymentStatus,CartonOrderDraft,CartonDetails} from '@/lib/types';
import {seededDemo,defaultSettings} from '@/lib/demo';
import {buildLocalOrder,dailyReport} from '@/lib/math';
import {browserDb,isCloudMode} from '@/lib/supabase';
import {allCustomerPhones,normalizeCustomerPhone,cleanCustomerPhones,cleanCustomerAddresses,matchingCustomer,sharedCustomerPhone} from '@/lib/customer-directory-v16';

const DEMO_KEY='thanh-nha-demo-v1';
type OrderPatch=Partial<Pick<Order,'status'|'payment_status'|'shipping_provider'|'shipping_status'|'tracking_code'|'shipping_request_state'>>;
interface StoreApi {data:Database;ready:boolean;busy:boolean;cloud:boolean;email:string;unauthorized:boolean;error:string;
 signIn:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>;refresh:()=>Promise<void>;
 saveProduct:(p:NewProduct)=>Promise<void>;archiveProduct:(id:string)=>Promise<void>;
 saveCustomer:(c:NewCustomer)=>Promise<Customer>;archiveCustomer:(id:string)=>Promise<void>;mergeCustomers:(keepId:string,removeId:string)=>Promise<void>;
 createOrder:(draft:OrderDraft,requestId:string)=>Promise<Order>;
 createWalkInOrder:(draft:OrderDraft,requestId:string)=>Promise<Order>;
 createCartonOrder:(draft:CartonOrderDraft,requestId:string)=>Promise<Order>;
 patchOrder:(id:string,patch:OrderPatch)=>Promise<void>;
 saveSettings:(s:Settings)=>Promise<void>;
 getReport:(from:string,to:string)=>Promise<DayReport[]>;
}
const initial:Database={products:[],customers:[],orders:[],settings:defaultSettings};
const C=createContext<StoreApi|null>(null);
function fail(message:string):never{throw new Error(message)}
export function StoreProvider({children}:{children:React.ReactNode}){
 const [data,setData]=useState<Database>(initial),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[unauthorized,setUnauthorized]=useState(false),[error,setError]=useState('');
 const db=useMemo(()=>browserDb(),[]);
 const saveDemo=(fn:(d:Database)=>Database)=>{setData(prev=>{const next=fn(prev);try{localStorage.setItem(DEMO_KEY,JSON.stringify(next));}catch{}return next;});};
 const load=useCallback(async()=>{
  if(!db)return;
  const {data:userInfo,error:authErr}=await db.auth.getUser();
  if(authErr||!userInfo.user){setEmail('');setUnauthorized(false);setData(initial);return;}
  setEmail(userInfo.user.email||'');
  const {data:member,error:memberError}=await db.from('app_members').select('user_id').eq('user_id',userInfo.user.id).eq('active',true).maybeSingle();
  if(memberError)throw new Error(memberError.message);
  if(!member){setUnauthorized(true);setData(initial);return;}
  setUnauthorized(false);
  const [p,c,o,s]=await Promise.all([
   db.from('products').select('*,variants:product_variants(*)').order('created_at',{ascending:false}),
   db.from('customers').select('*').order('created_at',{ascending:false}),
   db.from('orders').select('*,items:order_items(*)').order('created_at',{ascending:false}).limit(500),
   db.from('app_settings').select('*').eq('id',true).single()
  ]);
  for(const x of [p,c,o,s])if(x.error)throw new Error(x.error.message);
  setData({products:(p.data||[]) as Product[],customers:(c.data||[]) as Customer[],orders:(o.data||[]) as Order[],settings:(s.data||defaultSettings) as Settings});
 },[db]);
 useEffect(()=>{let mounted=true;(async()=>{try{
   if(!db){const stored=localStorage.getItem(DEMO_KEY);let next:Database;if(stored){try{next=JSON.parse(stored) as Database;}catch{next=seededDemo();}}else next=seededDemo();if(mounted)setData(next);}
   else await load();
  }catch(e){if(mounted)setError(e instanceof Error?e.message:'Không đọc được dữ liệu');}finally{if(mounted)setReady(true);}})();
  if(!db)return()=>{mounted=false};
  const {data:{subscription}}=db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){setEmail('');setData(initial);setUnauthorized(false)}});
  return()=>{mounted=false;subscription.unsubscribe()};
 },[db,load]);
 const mutate=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();setError('');}catch(e){const msg=e instanceof Error?e.message:'Thao tác thất bại';setError(msg);throw e;}finally{setBusy(false);}};
 const refresh=async()=>{if(db)await load();};
 const signIn=async(e:string,password:string)=>{if(!db)return;setBusy(true);try{const {error}=await db.auth.signInWithPassword({email:e,password});if(error)fail(error.message);await load();}finally{setBusy(false)}};
 const signOut=async()=>{if(db){await db.auth.signOut();setEmail('');setData(initial)}};
 const saveProduct=async(p:NewProduct)=>mutate(async()=>{
  if(!p.name.trim())fail('Hãy nhập tên sản phẩm');
  if(p.variants.length<1)fail('Cần ít nhất một biến thể');
  if(!db){const id=p.id||crypto.randomUUID();const next:Product={id,name:p.name,description:p.description,category:p.category,active:p.active,tax_rate:p.tax_rate,created_at:data.products.find(x=>x.id===id)?.created_at||new Date().toISOString(),variants:p.variants.map(v=>({...v,product_id:id}))};saveDemo(d=>({...d,products:[next,...d.products.filter(x=>x.id!==id)]}));return;}
  const fields={name:p.name,description:p.description,category:p.category,active:p.active,tax_rate:p.tax_rate};
  let id=p.id;
  if(id){const r=await db.from('products').update(fields).eq('id',id);if(r.error)fail(r.error.message)}
  else {const r=await db.from('products').insert(fields).select('id').single();if(r.error)fail(r.error.message);id=r.data.id;}
  const old=data.products.find(x=>x.id===id)?.variants||[];
  const submitted=new Set(p.variants.map(v=>v.id));
  for(const v of old.filter(v=>!submitted.has(v.id))){const r=await db.from('product_variants').update({active:false}).eq('id',v.id);if(r.error)fail(r.error.message)}
  for(const v of p.variants){const fields={product_id:id!,label:v.label,color:v.color,size:v.size,sku:v.sku,price:v.price,cost_price:v.cost_price,stock_quantity:v.stock_quantity,weight_grams:v.weight_grams,active:v.active};const exists=old.some(x=>x.id===v.id);
   const r=exists?await db.from('product_variants').update(fields).eq('id',v.id):await db.from('product_variants').insert(fields);if(r.error)fail(r.error.message)}
  await load();
 });
 const archiveProduct=async(id:string)=>mutate(async()=>{if(!db){saveDemo(d=>({...d,products:d.products.map(p=>p.id===id?{...p,active:false}:p)}));return;}const r=await db.from('products').update({active:false}).eq('id',id);if(r.error)fail(r.error.message);await load();});
 const saveCustomer=async(c:NewCustomer):Promise<Customer>=>{let saved:Customer|null=null;await mutate(async()=>{
  if(!c.name.trim())fail('Hãy nhập tên khách hàng');
  const phone=c.phone.trim();const address=c.address.trim();
  const phone_numbers=cleanCustomerPhones(c.phone_numbers||[],phone);
  const delivery_addresses=cleanCustomerAddresses(c.delivery_addresses||[],address);
  for(const number of [phone,...phone_numbers.map(x=>x.value)].filter(Boolean)){
    const digits=number.replace(/\D/g,'');
    if(!/^[+0-9().\s-]+$/.test(number)||digits.length<9||digits.length>12)fail('Số điện thoại không hợp lệ.');
    const existing=matchingCustomer(data.customers,number,c.id);
    const before=data.customers.find(x=>x.id===c.id);
    const unchanged=before&&allCustomerPhones(before).some(x=>normalizeCustomerPhone(x)===normalizeCustomerPhone(number));
    if(existing&&!unchanged)fail(`Số ${number} đã thuộc khách ${existing.name}. Mở hồ sơ cũ hoặc hợp nhất trong Danh bạ.`);
  }
  const clean:NewCustomer={...c,name:c.name.trim(),phone,address,phone_numbers,delivery_addresses};
  if(!db){saved={...clean,id:c.id||crypto.randomUUID(),created_at:data.customers.find(x=>x.id===c.id)?.created_at||new Date().toISOString()};const added=saved;saveDemo(d=>({...d,customers:[added,...d.customers.filter(x=>x.id!==added.id)]}));return;}
  const fields={name:clean.name,phone:clean.phone,address:clean.address,phone_numbers:clean.phone_numbers,delivery_addresses:clean.delivery_addresses,province_code:clean.province_code,district_code:clean.district_code,ward_code:clean.ward_code,notes:clean.notes,active:clean.active};
  const r=c.id?await db.from('customers').update(fields).eq('id',c.id).select('*').single():await db.from('customers').insert(fields).select('*').single();
  if(r.error){if(/phone_numbers|delivery_addresses|schema cache|column.*does not exist/i.test(r.error.message))fail('Chưa cài migration 006_customer_directory_v16.sql trong Supabase.');fail(r.error.message);}
  saved=r.data as Customer;await load();
 });return saved!;};
 const archiveCustomer=async(id:string)=>mutate(async()=>{if(!db){saveDemo(d=>({...d,customers:d.customers.map(c=>c.id===id?{...c,active:false}:c)}));return;}const r=await db.from('customers').update({active:false}).eq('id',id);if(r.error)fail(r.error.message);await load();});
 const mergeCustomers=async(keepId:string,removeId:string)=>mutate(async()=>{
  if(!keepId||!removeId||keepId===removeId)fail('Hãy chọn hai hồ sơ khác nhau.');
  const a=data.customers.find(x=>x.id===keepId&&x.active);
  const b=data.customers.find(x=>x.id===removeId&&x.active);
  if(!a||!b||!sharedCustomerPhone(a,b))fail('Không thể gộp hai khách không có số điện thoại trùng.');
  if(!db){
    const fromOtherPhones=[...allCustomerPhones(b)].filter(x=>!allCustomerPhones(a).some(y=>y.replace(/\D/g,'')===x.replace(/\D/g,'')));
    const extraPhones=[...(a.phone_numbers||[]),...(b.phone_numbers||[]),...fromOtherPhones.map(value=>({id:crypto.randomUUID(),label:'Số từ hồ sơ cũ',value}))];
    const extraAddress=[...(a.delivery_addresses||[]),...(b.delivery_addresses||[]),...(b.address&&b.address!==a.address?[{id:crypto.randomUUID(),label:'Địa chỉ cũ',value:b.address}]:[])];
    const merged={...a,phone_numbers:cleanCustomerPhones(extraPhones,a.phone),delivery_addresses:cleanCustomerAddresses(extraAddress,a.address),notes:[a.notes,a.name.trim().toLocaleLowerCase('vi-VN')!==b.name.trim().toLocaleLowerCase('vi-VN')?`Tên khác: ${b.name}`:'',b.notes].filter(Boolean).join(' | ')};
    saveDemo(d=>({...d,customers:d.customers.map(c=>c.id===keepId?merged:c.id===removeId?{...c,active:false}:c),orders:d.orders.map(o=>o.customer_id===removeId?{...o,customer_id:keepId}:o)}));
    return;
  }
  const r=await db.rpc('merge_customers_v16',{p_keep:keepId,p_remove:removeId});
  if(r.error){if(/merge_customers_v16|schema cache|function.*does not exist/i.test(r.error.message))fail('Chưa cài migration 006_customer_directory_v16.sql trong Supabase.');fail(r.error.message);}
  await load();
 });
 const createOrder=async(draft:OrderDraft,requestId:string):Promise<Order>=>{
  let created:Order|null=null;await mutate(async()=>{
   if(!db){created=buildLocalOrder(data,draft);const order=created;saveDemo(d=>({...d,orders:[order,...d.orders],products:d.products.map(p=>({...p,variants:p.variants.map(v=>{const picked=draft.items.filter(x=>x.variant_id===v.id).reduce((s,x)=>s+x.quantity,0);return picked&&v.stock_quantity!==null?{...v,stock_quantity:Math.max(0,v.stock_quantity-picked)}:v})}))}));return;}
   const r=await db.rpc('create_sale',{p_request_id:requestId,p_customer_id:draft.customer_id||null,p_customer_name:draft.customer_name,p_customer_phone:draft.customer_phone,p_customer_address:draft.customer_address,p_province_code:draft.recipient_province_code,p_district_code:draft.recipient_district_code,p_ward_code:draft.recipient_ward_code,p_items:draft.items,p_shipping_fee:draft.shipping_fee,p_shipping_cost:draft.shipping_cost,p_discount:draft.discount,p_payment_method:draft.payment_method,p_payment_status:draft.payment_status,p_note:draft.note});
   if(r.error)fail(r.error.message);
   const q=await db.from('orders').select('*,items:order_items(*)').eq('id',r.data).single();if(q.error)fail(q.error.message);created=q.data as Order;await load();
  });return created!;
 };
 const createWalkInOrder=async(draft:OrderDraft,requestId:string):Promise<Order>=>{
  let created:Order|null=null;
  await mutate(async()=>{
    if(draft.payment_status!=='paid'||!['Tiền mặt','Chuyển khoản'].includes(draft.payment_method)){
      fail('Bán trực tiếp cần xác nhận đã thanh toán bằng tiền mặt hoặc chuyển khoản.');
    }
    const posDraft:OrderDraft={...draft,shipping_fee:0,shipping_cost:0,customer_address:'',recipient_province_code:'',recipient_district_code:'',recipient_ward_code:''};
    if(!db){
      for(const selection of posDraft.items){
        const v=data.products.flatMap(p=>p.variants).find(v=>v.id===selection.variant_id);
        if(!v||!v.active)fail('Sản phẩm không còn được bán.');
        const totalQty=posDraft.items.filter(x=>x.variant_id===selection.variant_id).reduce((s,x)=>s+x.quantity,0);
        if(v.stock_quantity!==null && totalQty>v.stock_quantity) fail('Không đủ tồn kho.');
      }
      const order:Order={...buildLocalOrder(data,posDraft),status:'delivered',shipping_provider:'Bán trực tiếp',shipping_status:'Đã nhận hàng trực tiếp'};
      created=order;
      saveDemo(d=>({...d,orders:[order,...d.orders],products:d.products.map(p=>({...p,variants:p.variants.map(v=>{
        const q=posDraft.items.filter(x=>x.variant_id===v.id).reduce((s,x)=>s+x.quantity,0);
        return q&&v.stock_quantity!==null?{...v,stock_quantity:v.stock_quantity-q}:v;
      })}))}));
      return;
    }
    const r=await db.rpc('create_sale_pos',{
      p_request_id:requestId,
      p_customer_id:posDraft.customer_id||null,
      p_customer_name:posDraft.customer_name,
      p_customer_phone:posDraft.customer_phone,
      p_items:posDraft.items,
      p_discount:posDraft.discount,
      p_payment_method:posDraft.payment_method,
      p_payment_status:'paid',
      p_note:posDraft.note
    });
    if(r.error){
      if(/create_sale_pos|Could not find the function/i.test(r.error.message)){
        fail('Chưa kích hoạt bán tại quầy trên Supabase. Hãy chạy migration 002_instore_sales.sql trong SQL Editor rồi thử lại.');
      }
      fail(r.error.message);
    }
    const q=await db.from('orders').select('*,items:order_items(*)').eq('id',r.data).single();
    if(q.error)fail(q.error.message);
    created=q.data as Order;
    await load();
  });
  return created!;
 };
 const createCartonOrder=async(draft:CartonOrderDraft,requestId:string):Promise<Order>=>{
  let created:Order|null=null;
  await mutate(async()=>{
    const {variant_id,carton_count,units_per_carton,price_per_carton,mode}=draft;
    if(!Number.isInteger(carton_count)||carton_count<1||carton_count>100||!Number.isInteger(units_per_carton)||units_per_carton<1||units_per_carton>1000){fail('Quy cách thùng không hợp lệ.');}
    const qty=carton_count*units_per_carton;
    if(qty>10000) fail('Một đơn bán thùng không được vượt 10.000 cây.');
    const found=data.products.flatMap(p=>p.variants.map(v=>({p,v}))).find(x=>x.v.id===variant_id);
    if(!found||!found.p.active||!found.v.active)fail('Sản phẩm không còn khả dụng.');
    const originalPrice=found.v.price;
    const bulkTotal=carton_count*price_per_carton;
    const originalTotal=originalPrice*qty;
    if(!Number.isSafeInteger(price_per_carton)||price_per_carton<=0||price_per_carton>1000000000000||!Number.isSafeInteger(bulkTotal)||!Number.isSafeInteger(originalTotal)||bulkTotal>originalTotal)fail('Giá bán thùng không hợp lệ.');
    if(!Number.isInteger(draft.discount)||draft.discount<0||draft.discount>bulkTotal)fail('Giảm giá vượt tiền hàng.');
    if(found.v.stock_quantity!==null&&qty>found.v.stock_quantity)fail('Không đủ số cây trong kho.');
    if(mode==='instore'&&(draft.payment_status!=='paid'||!['Tiền mặt','Chuyển khoản'].includes(draft.payment_method)))fail('Đơn tại quầy phải thanh toán đầy đủ.');
    const bulkDiscount=originalTotal-bulkTotal;
    const carton:CartonDetails={variant_id,carton_count,units_per_carton,price_per_carton,reference_unit_price:originalPrice,bulk_discount:bulkDiscount,request_id:requestId};
    const sale:OrderDraft={...draft,items:[{variant_id,quantity:qty}],discount:bulkDiscount+draft.discount,shipping_fee:mode==='instore'?0:draft.shipping_fee,shipping_cost:mode==='instore'?0:draft.shipping_cost};
    if(!db){
      const existing=data.orders.find(o=>o.carton?.request_id===requestId);
      if(existing){created=existing;return;}
      const order:Order={...buildLocalOrder(data,sale),carton,...(mode==='instore'?{status:'delivered' as OrderStatus,shipping_provider:'Bán trực tiếp',shipping_status:'Đã nhận hàng trực tiếp'}:{})};
      created=order;
      saveDemo(d=>({...d,orders:[order,...d.orders],products:d.products.map(p=>({...p,variants:p.variants.map(v=>v.id===variant_id&&v.stock_quantity!==null?{...v,stock_quantity:v.stock_quantity-qty}:v)}))}));
      return;
    }
    const r=await db.rpc('create_sale_carton',{
      p_request_id:requestId,p_variant_id:variant_id,p_carton_count:carton_count,
      p_units_per_carton:units_per_carton,p_price_per_carton:price_per_carton,
      p_mode:mode,p_customer_id:draft.customer_id||null,p_customer_name:draft.customer_name,
      p_customer_phone:draft.customer_phone,p_customer_address:mode==='instore'?'':draft.customer_address,
      p_province_code:mode==='instore'?'':draft.recipient_province_code,
      p_district_code:mode==='instore'?'':draft.recipient_district_code,
      p_ward_code:mode==='instore'?'':draft.recipient_ward_code,
      p_shipping_fee:mode==='instore'?0:draft.shipping_fee,
      p_shipping_cost:mode==='instore'?0:draft.shipping_cost,
      p_discount:draft.discount,p_payment_method:draft.payment_method,
      p_payment_status:mode==='instore'?'paid':draft.payment_status,p_note:draft.note
    });
    if(r.error){
      if(/create_sale_carton|Could not find the function/i.test(r.error.message))fail('Chưa kích hoạt bán thùng trên Supabase. Hãy chạy migration 005_single_variant_cartons.sql trước.');
      fail(r.error.message);
    }
    const q=await db.from('orders').select('*,items:order_items(*)').eq('id',r.data).single();
    if(q.error)fail(q.error.message);
    created={...(q.data as Order),carton};
    await load();
  });return created!;
 };
 const patchOrder=async(id:string,patch:OrderPatch)=>mutate(async()=>{
  if(!db){saveDemo(d=>({...d,orders:d.orders.map(o=>o.id===id?{...o,...patch,updated_at:new Date().toISOString()}:o),products:patch.status==='cancelled'&&d.orders.find(o=>o.id===id)?.status!=='cancelled'?d.products.map(p=>({...p,variants:p.variants.map(v=>{const q=d.orders.find(o=>o.id===id)?.items.filter(i=>i.sku===v.sku).reduce((s,i)=>s+i.quantity,0)||0;return v.stock_quantity!==null?{...v,stock_quantity:v.stock_quantity+q}:v})})):d.products}));return;}
  const r=await db.from('orders').update(patch).eq('id',id);if(r.error)fail(r.error.message);await load();
 });
 const saveSettings=async(s:Settings)=>mutate(async()=>{if(!db){saveDemo(d=>({...d,settings:s}));return;}const r=await db.from('app_settings').update({...s}).eq('id',true);if(r.error)fail(r.error.message);await load();});
 const getReport=useCallback(async(from:string,to:string):Promise<DayReport[]>=>{
  if(!db)return dailyReport(data.orders,from,to);
  const r=await db.rpc('report_daily',{p_from:from,p_to:to});if(r.error)throw new Error(r.error.message);
  return (r.data||[]).map((x:DayReport)=>({...x,order_count:Number(x.order_count),revenue:Number(x.revenue),cogs:Number(x.cogs),shipping_cost:Number(x.shipping_cost),tax_total:Number(x.tax_total),profit:Number(x.profit)}));
 },[data.orders,db]);
 return <C.Provider value={{data,ready,busy,cloud:isCloudMode,email,unauthorized,error,signIn,signOut,refresh,saveProduct,archiveProduct,saveCustomer,archiveCustomer,mergeCustomers,createOrder,createWalkInOrder,createCartonOrder,patchOrder,saveSettings,getReport}}>{children}</C.Provider>;
}
export function useStore(){const x=useContext(C);if(!x)throw new Error('Missing StoreProvider');return x;}
