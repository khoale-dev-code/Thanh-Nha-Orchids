'use client';
import {useLayoutEffect,useRef} from 'react';

type Props={value:number;onChange:(value:number)=>void;ariaLabel:string};
export function PosMoneyInput({value,onChange,ariaLabel}:Props){
  const el=useRef<HTMLInputElement>(null);
  const caretDigits=useRef<number|null>(null);
  const display=Math.max(0,Math.floor(value||0)).toLocaleString('vi-VN');
  useLayoutEffect(()=>{
    if(caretDigits.current===null)return;
    const count=caretDigits.current;
    caretDigits.current=null;
    if(document.activeElement!==el.current||!el.current)return;
    let cursor=0,seen=0;
    while(cursor<display.length&&seen<count){if(/[0-9]/.test(display[cursor]))seen++;cursor++;}
    el.current.setSelectionRange(cursor,cursor);
  },[display]);
  return <div className="pos-money-field">
    <input ref={el} className="input pos-money-input" type="text" inputMode="numeric" autoComplete="off"
      value={display} aria-label={ariaLabel} onFocus={e=>e.currentTarget.select()}
      onChange={e=>{
        const before=e.currentTarget.value.slice(0,e.currentTarget.selectionStart??e.currentTarget.value.length);
        caretDigits.current=(before.match(/[0-9]/g)||[]).length;
        const digits=e.currentTarget.value.replace(/\D/g,'').slice(0,15);
        onChange(digits?Number(digits):0);
      }}/>
    <span aria-hidden="true">₫</span>
  </div>;
}
