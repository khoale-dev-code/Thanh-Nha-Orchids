export type OrderStatus = 'new'|'confirmed'|'packing'|'shipped'|'delivered'|'cancelled';
export type PaymentStatus = 'unpaid'|'paid';
export interface Variant {id:string; product_id:string; label:string; color:string; size:string; sku:string; price:number; cost_price:number|null; stock_quantity:number|null; weight_grams:number; active:boolean}
export interface Product {id:string; name:string; description:string; category:string; active:boolean; tax_rate:number; created_at:string; variants:Variant[]}
export interface CustomerPhoneV16 {id:string;label:string;value:string}
export interface CustomerAddressV16 {id:string;label:string;value:string}
export interface Customer {id:string; name:string; phone:string; address:string; province_code:string; district_code:string; ward_code:string; notes:string; active:boolean; created_at:string; phone_numbers?:CustomerPhoneV16[]; delivery_addresses?:CustomerAddressV16[]}
export interface Line {id:string; order_id:string; product_name:string; variant_label:string; sku:string; quantity:number; unit_price:number; unit_cost:number|null; tax_rate:number; line_subtotal:number; line_tax:number; line_cost:number}
export interface CartonDetails {variant_id:string;carton_count:number;units_per_carton:number;price_per_carton:number;reference_unit_price:number;bulk_discount:number;request_id?:string}
export interface Order {carton?:CartonDetails;id:string; code:string; customer_id:string|null; customer_name:string; customer_phone:string; customer_address:string; recipient_province_code:string; recipient_district_code:string; recipient_ward_code:string; tracking_token:string; created_at:string; updated_at:string; status:OrderStatus; payment_status:PaymentStatus; payment_method:string; shipping_provider:string; shipping_status:string; tracking_code:string; shipping_request_state:string; note:string; shipping_fee:number; shipping_cost:number; discount:number; subtotal:number; tax_total:number; total:number; cost_total:number; items:Line[]}
export interface Settings {id:boolean; shop_name:string; shop_phone:string; shop_address:string; bank_id:string; bank_account:string; bank_owner:string; default_shipping_fee:number; invoice_note:string}
export interface Database {products:Product[]; customers:Customer[]; orders:Order[]; settings:Settings}
export type NewProduct = Pick<Product,'name'|'description'|'category'|'tax_rate'|'active'> & {id?:string; variants:(Omit<Variant,'product_id'> & {product_id?:string})[]};
export type NewCustomer = Omit<Customer,'created_at'>;
export interface OrderDraft {customer_id:string|null; customer_name:string; customer_phone:string; customer_address:string; recipient_province_code:string; recipient_district_code:string; recipient_ward_code:string; items:{variant_id:string; quantity:number}[]; shipping_fee:number; shipping_cost:number; discount:number; payment_method:string; payment_status:PaymentStatus; note:string}
export interface DayReport {day:string; order_count:number; revenue:number; cogs:number; shipping_cost:number; tax_total:number; profit:number}

export type CartonOrderDraft = Omit<OrderDraft,'items'> & {variant_id:string;carton_count:number;units_per_carton:number;price_per_carton:number;mode:'delivery'|'instore'};
