'use client';
import {useLayoutEffect,useRef} from 'react';

type MoneyInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  ariaLabel?: string;
};

const formatMoney = (value: number | null) =>
  value === null ? '' : Math.max(0, Math.floor(value)).toLocaleString('en-US');

export function MoneyInput({value,onChange,allowEmpty=false,ariaLabel}:MoneyInputProps) {
  const ref=useRef<HTMLInputElement>(null);
  const caretDigits=useRef<number|null>(null);
  const display=formatMoney(value);

  // Restore position by number of digits, not by commas inserted during formatting.
  useLayoutEffect(()=>{
    const requested=caretDigits.current;
    if(requested===null) return;
    caretDigits.current=null;
    const el=ref.current;
    if(!el || document.activeElement!==el) return;
    let offset=0, digits=0;
    while(offset<display.length && digits<requested){
      if(/[0-9]/.test(display[offset])) digits++;
      offset++;
    }
    el.setSelectionRange(offset,offset);
  },[display]);

  return <div className="money-entry">
    <input ref={ref} type="text" inputMode="numeric" autoComplete="off"
      className="input money-entry-input" aria-label={ariaLabel}
      placeholder={allowEmpty?'Để trống':'0'} value={display}
      onFocus={e=>e.currentTarget.select()}
      onChange={e=>{
        const el=e.currentTarget;
        const before=el.value.slice(0,el.selectionStart??el.value.length);
        caretDigits.current=(before.match(/[0-9]/g)||[]).length;
        // Whole VND amounts only; protect numeric precision (<= 15 digits).
        const digits=el.value.replace(/[^0-9]/g,'').slice(0,15);
        onChange(digits===''?(allowEmpty?null:0):Number(digits));
      }}
      onKeyDown={e=>{
        // Backspace just after a thousands separator should remove a digit,
        // rather than delete a comma that immediately reappears.
        const el=e.currentTarget, pos=el.selectionStart;
        if(e.key==='Backspace' && pos!==null && pos===el.selectionEnd && pos>0 && el.value[pos-1]===','){
          e.preventDefault();
          const left=el.value.slice(0,pos-1);
          const lastDigit=left.search(/[0-9](?!.*[0-9])/);
          if(lastDigit<0)return;
          const next=left.slice(0,lastDigit)+el.value.slice(pos);
          caretDigits.current=(left.slice(0,lastDigit).match(/[0-9]/g)||[]).length;
          const digits=next.replace(/[^0-9]/g,'');
          onChange(digits===''?(allowEmpty?null:0):Number(digits));
        }
      }}/>
    <span aria-hidden="true" className="money-entry-unit">₫</span>
  </div>;
}