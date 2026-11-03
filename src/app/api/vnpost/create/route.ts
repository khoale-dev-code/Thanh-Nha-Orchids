import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const dynamic='force-dynamic';
const fail=(msg:string,status=400)=>NextResponse.json({error:msg},{status});
/** Cổng EMS được khóa mặc định, cần tài khoản đối tác, mapping bưu chính và kiểm thử với EMS. */
export async function POST(request:NextRequest){
 if(process.env.VNPOST_ENABLED!=='true')return fail('Tích hợp EMS chưa bật. Xem docs/VNPOST.md.',503);
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return fail('Bạn cần đăng nhập trước khi gửi vận đơn.',401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return fail('Chưa kết nối Supabase.',503);
 const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
 const auth=await db.auth.getUser(token);if(auth.error||!auth.data.user)return fail('Phiên đăng nhập không hợp lệ.',401);
 const member=await db.from('app_members').select('user_id').eq('user_id',auth.data.user.id).eq('active',true).maybeSingle();if(member.error||!member.data)return fail('Tài khoản không có quyền tạo vận đơn.',403);
 let input:{order_id?:string};try{input=await request.json()}catch{return fail('JSON không hợp lệ')}
 if(!/^[0-9a-f-]{36}$/i.test(input.order_id||''))return fail('Mã đơn không hợp lệ');
 const [orderResult,settingsResult]=await Promise.all([db.from('orders').select('*,items:order_items(*)').eq('id',input.order_id!).single(),db.from('app_settings').select('*').eq('id',true).single()]);
 if(orderResult.error||!orderResult.data)return fail('Không tìm thấy đơn hàng.',404);
 if(settingsResult.error||!settingsResult.data)return fail('Chưa cấu hình cửa hàng.');
 const o=orderResult.data,s=settingsResult.data;
 if(o.shipping_provider==='Bán trực tiếp')return fail('Đơn bán tại quầy không cần tạo vận đơn.',409);
 if(o.status==='cancelled')return fail('Không thể vận chuyển đơn đã hủy.');
 if(o.shipping_request_state!=='idle')return fail('Đơn này đã gửi yêu cầu hoặc có yêu cầu chưa rõ kết quả. Hãy kiểm tra trên cổng EMS trước khi gửi lại.',409);
 if(!o.customer_phone||!o.customer_address||!o.recipient_province_code||!o.recipient_district_code||!o.recipient_ward_code)return fail('Cần SĐT, địa chỉ và mã tỉnh/quận/phường EMS của người nhận. Sửa thông tin khách và tạo đơn mới hoặc cập nhật dữ liệu đơn bằng quy trình được kiểm soát.');
 if(!s.shop_phone||!s.shop_address)return fail('Thiếu số điện thoại hoặc địa chỉ cửa hàng trong Cài đặt.');
 const required=['EMS_API_TOKEN','EMS_CUSTOMER_CODE','EMS_SENDER_CODE','EMS_SENDER_PROVINCE_ID','EMS_SENDER_DISTRICT_ID','EMS_SENDER_WARD_ID'] as const;
 const missing=required.filter(n=>!process.env[n]);if(missing.length)return fail(`Thiếu cấu hình máy chủ: ${missing.join(', ')}`,503);
 // Chặn gửi trùng trên cùng đơn bằng chuyển trạng thái có điều kiện.
 const locked=await db.from('orders').update({shipping_request_state:'submitting'}).eq('id',o.id).eq('shipping_request_state','idle').select('id').maybeSingle();
 if(locked.error||!locked.data)return fail('Vận đơn đã có tác vụ khác xử lý.',409);
 const itemNames=(o.items||[]).map((i:{product_name:string;quantity:number})=>`${i.product_name} x${i.quantity}`).join(', ').slice(0,220);
 const payload={ORDER_CODE:o.code,CUSTOMER_CODE:process.env.EMS_CUSTOMER_CODE,SENDER_CODE:process.env.EMS_SENDER_CODE,SENDER_NAME:s.shop_name,SENDER_PHONE:s.shop_phone,SENDER_ADDRESS:s.shop_address,
 SENDER_PROVINCE_ID:Number(process.env.EMS_SENDER_PROVINCE_ID),SENDER_DISTRICT_ID:Number(process.env.EMS_SENDER_DISTRICT_ID),SENDER_WARD_ID:Number(process.env.EMS_SENDER_WARD_ID),
 RECEIVER_NAME:o.customer_name,RECEIVER_PHONE:o.customer_phone,RECEIVER_ADDRESS:o.customer_address,
 RECEIVER_PROVINCE_ID:Number(o.recipient_province_code),RECEIVER_DISTRICT_ID:Number(o.recipient_district_code),RECEIVER_WARD_ID:Number(o.recipient_ward_code),
 PRODUCT_NAME:itemNames,PRODUCT_DESCRIPTION:itemNames,PRODUCT_QUANTITY:(o.items||[]).reduce((n:number,i:{quantity:number})=>n+i.quantity,0),
 PRODUCT_VALUE:o.subtotal,TOTAL_AMOUNT:o.payment_method==='COD'&&o.payment_status==='unpaid'?o.total:0,COD:o.payment_method==='COD'&&o.payment_status==='unpaid'?1:0,WEIGHT:Math.max(500,(o.items||[]).reduce((n:number,i:{quantity:number})=>n+i.quantity*500,0)),SERVICE_TYPE:0,STORE_ID:0};
 try{
  const response=await fetch('https://customerconnect.ems.com.vn/api/Shipment/ShipmentCreate',{method:'POST',headers:{Authorization:`Bearer ${process.env.EMS_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(16000),cache:'no-store'});
  const body=await response.json().catch(()=>null) as Record<string,unknown>|null;
  // EMS trả Code theo phiên bản; xem chi tiết từng bưu gửi, không dựa vào HTTP 200 đơn thuần.
  const list=(body?.listResponse as {Code?:number|string;TrackingCode?:string;TrackingNo?:string}[]|undefined);
  const accepted=response.ok&&Boolean(body)&&((Array.isArray(list)&&list.length>0&&list.every(x=>[1,2,'1','2'].includes(x.Code??-1)))||(!Array.isArray(list)&&[1,2,'1','2'].includes(body?.Code as number|string)));
  if(!accepted){await db.from('orders').update({shipping_request_state:'rejected'}).eq('id',o.id);return fail('EMS chưa xác nhận tạo vận đơn. Kiểm tra tài khoản đối tác hoặc phản hồi trên cổng EMS; không gửi lại mù.',502)}
  const code=list?.[0]?.TrackingCode||list?.[0]?.TrackingNo||'';
  const updated=await db.from('orders').update({shipping_provider:'VNPost/EMS',shipping_status:'Đã gửi yêu cầu EMS',shipping_request_state:'submitted',tracking_code:code}).eq('id',o.id);
  if(updated.error)return fail('EMS có thể đã nhận đơn nhưng chưa cập nhật được hệ thống. Hãy kiểm tra trên cổng EMS trước khi thao tác tiếp.',502);
  return NextResponse.json({ok:true,tracking_code:code,message:code?'EMS đã phản hồi mã vận đơn':'EMS đã tiếp nhận, cần đối chiếu mã vận đơn trên hệ thống EMS.'});
 }catch{
  // Nếu timeout, có thể EMS đã nhận đơn. Giữ state=unknown để tránh bấm tạo trùng.
  await db.from('orders').update({shipping_request_state:'unknown'}).eq('id',o.id);
  return fail('Mất kết nối EMS hoặc chưa xác định được phản hồi. Kiểm tra cổng EMS trước khi gửi lại.',504);
 }
}
