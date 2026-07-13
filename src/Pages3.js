import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { doc, updateDoc, collection, addDoc } from "firebase/firestore";
import { C, D, BRAND, MAX_PLAYERS, DAY_SCHEDULE, PRIVATE_SCHEDULE, AGE_COLORS, SKILL_COLORS, DAY_ABBR, dKey, fmtDate, callEmailAPI, IS, FL, AB, GB, NB, GStyles } from "./constants";

// ── HELPERS ──────────────────────────────────────────────
function parseTime(timeStr){
  if(!timeStr) return null;
  try{
    const startStr = timeStr.split("–")[0].trim();
    const [time, meridiem] = startStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if(meridiem==="PM" && hours!==12) hours+=12;
    if(meridiem==="AM" && hours===12) hours=0;
    return {hours, minutes: minutes||0};
  }catch(e){ return null; }
}

function getMonthDays(year, month){
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const days = [];
  // Pad start
  for(let i=0; i<firstDay; i++) days.push(null);
  for(let d=1; d<=daysInMonth; d++) days.push(new Date(year, month, d));
  // Pad end to complete grid
  while(days.length % 7 !== 0) days.push(null);
  return days;
}

// ── CALENDAR DASHBOARD ────────────────────────────────────
export function CalendarDashboard({bookings, inquiries, confirmBooking, removeBooking, removeInquiry, spotsLeft, getDates, getPrivateDates, blocked}){
  const today = new Date();
  const todayKey = dKey(today);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dropModal, setDropModal] = useState(null); // {booking, targetDate}
  const [dropSess, setDropSess] = useState(null);
  const [noteModal, setNoteModal] = useState(null); // {booking, collection}
  const [noteText, setNoteText] = useState("");
  const [expandedDay, setExpandedDay] = useState(null);
  const [view, setView] = useState("month"); // month | week
  const [movingId, setMovingId] = useState(null);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const allSessions = [
    ...(bookings||[]).map(b=>({...b, _type:"group", _collection:"bookings", _time:b.sessTime})),
    ...(inquiries||[]).map(i=>({...i, _type:"1on1",  _collection:"inquiries", _time:i.slotTime})),
  ];

  function sessionsOnDate(dateKey){
    return allSessions.filter(s=>s.dateKey===dateKey && s.status!=="cancelled" && s.status!=="removed");
  }

  // ── DRAG & DROP ──────────────────────────────────────────
  function onDragStart(e, session){
    setDragItem(session);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e, dateKey){
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(dateKey);
  }

  function onDrop(e, targetDate){
    e.preventDefault();
    setDragOver(null);
    if(!dragItem) return;
    if(dKey(targetDate)===dragItem.dateKey) return; // same date, no move
    setDropModal({booking:dragItem, targetDate});
    setDropSess(null);
    setDragItem(null);
  }

  async function confirmDrop(){
    if(!dropModal||!dropSess) return;
    const {booking:b, targetDate} = dropModal;
    const newDateKey = dKey(targetDate);
    const newDateLabel = fmtDate(targetDate);
    setMovingId(b.id);
    try{
      if(b._type==="1on1"){
        await updateDoc(doc(db,"inquiries",b.id),{
          dateKey:newDateKey, dateLabel:newDateLabel,
          slotId:dropSess.id, slotTime:dropSess.time,
          requestType:null, requestNote:null, movedAt:new Date().toISOString(),
        });
      } else {
        const sched = DAY_SCHEDULE[targetDate.getDay()]||{};
        await updateDoc(doc(db,"bookings",b.id),{
          dateKey:newDateKey, dateLabel:newDateLabel,
          sessId:dropSess.id, sessTime:dropSess.time,
          ageGroup:dropSess.ageGroup, ageTag:dropSess.ageTag,
          skill:sched.skill||b.skill, skillIcon:sched.skillIcon||b.skillIcon,
          requestType:null, requestNote:null, movedAt:new Date().toISOString(),
        });
      }
      try{ await callEmailAPI({...b,dateLabel:newDateLabel,sessTime:dropSess.time},"reschedule"); }catch(e){}
    }finally{
      setMovingId(null);
      setDropModal(null);
      setDropSess(null);
    }
  }

  // ── NOTES ────────────────────────────────────────────────
  function openNote(session){
    setNoteModal(session);
    setNoteText(session.coachNote||"");
  }

  async function saveNote(){
    if(!noteModal) return;
    await updateDoc(doc(db,noteModal._collection,noteModal.id),{
      coachNote:noteText, coachNoteUpdated:new Date().toISOString(),
    });
    setNoteModal(null);
    setNoteText("");
  }

  // ── SESSION CARD ─────────────────────────────────────────
  function SessionChip({session, compact=false}){
    const is1on1 = session._type==="1on1";
    const color = is1on1 ? C.gold : C.red;
    const bg = is1on1 ? "rgba(196,168,76,0.15)" : "rgba(204,34,34,0.15)";
    const border = is1on1 ? `1px solid ${C.gold}33` : `1px solid ${C.red}33`;
    const confirmed = session.status==="confirmed";

    return(
      <div
        draggable
        onDragStart={(e)=>onDragStart(e,session)}
        onClick={(e)=>{e.stopPropagation(); setExpandedDay(session.dateKey===expandedDay?null:session.dateKey);}}
        style={{
          background:bg, border, borderLeft:`3px solid ${color}`,
          borderRadius:6, padding:compact?"3px 6px":"6px 8px",
          cursor:"grab", marginBottom:2, transition:"all 0.15s",
          opacity:movingId===session.id?0.4:1,
        }}
      >
        <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,minWidth:0}}>
            <span style={{fontSize:compact?8:9,flexShrink:0}}>{is1on1?"⚒️":"🔥"}</span>
            <span style={{fontSize:compact?9:10,color:C.white,fontFamily:D.display,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.name}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
            {session.coachNote&&<span style={{fontSize:8,color:C.gold}}>📝</span>}
            {session.requestType&&<span style={{fontSize:8,color:C.silver}}>⚠</span>}
            <div style={{width:5,height:5,borderRadius:"50%",background:confirmed?C.green:C.gold,flexShrink:0}}/>
          </div>
        </div>
        {!compact&&<div style={{fontSize:8,color:"rgba(255,255,255,0.4)",fontFamily:D.body,marginTop:2}}>{session._time?.split("–")[0]?.trim()}</div>}
      </div>
    );
  }

  // ── MONTH CALENDAR ───────────────────────────────────────
  function MonthView(){
    const days = getMonthDays(year, month);
    const todayStr = today.toISOString().split("T")[0];

    return(
      <div>
        {/* Month nav */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"6px 12px",color:C.textMid,cursor:"pointer",fontFamily:D.body,fontSize:11}}>← Prev</button>
          <div style={{fontSize:18,fontWeight:600,color:C.white,fontFamily:D.display}}>{monthNames[month]} {year}</div>
          <button onClick={()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"6px 12px",color:C.textMid,cursor:"pointer",fontFamily:D.body,fontSize:11}}>Next →</button>
        </div>

        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {dayNames.map(d=>(
            <div key={d} style={{textAlign:"center",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,padding:"4px 0"}}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {days.map((d,i)=>{
            if(!d) return <div key={i}/>;
            const dk = dKey(d);
            const daySessions = sessionsOnDate(dk);
            const isToday = dk===todayStr;
            const isPast = dk<todayStr;
            const isExpanded = expandedDay===dk;
            const isDragOver = dragOver===dk;
            const hasCoachDay = DAY_SCHEDULE[d.getDay()]||PRIVATE_SCHEDULE[d.getDay()];

            return(
              <div
                key={i}
                onDragOver={(e)=>onDragOver(e,dk)}
                onDragLeave={()=>setDragOver(null)}
                onDrop={(e)=>onDrop(e,d)}
                onClick={()=>setExpandedDay(isExpanded?null:dk)}
                style={{
                  background:isDragOver?"rgba(196,168,76,0.08)":isToday?"rgba(196,168,76,0.05)":C.card,
                  border:isDragOver?`1px solid ${C.gold}`:`1px solid ${isToday?C.gold+"44":C.cardBorder}`,
                  borderRadius:8, padding:"6px", minHeight:90,
                  cursor:"pointer", transition:"all 0.15s",
                  opacity:isPast&&!daySessions.length?0.4:1,
                }}
              >
                {/* Date number */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{
                    fontSize:12, fontWeight:isToday?700:500,
                    color:isToday?C.gold:C.white, fontFamily:D.display,
                    width:20,height:20,borderRadius:isToday?"50%":"4px",
                    background:isToday?`${C.gold}22`:"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>{d.getDate()}</div>
                  {daySessions.length>0&&(
                    <div style={{fontSize:8,color:C.textDim,fontFamily:D.body}}>
                      {daySessions.length}
                    </div>
                  )}
                </div>

                {/* Session chips */}
                <div>
                  {daySessions.slice(0,3).map((s,si)=>(
                    <SessionChip key={si} session={s} compact={true}/>
                  ))}
                  {daySessions.length>3&&(
                    <div style={{fontSize:8,color:C.textDim,fontFamily:D.body,textAlign:"center",marginTop:2}}>+{daySessions.length-3} more</div>
                  )}
                </div>

                {/* Drop hint */}
                {isDragOver&&(
                  <div style={{textAlign:"center",fontSize:8,color:C.gold,marginTop:4,fontFamily:D.body}}>Drop here</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── WEEK VIEW ────────────────────────────────────────────
  function WeekView(){
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const weekDays = Array.from({length:7},(_,i)=>{
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate()+i);
      return d;
    });

    const timeSlots = [
      "7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM",
      "1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM"
    ];

    return(
      <div>
        <div style={{fontSize:11,letterSpacing:2,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>
          Week of {weekDays[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} — {weekDays[6].toLocaleDateString("en-US",{month:"short",day:"numeric"})}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"60px repeat(7,1fr)",gap:2,overflowX:"auto"}}>
          {/* Header */}
          <div/>
          {weekDays.map((d,i)=>{
            const isToday = dKey(d)===todayKey;
            return(
              <div key={i} style={{textAlign:"center",padding:"6px 4px",background:isToday?`${C.gold}10`:C.card,border:`1px solid ${isToday?C.gold+"44":C.cardBorder}`,borderRadius:6}}>
                <div style={{fontSize:8,color:C.textDim,fontFamily:D.body,letterSpacing:1}}>{dayNames[d.getDay()]}</div>
                <div style={{fontSize:14,fontWeight:isToday?700:500,color:isToday?C.gold:C.white,fontFamily:D.display}}>{d.getDate()}</div>
              </div>
            );
          })}

          {/* Time rows */}
          {timeSlots.map((slot,ti)=>(
            <>
              <div key={`time-${ti}`} style={{fontSize:8,color:C.textDim,fontFamily:D.mono||D.body,textAlign:"right",paddingRight:6,paddingTop:6}}>{slot}</div>
              {weekDays.map((d,di)=>{
                const dk = dKey(d);
                const slotHour = parseInt(slot);
                const isPM = slot.includes("PM");
                const slotH = isPM && slotHour!==12 ? slotHour+12 : (!isPM && slotHour===12 ? 0 : slotHour);

                const daySessions = sessionsOnDate(dk).filter(s=>{
                  const t = parseTime(s._time);
                  if(!t) return false;
                  return t.hours===slotH;
                });

                return(
                  <div
                    key={`cell-${ti}-${di}`}
                    onDragOver={(e)=>onDragOver(e,dk)}
                    onDragLeave={()=>setDragOver(null)}
                    onDrop={(e)=>onDrop(e,d)}
                    style={{
                      background:dragOver===dk?"rgba(196,168,76,0.05)":C.card,
                      border:`1px solid ${dragOver===dk?C.gold+"33":C.cardBorder}`,
                      borderRadius:4, padding:4, minHeight:44,
                      transition:"all 0.15s",
                    }}
                  >
                    {daySessions.map((s,si)=>(
                      <SessionChip key={si} session={s} compact={true}/>
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    );
  }

  // ── TODAY'S ROSTER ───────────────────────────────────────
  function TodayRoster(){
    const todaySessions = sessionsOnDate(todayKey);
    if(todaySessions.length===0) return(
      <div style={{textAlign:"center",padding:"32px 20px",background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12}}>
        <div style={{fontSize:24,marginBottom:8}}>📋</div>
        <div style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>No sessions today</div>
      </div>
    );

    // Group by time
    const groups = {};
    todaySessions.forEach(s=>{
      const key = s._time||"unknown";
      if(!groups[key]) groups[key]={time:s._time, players:[], type:s._type};
      groups[key].players.push(s);
    });

    return(
      <div style={{display:"grid",gap:10}}>
        {Object.values(groups).sort((a,b)=>{
          const ta=parseTime(a.time), tb=parseTime(b.time);
          if(!ta||!tb) return 0;
          return (ta.hours*60+ta.minutes)-(tb.hours*60+tb.minutes);
        }).map((group,gi)=>(
          <div key={gi} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,overflow:"hidden"}}>
            {/* Session header */}
            <div style={{background:group.type==="1on1"?`linear-gradient(135deg,#1a1308,#0f0c05)`:`linear-gradient(135deg,${C.redDark},#150804)`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{group.type==="1on1"?"⚒️":"🔥"}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:C.white,fontFamily:D.display}}>{group.type==="1on1"?"The Tempering":"The Furnace"}</div>
                  <div style={{fontSize:10,color:group.type==="1on1"?C.gold:C.red,fontFamily:D.body}}>{group.time}</div>
                </div>
              </div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{group.players.length} player{group.players.length!==1?"s":""}</div>
            </div>

            {/* Players */}
            <div style={{padding:"8px 12px",display:"grid",gap:6}}>
              {group.players.map((s,si)=>(
                <div key={si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#0a0805",borderRadius:8,border:`1px solid ${s.status==="confirmed"?C.green+"22":C.cardBorder}`,borderLeft:`3px solid ${s.status==="confirmed"?C.green:C.gold}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:3}}>{s.name}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {s.ageGroup&&<span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>👤 {s.ageGroup}</span>}
                      {s.position&&<span style={{fontSize:9,color:C.gold,fontFamily:D.body}}>⚽ {s.position}</span>}
                      {s.phone&&<span style={{fontSize:9,color:C.silverDim,fontFamily:D.body}}>{s.phone}</span>}
                    </div>
                    {s.coachNote&&<div style={{fontSize:9,color:C.gold,marginTop:4,fontFamily:D.body,background:`${C.gold}08`,borderRadius:4,padding:"2px 6px",display:"inline-block"}}>📝 {s.coachNote}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <button onClick={()=>openNote(s)} style={{background:"transparent",border:`1px solid ${s.coachNote?C.gold+"44":C.cardBorder}`,borderRadius:6,padding:"4px 8px",color:s.coachNote?C.gold:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>📝</button>
                    {s.status==="pending"&&<button onClick={()=>confirmBooking(s.id)} style={{background:`${C.green}15`,border:`1px solid ${C.green}44`,borderRadius:6,padding:"4px 8px",color:C.green,fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600}}>✓</button>}
                    <div style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:s.status==="confirmed"?`${C.green}18`:`${C.gold}18`,color:s.status==="confirmed"?C.green:C.gold,fontFamily:D.body}}>{s.status==="confirmed"?"✓":"⏳"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── DROP MODAL ───────────────────────────────────────────
  function DropModal(){
    if(!dropModal) return null;
    const {booking:b, targetDate} = dropModal;
    const is1on1 = b._type==="1on1";
    const sched = is1on1 ? PRIVATE_SCHEDULE[targetDate.getDay()] : DAY_SCHEDULE[targetDate.getDay()];
    if(!sched) return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setDropModal(null)}>
        <div style={{background:"#111",border:`1px solid ${C.red}44`,borderRadius:16,padding:"24px",maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:14,color:C.red,fontFamily:D.body,marginBottom:16}}>No sessions scheduled on {fmtDate(targetDate)}. Pick a valid coaching day.</div>
          <GB onClick={()=>setDropModal(null)}>Close</GB>
        </div>
      </div>
    );

    const slots = is1on1 ? sched.slots : sched.sessions;

    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setDropModal(null)}>
        <div style={{background:"#111",border:`1px solid ${C.gold}44`,borderRadius:16,padding:"24px",maxWidth:460,width:"100%"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>Moving</div>
          <div style={{fontSize:18,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>{b.name}</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginBottom:20}}>→ {fmtDate(targetDate)}</div>

          <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>
            {is1on1?"Select Slot":"Select Session"}
          </div>
          <div style={{display:"grid",gap:8,marginBottom:20}}>
            {slots.map(slot=>{
              const sel = dropSess?.id===slot.id;
              return(
                <button key={slot.id} onClick={()=>setDropSess(slot)}
                  style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:10,padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}}>
                  <span style={{fontSize:13,fontWeight:600,color:sel?C.gold:C.white,fontFamily:D.display}}>{slot.time}</span>
                  {!is1on1&&<span style={{fontSize:10,color:sel?C.gold:C.textDim,fontFamily:D.body}}>{slot.ageGroup}</span>}
                  {sel&&<span style={{fontSize:10,color:C.gold,fontFamily:D.body}}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{display:"flex",gap:10}}>
            <button disabled={!dropSess||movingId} onClick={confirmDrop}
              style={{flex:1,background:dropSess?`linear-gradient(135deg,${C.gold},${C.goldDim})`:"#1a1a1a",border:"none",borderRadius:10,padding:"13px",color:dropSess?"#0a0a0a":C.silverDark,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:dropSess?"pointer":"not-allowed",fontFamily:D.body,fontWeight:700}}>
              {movingId?"Moving…":"Confirm Move"}
            </button>
            <button onClick={()=>setDropModal(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"13px 16px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body}}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NOTE MODAL ───────────────────────────────────────────
  function NoteModal(){
    if(!noteModal) return null;
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setNoteModal(null)}>
        <div style={{background:"#111",border:`1px solid ${C.gold}44`,borderRadius:16,padding:"24px",maxWidth:460,width:"100%"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>Coach Note</div>
          <div style={{fontSize:16,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>{noteModal.name}</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginBottom:16}}>{noteModal.dateLabel} · {noteModal._time}</div>
          <textarea
            value={noteText}
            onChange={e=>setNoteText(e.target.value)}
            placeholder="Session notes, changes, player focus, anything you need to remember..."
            rows={4}
            style={{...IS,width:"100%",marginBottom:14,fontSize:12,resize:"vertical"}}
            autoFocus
          />
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveNote} style={{flex:1,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:10,padding:"12px",color:"#0a0a0a",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>Save Note</button>
            {noteModal.coachNote&&<button onClick={async()=>{await updateDoc(doc(db,noteModal._collection,noteModal.id),{coachNote:"",coachNoteUpdated:new Date().toISOString()});setNoteModal(null);}} style={{background:"transparent",border:`1px solid ${C.redDim}33`,borderRadius:10,padding:"12px 14px",color:C.redDim,fontSize:11,cursor:"pointer",fontFamily:D.body}}>Clear</button>}
            <button onClick={()=>setNoteModal(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 14px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── LEGEND ───────────────────────────────────────────────
  function Legend(){
    return(
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        {[
          {color:C.red,label:"The Furnace (Group)"},
          {color:C.gold,label:"The Tempering (1-on-1)"},
          {color:C.green,label:"Confirmed"},
          {color:C.gold,label:"Pending",dot:true},
        ].map((item,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:item.dot?"50%":2,background:item.color,flexShrink:0}}/>
            <span style={{fontSize:9,color:C.textDim,fontFamily:D.body,letterSpacing:1}}>{item.label}</span>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>⋮ Drag player card to reschedule</span>
        </div>
      </div>
    );
  }

  // ── MAIN RENDER ──────────────────────────────────────────
  const todaySessions = sessionsOnDate(todayKey);

  return(
    <div style={{maxWidth:1100,margin:"0 auto",padding:"32px 24px 100px"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>La Forja</div>
          <h1 style={{margin:0,fontSize:26,fontWeight:600,color:C.white,fontFamily:D.display}}>Session Calendar</h1>
        </div>
        {/* View toggle */}
        <div style={{display:"flex",gap:6}}>
          {[["month","📅 Month"],["week","📋 Week"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{background:view===v?`linear-gradient(135deg,${C.goldDark},#1c0e04)`:C.card,border:view===v?`1px solid ${C.gold}55`:`1px solid ${C.cardBorder}`,color:view===v?C.gold:C.textDim,borderRadius:10,padding:"8px 16px",fontSize:11,letterSpacing:1,cursor:"pointer",fontFamily:D.body,fontWeight:view===v?600:400}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {[
          {label:"Today",value:todaySessions.length,icon:"🔥",color:C.gold},
          {label:"This Month",value:sessionsOnDate.length||allSessions.filter(s=>s.dateKey?.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).length,icon:"📅",color:C.green},
          {label:"Pending",value:(bookings||[]).filter(b=>b.status==="pending").length+(inquiries||[]).filter(i=>i.status==="pending").length,icon:"⏳",color:C.red},
        ].map((s,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:`${s.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontSize:22,fontWeight:700,color:s.color,fontFamily:D.display,lineHeight:1,marginBottom:2}}>{s.value}</div>
              <div style={{fontSize:9,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",fontFamily:D.body}}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{marginBottom:16}}><Legend/></div>

      {/* Calendar */}
      <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"20px",marginBottom:20}}>
        {view==="month" ? <MonthView/> : <WeekView/>}
      </div>

      {/* Today's Roster */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.cardBorder}`}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.green,animation:"pulse 1.5s infinite",flexShrink:0}}/>
          <span style={{fontSize:10,letterSpacing:3,color:C.green,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Today</span>
          <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>— {today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
          <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>· {todaySessions.length} player{todaySessions.length!==1?"s":""}</span>
        </div>
        <TodayRoster/>
      </div>

      {/* Modals */}
      <DropModal/>
      <NoteModal/>
    </div>
  );
}
