/* Yuori migration adapter. Not activated until schema, owner and RLS are verified.
 * No production writes or credential changes are performed by this module.
 */
const YUORI_DB={
  url:'https://vjjnkflbfsjihwzjsjpr.supabase.co',
  anonKey:'sb_publishable_J5WCsft5jMU2_2qVYXKieg_JfSX5Uos',
  therapistKey:'yuori',
  table:'therapist_sample_pages'
};
function yuoriClient(){
  if(!window.supabase?.createClient)throw new Error('Supabase JS is not loaded');
  return window.supabase.createClient(YUORI_DB.url,YUORI_DB.anonKey);
}
async function yuoriReadPublished(client){
  const {data,error}=await client.from(YUORI_DB.table)
    .select('config').eq('therapist_key',YUORI_DB.therapistKey)
    .maybeSingle();
  if(error)throw error;
  return data?.config??null;
}
let yuoriLoadedRevision=null;
function reiCanonical(value){if(Array.isArray(value))return value.map(reiCanonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,reiCanonical(value[key])]));return value}
async function yuoriReadOwner(client){
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('管理者ログインが必要です');
  const {data,error}=await client.from(YUORI_DB.table)
    .select('config,owner_uid,published,updated_at').eq('therapist_key',YUORI_DB.therapistKey).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('管理権限がないか、ページが未登録です');
  yuoriLoadedRevision=data.updated_at;
  return {user,record:data};
}
async function yuoriSaveOwner(client,config){
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('管理者ログインが必要です');
  if(!yuoriLoadedRevision)throw new Error('保存前に管理データを再読み込みしてください');
  // Never change owner, publication state, or another therapist's record.
  const {data,error}=await client.from(YUORI_DB.table)
    .update({config,updated_at:new Date().toISOString()})
    .eq('therapist_key',YUORI_DB.therapistKey).eq('updated_at',yuoriLoadedRevision).select('therapist_key,updated_at');
  if(error)throw error;
  if(data?.length!==1)throw new Error('他の画面でデータが更新されています。内容をコピーしてから再読み込みしてください。');
  const {data:check,error:checkError}=await client.from(YUORI_DB.table).select('config').eq('therapist_key',YUORI_DB.therapistKey).single();
  if(checkError)throw new Error('保存後の読み取り確認に失敗しました：'+checkError.message);
  if(JSON.stringify(reiCanonical(check?.config))!==JSON.stringify(reiCanonical(config)))throw new Error('保存内容が一致しません。再読み込み前に管理者へ確認してください');
  yuoriLoadedRevision=data[0].updated_at;
}
