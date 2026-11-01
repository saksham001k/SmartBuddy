import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationPlan,validateClass,parseCSV,nextOccurrence} from './schedule.js';
const cls={id:'a',day:'Monday',date:'',subject:'Formal Languages and Automata Theory',room:'10202',start:'09:00',end:'09:55'};
test('dated reminder is exactly five minutes before the class',()=>{
 const result=notificationPlan([{...cls,date:'2026-11-02'}],new Date('2026-11-01T12:00:00'));
 assert.equal(result.notifications[0].schedule.at.getTime(),new Date('2026-11-02T08:55:00').getTime());
});
test('weekly reminders repeat indefinitely with one request per class',()=>{
 const plan=notificationPlan([cls],new Date('2026-11-01T12:00:00')).notifications;
 assert.deepEqual(plan[0].schedule.on,{weekday:2,hour:8,minute:55});assert.equal(plan[0].schedule.repeats,true);
});
test('Monday midnight reminder belongs to Sunday',()=>{
 const plan=notificationPlan([{...cls,start:'00:02',end:'00:55'}]).notifications;
 assert.deepEqual(plan[0].schedule.on,{weekday:1,hour:23,minute:57});
});
test('past and missed dated reminders are skipped',()=>{
 assert.equal(notificationPlan([{...cls,date:'2026-10-26'}],new Date('2026-11-01T12:00:00')).notifications.length,0);
 assert.equal(notificationPlan([{...cls,date:'2026-11-02'}],new Date('2026-11-02T08:58:00')).notifications.length,0);
});
test('notification capacity is reported rather than silently discarded',()=>{
 const result=notificationPlan(Array.from({length:67},(_,id)=>({...cls,id})));
 assert.equal(result.notifications.length,64);assert.equal(result.omitted,3);
});
test('CSV preserves quoted commas, escaped quotes, and dates',()=>{
 const csv='Day,Start,End,Subject,Room,Date\r\nMonday,09:00,09:55,"Probability, Entropy",10202,2026-11-02';
 const [item]=parseCSV(csv);assert.equal(item.subject,'Probability, Entropy');assert.equal(item.date,'2026-11-02');
});
test('invalid dates, times and reverse durations are rejected',()=>{
 for(const patch of [{start:'29:00'},{end:'08:00'},{date:'2026-02-30'},{day:'Unknown'}])assert.throws(()=>validateClass({...cls,...patch}));
});
test('weekly next occurrence moves to next week after the class starts',()=>{
 assert.equal(nextOccurrence(cls,new Date('2026-11-02T10:00:00')).getDate(),9);
});
