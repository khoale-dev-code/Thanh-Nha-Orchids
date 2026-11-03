import {browserDb} from '@/lib/supabase';
import type {Order} from '@/lib/types';

export type CashKind='other_income'|'expense';
export type CashPurpose='operation'|'stock_purchase';
export type HoldStatus='held'|'released'|'fulfilled';
export type LeadStatus='pending'|'converted'|'ignored';
export interface CashRow {id:string;entry_type:CashKind;purpose:CashPurpose;category:string;amount:number;occurred_on:string;note:string;created_at:string}
export interface HoldRow {id:string;customer_name:string;customer_phone:string;variant_id:string;quantity:number;agreed_unit_price:number;deposit_amount:number;due_on:string|null;note:string;status:HoldStatus;created_at:string}
export interface BankRow {id:string;reference:string;amount:number;occurred_at:string;description:string;order_id:string|null;confirmed_at:string|null;created_at:string}
export interface LeadRow {id:string;platform:'Facebook'|'TikTok'|'Khác';source_comment:string;customer_name:string;customer_phone:string;customer_address:string;variant_id:string;quantity:number;shipping_fee:number;status:LeadStatus;order_id:string|null;request_id:string;created_at:string}
export interface AuditRow {id:string|number;actor_id:string|null;action:string;entity_type:string;entity_id:string;details:Record<string,unknown>;created_at:string}
export interface MonthlyProfit {month:number;orders_count:number;sales_revenue:number;cogs:number;shipping_cost:number;sales_tax:number;other_income:number;operating_expense:number;estimated_profit:number}
export interface FamilyData {cash:CashRow[];holds:HoldRow[];banks:BankRow[];leads:LeadRow[];audit:AuditRow[]}
const KEY='thanh-nha-family-ops-v7';
const empty=():FamilyData=>({cash:[],holds:[],banks:[],leads:[],audit:[]});
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
function demoRead():FamilyData {try{const raw=localStorage.getItem(KEY);if(!raw)return empty();const parsed=JSON.parse(raw) as FamilyData;return {cash:parsed.cash||[],holds:parsed.holds||[],banks:parsed.banks||[],leads:parsed.leads||[],audit:parsed.audit||[]}}catch{return empty()}}
function demoWrite(data:FamilyData){localStorage.setItem(KEY,JSON.stringify(data))}
function demoEvent(d:FamilyData,entity_type:string,entity_id:string,action:string,details:Record<string,unknown>){d.audit.unshift({id:uuid(),actor_id:null,action,entity_type,entity_id,details,created_at:now()});d.audit=d.audit.slice(0,150)}
function err(message:string):never{throw new Error(message)}
async function readTable<T>(table:string,limit:number):Promise<T[]>{const db=browserDb();if(!db)return [];const r=await db.from(table).select('*').order('created_at',{ascending:false}).limit(limit);if(r.error)err(`Không đọc được ${table}. Bạn đã chạy migration 003_family_operations.sql chưa? ${r.error.message}`);return r.data as T[]}
export async function listPendingLeads(limit=100):Promise<LeadRow[]>{
 const db=browserDb();
 if(!db)return demoRead().leads.filter(l=>l.status==='pending').slice(0,limit);
 const result=await db.from('family_livestream_leads').select('*').eq('status','pending').order('created_at',{ascending:false}).limit(limit);
 if(result.error)err('Không tải được khách chờ chốt. Kiểm tra migration 003 và quyền truy cập: '+result.error.message);
 return result.data as LeadRow[];
}
export async function readFamily():Promise<FamilyData>{if(!browserDb())return demoRead();const [cash,holds,banks,leads]=await Promise.all([
 readTable<CashRow>('family_cash_entries',300),readTable<HoldRow>('family_reservations',300),readTable<BankRow>('family_bank_transfers',300),readTable<LeadRow>('family_livestream_leads',300)
]);const db=browserDb()!;const r=await db.from('family_audit_events').select('*').order('created_at',{ascending:false}).limit(100);if(r.error)err(r.error.message);return {cash,holds,banks,leads,audit:r.data as AuditRow[]}}
function checkAmount(n:number){if(!Number.isSafeInteger(n)||n<=0||n>999999999999)err('Số tiền không hợp lệ')}
export async function addCash(row:Pick<CashRow,'entry_type'|'purpose'|'category'|'amount'|'occurred_on'|'note'>){checkAmount(row.amount);if(!row.category.trim())err('Nhập nhóm thu/chi');const db=browserDb();if(db){const r=await db.from('family_cash_entries').insert(row);if(r.error)err(r.error.message);return;}const d=demoRead();const record:CashRow={...row,id:uuid(),created_at:now()};d.cash.unshift(record);demoEvent(d,'family_cash_entries',record.id,'INSERT',{type:row.entry_type,amount:row.amount});demoWrite(d)}
export async function addHold(row:Pick<HoldRow,'customer_name'|'customer_phone'|'variant_id'|'quantity'|'agreed_unit_price'|'deposit_amount'|'due_on'|'note'>){
 if(!row.customer_name.trim()||!row.variant_id||!Number.isInteger(row.quantity)||row.quantity<1)err('Thiếu khách hàng hoặc thông tin cây');
 if(row.deposit_amount<0||row.deposit_amount>row.agreed_unit_price*row.quantity)err('Tiền cọc không được vượt tổng giá trị cây');
 const db=browserDb();if(db){const r=await db.from('family_reservations').insert(row);if(r.error)err(r.error.message);return;}
 const d=demoRead();const record:HoldRow={...row,id:uuid(),status:'held',created_at:now()};d.holds.unshift(record);demoEvent(d,'family_reservations',record.id,'INSERT',{status:'held',deposit:row.deposit_amount});demoWrite(d);
}
export async function setHoldStatus(id:string,status:HoldStatus){const db=browserDb();if(db){const r=await db.from('family_reservations').update({status}).eq('id',id).eq('status','held').select('id');if(r.error)err(r.error.message);if(!r.data?.length)err('Phiếu giữ cây đã thay đổi. Tải lại dữ liệu.');return;}const d=demoRead();const row=d.holds.find(x=>x.id===id);if(!row||row.status!=='held')err('Phiếu không còn ở trạng thái đang giữ');row.status=status;demoEvent(d,'family_reservations',id,'UPDATE',{status});demoWrite(d)}
export async function addBank(row:Pick<BankRow,'reference'|'amount'|'occurred_at'|'description'>){checkAmount(row.amount);if(row.reference.trim().length<3)err('Nhập mã giao dịch dài ít nhất 3 ký tự');const db=browserDb();if(db){const r=await db.from('family_bank_transfers').insert(row);if(r.error)err(r.error.message);return;}const d=demoRead();if(d.banks.some(x=>x.reference===row.reference))err('Mã giao dịch đã tồn tại');const record:BankRow={...row,id:uuid(),order_id:null,confirmed_at:null,created_at:now()};d.banks.unshift(record);demoEvent(d,'family_bank_transfers',record.id,'INSERT',{amount:row.amount});demoWrite(d)}
export async function confirmBank(transfer:BankRow,order:Order,patchPayment:(id:string)=>Promise<void>){
 if(transfer.order_id||order.payment_status==='paid'||order.status==='cancelled'||order.payment_method!=='Chuyển khoản'||transfer.amount!==order.total)err('Chỉ đối soát đơn chuyển khoản chưa trả với số tiền trùng khớp 100%.');
 const db=browserDb();if(db){const r=await db.rpc('family_confirm_bank_transfer',{p_transfer_id:transfer.id,p_order_id:order.id});if(r.error)err(r.error.message);return;}
 await patchPayment(order.id);
 const d=demoRead();const record=d.banks.find(x=>x.id===transfer.id);if(!record||record.order_id)err('Giao dịch đã được xác nhận');record.order_id=order.id;record.confirmed_at=now();demoEvent(d,'family_bank_transfers',record.id,'UPDATE',{matched:true});demoWrite(d);
}
export async function addLead(row:Pick<LeadRow,'platform'|'source_comment'|'customer_name'|'customer_phone'|'customer_address'|'variant_id'|'quantity'|'shipping_fee'>){if(!row.variant_id||row.quantity<1)err('Chọn sản phẩm và số lượng');const db=browserDb();if(db){const r=await db.from('family_livestream_leads').insert(row);if(r.error)err(r.error.message);return;}const d=demoRead();const record:LeadRow={...row,id:uuid(),status:'pending',order_id:null,request_id:uuid(),created_at:now()};d.leads.unshift(record);demoEvent(d,'family_livestream_leads',record.id,'INSERT',{platform:row.platform,status:'pending'});demoWrite(d)}

export async function updateLeadContact(id:string,patch:Pick<LeadRow,'customer_name'|'customer_phone'|'customer_address'|'shipping_fee'>){
 if(!patch.customer_name.trim()||patch.shipping_fee<0)err('Thông tin khách hoặc phí ship không hợp lệ');
 const db=browserDb();if(db){const r=await db.from('family_livestream_leads').update(patch).eq('id',id).eq('status','pending');if(r.error)err(r.error.message);return;}
 const d=demoRead();const row=d.leads.find(x=>x.id===id);if(!row||row.status!=='pending')err('Bình luận đã xử lý');Object.assign(row,patch);demoEvent(d,'family_livestream_leads',id,'UPDATE',{action:'contact_edit'});demoWrite(d)
}
export async function ignoreLead(id:string){const db=browserDb();if(db){const r=await db.from('family_livestream_leads').update({status:'ignored'}).eq('id',id).eq('status','pending');if(r.error)err(r.error.message);return;}const d=demoRead();const row=d.leads.find(x=>x.id===id);if(!row||row.status!=='pending')err('Bình luận đã được xử lý');row.status='ignored';demoEvent(d,'family_livestream_leads',id,'UPDATE',{status:'ignored'});demoWrite(d)}
export async function finishLead(lead:LeadRow,orderId:string){const db=browserDb();if(db){const r=await db.rpc('family_finish_livestream_lead',{p_lead_id:lead.id,p_order_id:orderId});if(r.error)err(r.error.message);return;}const d=demoRead();const row=d.leads.find(x=>x.id===lead.id);if(!row)err('Không tìm thấy bình luận');row.status='converted';row.order_id=orderId;demoEvent(d,'family_livestream_leads',row.id,'UPDATE',{status:'converted'});demoWrite(d)}
export async function readProfit(year:number,orders:Order[],cash:CashRow[]):Promise<MonthlyProfit[]>{const db=browserDb();if(db){const r=await db.rpc('family_profit_monthly',{p_year:year});if(r.error)err(r.error.message);return (r.data as MonthlyProfit[]).map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,Number(v)])) as unknown as MonthlyProfit)}
 return Array.from({length:12},(_,i)=>{const month=i+1;const sales=orders.filter(o=>o.status==='delivered'&&new Date(o.created_at).getFullYear()===year&&new Date(o.created_at).getMonth()+1===month);const ledger=cash.filter(x=>Number(x.occurred_on.slice(0,4))===year&&Number(x.occurred_on.slice(5,7))===month);const sum=(a:number[])=>a.reduce((s,v)=>s+v,0);const sales_revenue=sum(sales.map(o=>o.total-o.tax_total)),cogs=sum(sales.map(o=>o.cost_total)),shipping_cost=sum(sales.map(o=>o.shipping_cost)),sales_tax=sum(sales.map(o=>o.tax_total));const other_income=sum(ledger.filter(x=>x.entry_type==='other_income').map(x=>x.amount));const operating_expense=sum(ledger.filter(x=>x.entry_type==='expense'&&x.purpose!=='stock_purchase').map(x=>x.amount));return {month,orders_count:sales.length,sales_revenue,cogs,shipping_cost,sales_tax,other_income,operating_expense,estimated_profit:sales_revenue-cogs-shipping_cost+other_income-operating_expense}});
}
