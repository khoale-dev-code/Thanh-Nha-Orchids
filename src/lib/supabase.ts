import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export const isCloudMode=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let singleton:SupabaseClient|null=null;
export function browserDb():SupabaseClient|null{
 if(!isCloudMode || typeof window==='undefined')return null;
 if(!singleton)singleton=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return singleton;
}
