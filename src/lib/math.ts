import type {Database, Line, Order, OrderDraft, DayReport, Product} from './types';
export const money = (v:number) => Math.round(v||0).toLocaleString('vi-VN')+' ₫';
export const isoDay = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const orderStatuses:Record<string,string> = {new:'Mới chốt', confirmed:'Đã xác nhận', packing:'Đang đóng gói', shipped:'Đang vận chuyển', delivered:'Đã giao', cancelled:'Đã hủy'};
export const colorForStatus:Record<string,string> = {new:'status-blue',confirmed:'status-indigo',packing:'status-warm',shipped:'status-blue',delivered:'status-green',cancelled:'status-red'};
export const safeNonNeg=(n:number)=>Number.isFinite(n)?Math.max(0,Math.round(n)):0;
export function buildLocalOrder(data:Database,draft:OrderDraft):Order {
 const time=new Date();let subtotal=0,tax_total=0,cost_total=0;
 const items:Line[]=draft.items.map(({variant_id,quantity})=>{
  const found=data.products.flatMap(p=>p.variants.map(v=>({p,v}))).find(x=>x.v.id===variant_id);
  if(!found||!found.p.active||!found.v.active)throw new Error('Sản phẩm không còn khả dụng');
  const q=safeNonNeg(quantity);if(q<1||q>10000)throw new Error('Số lượng không hợp lệ');
  const price=safeNonNeg(found.v.price);const cost=found.v.cost_price===null?null:safeNonNeg(found.v.cost_price);
  const lineSubtotal=q*price;const tax=0;
  const lineCost=q*(cost??0); subtotal+=lineSubtotal;tax_total+=tax;cost_total+=lineCost;
  return {id:crypto.randomUUID(),order_id:'',product_name:found.p.name,variant_label:found.v.label,sku:found.v.sku,quantity:q,unit_price:price,unit_cost:cost,tax_rate:found.p.tax_rate,line_subtotal:lineSubtotal,line_tax:tax,line_cost:lineCost};
 });
 if(items.length===0)throw new Error('Cần chọn ít nhất một sản phẩm');
 const discount=safeNonNeg(draft.discount);if(discount>subtotal)throw new Error('Giảm giá vượt tổng tiền hàng');
 // Phân bổ giảm giá theo tỷ trọng tiền hàng, rồi tính thuế trên phần giá đã giảm.
 const adjusted=items.map(i=>{const net=i.line_subtotal-(subtotal>0?discount*i.line_subtotal/subtotal:0);return {...i,line_tax:Math.round(net*Math.max(0,Math.min(100,i.tax_rate))/100)};});
 tax_total=adjusted.reduce((sum,i)=>sum+i.line_tax,0);
 const id=crypto.randomUUID();const code=`TN${time.getFullYear().toString().slice(2)}${String(time.getMonth()+1).padStart(2,'0')}${String(time.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
 return {id,code,customer_id:draft.customer_id||null,customer_name:draft.customer_name.trim()||'Khách lẻ',customer_phone:draft.customer_phone.trim(),customer_address:draft.customer_address.trim(),recipient_province_code:draft.recipient_province_code,recipient_district_code:draft.recipient_district_code,recipient_ward_code:draft.recipient_ward_code,tracking_token:crypto.randomUUID(),created_at:time.toISOString(),updated_at:time.toISOString(),status:'new',payment_status:draft.payment_status,payment_method:draft.payment_method,shipping_provider:'',shipping_status:'',tracking_code:'',shipping_request_state:'idle',note:draft.note,shipping_fee:safeNonNeg(draft.shipping_fee),shipping_cost:safeNonNeg(draft.shipping_cost),discount,subtotal,tax_total,total:Math.max(0,subtotal-discount)+tax_total+safeNonNeg(draft.shipping_fee),cost_total,items:adjusted.map(i=>({...i,order_id:id}))};
}
export function orderProfit(order:Order){return order.status==='delivered'?order.total-order.tax_total-order.cost_total-order.shipping_cost:0}
export function dailyReport(orders:Order[],from:string,to:string):DayReport[]{
 const map=new Map<string,DayReport>();for(const order of orders){if(order.status!=='delivered')continue;const day=order.created_at.slice(0,10);if(day<from||day>to)continue;
  const row=map.get(day)||{day,order_count:0,revenue:0,cogs:0,shipping_cost:0,tax_total:0,profit:0};
  row.order_count+=1;row.revenue+=order.total-order.tax_total;row.cogs+=order.cost_total;row.shipping_cost+=order.shipping_cost;row.tax_total+=order.tax_total;row.profit+=orderProfit(order);map.set(day,row);
 }return [...map.values()].sort((a,b)=>a.day.localeCompare(b.day));
}
export function variantsOf(products:Product[],term:string){const q=term.toLocaleLowerCase('vi').trim();return products.filter(p=>p.active).flatMap(p=>p.variants.filter(v=>v.active).filter(v=>`${p.name} ${v.label} ${v.sku} ${p.category}`.toLocaleLowerCase('vi').includes(q)).map(v=>({product:p,variant:v})));}
