import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams;const bank=q.get('bank')||'',account=q.get('account')||'',amount=q.get('amount')||'',addInfo=q.get('addInfo')||'',accountName=q.get('accountName')||'';
 if(!/^[a-zA-Z0-9]{2,24}$/.test(bank)||!/^[0-9]{5,22}$/.test(account)||!/^[0-9]{1,12}$/.test(amount)||Number(amount)>999999999999||addInfo.length>48||accountName.length>100)return NextResponse.json({error:'Thông số mã QR không hợp lệ'},{status:400});
 const url=new URL(`https://img.vietqr.io/image/${bank}-${account}-compact2.png`);
 url.searchParams.set('amount',amount);url.searchParams.set('addInfo',addInfo);url.searchParams.set('accountName',accountName);
 try{const response=await fetch(url.toString(),{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('VietQR không phản hồi ảnh');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>2_000_000)throw Error('Ảnh QR quá lớn');return new NextResponse(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff'}});}catch{return NextResponse.json({error:'Không tải được VietQR. Kiểm tra mạng hoặc thông tin ngân hàng.'},{status:502})}
}
