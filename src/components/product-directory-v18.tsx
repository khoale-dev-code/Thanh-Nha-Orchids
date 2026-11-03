'use client';

import {Archive, ArrowUpRight, Flower2, Layers3, Package, Pencil, Search, X} from 'lucide-react';
import type {Product} from '@/lib/types';
import {money} from '@/lib/math';
import './product-directory-v18.css';

interface ProductDirectoryProps {
  products: Product[];
  allProducts: Product[];
  busy: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onEdit: (product: Product) => void;
  onArchive: (product: Product) => Promise<void>;
}

function activeVariants(product: Product) {
  return product.variants.filter(variant => variant.active);
}

function priceFrom(product: Product) {
  const variants = activeVariants(product);
  return variants.length ? money(Math.min(...variants.map(variant => variant.price))) : 'Chưa có giá';
}

export function ProductDirectoryV18({
  products, allProducts, busy, query, onQueryChange,
  includeArchived, onIncludeArchivedChange, onEdit, onArchive,
}: ProductDirectoryProps) {
  const activeCount = allProducts.filter(product => product.active).length;
  const totalCount = allProducts.length;

  return <section className="tn18-directory" aria-label="Danh mục sản phẩm">
    <div className="tn18-heading">
      <div className="tn18-heading-copy">
        <span className="tn18-overline">DANH MỤC VƯỜN LAN</span>
        <h2>Danh sách sản phẩm</h2>
        <p>Quản lý giá bán, phân loại và trạng thái của từng loại lan.</p>
      </div>
      <div className="tn18-counter" aria-label={`${activeCount} sản phẩm đang kinh doanh`}>
        <strong>{activeCount.toLocaleString('vi-VN')}</strong>
        <span>đang bán</span>
      </div>
    </div>

    <div className="tn18-toolbar">
      <label className="tn18-search">
        <Search size={20} aria-hidden="true" />
        <span className="tn18-sr-only">Tìm kiếm sản phẩm</span>
        <input type="search" inputMode="search" autoComplete="off" placeholder="Tìm tên hoa, màu sắc, kích thước..." value={query} onChange={event => onQueryChange(event.target.value)} />
        {query && <button type="button" className="tn18-clear" aria-label="Xóa nội dung tìm kiếm" onClick={() => onQueryChange('')}><X size={18}/></button>}
      </label>
      <div className="tn18-segments" role="group" aria-label="Lọc sản phẩm theo trạng thái">
        <button type="button" className={!includeArchived ? 'is-active' : ''} aria-pressed={!includeArchived} onClick={() => onIncludeArchivedChange(false)}>Đang bán <span>{activeCount}</span></button>
        <button type="button" className={includeArchived ? 'is-active' : ''} aria-pressed={includeArchived} onClick={() => onIncludeArchivedChange(true)}>Tất cả <span>{totalCount}</span></button>
      </div>
    </div>

    <div className="tn18-products-desktop table-wrap">
      <table className="data-table">
        <thead><tr><th>SẢN PHẨM</th><th>NHÓM</th><th>BIẾN THỂ</th><th>GIÁ BÁN TỪ</th><th>THUẾ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
        <tbody>{products.map(product => {
          const variants = activeVariants(product);
          return <tr key={product.id}>
            <td><span className="table-avatar"><Flower2 size={18}/></span><strong>{product.name}</strong></td>
            <td>{product.category || 'Chưa phân nhóm'}</td>
            <td>{variants.length} loại</td>
            <td><strong>{priceFrom(product)}</strong></td>
            <td>{product.tax_rate > 0 ? `${product.tax_rate}%` : 'Không'}</td>
            <td><span className={`tag ${product.active ? 'status-green' : 'status-red'}`}>{product.active ? 'Đang bán' : 'Ngừng bán'}</span></td>
            <td><div className="inline-actions">
              <button type="button" className="icon-button" onClick={() => onEdit(product)} title={`Chỉnh sửa ${product.name}`} aria-label={`Chỉnh sửa ${product.name}`}><Pencil size={17}/></button>
              {product.active && <button type="button" className="icon-button" title={`Ngừng bán ${product.name}`} aria-label={`Ngừng bán ${product.name}`} disabled={busy} onClick={() => {void onArchive(product);}}><Archive size={16}/></button>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    <div className="tn18-products-mobile" aria-label="Danh sách sản phẩm trên điện thoại">
      {products.map(product => {
        const count = activeVariants(product).length;
        return <article className="tn18-card" key={product.id}>
          <div className="tn18-card-top">
            <div className="tn18-flower" aria-hidden="true"><Flower2 size={27} strokeWidth={1.8}/></div>
            <div className="tn18-product-name">
              <span className="tn18-product-category">{product.category || 'HOA LAN'}</span>
              <h3>{product.name}</h3>
            </div>
            <span className={`tn18-status ${product.active ? 'is-selling' : 'is-archived'}`}><i/>{product.active ? 'Đang bán' : 'Ngừng bán'}</span>
          </div>

          <div className="tn18-card-main">
            <div className="tn18-price-block">
              <span>GIÁ BÁN TỪ</span>
              <strong>{priceFrom(product)}</strong>
            </div>
            <div className="tn18-count-block">
              <Layers3 size={17} aria-hidden="true" />
              <b>{count}</b>
              <span>biến thể</span>
            </div>
          </div>

          <div className="tn18-card-bottom">
            <span className="tn18-tax">Thuế VAT <b>{product.tax_rate > 0 ? `${product.tax_rate}%` : 'Không áp dụng'}</b></span>
            <div className="tn18-buttons">
              <button type="button" className="tn18-edit" onClick={() => onEdit(product)}><Pencil size={17} aria-hidden="true"/> Chỉnh sửa <ArrowUpRight size={17} aria-hidden="true"/></button>
              {product.active && <button type="button" className="tn18-archive" disabled={busy} onClick={() => {void onArchive(product);}}><Archive size={16} aria-hidden="true"/> Ngừng bán</button>}
            </div>
          </div>
        </article>;
      })}
    </div>

    {!products.length && <div className="tn18-empty"><Package size={34} aria-hidden="true"/><h3>Không tìm thấy sản phẩm</h3><p>{query ? 'Thử tìm bằng tên hoa hoặc màu sắc khác.' : 'Hãy thêm sản phẩm đầu tiên để bắt đầu bán hàng.'}</p></div>}
  </section>;
}
