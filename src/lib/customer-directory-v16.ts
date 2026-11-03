import type {Customer,CustomerAddressV16,CustomerPhoneV16} from './types';

/** Compare VN numbers entered as 0xxx, 84xxx or +84xxx without changing display text. */
export function normalizeCustomerPhone(input:string):string {
  const digits=(input||'').replace(/\D/g,'');
  if(digits.startsWith('84') && digits.length>=11 && digits.length<=12)return `0${digits.slice(2)}`;
  return digits;
}
export function allCustomerPhones(customer:Pick<Customer,'phone'|'phone_numbers'>):string[]{
  const list=[customer.phone,...(Array.isArray(customer.phone_numbers)?customer.phone_numbers.map(x=>x.value):[])].map(x=>(x||'').trim()).filter(Boolean);
  const known=new Set<string>();
  return list.filter(x=>{const key=normalizeCustomerPhone(x);if(known.has(key))return false;known.add(key);return true;});
}
export function allCustomerAddresses(customer:Pick<Customer,'address'|'delivery_addresses'>):string[]{
  const list=[customer.address,...(Array.isArray(customer.delivery_addresses)?customer.delivery_addresses.map(x=>x.value):[])].map(x=>(x||'').trim()).filter(Boolean);
  const known=new Set<string>();
  return list.filter(x=>{const key=x.toLocaleLowerCase('vi-VN');if(known.has(key))return false;known.add(key);return true;});
}
export function matchingCustomer(customers:Customer[],number:string,exceptId=''):Customer|undefined{
  const normalized=normalizeCustomerPhone(number);
  if(normalized.length<9)return undefined;
  return customers.find(c=>c.active && c.id!==exceptId && allCustomerPhones(c).some(x=>normalizeCustomerPhone(x)===normalized));
}
export function sharedCustomerPhone(a:Customer,b:Customer):string|null{
  const other=new Set(allCustomerPhones(b).map(normalizeCustomerPhone));
  return allCustomerPhones(a).find(x=>other.has(normalizeCustomerPhone(x)))||null;
}
export function cleanCustomerPhones(items:CustomerPhoneV16[],main:string):CustomerPhoneV16[]{
  const used=new Set<string>([normalizeCustomerPhone(main)].filter(Boolean));
  return items.map(x=>({...x,label:x.label.trim().slice(0,35),value:x.value.trim()})).filter(x=>{
    const key=normalizeCustomerPhone(x.value);
    if(!key||used.has(key))return false;
    used.add(key);return true;
  });
}
export function cleanCustomerAddresses(items:CustomerAddressV16[],main:string):CustomerAddressV16[]{
  const used=new Set<string>([main.trim().toLocaleLowerCase('vi-VN')].filter(Boolean));
  return items.map(x=>({...x,label:x.label.trim().slice(0,35),value:x.value.trim().slice(0,500)})).filter(x=>{
    const key=x.value.toLocaleLowerCase('vi-VN');
    if(!key||used.has(key))return false;
    used.add(key);return true;
  });
}
