import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { DAYS, localDate, validateClass, occursOn, nextOccurrence, notificationPlan, parseCSV } from './schedule.js';
const $ = id => document.getElementById(id);
const native = Capacitor.isNativePlatform();
const KEY = 'smartbuddy_schedule';
let schedule = [];
let queue = Promise.resolve();
let weekOffset = 0;
let storageReady = true;
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text) { $('message').textContent = text; }
function render() {
  const now = new Date(); const time=now.toTimeString().slice(0,5);
  $('today').textContent=now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  const current=schedule.find(c=>occursOn(c,now)&&c.start<=time&&time<c.end);
  const next=schedule.map(c=>({c,at:nextOccurrence(c,now)})).filter(x=>x.at>now).sort((a,b)=>a.at-b.at)[0];
  const cls=current||next?.c;
  $('currentClassDisplay').innerHTML=cls?`<h2>${escapeHTML(cls.subject)}</h2><p>${escapeHTML(cls.room)}</p><p class="detail">${current?'Happening now':next.at.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})} · ${cls.start}–${cls.end}</p>`:`<h2>A clear day ahead.</h2><p class="detail">${schedule.length?'No upcoming classes. Upload your next timetable when it arrives.':'Add your first class to get started.'}</p>`;
  $('weekControls').hidden=$('view').value!=='week';
  if($('view').value==='week'){
    const monday=new Date(now);monday.setDate(now.getDate()-(now.getDay()+6)%7+weekOffset*7);monday.setHours(12,0,0,0);
    const dates=Array.from({length:7},(_,i)=>{const date=new Date(monday);date.setDate(date.getDate()+i);return date;});
    $('weekRange').textContent=`${dates[0].toLocaleDateString()} – ${dates[6].toLocaleDateString()}`;
    $('timetableContainer').innerHTML=`<div class="week-grid">${dates.map(date=>`<section class="week-day"><h3>${date.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}</h3>${schedule.filter(c=>occursOn(c,date)).sort((a,b)=>a.start.localeCompare(b.start)).map(c=>`<button class="week-class" data-edit="${c.id}"><strong>${c.start}–${c.end}</strong><span>${escapeHTML(c.subject)}</span><small>${escapeHTML(c.room)}</small></button>`).join('')||'<p class="hint">No classes</p>'}</section>`).join('')}</div>`;
    return;
  }
  const items=schedule.filter(c=>$('view').value==='all'||occursOn(c,now)).sort((a,b)=>{
    if($('view').value==='today')return a.start.localeCompare(b.start);
    return nextOccurrence(a,now)-nextOccurrence(b,now);
  });
  $('timetableContainer').innerHTML=items.length?items.map(c=>`<article class="class-card"><div class="time">${c.start}<span>to ${c.end}</span></div><div><h3>${escapeHTML(c.subject)}</h3><p>${escapeHTML(c.room)}</p>${c.courseCode||c.faculty?`<p>${escapeHTML([c.courseCode,c.faculty].filter(Boolean).join(' · '))}</p>`:''}${c.link?`<p><a href="${escapeHTML(c.link)}" target="_blank" rel="noopener noreferrer">Join online class</a></p>`:''}<p>${c.date?escapeHTML(c.date):`Every ${c.day}`}</p></div><div class="actions"><button class="text-button" data-edit="${c.id}" aria-label="Edit ${escapeHTML(c.subject)}">Edit</button><button class="text-button" data-delete="${c.id}" aria-label="Delete ${escapeHTML(c.subject)}">Delete</button></div></article>`).join(''):`<div class="empty">${schedule.length?'No classes today. Enjoy the breathing room.':'Your timetable starts here. Add a class or import a CSV.'}</div>`;
}
async function persist(next) {
  // Write before changing the view: a failed save must never look successful.
  await Preferences.set({key:KEY,value:JSON.stringify(next)});
  schedule=next; render(); await syncReminders();
}
async function updateReminders() {
  if(!native){$('reminderStatus').textContent='Phone reminders work in the Android or iOS app, including offline. This browser is a timetable preview.';$('enableReminders').hidden=true;return;}
  const permission=await LocalNotifications.checkPermissions();
  if(permission.display!=='granted'){$('reminderStatus').textContent='Allow notifications to receive reminders while the app is closed. If blocked, enable them in phone settings.';return;}
  const pending=await LocalNotifications.getPending();
  if(pending.notifications.length)await LocalNotifications.cancel({notifications:pending.notifications});
  if(Capacitor.getPlatform()==='android'){
    const setting=await LocalNotifications.checkExactNotificationSetting();
    if(setting.exact_alarm!=='granted'){$('reminderStatus').textContent='Enable Alarms & reminders in phone settings for five-minute reminders.';$('enableReminders').textContent='Open alarm settings';return;}
    await LocalNotifications.createChannel({id:'classes',name:'Class reminders',importance:4,visibility:1});
  }
  const plan=notificationPlan(schedule);
  if(plan.notifications.length)await LocalNotifications.schedule({notifications:plan.notifications.map(n=>({...n,channelId:'classes',isExactMandatory:true}))});
  $('enableReminders').textContent='Check reminders';
  $('reminderStatus').textContent=plan.omitted?`${plan.notifications.length} reminders scheduled; ${plan.omitted} exceed the 64-class reminder limit. Reduce classes to enable all reminders.`:`${plan.notifications.length} reminders scheduled on this phone, 5 minutes before class. Weekly classes repeat automatically.`;
}
function syncReminders(){if(!storageReady)return Promise.resolve();queue=queue.catch(()=>{}).then(updateReminders).catch(()=>{$('reminderStatus').textContent='Classes are saved. Reminders could not be scheduled. Check phone permissions and tap Check reminders to retry.';});return queue;}
$('enableReminders').onclick=async()=>{
  try{
    await LocalNotifications.requestPermissions();
    if(Capacitor.getPlatform()==='android'&&(await LocalNotifications.checkExactNotificationSetting()).exact_alarm!=='granted')await LocalNotifications.changeExactNotificationSetting();
    await syncReminders();
  }catch{message('Could not enable reminders. Please check the app permissions in phone settings.');}
};
function repeatFields(){const once=$('repeat').value==='once';$('dateLabel').hidden=!once;$('dayLabel').hidden=once;$('classDate').required=once;}
function openClass(id){
  $('classForm').reset(); const cls=schedule.find(c=>String(c.id)===id);
  $('classId').value=cls?.id||'';$('modalTitle').textContent=cls?'Edit class':'Add class';
  $('subject').value=cls?.subject||'';$('room').value=cls?.room||'';
  $('courseCode').value=cls?.courseCode||'';$('faculty').value=cls?.faculty||'';$('classLink').value=cls?.link||'';
  $('startTime').value=cls?.start||'';$('endTime').value=cls?.end||'';
  $('repeat').value=cls?.date?'once':'weekly';$('classDate').value=cls?.date||localDate(new Date());$('classDay').value=cls?.day||DAYS[new Date().getDay()];
  repeatFields();$('classModal').showModal();
}
$('repeat').onchange=repeatFields;$('addClassBtn').onclick=()=>openClass();$('cancelModalBtn').onclick=()=>$('classModal').close();$('view').onchange=render;
$('previousWeek').onclick=()=>{weekOffset--;render();};$('nextWeek').onclick=()=>{weekOffset++;render();};
$('classForm').onsubmit=async event=>{
  event.preventDefault();
  try{
    const id=$('classId').value||crypto.randomUUID();
    const item=validateClass({id,subject:$('subject').value.trim(),room:$('room').value.trim(),courseCode:$('courseCode').value.trim(),faculty:$('faculty').value.trim(),link:$('classLink').value.trim(),day:$('classDay').value,date:$('repeat').value==='once'?$('classDate').value:'',start:$('startTime').value,end:$('endTime').value});
    if(item.date&&new Date(`${item.date}T${item.start}:00`)<=new Date())throw new Error('Choose a future date and time.');
    await persist([...schedule.filter(c=>String(c.id)!==id),item]);$('classModal').close();
    const tooSoon=item.date&&new Date(`${item.date}T${item.start}:00`)-Date.now()<=300000;
    message(tooSoon?'Class saved. Its five-minute reminder time has already passed.':'Class saved on this device.');
  }catch(error){message(error.message);alert(error.message);}
};
$('timetableContainer').onclick=async event=>{
  const edit=event.target.closest('[data-edit]');if(edit){openClass(edit.dataset.edit);return;}
  const del=event.target.closest('[data-delete]');
  if(del&&confirm('Delete this class and its reminder?'))try{await persist(schedule.filter(c=>String(c.id)!==del.dataset.delete));message('Class deleted.');}catch{message('Could not save changes. Your class has been kept.');}
};
$('uploadBtn').onclick=()=>$('csvFileInput').click();
$('csvFileInput').onchange=async event=>{
  try{
    const file=event.target.files[0];if(!file)return;if(file.size>1000000)throw new Error('Choose a CSV smaller than 1 MB.');
    const imported=parseCSV(await file.text()); const next=[...schedule];let count=0;
    for(const item of imported){if(!next.some(c=>['day','date','start','end','subject','room'].every(k=>(c[k]||'')===(item[k]||'')))){next.push({...item,id:crypto.randomUUID()});count++;}}
    await persist(next);message(`${count} classes imported. Existing classes kept.`);
  }catch(error){message(error.message);}finally{event.target.value='';}
};
$('exportBtn').onclick=async()=>{
  const quote=value=>`"${String(value||'').replaceAll('"','""')}"`;
  const csv=['Day,Start,End,Subject,Room,Date,CourseCode,Faculty,Link',...schedule.map(c=>['day','start','end','subject','room','date','courseCode','faculty','link'].map(k=>quote(c[k])).join(','))].join('\r\n');
  if(native){try{await Share.share({title:'SmartBuddy timetable backup (CSV)',text:csv});}catch{message('Backup sharing was closed. Your timetable is still saved.');}return;}
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='smartbuddy-timetable.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{
  const saved=await Preferences.get({key:KEY});
  const legacy=localStorage.getItem(KEY);
  const raw=saved.value??legacy;const data=raw?JSON.parse(raw):[];
  if(!Array.isArray(data))throw new Error('Invalid storage');
  schedule=data.map(c=>({...validateClass(c),id:String(c.id||crypto.randomUUID())}));
  if(!saved.value&&legacy)await Preferences.set({key:KEY,value:JSON.stringify(schedule)});
}catch{storageReady=false;$('pdfBtn').disabled=true;message('Saved data could not be read. Import your CSV backup to restore it. No saved data has been overwritten.');$('addClassBtn').disabled=true;$('uploadBtn').disabled=true;}
render();syncReminders();setInterval(render,30000);
if(native)App.addListener('appStateChange',({isActive})=>{if(isActive){render();syncReminders();}});

let pdfDraft=null;
$('pdfBtn').onclick=()=>$('pdfFileInput').click();
$('cancelImport').onclick=()=>$('importModal').close();
$('pdfFileInput').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  const year=prompt('What year is this timetable for? (PDF headers may only show day/month.)',String(new Date().getFullYear()));
  if(year===null){event.target.value='';return;}
  if(!/^\d{4}$/.test(year)||+year<2000||+year>2100){message('Enter a year between 2000 and 2100.');event.target.value='';return;}
  $('pdfBtn').disabled=true;message('Reading the PDF on your device…');
  try{
    const {readTimetablePDF}=await import('./pdf-import.js');pdfDraft=await readTimetablePDF(file,+year);
    $('importSummary').textContent=`${pdfDraft.classes.length} classes found · ${pdfDraft.dates[0]} to ${pdfDraft.dates.at(-1)}.${pdfDraft.uncertain?` ${pdfDraft.uncertain} blocks could not be read; add those manually.`:''}`;
    $('importRows').innerHTML=pdfDraft.classes.map((c,i)=>`<fieldset data-row="${i}"><legend>${escapeHTML(c.day)} · ${c.date}</legend><label>Class<input data-field="subject" value="${escapeHTML(c.subject)}" maxlength="100" required></label><label>Venue<input data-field="room" value="${escapeHTML(c.room)}" maxlength="120" required></label><div class="time-fields"><label>Starts<input data-field="start" type="time" value="${c.start}" required></label><label>Ends (estimated)<input data-field="end" type="time" value="${c.end}" required></label></div><label><input type="checkbox" data-field="include" checked> Include this class</label></fieldset>`).join('');
    $('importMode').value='replace';$('importModal').showModal();message('PDF read. Review the detected classes before updating.');
  }catch(error){message(`PDF not imported: ${error.message}`);}finally{$('pdfBtn').disabled=false;event.target.value='';}
};
$('importForm').onsubmit=async event=>{
  event.preventDefault();if(!pdfDraft)return;
  const button=event.submitter;button.disabled=true;
  try{
    const items=[...$('importRows').querySelectorAll('[data-row]')].filter(row=>row.querySelector('[data-field="include"]').checked).map(row=>{
      const source=pdfDraft.classes[+row.dataset.row];
      const known=schedule.find(c=>c.subject===source.subject);
      const cls={courseCode:known?.courseCode||'',faculty:known?.faculty||'',link:known?.link||'',...source,id:crypto.randomUUID()};
      for(const field of ['subject','room','start','end'])cls[field]=row.querySelector(`[data-field="${field}"]`).value.trim();
      return validateClass(cls);
    });
    if(!items.length)throw new Error('Include at least one class.');
    const first=pdfDraft.dates[0],last=pdfDraft.dates.at(-1);
    const next=$('importMode').value==='replace'?schedule.filter(c=>!c.date||c.date<first||c.date>last):[...schedule];
    for(const item of items)if(!next.some(c=>['date','start','end','subject','room'].every(k=>c[k]===item[k])))next.push(item);
    await persist(next);$('importModal').close();pdfDraft=null;$('view').value='all';render();message(`${items.length} dated classes imported. Past reminder times are skipped.`);
  }catch(error){alert(error.message);}finally{button.disabled=false;}
};
