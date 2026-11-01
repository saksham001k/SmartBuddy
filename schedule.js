export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const REMINDER_MINUTES = 5;
export function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validateClass(item) {
  if (!item || typeof item.subject !== 'string' || !item.subject.trim() || item.subject.length > 100 || typeof item.room !== 'string' || !item.room.trim() || item.room.length > 120) throw new Error('Enter a class name and venue.');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(item.start) || !time.test(item.end) || item.start >= item.end) throw new Error('End time must be after start time, on the same day.');
  if (item.date) {
    const parsed = new Date(`${item.date}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(+parsed) || localDate(parsed) !== item.date) throw new Error('Choose a valid date.');
  } else if (!DAYS.includes(item.day)) throw new Error('Choose a valid day.');
  if(item.link && !/^https?:\/\//i.test(item.link))throw new Error('Use an https:// or http:// online class link.');
  return item;
}
export function occursOn(item, date) { return item.date ? item.date === localDate(date) : item.day === DAYS[date.getDay()]; }
export function nextOccurrence(item, now = new Date()) {
  if (item.date) return new Date(`${item.date}T${item.start}:00`);
  const date = new Date(now); const [hour, minute] = item.start.split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + (DAYS.indexOf(item.day)-date.getDay()+7)%7);
  if (date <= now) date.setDate(date.getDate()+7);
  return date;
}
export function notificationPlan(items, now = new Date()) {
  const plan = items.map(item => {
    const start = nextOccurrence(item, now);
    const at = new Date(+start - REMINDER_MINUTES*60000);
    if (item.date && at <= now) return null;
    return {
      title: `${item.subject} starts in 5 minutes`, body: `${item.start}–${item.end} · ${item.room}`,
      extra: { classId: item.id },
      schedule: item.date ? { at, allowWhileIdle: true } : {
        on: { weekday: at.getDay()+1, hour: at.getHours(), minute: at.getMinutes() }, repeats: true, allowWhileIdle: true,
      },
      next: at <= now && !item.date ? new Date(+at + 7*86400000) : at,
    };
  }).filter(Boolean).sort((a,b)=>a.next-b.next);
  return { notifications: plan.slice(0,64).map(({next,...entry},i)=>({...entry,id:i+1})), omitted: Math.max(0,plan.length-64) };
}
export function parseCSV(text) {
  const rows=[]; let row=[], field='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(char===',' && !quoted){row.push(field.trim());field='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=char;
  }
  if(quoted)throw new Error('CSV contains an unclosed quote.');
  row.push(field.trim());if(row.some(Boolean))rows.push(row);
  if(rows[0]?.[0].toLowerCase()==='day')rows.shift();
  return rows.map((r,index)=>{
    if(![5,6,9].includes(r.length))throw new Error(`CSV row ${index+2}: use Day,Start,End,Subject,Room,Date (optionally CourseCode,Faculty,Link).`);
    const [day,start,end,subject,room,date='',courseCode='',faculty='',link='']=r;
    try{return validateClass({day,start,end,subject,room,date,courseCode,faculty,link});}catch(error){throw new Error(`CSV row ${index+2}: ${error.message}`);}
  });
}
