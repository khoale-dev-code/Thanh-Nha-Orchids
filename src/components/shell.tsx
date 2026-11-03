'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {Radio,LayoutDashboard,ShoppingBag,PlusCircle,Users,Flower2,ChartColumnIncreasing,Settings,BookOpen,Menu,X,LogOut,Wifi,CheckCircle2,ChevronRight,ArrowRight,RefreshCw} from 'lucide-react';
import {useStore} from '@/context/store';
const menus=[{href:'/',label:'Tổng quan',Icon:LayoutDashboard},{href:'/new-order',label:'Chốt đơn',Icon:PlusCircle},{href:'/orders',label:'Đơn hàng',Icon:ShoppingBag},{href:'/customers',label:'Khách hàng',Icon:Users},{href:'/products',label:'Sản phẩm',Icon:Flower2},{href:'/reports',label:'Báo cáo',Icon:ChartColumnIncreasing},{href:'/operations',label:'Sổ vận hành',Icon:BookOpen},{href:'/live-assistant',label:'Robot livestream',Icon:Radio},{href:'/settings',label:'Cài đặt',Icon:Settings}];
const mobile=menus.slice(0,5);
export function Shell({title,subtitle,children,action}:{title:string;subtitle?:string;children:React.ReactNode;action?:React.ReactNode}){
 const pathname=usePathname(),[drawer,setDrawer]=useState(false);
 const {ready,cloud,email,unauthorized,error,refresh,signOut}=useStore();
 if(!ready)return <div className="loading-app"><div className="pulse-logo"><Flower2 size={44}/></div><h2>Vườn Lan Thanh Nhã</h2><p>Đang chuẩn bị khu vực bán hàng...</p></div>;
 if(cloud&&!email)return <Login/>;
 if(unauthorized)return <div className="loading-app"><Flower2 size={60} color="#00a651"/><h2>Chưa được cấp quyền</h2><p>Tài khoản đã đăng nhập nhưng chưa có trong bảng <code>app_members</code>. Hãy xem docs/SUPABASE.md.</p><button className="btn btn-outline" onClick={signOut}>Đăng xuất</button></div>;
 return <div className="app-layout">
  <aside className={`sidebar ${drawer?'sidebar-open':''}`}>
   <div className="brand-block"><div className="brand-mark"><img src="/icons/icon-192.png" alt="Biểu tượng hoa lan"/></div><div><strong>THANH NHÃ</strong><small>QUẢN LÝ VƯỜN LAN</small></div><button className="menu-close" aria-label="Đóng menu" onClick={()=>setDrawer(false)}><X size={20}/></button></div>
   <div className="sidebar-caption">KHÔNG GIAN LÀM VIỆC</div>
   <nav aria-label="Điều hướng chính" className="sidebar-menu">{menus.map(({href,label,Icon})=><Link key={href} href={href} prefetch className={`sidebar-link ${pathname===href?'selected':''}`} onClick={()=>setDrawer(false)}><Icon size={20}/><span>{label}</span>{pathname===href&&<ChevronRight size={17} className="nav-chevron"/>}</Link>)}</nav>
   <div className="sidebar-bottom"><div className="sidebar-account"><span className="avatar">TN</span><div><b>Ngưới nhà quản lý</b><small>{cloud?email:'Chế độ dùng thử'}</small></div>{cloud&&<button onClick={signOut} title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={17}/></button>}</div></div>
  </aside>
  {drawer&&<button className="drawer-backdrop" aria-label="Đóng menu" onClick={()=>setDrawer(false)}/>}
  <div className="work-area">
   <header className="topbar"><div className="topbar-left"><button className="hamburger" onClick={()=>setDrawer(true)} aria-label="Mở menu"><Menu/></button><span className="breadcrumb-name">Vườn Lan Thanh Nhã</span><ChevronRight size={15} className="breadcrumb-sep"/><span className="breadcrumb-current">{title}</span></div><div className="topbar-right">{!cloud?<span className="mode-chip"><span className="green-dot"/> Demo trên máy</span>:<span className="mode-chip"><Wifi size={15}/> Supabase</span>}<Link className="btn btn-primary top-create" href="/new-order"><PlusCircle size={18}/> Chốt đơn mới</Link></div></header>
   {!cloud&&<div className="demo-strip"><span><b>Đang dùng dữ liệu mẫu.</b> Dữ liệu chỉ lưu ở trình duyệt hiện tại, chưa đồng bộ giữa thiết bị.</span><Link href="/settings">Hướng dẫn kết nối Supabase <ArrowRight size={15}/></Link></div>}
   {error&&<div role="alert" className="global-error">{error}<button onClick={()=>refresh().catch(()=>{})} aria-label="Tải lại"><RefreshCw size={16}/></button></div>}
   <main className="main-content"><div className="page-title-row"><div><div className="page-eyebrow"><span className="eyebrow-line"/> KHÔNG GIAN BÁN HÀNG</div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action&&<div className="page-action">{action}</div>}</div>{children}</main>
   <footer className="app-footer">Vườn Lan Thanh Nhã <span>•</span> Đơn giản hơn mỗi ngày <span>✿</span></footer>
  </div>
  <nav className="mobile-nav" aria-label="Điều hướng điện thoại">{mobile.map(({href,label,Icon})=><Link href={href} key={href} className={pathname===href?'active':''}><Icon size={21}/><span>{label}</span></Link>)}<button onClick={()=>setDrawer(true)}><Menu size={21}/><span>Thêm</span></button></nav>
 </div>;
}
function Login(){const {signIn,busy}=useStore();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[err,setErr]=useState('');return <div className="login-page"><div className="login-card"><img src="/brand/logo-doc-sang.png" alt="Vườn Lan Thanh Nhã"/><span className="login-eyebrow">HỆ THỐNG QUẢN LÝ BÁN HÀNG</span><h1>Chào mừng trở lại!</h1><p>Đăng nhập để tiếp tục chốt đơn và quản lý cửa hàng.</p><form onSubmit={async e=>{e.preventDefault();setErr('');try{await signIn(email,password)}catch(x){setErr(x instanceof Error?x.message:'Không đăng nhập được')}}}><label className="field">Email<input required autoComplete="username" type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email nhân viên"/></label><label className="field">Mật khẩu<input required autoComplete="current-password" type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập mật khẩu"/></label>{err&&<div className="form-error">{err}</div>}<button type="submit" className="btn btn-primary btn-full" disabled={busy}>{busy?'Đang đăng nhập...':'Đăng nhập' }<ArrowRight size={18}/></button></form><p className="login-help">Tài khoản được quản lý bởi chủ cửa hàng trong Supabase Auth.</p></div></div>}
