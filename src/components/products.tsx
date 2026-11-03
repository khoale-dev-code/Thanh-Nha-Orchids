'use client';
import {useMemo,useState} from 'react';
import {Plus,CheckCircle2} from 'lucide-react';
import {Shell} from './shell';
import {useStore} from '@/context/store';
import {ProductEditor} from './editors';
import {ProductDirectoryV18} from './product-directory-v18';
import type {Product} from '@/lib/types';
export function Products(){const {data,archiveProduct,busy}=useStore(),[filter,setFilter]=useState(''),[showArchived,setShowArchived]=useState(false),[editing,setEditing]=useState<Product|undefined|false>(false);
 const list=useMemo(()=>data.products.filter(p=>(showArchived||p.active)&&`${p.name} ${p.category} ${p.variants.map(v=>v.label).join(' ')}`.toLowerCase().includes(filter.toLowerCase())),[data.products,filter,showArchived]);
 return <Shell title="Quản lý sản phẩm" subtitle="Mỗi loại lan có thể có nhiều màu hoa, kích cỡ và mức giá khác nhau." action={<button onClick={()=>setEditing(undefined)} className="btn btn-primary"><Plus size={17}/> Thêm sản phẩm</button>}>
  <ProductDirectoryV18
    products={list}
    allProducts={data.products}
    busy={busy}
    query={filter}
    onQueryChange={setFilter}
    includeArchived={showArchived}
    onIncludeArchivedChange={setShowArchived}
    onEdit={setEditing}
    onArchive={async product => {
      if (window.confirm(`Ngừng bán ${product.name}? Đơn hàng cũ vẫn được giữ nguyên.`)) {
        await archiveProduct(product.id);
      }
    }}
  /><section className="notice section-gap"><CheckCircle2 size={18} style={{display:'inline',marginRight:8}}/>Khi ngừng bán sản phẩm, hóa đơn cũ vẫn giữ nguyên tên, giá và tiền vốn tại thời điểm chốt đơn. Giá mới không làm thay đổi doanh thu cũ.</section>
  {editing!==false&&<ProductEditor current={editing||undefined} onClose={()=>setEditing(false)}/>}</Shell>;
}
