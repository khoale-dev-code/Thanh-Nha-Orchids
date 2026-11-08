import {buildLocalOrder} from './math';
import type {Database,Product,Customer,Settings,OrderDraft,OrderStatus} from './types';
const id=(suffix:string)=>`00000000-0000-4000-8000-${suffix.padStart(12,'0')}`;
const product=(n:number,name:string,category:string,variants:[string,string,string,number,number|null][],tax=0):Product=>({id:id(String(n)),name,description:'',category,tax_rate:tax,active:true,created_at:new Date().toISOString(),variants:variants.map(([label,color,size,price,cost],i)=>({id:id(String(n*100+i+1)),product_id:id(String(n)),label,color,size,sku:`LAN-${n}${i+1}`,price,cost_price:cost,stock_quantity:null,weight_grams:500,active:true}))});
const customer=(n:number,name:string,phone:string,address:string):Customer=>({id:id(String(n+1000)),name,phone,address,notes:'',province_code:'',district_code:'',ward_code:'',active:true,created_at:new Date().toISOString()});
export const defaultSettings:Settings={id:true,shop_name:'Vườn Lan Thanh Nhã',shop_phone:'0976350159',shop_address:'1 Hẻm số 17 Lạc Long Quân, Hiệp Định, Thanh Điền, Tây Ninh, Việt Nam',bank_id:'',bank_account:'',bank_owner:'',default_shipping_fee:40000,invoice_note:'Cảm ơn quý khách đã tin yêu Vườn Lan Thanh Nhã! Chúc quý khách luôn có những mùa hoa thật đẹp 🌸'};
export function seededDemo():Database{
 const products=[
  product(1,'Hồ điệp','Lan hồ điệp',[['Chậu nhỏ · Hồng','Hồng','Nhỏ',180000,110000],['Chậu vừa · Trắng','Trắng','Vừa',290000,185000],['Chậu lớn · Tím','Tím','Lớn',450000,310000]]),
  product(2,'Dendro nắng','Lan dendro',[['Chậu nhỏ · Vàng','Vàng','Nhỏ',95000,52000],['Chậu vừa · Tím','Tím','Vừa',150000,90000]]),
  product(3,'Cattleya','Lan cattleya',[['Trưởng thành · Tím','Tím','Lớn',350000,225000],['Cây giống','Trắng','Giống',120000,65000]]),
  product(4,'Vanda','Lan vanda',[['Giò treo · Xanh','Xanh','Vừa',270000,165000]]),
  product(5,'Phân bón lá NPK','Vật tư',[['Chai 500ml','','500ml',65000,38000],['Chai 1 lít','','1 lít',115000,72000]]),
  product(6,'Chậu sứ trồng lan','Phụ kiện',[['Chậu trắng 18cm','Trắng','18cm',85000,42000]])
 ];
 const customers=[customer(1,'Cô Nguyễn Thị Hương','0901234567','Quận 7, TP. Hồ Chí Minh'),customer(2,'Anh Minh','0912345678','TP. Thủ Đức, TP. Hồ Chí Minh'),customer(3,'Chị Phương Lan','0987654321','Biên Hòa, Đồng Nai'),customer(4,'Chú Thành','0934567890','Bình Dương')];
 const data:Database={products,customers,orders:[],settings:{...defaultSettings}};
 const now=new Date(); const offsets=[0,1,2,3,5,6,8,13,18,25,31,45,62,91,120,145,190,250];
 offsets.forEach((days,i)=>{const c=customers[i%customers.length];const p=products[i%products.length];const v=p.variants[i%p.variants.length];
  const draft:OrderDraft={customer_id:c.id,customer_name:c.name,customer_phone:c.phone,customer_address:c.address,recipient_province_code:'',recipient_district_code:'',recipient_ward_code:'',items:[{variant_id:v.id,quantity:(i%3)+1}],shipping_fee:30000,shipping_cost:26000,discount:i%5===0?10000:0,payment_method:i%2===0?'Chuyển khoản':'COD',payment_status:i%3===0?'unpaid':'paid',note:''};
  const order=buildLocalOrder(data,draft);const date=new Date(now);date.setDate(now.getDate()-days);order.created_at=date.toISOString();order.updated_at=date.toISOString();order.status=(days<2?'new':days<5?'packing':days<8?'shipped':'delivered') as OrderStatus;data.orders.push(order);
 }); return data;
}
