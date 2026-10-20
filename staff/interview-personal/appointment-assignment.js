// Enhancement for the personal interview page: manual-only assignment.
// The underlying appointment record is rechecked before every save.
const originalLoadAppointments=loadAppointments;
loadAppointments=async function(){
 await originalLoadAppointments();
 if(!user||!profile)return;
 const {data,error}=await sb.from('staff_interviews')
  .select('id,shop,interview_date,interview_time,interviewer_user_id,status')
  .in('shop',profile.stores).order('interview_date').order('interview_time');
 if(error)return message(error.message,true);
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const rows=(data||[]).filter(x=>x.interview_date>=today&&['面接予定','日程変更'].includes(x.status));
 const items=Array.from(document.querySelectorAll('#appointments li'));
 for(let i=0;i<rows.length;i++){
  const x=rows[i],item=items[i];if(!item)continue;
  const start=String(x.interview_time).slice(0,5);
  const finish=Number(start.slice(0,2))*60+Number(start.slice(3))+60;
  if(finish>=1440)continue;
  const end=String(Math.floor(finish/60)).padStart(2,'0')+':'+String(finish%60).padStart(2,'0');
  const args={p_shop:x.shop,p_date:x.interview_date,p_start:start,p_end:end};
  const picker=document.createElement('select');
  picker.append(new Option('担当者を手動で選択',''));
  const button=document.createElement('button');button.textContent='担当者を保存';
  const note=document.createElement('small');note.style.display='block';
  button.disabled=true;picker.disabled=true;
  item.append(picker,button,note);
  const result=await sb.rpc('interview_available_staff',args);
  if(result.error){note.textContent=result.error.message;continue}
  for(const p of result.data||[])picker.add(new Option(p.display_name,p.interviewer_user_id));
  picker.disabled=!(result.data||[]).length;
  note.textContent=picker.disabled?'対応可能な担当者はいません':'手動で選択してください';
  picker.onchange=()=>button.disabled=!picker.value||picker.value===x.interviewer_user_id;
  button.onclick=async()=>{
   button.disabled=true;
   const selected=picker.value;if(!selected)return;
   const check=await sb.rpc('interview_available_staff',args);
   if(check.error||!(check.data||[]).some(p=>p.interviewer_user_id===selected)){
    note.textContent='対応状況が変更されました。再読み込みしてください';return;
   }
   const save=await sb.rpc('assign_interview_interviewer',{p_interview_id:x.id,p_interviewer_user_id:selected});
   if(save.error){note.textContent='保存失敗：'+save.error.message;return}
   message('担当者を保存しました');await loadAppointments();
  };
 }
};
