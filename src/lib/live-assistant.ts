export type Platform = 'Facebook' | 'TikTok';
export type Candidate = {id:string;author:string;comment:string;profileUrl:string;variantId:string;quantity:number;origin:'manual'|'ocr';capturedAt:string};
export type ProductChoice = {id:string;name:string;sku:string;price:number};

const fold=(value:string)=>value.toLocaleLowerCase('vi-VN').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
  .replace(/[^a-z0-9\s+\-]/g,' ').replace(/\s+/g,' ').trim();

export const UNKNOWN_AUTHOR='Chưa rõ tên (kiểm tra)';
export function allowedUrl(value:string, platform:Platform){
  try{
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    const domain=platform==='Facebook'?'facebook.com':'tiktok.com';
    return url.protocol==='https:' && (host===domain||host.endsWith(`.${domain}`)) && url.pathname!=='/';
  }catch{return false;}
}

export function identifyOrder(comment:string){
  const text=fold(comment);
  return /(?:^|\s)(?:chot|lay|mua|dat|giu)(?:\s|$)/.test(text)
    || /(?:^|\s)\+\s*\d{1,3}(?:\s|$)/.test(text)
    || /\b\d{1,3}\s*(?:cay|chau|gio|thung)\b/.test(text);
}
export function guessQuantity(comment:string){
  const text=fold(comment);
  const found=text.match(/(?:^|\s)(?:chot|lay|mua|dat|giu)\s*(\d{1,4})\b/)
    || text.match(/(?:^|\s)\+\s*(\d{1,4})\b/)
    || text.match(/\b(\d{1,4})\s*(?:cay|chau|gio|thung)\b/);
  return Math.min(1000,Math.max(1,found?Number(found[1]):1));
}
export function guessVariant(comment:string,products:ProductChoice[]){
  const text=fold(comment);
  const exact=products.filter(p=>p.sku&&new RegExp(`(?:^|\\s)${fold(p.sku).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:\\s|$)`).test(text));
  if(exact.length===1)return exact[0].id;
  const names=products.filter(p=>fold(p.name).length>=6&&text.includes(fold(p.name)));
  return names.length===1?names[0].id:'';
}
export function splitCommentLine(text:string){
  const raw=text.trim().slice(0,1000);
  if(!raw)return null;
  const fields=raw.split(/\s*\|\s*/);
  if(fields.length>=2)return {author:fields[0].trim().slice(0,80),comment:fields[1].trim().slice(0,600),profileUrl:(fields[2]||'').trim().slice(0,500)};
  const colon=raw.match(/^([^:：]{2,80})\s*[:：]\s*(.{1,600})$/);
  if(colon)return {author:colon[1].trim(),comment:colon[2].trim(),profileUrl:''};
  // Screenshots often join a display name with its comment, without a colon.
  const joined=raw.match(/^(.{2,55}?)\s+(chốt\b.+|lấy\b.+|mua\b.+|đặt\b.+|giữ\b.+|\+\s*\d+.*)$/i);
  if(joined)return {author:joined[1].trim(),comment:joined[2].trim(),profileUrl:''};
  return null;
}
const uiNoise=/^(?:thích|trả lời|chia sẻ|gửi|bình luận|phổ biến nhất|mới nhất|trực tiếp|theo dõi|xem thêm|like|reply|follow|share|comment|live|viết bình luận|hãy viết|minutes|\d+\s*(?:phút|giây|giờ|ph|h|s))$/i;
const plausibleName=(s:string)=>s.length>=2&&s.length<=60&&!uiNoise.test(s)&&!identifyOrder(s)
  && !/https?:|\d{4,}|^[-.]+$/.test(s);

export function parseCommentLines(text:string,products:ProductChoice[],origin:'manual'|'ocr'){
  const accepted:Candidate[]=[];
  const lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,300);
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    let entry=splitCommentLine(line);
    if(!entry&&origin==='ocr'&&identifyOrder(line)){
      // OCR may place the profile name 1-3 lines before the text.
      // If uncertain, flag the name instead of inventing an identity.
      let author=UNKNOWN_AUTHOR;
      for(let back=1;back<=3;back++){
        const previous=lines[i-back];
        if(previous&&plausibleName(previous)) {author=previous;break;}
      }
      entry={author,comment:line.slice(0,600),profileUrl:''};
    }
    if(!entry||!identifyOrder(entry.comment)||!entry.author||entry.author.length>80)continue;
    accepted.push({id:crypto.randomUUID(),...entry,variantId:guessVariant(entry.comment,products),
      quantity:guessQuantity(entry.comment),origin,capturedAt:new Date().toISOString()});
  }
  return accepted;
}
export function identity(c:Candidate,platform:Platform,url:string){
  return `${platform}|${url}|${fold(c.author)}|${fold(c.comment)}`;
}
