import type {Product,Variant} from './types';

export type CheckoutProductOption={product:Product;variant:Variant};
type IndexedProduct={product:Product;variant:Variant;name:string;searchable:string;words:string[]};

// Vietnamese-friendly: accents, case, and the distinct letter 'd' are normalized.
export function normalizeCheckoutSearch(value:string):string{
  return value.toLocaleLowerCase('vi-VN')
    .replace(/đ/g,'d')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim().replace(/\s+/g,' ');
}
export function buildCheckoutProductIndex(products:Product[]):IndexedProduct[]{
  const result:IndexedProduct[]=[];
  for(const p of products){
    if(!p.active)continue;
    for(const v of p.variants){
      if(!v.active)continue;
      const name=normalizeCheckoutSearch(p.name);
      const searchable=normalizeCheckoutSearch([p.name,v.label,v.sku,p.category,v.color,v.size].join(' '));
      result.push({product:p,variant:v,name,searchable,words:searchable.split(' ')});
    }
  }
  return result;
}
function oneEditAway(a:string,b:string):boolean{
  if(a===b)return true;
  if(a.length<3||b.length<3||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,errors=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++errors>1)return false;
    if(a.length>b.length)i++;
    else if(b.length>a.length)j++;
    else{i++;j++;}
  }
  return errors+(a.length-i)+(b.length-j)<=1;
}
function score(item:IndexedProduct,q:string,tokens:string[],allowTypo:boolean):number{
  if(item.name===q)return 0;
  if(item.name.startsWith(q))return 1;
  if(item.name.includes(q))return 2;
  if(item.searchable.includes(q))return 3;
  const direct=tokens.every(token=>item.words.some(word=>word.startsWith(token)));
  if(direct)return 4;
  if(!allowTypo||q.length<3)return -1;
  const fuzzy=tokens.every(token=>item.words.some(word=>word.startsWith(token)||oneEditAway(token,word)));
  return fuzzy?7:-1;
}
export function searchCheckoutProducts(index:IndexedProduct[],query:string,limit=12):{items:CheckoutProductOption[];hasMore:boolean;fuzzy:boolean}{
  const max=Math.max(1,Math.min(240,Math.trunc(limit)||12));
  const q=normalizeCheckoutSearch(query);
  if(!q){return {items:index.slice(0,max).map(item=>({product:item.product,variant:item.variant})),hasMore:index.length>max,fuzzy:false};}
  const tokens=q.split(' ');
  const matches:{item:IndexedProduct;score:number;position:number}[]=[];
  // First pass: exact, prefix, accent-insensitive and token matching.
  for(let i=0;i<index.length;i++){
    const item=index[i],rank=score(item,q,tokens,false);
    if(rank>=0)matches.push({item,score:rank,position:i});
  }
  const enoughExact=matches.length>0;
  let hasFuzzy=false;
  if(!enoughExact){
    // Only expand to one-edit matches if exact matches are sparse.
    for(let i=0;i<index.length;i++){
      const item=index[i],rank=score(item,q,tokens,true);
      if(rank===7){matches.push({item,score:rank,position:i});hasFuzzy=true;}
    }
  }
  matches.sort((a,b)=>a.score-b.score||a.position-b.position);
  const visible=matches.slice(0,max);
  return {items:visible.map(({item})=>({product:item.product,variant:item.variant})),hasMore:matches.length>max&&max<240,fuzzy:visible.some(x=>x.score===7)&&hasFuzzy};
}
