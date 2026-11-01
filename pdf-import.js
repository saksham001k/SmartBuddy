import { DAYS, localDate } from './schedule.js';
const DAY_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// This reader targets text-based weekly calendar exports, like scheduler.pdf.
// Text supplies labels; rendered card boundaries supply durations. PDF content
// is treated only as data and never as instructions, HTML, or executable code.
export async function readTimetablePDF(file, year) {
  if(file.size>15*1024*1024)throw new Error('Choose a PDF smaller than 15 MB.');
  const pdfjs=await import('pdfjs-dist');
  const {default:worker}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc=worker;
  const loading=pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false});
  const doc=await loading.promise;
  try{
    if(doc.numPages>12)throw new Error('Import up to 12 timetable pages at a time.');
    const classes=[];const dates=new Set();let uncertain=0;
    for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
      const page=await doc.getPage(pageNumber);const viewport=page.getViewport({scale:1});
      if(viewport.width*viewport.height>6000000)throw new Error('This page is too large to read on-device.');
      const {items}=await page.getTextContent();
      const text=items.filter(i=>i.str?.trim()).map(i=>{const pt=pdfjs.Util.transform(viewport.transform,i.transform);return {text:i.str.trim(),x:pt[4],y:pt[5],height:i.height,width:i.width};});
      const headers=text.map(t=>({...t,match:t.text.match(/\b(SUN|MON|TUE|WED|THU|FRI|SAT)[A-Z]*,?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/i)})).filter(t=>t.match).sort((a,b)=>a.x-b.x);
      const times=text.filter(t=>/^\d{2}:\d{2}$/.test(t.text)).sort((a,b)=>a.y-b.y);
      if(headers.length<5||times.length<2)throw new Error('This PDF layout is not supported yet. Use a text-based weekly calendar with day/date columns and a time axis. Scanned images need manual entry or CSV.');
      const hourScale=(times[1].y-times[0].y)/((minutes(times[1].text)-minutes(times[0].text))/60);
      if(!Number.isFinite(hourScale)||hourScale<=0)throw new Error('Could not identify the time scale.');
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const context=canvas.getContext('2d',{willReadFrequently:true});
      await page.render({canvasContext:context,viewport}).promise;
      const pixels=context.getImageData(0,0,canvas.width,canvas.height);
      const color=(x,y)=>{const p=(Math.floor(y)*canvas.width+Math.floor(x))*4;return pixels.data.subarray(p,p+3);};
      const centers=headers.map(h=>h.x+h.width/2);const columnWidth=(centers.at(-1)-centers[0])/(centers.length-1);
      // Time labels sit inside their row. Find the horizontal grid line above
      // the first label using multiple day columns (ignoring colored cards).
      let origin=null;
      for(let y=Math.floor(times[0].y-4);y>times[0].y-hourScale/2;y--){
        const count=centers.filter(x=>{const c=color(x,y);return Math.max(...c)-Math.min(...c)<12&&c[0]>150&&c[0]<232;}).length;
        if(count>=3){origin=y;break;}
      }
      if(origin===null)throw new Error('Could not locate the calendar grid. Please use CSV or add classes manually.');
      const atY=y=>minutes(times[0].text)+(y-origin)*60/hourScale;
      for(let column=0;column<headers.length;column++){
        const header=headers[column];const [,short,day,month,explicitYear]=header.match;
        const date=new Date(Number(explicitYear||year),Number(month)-1,Number(day),12);
        if(date.getMonth()!==Number(month)-1||date.getDate()!==Number(day)||DAY_SHORT[date.getDay()]!==short.toUpperCase())throw new Error('The PDF dates do not match the selected year. Check the year and retry.');
        dates.add(localDate(date));
        // Vote across each row so white lettering cannot split a class block.
        let top=null;const blocks=[];
        for(let y=origin;y<canvas.height;y++){
          const votes=Array.from({length:60},(_,i)=>centers[column]+(i-30)*columnWidth*.012).filter(x=>{const c=color(x,y);return Math.max(...c)-Math.min(...c)>45&&Math.min(...c)<190;}).length;
          const colored=votes>=6;
          if(colored&&top===null)top=y;
          if((!colored||y===canvas.height-1)&&top!==null){if(y-top>hourScale/5)blocks.push({top,bottom:y});top=null;}
        }
        for(const block of blocks){
          const inside=text.filter(t=>t.x>centers[column]-columnWidth/2&&t.x<centers[column]+columnWidth/2&&t.y>block.top&&t.y<block.bottom).sort((a,b)=>a.y-b.y||a.x-b.x);
          if(inside.length<2){uncertain++;continue;}
          const start=Math.round(atY(block.top)/5)*5;
          // Calendar exports leave a small visual gutter beneath each block.
          // End time is an estimate until the user reviews the import preview.
          const end=Math.round(atY(block.bottom)/5)*5;
          if(start<0||end>=1440||end<=start){uncertain++;continue;}
          classes.push({date:localDate(date),day:DAYS[date.getDay()],start:clock(start),end:clock(end),subject:inside.slice(0,-1).map(t=>t.text).join(' '),room:inside.at(-1).text});
        }
      }
      canvas.width=canvas.height=0;page.cleanup();
    }
    if(!classes.length)throw new Error('No class blocks could be read. Your existing timetable has been kept.');
    return {classes,dates:[...dates].sort(),uncertain};
  }finally{await loading.destroy();}
}
function minutes(value){const [h,m]=value.split(':').map(Number);return h*60+m;}
function clock(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
