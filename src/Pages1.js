import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, DAY_SCHEDULE, DAY_ABBR, COACH_DAYS, dKey, fmtDate, getDates, callEmailAPI, sendReminderEmail, IS, GStyles, SH, FL } from "./constants";

// ── DASHBOARD ─────────────────────────────────────────────
export function Dashboard({bookings,inquiries,confirmBooking,removeBooking,sendReminderEmail,blocked,blockSession,spotsLeft,getDates}){
  const [pw,setPw]           = useState("");
  const [auth,setAuth]       = useState(false);
  const [noteId,setNoteId]   = useState(null);
  const [noteText,setNoteText] = useState("");
  const [noteColl,setNoteColl] = useState("bookings");
  const [reminderModal,setReminderModal] = useState(null);
  const [reminderMsg,setReminderMsg]     = useState("");
  const [sending,setSending]             = useState(false);
  const [actionItem,setActionItem]       = useState(null);
  const [cancelConfirm,setCancelConfirm] = useState(false);
  const [rescheduleItem,setRescheduleItem] = useState(null);
  const [reschedDate,setReschedDate]       = useState(null);
  const [reschedSess,setReschedSess]       = useState(null);
  const [reschedLoading,setReschedLoading] = useState(false);
  const [filterStatus,setFilterStatus]   = useState("all");
  const [searchQ,setSearchQ]             = useState("");

  if(!auth) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.black}}>
      <div style={{width:320,padding:32,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:28,marginBottom:8}}>⚙</div>
          <div style={{fontSize:16,color:C.white,fontFamily:D.display,fontWeight:600}}>Coach Dashboard</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:4}}>La Forja · Restricted Access</div>
        </div>
        <input type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&pw===BRAND.coachPw&&setAuth(true)}
          style={{...IS,marginBottom:12,textAlign:"center",fontSize:16,letterSpacing:4}}/>
        <button onClick={()=>pw===BRAND.coachPw?setAuth(true):alert("Wrong password")}
          style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:10,padding:"13px",color:C.white,fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
          Enter
        </button>
      </div>
    </div>
  );

  const todayKey = dKey(new Date());
  const now = new Date();

  // Build allSessions combining bookings + inquiries, excluding cancelled
  const allSessions = [
    ...(bookings||[]).filter(b=>b.status!=="cancelled"&&b.status!=="removed"&&b.status!=="awaiting_payment").map(b=>({...b,_type:"group",_coll:"bookings",_time:b.sessTime})),
    ...(inquiries||[]).filter(i=>i.status!=="cancelled"&&i.status!=="removed"&&i.status!=="awaiting_payment").map(i=>({...i,_type:"1on1",_coll:"inquiries",_time:i.slotTime})),
  ];

  // Today's sessions
  const todaySessions = allSessions.filter(s=>s.dateKey===todayKey).sort((a,b)=>(a._time||"").localeCompare(b._time||""));

  // Upcoming (after today)
  const upcomingSessions = allSessions.filter(s=>s.dateKey>todayKey).sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||(a._time||"").localeCompare(b._time||""));

  // Past sessions
  const pastSessions = allSessions.filter(s=>s.dateKey<todayKey).sort((a,b)=>b.dateKey.localeCompare(a.dateKey));

  // Stats
  const pendingCount = allSessions.filter(s=>s.status==="pending").length;
  const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay());
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7);
  const weekSessions = allSessions.filter(s=>{ const d=new Date(s.dateKey+"T12:00:00"); return d>=weekStart&&d<weekEnd&&s.status==="confirmed"; });
  const weekRevenue = weekSessions.reduce((s,x)=>s+(x.total||x.price||0),0);
  const totalRevenue = allSessions.filter(s=>s.status==="confirmed").reduce((s,x)=>s+(x.total||x.price||0),0);

  // Filter/search for upcoming
  const filteredUpcoming = upcomingSessions.filter(s=>{
    if(filterStatus!=="all"&&s.status!==filterStatus) return false;
    if(searchQ&&!s.name?.toLowerCase().includes(searchQ.toLowerCase())&&!s.dateLabel?.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  function openAction(item){
    setActionItem(item); setNoteText(item.coachNote||""); setNoteColl(item._coll||"bookings"); setCancelConfirm(false);
  }

  async function doCoachReschedule(){
    if(!reschedDate||!reschedSess||!rescheduleItem) return;
    setReschedLoading(true);
    const coll = rescheduleItem._coll||"bookings";
    await updateDoc(doc(db,coll,rescheduleItem.id),{
      dateKey:dKey(reschedDate), dateLabel:fmtDate(reschedDate),
      sessId:reschedSess.id, sessTime:reschedSess.time,
      rescheduledAt:new Date().toISOString(), rescheduledBy:"coach",
    });
    if(rescheduleItem.email){
      await callEmailAPI({...rescheduleItem, dateLabel:fmtDate(reschedDate), sessTime:reschedSess.time},"reschedule");
    }
    setRescheduleItem(null); setReschedDate(null); setReschedSess(null);
    setReschedLoading(false); setActionItem(null);
  }

  async function saveNote(){
    await updateDoc(doc(db,noteColl,actionItem.id),{coachNote:noteText,coachNoteUpdated:new Date().toISOString()});
    setActionItem(null);
  }

  // Next Friday slots for dashboard
  const nextFridays = getDates(4);

  return(
    <div style={{paddingTop:80,background:C.black,minHeight:"100vh"}}>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 20px 100px"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>La Forja · Coach Dashboard</div>
            <h1 style={{margin:0,fontSize:24,fontWeight:600,color:C.white,fontFamily:D.display}}>{now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</h1>
          </div>
          {pendingCount>0&&(
            <div style={{background:C.redDark,border:`1px solid ${C.red}33`,borderRadius:10,padding:"8px 16px",fontSize:10,color:C.red,fontFamily:D.body,letterSpacing:1}}>
              ⏳ {pendingCount} pending confirmation{pendingCount>1?"s":""}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:24}}>
          {[
            {label:"Today",value:todaySessions.length,color:C.red},
            {label:"Week Sessions",value:weekSessions.length,color:C.green},
            {label:"Week Revenue",value:`$${weekRevenue}`,color:C.silverBright},
            {label:"All Time Revenue",value:`$${totalRevenue.toLocaleString()}`,color:C.textMid},
          ].map((s,i)=>(
            <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:700,color:s.color,fontFamily:D.display,lineHeight:1,marginBottom:3}}>{s.value}</div>
              <div style={{fontSize:8,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Friday Fill Rates */}
        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:20}}>
          <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14}}>Upcoming Fridays</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            {nextFridays.map((d,i)=>{
              const dk=dKey(d);
              const sched=DAY_SCHEDULE[d.getDay()];
              return(
                <div key={i} style={{background:"#0d0b08",borderRadius:10,padding:"12px 14px",border:`1px solid ${C.cardBorder}`}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{fmtDate(d)}</div>
                  {sched.sessions.map(sess=>{
                    const confirmed=allSessions.filter(s=>s.dateKey===dk&&s.sessId===sess.id&&s.status==="confirmed").length;
                    const pending=allSessions.filter(s=>s.dateKey===dk&&s.sessId===sess.id&&s.status==="pending").length;
                    const total=confirmed+pending;
                    const isBlockd=(blocked||[]).some(b=>b.dateKey===dk&&b.sessId===sess.id);
                    const pct=Math.round((confirmed/MAX_PLAYERS)*100);
                    return(
                      <div key={sess.id} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{sess.time.split("–")[0].trim()}</div>
                          <div style={{fontSize:10,color:isBlockd?"#666":confirmed===MAX_PLAYERS?C.red:C.silver,fontFamily:D.body}}>{isBlockd?"Blocked":`${confirmed}/${MAX_PLAYERS}`}{pending>0&&!isBlockd?` (${pending} pending)`:""}</div>
                        </div>
                        {!isBlockd&&(
                          <div style={{height:4,background:"#1a1a1a",borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,background:pct===100?C.red:pct>60?C.silver:C.green,borderRadius:2,transition:"width 0.5s"}}/>
                          </div>
                        )}
                        <button onClick={()=>blockSession(dk,sess.id,fmtDate(d))} style={{marginTop:5,background:"transparent",border:`1px solid ${isBlockd?C.red:C.cardBorder}33`,borderRadius:5,padding:"2px 8px",color:isBlockd?C.red:C.textDim,fontSize:8,cursor:"pointer",fontFamily:D.body}}>
                          {isBlockd?"Unblock":"Block"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's Sessions */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"pulse 1.5s infinite"}}/>
              <span style={{fontSize:11,letterSpacing:3,color:C.green,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Today's Sessions</span>
              <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>· {todaySessions.length} player{todaySessions.length!==1?"s":""}</span>
            </div>
            {todaySessions.length>0&&(
              <button onClick={()=>{setReminderModal({group:true,players:todaySessions});setReminderMsg("");}}
                style={{background:`${C.silver}12`,border:`1px solid ${C.silver}33`,borderRadius:8,padding:"6px 14px",color:C.silver,fontSize:9,cursor:"pointer",fontFamily:D.body,letterSpacing:1}}>
                📧 Send All Reminders
              </button>
            )}
          </div>
          {todaySessions.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"28px",textAlign:"center",color:C.textDim,fontSize:12,fontFamily:D.body,fontStyle:"italic"}}>No sessions today</div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
              {todaySessions.map((s,i)=><PlayerCard key={i} s={s} onAction={openAction} onConfirm={confirmBooking} onReminder={()=>setReminderModal(s)}/>)}
            </div>
          )}
        </div>

        {/* Upcoming Sessions */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:11,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Upcoming Sessions</span>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <input placeholder="Search name..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{...IS,width:160,fontSize:11,padding:"6px 10px"}}/>
              {["all","confirmed","pending"].map(f=>(
                <button key={f} onClick={()=>setFilterStatus(f)} style={{background:filterStatus===f?`${C.red}18`:"transparent",border:`1px solid ${filterStatus===f?C.red:C.cardBorder}`,borderRadius:7,padding:"5px 12px",color:filterStatus===f?C.red:C.textDim,fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {filteredUpcoming.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"28px",textAlign:"center",color:C.textDim,fontSize:12,fontFamily:D.body,fontStyle:"italic"}}>No upcoming sessions</div>
          ):(
            <div style={{display:"grid",gap:8}}>
              {filteredUpcoming.map((s,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${s.status==="confirmed"?C.green:s.status==="pending"?C.silver:C.silverDark}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:180}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>{s.name}</span>
                      <span style={{fontSize:7,padding:"2px 8px",borderRadius:10,background:s.status==="confirmed"?`${C.green}18`:`${C.silver}12`,color:s.status==="confirmed"?C.green:C.silver,fontFamily:D.body,letterSpacing:1,textTransform:"uppercase"}}>{s.status}</span>
                      {s.paymentMethod==="cash"&&<span style={{fontSize:7,padding:"2px 8px",borderRadius:10,background:"#1a1200",border:"1px solid #c9a84c44",color:"#c9a84c",fontFamily:D.body,letterSpacing:1,textTransform:"uppercase"}}>💵 Cash</span>}
                    </div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>📅 {s.dateLabel}</span>
                      <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>🕐 {s._time}</span>
                      <span style={{fontSize:10,color:C.silver,fontFamily:D.body,fontWeight:600}}>${s.total||s.price||0}</span>
                    </div>
                    {s.coachNote&&<div style={{fontSize:9,color:C.silver,fontFamily:D.body,marginTop:4,fontStyle:"italic"}}>📝 {s.coachNote}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    {s.status==="pending"&&s.paymentMethod!=="cash"&&<button onClick={()=>confirmBooking(s.id,s._type==="1on1"?"inquiries":"bookings")} style={{background:`${C.green}18`,border:`1px solid ${C.green}33`,borderRadius:7,padding:"5px 12px",color:C.green,fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600}}>✓ Confirm</button>}
                    <button onClick={()=>setReminderModal(s)} style={{background:"transparent",border:`1px solid ${C.silver}22`,borderRadius:7,padding:"5px 10px",color:C.silver,fontSize:9,cursor:"pointer",fontFamily:D.body}}>📧</button>
                    <button onClick={()=>openAction(s)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"5px 10px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>⋯</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions */}
        {pastSessions.length>0&&(
          <div>
            <details>
              <summary style={{fontSize:11,letterSpacing:3,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,cursor:"pointer",marginBottom:14,userSelect:"none"}}>
                Past Sessions ({pastSessions.length})
              </summary>
              <div style={{display:"grid",gap:6,marginTop:10}}>
                {pastSessions.slice(0,30).map((s,i)=>(
                  <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 14px",opacity:0.7,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.textMid,fontFamily:D.display,marginBottom:2}}>{s.name}</div>
                      <div style={{display:"flex",gap:10}}>
                        <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{s.dateLabel}</span>
                        <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{s._time}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,color:C.silver,fontFamily:D.body}}>${s.total||s.price||0}</span>
                      <button onClick={()=>openAction(s)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:"3px 8px",color:C.textDim,fontSize:8,cursor:"pointer",fontFamily:D.body}}>⋯</button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ── ACTION MODAL ── */}
      {actionItem&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>{setActionItem(null);setCancelConfirm(false);}}>
          <div style={{background:"#111",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"22px",maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:2}}>{actionItem.name}</div>
                <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{actionItem.dateLabel} · {actionItem._time}</div>
                <div style={{fontSize:9,color:actionItem.status==="confirmed"?C.green:C.silver,fontFamily:D.body,marginTop:2,letterSpacing:1,textTransform:"uppercase"}}>{actionItem.status}</div>
              </div>
              <button onClick={()=>setActionItem(null)} style={{background:"transparent",border:"none",color:C.textDim,fontSize:18,cursor:"pointer"}}>✕</button>
            </div>

            {/* Note */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:8,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Coach Note</div>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Session notes, player focus..." rows={3} style={{...IS,fontSize:12,resize:"vertical"}} autoFocus/>
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <button onClick={saveNote} style={{flex:1,background:`linear-gradient(135deg,${C.silver},${C.silverDim})`,border:"none",borderRadius:8,padding:"9px",color:"#0a0a0a",fontSize:9,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>Save Note</button>
                {noteText&&<button onClick={async()=>{await updateDoc(doc(db,noteColl,actionItem.id),{coachNote:"",coachNoteUpdated:new Date().toISOString()});setActionItem(null);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"9px 12px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>Clear</button>}
              </div>
            </div>

            <div style={{borderTop:`1px solid ${C.cardBorder}`,marginBottom:14}}/>

            {/* Actions */}
            {actionItem.status==="confirmed"&&(
              <button onClick={async()=>{await updateDoc(doc(db,noteColl,actionItem.id),{status:"pending"});setActionItem(null);}}
                style={{display:"block",width:"100%",background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:9,padding:"10px",color:C.silver,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginBottom:8,textAlign:"center"}}>
                ↩ Unconfirm
              </button>
            )}
            <button onClick={()=>{setRescheduleItem(actionItem);setReschedDate(null);setReschedSess(null);}}
              style={{display:"block",width:"100%",background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:9,padding:"10px",color:C.silver,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginBottom:8,textAlign:"center"}}>
              📅 Reschedule
            </button>
            {actionItem.status==="pending"&&(
              <button onClick={()=>confirmBooking(actionItem.id,actionItem._coll||"bookings")}
                style={{display:"block",width:"100%",background:`${C.green}18`,border:`1px solid ${C.green}33`,borderRadius:9,padding:"10px",color:C.green,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginBottom:8,textAlign:"center",fontWeight:600}}>
                ✓ Confirm
              </button>
            )}
            {!cancelConfirm?(
              <button onClick={()=>setCancelConfirm(true)} style={{display:"block",width:"100%",background:"transparent",border:`1px solid ${C.redDim}44`,borderRadius:9,padding:"10px",color:C.redDim,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginBottom:8,textAlign:"center"}}>
                ✕ Cancel Session
              </button>
            ):(
              <div style={{background:`${C.red}08`,border:`1px solid ${C.red}33`,borderRadius:9,padding:"12px 14px",marginBottom:8}}>
                <div style={{fontSize:11,color:C.white,fontFamily:D.body,marginBottom:10}}>Cancel <strong>{actionItem.name}</strong>'s session?</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={async()=>{await updateDoc(doc(db,noteColl,actionItem.id),{status:"cancelled",cancelledAt:new Date().toISOString()});setActionItem(null);setCancelConfirm(false);}}
                    style={{flex:1,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:7,padding:"9px",color:C.white,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>Yes, Cancel</button>
                  <button onClick={()=>setCancelConfirm(false)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"9px 14px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Keep</button>
                </div>
              </div>
            )}
            <button onClick={async()=>{if(!window.confirm(`Permanently delete ${actionItem.name}'s record?`)) return; await deleteDoc(doc(db,noteColl,actionItem.id));setActionItem(null);}}
              style={{display:"block",width:"100%",background:"transparent",border:"none",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body,padding:"6px",textAlign:"center",textDecoration:"underline"}}>
              Remove from records
            </button>
          </div>
        </div>
      )}

      {/* ── RESCHEDULE MODAL ── */}
      {rescheduleItem&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>{setRescheduleItem(null);setReschedDate(null);setReschedSess(null);}}>
          <div style={{background:"#111",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"22px",maxWidth:480,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>Reschedule Session</div>
              <button onClick={()=>setRescheduleItem(null)} style={{background:"transparent",border:"none",color:C.textDim,fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginBottom:16}}>Moving: <strong style={{color:C.white}}>{rescheduleItem.name} — {rescheduleItem.dateLabel} · {rescheduleItem._time}</strong></div>
            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Pick New Date & Session</div>
            <div style={{display:"grid",gap:8,marginBottom:16}}>
              {getDates(8).map((d,i)=>{
                if(dKey(d)===rescheduleItem.dateKey) return null;
                const sched=DAY_SCHEDULE[d.getDay()];
                const isSelDate=reschedDate&&dKey(reschedDate)===dKey(d);
                return(
                  <div key={i} style={{background:isSelDate?`${C.red}08`:C.card,border:`1px solid ${isSelDate?C.red:C.cardBorder}`,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{fmtDate(d)}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {sched.sessions.map(sess=>{
                        const isSel=isSelDate&&reschedSess?.id===sess.id;
                        return(
                          <button key={sess.id} onClick={()=>{setReschedDate(d);setReschedSess(sess);}}
                            style={{background:isSel?`${C.red}18`:"#0d0b08",border:`1px solid ${isSel?C.red:C.cardBorder}`,borderRadius:8,padding:"8px 10px",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:11,fontWeight:600,color:isSel?C.red:C.white,fontFamily:D.display,marginBottom:2}}>{sess.time}</div>
                            <div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>{sess.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {reschedDate&&reschedSess&&(
              <div style={{background:`${C.red}08`,border:`1px solid ${C.red}22`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:11,color:C.silver,fontFamily:D.body}}>
                Moving to: <strong style={{color:C.white}}>{fmtDate(reschedDate)} · {reschedSess.time}</strong>
                <br/><span style={{fontSize:10,color:C.textDim}}>A reschedule confirmation email will be sent to {rescheduleItem.email||"the client"}.</span>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setRescheduleItem(null);setReschedDate(null);setReschedSess(null);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:9,padding:"11px 18px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
              <button disabled={!reschedDate||!reschedSess||reschedLoading} onClick={doCoachReschedule}
                style={{flex:1,background:reschedDate&&reschedSess?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a1a1a",border:"none",color:reschedDate&&reschedSess?C.white:C.textDim,borderRadius:9,padding:"11px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:reschedDate&&reschedSess?"pointer":"not-allowed",fontFamily:D.body,fontWeight:600}}>
                {reschedLoading?"Rescheduling…":"Confirm Reschedule →"}
              </button>
            </div>
          </div>
        </div>
      )}
      {reminderModal&&(()=>{
        const isGroup=reminderModal.group;
        const recipients=isGroup?reminderModal.players:[reminderModal];
        const defaultMsg=`Hey ${isGroup?"everyone":"there"}! Just a reminder that you have a La Forja session${reminderModal.time?" at "+reminderModal.time:""}. See you on the field! 🔥`;
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setReminderModal(null)}>
            <div style={{background:"#111",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"22px",maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14}}>{isGroup?`Send to ${recipients.length} player${recipients.length>1?"s":""}`:reminderModal.name}</div>
              <textarea value={reminderMsg||defaultMsg} onChange={e=>setReminderMsg(e.target.value)} rows={4} style={{...IS,fontSize:12,resize:"vertical",marginBottom:12}}/>
              <div style={{display:"flex",gap:8}}>
                <button disabled={sending} onClick={async()=>{
                  setSending(true);
                  const msg=reminderMsg||defaultMsg;
                  for(const r of recipients){
                    if(!r.email){ console.log("No email for",r.name); continue; }
                    await callEmailAPI({...r,message:msg,sessTime:r.sessTime||r.slotTime||r._time||"",dateLabel:r.dateLabel||r.dateKey||"",skill:r.skill||"La Forja Session",skillIcon:"🔥",count:r.count||1,total:r.total||r.price||0,ageGroup:"U11+",ageTag:"u11+"},"reminder");
                  }
                  setSending(false);setReminderModal(null);setReminderMsg("");
                }} style={{flex:1,background:`linear-gradient(135deg,${C.silver},${C.silverDim})`,border:"none",borderRadius:8,padding:"10px",color:"#0a0a0a",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:sending?"wait":"pointer",fontFamily:D.body,fontWeight:700}}>
                  {sending?"Sending…":"Send Reminder"}
                </button>
                <button onClick={()=>setReminderModal(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"10px 14px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── PLAYER CARD (Today's Roster) ──────────────────────────
function PlayerCard({s,onAction,onConfirm,onReminder}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${s.status==="confirmed"?C.green:C.silver}`,borderRadius:12,padding:"12px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <span style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>{s.name}</span>
            <span style={{fontSize:7,padding:"1px 6px",borderRadius:4,background:s.status==="confirmed"?`${C.green}18`:`${C.silver}12`,color:s.status==="confirmed"?C.green:C.silver,fontFamily:D.body}}>{s.status==="confirmed"?"✓":"Pending"}</span>
            {s.paymentMethod==="cash"&&<span style={{fontSize:7,padding:"1px 6px",borderRadius:4,background:"#1a1200",border:"1px solid #c9a84c44",color:"#c9a84c",fontFamily:D.body}}>💵 Cash</span>}
          </div>
          <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>🕐 {s._time}</div>
          {s.email&&<div style={{fontSize:9,color:C.textDim,fontFamily:D.body,marginTop:2}}>{s.email}</div>}
          {s.phone&&<div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>{s.phone}</div>}
          {s.coachNote&&<div style={{fontSize:9,color:C.silver,fontFamily:D.body,marginTop:4,fontStyle:"italic"}}>📝 {s.coachNote}</div>}
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          <button onClick={onReminder} style={{background:"transparent",border:`1px solid ${C.silver}22`,borderRadius:6,padding:"4px 8px",color:C.silver,fontSize:9,cursor:"pointer",fontFamily:D.body}}>📧</button>
          <button onClick={()=>onAction(s)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:"4px 8px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>⋯</button>
        </div>
      </div>
      {s.status==="pending"&&(
        <button onClick={()=>onConfirm(s.id,s._type==="1on1"?"inquiries":"bookings")}
          style={{width:"100%",background:`${C.green}18`,border:`1px solid ${C.green}33`,borderRadius:7,padding:"6px",color:C.green,fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600,letterSpacing:1,marginTop:8}}>
          ✓ Confirm Payment Received
        </button>
      )}
    </div>
  );
}
