/* Rei migration adapter. Not activated until schema, owner and RLS are verified.
 * No production writes or credential changes are performed by this module.
 */
const REI_SAMPLE_DB={
  url:'https://vjjnkflbfsjihwzjsjpr.supabase.co',
  anonKey:'sb_publishable_J5WCsft5jMU2_2qVYXKieg_JfSX5Uos',
  therapistKey:'rei',
  table:'therapist_sample_pages'
};
function reiSampleClient(){
  if(!window.supabase?.createClient)throw new Error('Supabase JS is not loaded');
  return window.supabase.createClient(REI_SAMPLE_DB.url,REI_SAMPLE_DB.anonKey);
}
async function reiSampleReadPublished(client){
  const {data,error}=await client.from(REI_SAMPLE_DB.table)
    .select('config').eq('therapist_key',REI_SAMPLE_DB.therapistKey)
    .eq('published',true).maybeSingle();
  if(error)throw error;
  return data?.config??null;
}
async function reiSampleReadOwner(client){
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('管理者ログインが必要です');
  const {data,error}=await client.from(REI_SAMPLE_DB.table)
    .select('config,owner_uid,published').eq('therapist_key',REI_SAMPLE_DB.therapistKey).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('管理権限がないか、ページが未登録です');
  return {user,record:data};
}
async function reiSampleSaveOwner(client,config){
  const {user,record}=await reiSampleReadOwner(client);
  if(!record)throw new Error('管理対象ページが未登録です');
  // Never change owner, publication state, or another therapist's record.
  const {data,error}=await client.from(REI_SAMPLE_DB.table)
    .update({config,updated_at:new Date().toISOString()})
    .eq('therapist_key',REI_SAMPLE_DB.therapistKey).select('therapist_key');
  if(error)throw error;
  if(data?.length!==1)throw new Error('更新件数を確認できませんでした');
}
