'use client';

import Link from 'next/link';
import {CalendarDays,ChevronRight,CircleX,ClipboardList,Package,Printer,Search,UserRound,Wallet} from 'lucide-react';
import {money,orderStatuses,colorForStatus} from '@/lib/math';
import type {Order,OrderStatus} from '@/lib/types';
import './order-directory-v19.css';

type FilterValue='all'|OrderStatus;
type Props={
  orders:Order[];
  rows:Order[];
  filter:string;
  onFilterChange:(value:string)=>void;
  status:string;
  onStatusChange:(value:string)=>void;
  onOpen:(order:Order)=>void;
};

const filters:{id:FilterValue;label:string}[]=[
  {id:'all',label:'Tất cả'},
  {id:'new',label:'Mới'},
  {id:'confirmed',label:'Đã xác nhận'},
  {id:'packing',label:'Đang gói'},
  {id:'shipped',label:'Đang giao'},
  {id:'delivered',label:'Đã giao'},
  {id:'cancelled',label:'Đã hủy'},
];

export function OrderDirectoryV19({orders,rows,filter,onFilterChange,status,onStatusChange,onOpen}:Props){
  const filterCounts:Record<string,number>={all:orders.length};
  for(const order of orders){
    filterCounts[order.status]=(filterCounts[order.status]||0)+1;
  }
  return <div className="tn19-directory">
    <div className="tn19-search-wrap">
      <Search size={19} aria-hidden="true"/>
      <input
        type="search"
        inputMode="search"
        aria-label="Tìm đơn hàng"
        autoComplete="off"
        enterKeyHint="search"
        value={filter}
        onChange={event=>onFilterChange(event.target.value)}
        placeholder="Mã đơn, tên hoặc số điện thoại..."
      />
      {!!filter&&<button type="button" className="tn19-clear" aria-label="Xóa từ khóa tìm kiếm" onClick={()=>onFilterChange('')}><CircleX size={20}/></button>}
    </div>
    <div className="tn19-filter-track" role="group" aria-label="Lọc theo trạng thái đơn hàng">
      {filters.map(item=><button key={item.id} type="button" aria-pressed={status===item.id} className={`tn19-filter-pill ${status===item.id?'is-selected':''}`} onClick={()=>onStatusChange(item.id)}>
        {item.label}<span>{filterCounts[item.id]||0}</span>
      </button>)}
    </div>
    <div className="tn19-list-heading">
      <strong>{rows.length} đơn hàng</strong>
      <span>{filter.trim()||status!=='all'?'Kết quả lọc':'Đơn gần đây'}</span>
    </div>
    {rows.length? <div className="tn19-card-list">
      {rows.map(order=>{
        const walkin=order.shipping_provider==='Bán trực tiếp';
        const statusLabel=walkin&&order.status==='delivered'?'Bán trực tiếp':orderStatuses[order.status];
        return <article className="tn19-card" key={order.id}>
          <div className="tn19-card-head">
            <div className="tn19-card-id">
              <span className="tn19-card-id-icon"><ClipboardList size={17}/></span>
              <strong title={order.code}>{order.code}</strong>
            </div>
            <span className={`tn19-state ${colorForStatus[order.status]}`}>{statusLabel}</span>
          </div>
          <div className="tn19-card-customer">
            <div className="tn19-card-avatar"><UserRound size={20}/></div>
            <div className="tn19-card-customer-name">
              <b>{order.customer_name||'Khách vãng lai'}</b>
              <span>{order.customer_phone||'Chưa có số điện thoại'}</span>
            </div>
          </div>
          <div className="tn19-card-meta">
            <span><CalendarDays size={15}/>{new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
            <span><Package size={15}/>{order.items.reduce((sum,item)=>sum+item.quantity,0)} sản phẩm</span>
          </div>
          <div className="tn19-card-finance">
            <div>
              <span className="tn19-total-label">Tổng đơn</span>
              <strong>{money(order.total)}</strong>
            </div>
            <span className={`tn19-payment ${order.payment_status==='paid'?'is-paid':'is-unpaid'}`}><Wallet size={15}/>{order.payment_status==='paid'?'Đã thanh toán':'Chưa thanh toán'}</span>
          </div>
          <div className="tn19-card-actions">
            <button className="tn19-detail-button" type="button" onClick={()=>onOpen(order)}>Xem chi tiết <ChevronRight size={18}/></button>
            <Link className="tn19-invoice-link" href={`/print/${order.id}`} aria-label={`Xem hóa đơn ${order.code}`}><Printer size={17}/><span>Hóa đơn</span></Link>
          </div>
        </article>;
      })}
    </div>:<div className="tn19-empty">
      <Package size={33}/>
      <strong>Chưa tìm thấy đơn hàng</strong>
      <p>Thử nhập từ khóa khác hoặc chọn trạng thái “Tất cả”.</p>
      {(filter||status!=='all')&&<button type="button" onClick={()=>{onFilterChange('');onStatusChange('all')}}>Xóa bộ lọc</button>}
    </div>}
  </div>;
}
