const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const crypto = require('crypto');
const bank = require('./questions.json');
const app = express(); app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server,{cors:{origin:false}});
const rooms=new Map(); const colors=['#57e6ff','#fbbf24','#b794ff','#65eba5','#ff8fa7'];
const clean=(v,n=32)=>String(v||'').replace(/[<>]/g,'').trim().slice(0,n);
const code=()=>{let x;do{x=crypto.randomInt(100000,1000000).toString()}while(rooms.has(x));return x};
function view(r){return {code:r.code,phase:r.phase,teams:r.teams.map(t=>({id:t.id,name:t.name,color:t.color,score:t.score,members:t.members.map(m=>m.name)})),players:r.players.size,round:r.round+1,total:r.questions.length,question:r.phase==='question'?publicQuestion(r):null,deadline:r.deadline,duration:r.duration,answered:r.answers.size,hostOnline:!!r.hostId};}
function publicQuestion(r){let q=bank[r.questions[r.round]];return {kind:q.kind,stem:q.stem,opts:q.opts,tag:q.tag,ch:q.ch,case:q.case};}
const emit=(r)=>io.to(r.code).emit('state',view(r));
function ack(cb,ok,message,data={}){if(typeof cb==='function')cb({ok,message,...data})}
function shuffle(a){let b=[...a];for(let i=b.length-1;i>0;i--){let j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]]}return b}
function reveal(r){if(r.phase!=='question')return;clearTimeout(r.timer);r.phase='reveal';const q=bank[r.questions[r.round]];let results=[];for(const [sid,a] of r.answers){const player=r.players.get(sid);if(!player)continue;let right=q.kind==='order'?JSON.stringify(a.choices)===JSON.stringify(q.correct):a.choices.length===q.correct.length&&a.choices.every(x=>q.correct.includes(x));
 let gained=right?Math.round(500+500*Math.max(0,(r.deadline-a.received)/r.duration)):0;
 const team=r.teams.find(t=>t.id===player.team);if(team)team.score+=gained;results.push({name:player.name,team:player.team,right,points:gained});}
 io.to(r.code).emit('reveal',{correct:q.correct,why:q.why,results});emit(r);}
io.on('connection',socket=>{
 socket.on('create',(data,cb)=>{const cnt=Math.min(5,Math.max(2,Number(data?.count)||3));let names=Array.isArray(data?.names)?data.names:[];let r={code:code(),hostId:socket.id,hostKey:crypto.randomBytes(20).toString('hex'),phase:'lobby',teams:Array.from({length:cnt},(_,i)=>({id:i,name:clean(names[i],23)||`Faction ${i+1}`,color:colors[i],score:0,members:[]})),players:new Map(),answers:new Map(),questions:[],round:-1,deadline:0,duration:30000,timer:null,updated:Date.now()};rooms.set(r.code,r);socket.join(r.code);socket.data.hostRoom=r.code;ack(cb,true,'Room created',{code:r.code,key:r.hostKey});emit(r)});
 socket.on('resumeHost',(data,cb)=>{let r=rooms.get(clean(data?.code,6));if(!r||r.hostKey!==data?.key)return ack(cb,false,'Host credentials invalid');r.hostId=socket.id;socket.data.hostRoom=r.code;socket.join(r.code);ack(cb,true,'Host restored');emit(r)});
 socket.on('preview',(room,cb)=>{let r=rooms.get(clean(room,6));if(!r)return ack(cb,false,'Room not found');ack(cb,true,'Room found',{teams:r.teams.map(t=>({id:t.id,name:t.name,color:t.color})),phase:r.phase})});
 socket.on('join',(data,cb)=>{const c=clean(data?.code,6),name=clean(data?.name,26),team=Number(data?.team),r=rooms.get(c);if(!r)return ack(cb,false,'Room not found');if(r.phase!=='lobby')return ack(cb,false,'Game already started');if(!name)return ack(cb,false,'Enter your name');if(!Number.isInteger(team)||!r.teams[team])return ack(cb,false,'Select a faction');if([...r.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return ack(cb,false,'Name already taken in this room');if(r.players.size>=100)return ack(cb,false,'Room is full');r.players.set(socket.id,{name,team});r.teams[team].members.push({id:socket.id,name});socket.join(c);socket.data.playerRoom=c;ack(cb,true,'You joined',{name,team});emit(r)});
 socket.on('start',(data,cb)=>{let r=rooms.get(clean(data?.code,6));if(!r||r.hostId!==socket.id)return ack(cb,false,'Only the host can start');if(r.phase!=='lobby'&&r.phase!=='finished')return ack(cb,false,'Round already running');if(r.players.size<2)return ack(cb,false,'Need at least 2 players');r.questions=shuffle(bank.map((_,i)=>i)).slice(0,[10,20,33].includes(Number(data?.length))?Number(data.length):10);r.duration=Math.max(15000,Math.min(90000,Number(data?.seconds||45)*1000));r.round=-1;r.answers.clear();r.teams.forEach(t=>t.score=0);r.phase='reveal';ack(cb,true,'Starting');next(r)});
 function next(r){clearTimeout(r.timer);r.round++;if(r.round>=r.questions.length){r.phase='finished';io.to(r.code).emit('finished',view(r));emit(r);return}r.answers=new Map();r.phase='question';r.deadline=Date.now()+r.duration;emit(r);r.timer=setTimeout(()=>reveal(r),r.duration)}
 socket.on('next',(data,cb)=>{let r=rooms.get(clean(data?.code,6));if(!r||r.hostId!==socket.id)return ack(cb,false,'Only the host controls questions');if(r.phase!=='reveal')return ack(cb,false,'Wait for reveal');next(r);ack(cb,true,'Next question')});
 socket.on('revealNow',(data,cb)=>{let r=rooms.get(clean(data?.code,6));if(!r||r.hostId!==socket.id)return ack(cb,false,'Only the host can reveal');reveal(r);ack(cb,true,'Answers revealed')});
 socket.on('answer',(data,cb)=>{let r=rooms.get(clean(data?.code,6)),p=r?.players.get(socket.id);if(!p)return ack(cb,false,'Join the room first');if(r.phase!=='question'||Date.now()>r.deadline)return ack(cb,false,'Time expired');if(r.answers.has(socket.id))return ack(cb,false,'Already answered');const q=bank[r.questions[r.round]],a=data?.choices;if(!Array.isArray(a)||!a.length||a.some(x=>!Number.isInteger(x)||x<0||x>=q.opts.length)||new Set(a).size!==a.length)return ack(cb,false,'Invalid answer');if(q.kind==='single'&&a.length!==1)return ack(cb,false,'Choose one answer');r.answers.set(socket.id,{choices:[...a],received:Date.now()});ack(cb,true,'Answer locked');emit(r);if(r.answers.size===r.players.size)reveal(r)});
 socket.on('disconnect',()=>{if(socket.data.hostRoom){let r=rooms.get(socket.data.hostRoom);if(r&&r.hostId===socket.id){r.hostId=null;emit(r)}}if(socket.data.playerRoom){let r=rooms.get(socket.data.playerRoom);if(r&&r.phase==='lobby'){let p=r.players.get(socket.id);if(p){r.teams[p.team].members=r.teams[p.team].members.filter(m=>m.id!==socket.id);r.players.delete(socket.id);emit(r)}}}})
});
setInterval(()=>{for(const [c,r] of rooms)if(!r.hostId&&Date.now()-r.updated>12*60*60*1000){clearTimeout(r.timer);rooms.delete(c)}},3600000);
server.listen(process.env.PORT||3000,()=>console.log('Code Blue running'));
