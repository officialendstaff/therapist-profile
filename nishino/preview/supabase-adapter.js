/* Rei migration adapter. Not activated until schema, owner and RLS are verified.
 * No production writes or credential changes are performed by this module.
 */
const REI_SAMPLE_DB={
  url:'https://vjjnkflbfsjihwzjsjpr.supabase.co',
  anonKey:'sb_publishable_J5WCsft5jMU2_2qVYXKieg_JfSX5Uos',
  therapistKey:'nishino',
  table:'therapist_sample_pages'
};
function reiSampleClient(){
  if(!window.supabase?.createClient)throw new Error('Supabase JS is not loaded');
  return window.supabase.createClient(REI_SAMPLE_DB.url,REI_SAMPLE_DB.anonKey);
}
async function nishinoReadLegacy(client){
  const [page,photos,sns,schedule,news]=await Promise.all([
    client.from('nishino_page').select('*').eq('id',1).maybeSingle(),
    client.from('nishino_photos').select('image_url,image_data,sort_order').order('sort_order',{ascending:true}),
    client.from('nishino_sns').select('*').eq('id',1).maybeSingle(),
    client.from('nishino_schedule').select('*').gte('schedule_date',new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})).order('schedule_date',{ascending:true}).limit(120),
    client.from('nishino_news').select('title,body,published_at').eq('is_public',true).lte('published_at',new Date().toISOString()).order('published_at',{ascending:false}).limit(3)
  ]);
  if(page.error||!page.data)throw new Error('西野さんの既存データを読み込めません');
  const p=page.data,n=sns.data||{},shifts={};
  for(const row of schedule.data||[]){
    const start=row.base_start||row.today_start,end=row.base_end||row.today_end;
    if(row.base_status==='work'&&start&&end)shifts[row.schedule_date]=start.slice(0,5)+'–'+end.slice(0,5);
  }
  return {
    name:'西野',catch:'薔薇と紳士 · NISHINO',intro:p.intro||'',images:{
      hero:p.hero_image_url||'../main.png.png',personal:p.personal_image_url||'',
      profile:p.profile_image_url||'',calendar:p.calendar_image_url||'',
      working:p.work_image_url||'',off:p.off_image_url||'',soldout:p.full_image_url||''
    },
    photos:(photos.data||[]).map(x=>x.image_url||x.image_data).filter(Boolean),
    sns:{line:n.line_enabled===false?'':n.line_url||'',x:n.x_enabled===false?'':n.x_url||'',sub:n.sns02_enabled===false?'':n.sns02_url||''},
    shifts,newsItems:(news.data||[]).map(x=>({title:x.title,body:x.body,date:x.published_at})),
    phone:'0662145047',shopLine:'https://line.me/R/ti/p/@639kkifl?oat_content=url',
    official:'https://rose-gentleman.com/profile.php?id=146',
    ogp:{title:'西野 | 薔薇と紳士',description:'薔薇と紳士 西野 セラピスト OFFICIAL PAGE',image:p.hero_image_url||''}
  };
}
async function reiSampleReadPublished(client){
  const {data,error}=await client.from(REI_SAMPLE_DB.table)
    .select('config').eq('therapist_key',REI_SAMPLE_DB.therapistKey)
    .maybeSingle();
  if(error)throw error;
  return data?.config??await nishinoReadLegacy(client);
}
let reiSampleLoadedRevision=null;
function reiCanonical(value){if(Array.isArray(value))return value.map(reiCanonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,reiCanonical(value[key])]));return value}
async function reiSampleReadOwner(client){
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('管理者ログインが必要です');
  const {data,error}=await client.from(REI_SAMPLE_DB.table)
    .select('config,owner_uid,published,updated_at').eq('therapist_key',REI_SAMPLE_DB.therapistKey).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('管理権限がないか、ページが未登録です');
  reiSampleLoadedRevision=data.updated_at;
  return {user,record:data};
}
async function reiSampleSaveOwner(client,config){
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('管理者ログインが必要です');
  if(!reiSampleLoadedRevision)throw new Error('保存前に管理データを再読み込みしてください');
  // Never change owner, publication state, or another therapist's record.
  const {data,error}=await client.from(REI_SAMPLE_DB.table)
    .update({config,updated_at:new Date().toISOString()})
    .eq('therapist_key',REI_SAMPLE_DB.therapistKey).eq('updated_at',reiSampleLoadedRevision).select('therapist_key,updated_at');
  if(error)throw error;
  if(data?.length!==1)throw new Error('他の画面でデータが更新されています。内容をコピーしてから再読み込みしてください。');
  const {data:check,error:checkError}=await client.from(REI_SAMPLE_DB.table).select('config').eq('therapist_key',REI_SAMPLE_DB.therapistKey).single();
  if(checkError)throw new Error('保存後の読み取り確認に失敗しました：'+checkError.message);
  if(JSON.stringify(reiCanonical(check?.config))!==JSON.stringify(reiCanonical(config)))throw new Error('保存内容が一致しません。再読み込み前に管理者へ確認してください');
  reiSampleLoadedRevision=data[0].updated_at;
}
