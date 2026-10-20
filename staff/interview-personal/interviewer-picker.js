/* Manual-only interviewer selector for booking forms.
   Usage: await InterviewerPicker.mount({shopSelect,dateInput,startInput,endInput,container,onChange});
   Pass real form elements. No interviewer is ever selected automatically.
   The booking submit handler MUST reject a missing/invalid interviewer and revalidate server-side. */
window.InterviewerPicker=(()=>{
 const sb=window.interviewBookingSupabase;
 if(!sb)console.warn('Set window.interviewBookingSupabase before loading interviewer-picker.js');
 async function available(shop,date,start,end){
  if(!shop||!date||!start||!end||start>=end)return [];
  const {data,error}=await sb.rpc('interview_available_staff',{p_shop:shop,p_date:date,p_start:start,p_end:end});
  if(error)throw error;
  return data||[];
 }
 function mount({shopSelect,dateInput,startInput,endInput,container,onChange=()=>{}}){
  if(!shopSelect||!dateInput||!startInput||!endInput||!container)throw Error('担当者選択に必要な入力欄がありません');
  const label=document.createElement('label');label.textContent='面接担当者（必須・手動選択）';
  const select=document.createElement('select');select.required=true;select.name='interviewer_user_id';
  const status=document.createElement('p');status.setAttribute('aria-live','polite');
  container.replaceChildren(label,select,status);
  let request=0,options=[];
  function setOptions(items){
   select.replaceChildren(new Option('担当者を選択してください',''));
   for(const x of items)select.add(new Option(x.display_name,x.interviewer_user_id));
   select.value='';onChange(null);select.disabled=!items.length;
  }
  async function refresh(){
   const current=++request;options=[];select.disabled=true;setOptions([]);
   const shop=shopSelect.value,date=dateInput.value,start=startInput.value,end=endInput.value;
   if(!shop||!date||!start||!end){status.textContent='店舗・日付・開始時刻・終了時刻を指定してください';return}
   if(start>=end){status.textContent='終了時刻は開始時刻より後にしてください';return}
   status.textContent='対応可能な担当者を確認中…';
   try{const data=await available(shop,date,start,end);if(current!==request)return;options=data;setOptions(data);status.textContent=data.length?'担当者を手動で選択してください':'対応可能な担当者がいません。この時間帯は予約できません。'}
   catch(e){if(current===request){setOptions([]);status.textContent='担当者の取得に失敗しました：'+e.message}}
  }
  for(const input of [shopSelect,dateInput,startInput,endInput])input.addEventListener('change',refresh);
  select.addEventListener('change',()=>onChange(options.find(x=>x.interviewer_user_id===select.value)||null));
  refresh();
  return {select,refresh,async validate(){
   const chosen=select.value;if(!chosen)throw Error('面接担当者を選択してください');
   const current=await available(shopSelect.value,dateInput.value,startInput.value,endInput.value);
   if(!current.some(x=>x.interviewer_user_id===chosen)){await refresh();throw Error('選択した担当者は、この時間帯に対応できません')}
   return chosen;
  }};
 }
 return {mount,available};
})();
