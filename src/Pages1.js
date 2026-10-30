import { useState, useEffect } from "react";
import { db } from "./firebase";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, DAY_SCHEDULE, DAY_ABBR, COACH_DAYS, dKey, fmtDate, getDates, callEmailAPI, sendReminderEmail, IS, GStyles, SH, FL, sessMax } from "./constants";

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
  const [dashTab,setDashTab]             = useState("upcoming"); // "upcoming" | "packages" | "testimonials" | "past"
  const [testimonials,setTestimonials]   = useState([]);
  const [pkgReschedItem,setPkgReschedItem]   = useState(null); // single booking from a package
  const [pkgReschedAll,setPkgReschedAll]     = useState(null); // array of all bookings in pkg
  const [pkgReschedDate,setPkgReschedDate]   = useState(null);
  const [pkgReschedSess,setPkgReschedSess]   = useState(null);
  const [pkgReschedLoading,setPkgReschedLoading] = useState(false);
  const [pkgReschedMode,setPkgReschedMode]   = useState("one"); // "one" | "all"

  useEffect(()=>{
    if(!auth) return;
    const unsub = onSnapshot(collection(db,"testimonials"), s=>setTestimonials(s.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[auth]);

  if(!auth) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.black}}>
      <div style={{width:320,padding:32,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:28,marginBottom:8}}>⚙</div>
          <div style={{fontSize:16,color:C.white,fontFamily:D.display,fontWeight:600}}>Coach Dashboard</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:4}}>La Forja · Restricted Access</div>
        </div>
        <input type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&pw===BRAND.coachPw){ signInWithEmailAndPassword(getAuth(),"ccepeda737@gmail.com",pw).catch(()=>{}); setAuth(true); } }}
          style={{...IS,marginBottom:12,textAlign:"center",fontSize:16,letterSpacing:4}}/>
        <button onClick={()=>{ if(pw===BRAND.coachPw){ signInWithEmailAndPassword(getAuth(),"ccepeda737@gmail.com",pw).catch(()=>{}); setAuth(true); } else alert("Wrong password"); }}
          style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:10,padding:"13px",color:C.white,fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
          Enter
        </button>
      </div>
    </div>
  );

  const todayKey = dKey(new Date());
  const now = new Date();

  // Build allSessions combining bookings + inquiries, excluding only truly removed/cancelled
  // awaiting_payment IS shown — these are real clients who started checkout
  const allSessions = [
    ...(bookings||[]).filter(b=>b.status!=="cancelled"&&b.status!=="removed").map(b=>({...b,_type:"group",_coll:"bookings",_time:b.sessTime})),
    ...(inquiries||[]).filter(i=>i.status!=="cancelled"&&i.status!=="removed").map(i=>({...i,_type:"1on1",_coll:"inquiries",_time:i.slotTime})),
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

  // Group bookings by packageGroupId
  const packageGroups = (() => {
    const groups = {};
    const bookingsArr = (bookings||[]).filter(b=>b.status!=="cancelled"&&b.status!=="removed");
    for(const b of bookingsArr){
      const gid = b.packageGroupId || b.id; // single sessions use their own id
      if(!groups[gid]) groups[gid] = {groupId:gid, name:b.name, email:b.email, phone:b.phone, sessions:[], packageName:b.packageName||"Single Session", total:0};
      groups[gid].sessions.push({...b,_coll:"bookings",_time:b.sessTime});
      groups[gid].total += (b.total||b.price||0);
    }
    // Sort sessions within each group by date
    for(const g of Object.values(groups)) g.sessions.sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
    // Return only multi-session packages (packageGroupId exists and >1 session)
    return Object.values(groups).filter(g=>g.sessions.length>1||g.sessions[0]?.packageGroupId).sort((a,b)=>a.sessions[0]?.dateKey.localeCompare(b.sessions[0]?.dateKey));
  })();

  async function doPkgReschedule(){
    if(!pkgReschedDate||!pkgReschedSess) return;
    setPkgReschedLoading(true);
    const targets = pkgReschedMode==="all" ? pkgReschedAll : [pkgReschedItem];
    for(const s of targets){
      await updateDoc(doc(db,"bookings",s.id),{
        dateKey:dKey(pkgReschedDate), dateLabel:fmtDate(pkgReschedDate),
        sessId:pkgReschedSess.id, sessTime:pkgReschedSess.time,
        rescheduledAt:new Date().toISOString(), rescheduledBy:"coach",
      });
      if(s.email){
        const sessLabel = pkgReschedSess.id==="s1"
          ? "🌱 Little Forja · U9–U11 · 4:00 PM"
          : "🔥 The Furnace · U12+ · 5:30 PM";
        await callEmailAPI({
          ...s,
          dateLabel:fmtDate(pkgReschedDate),
          sessTime:pkgReschedSess.time,
          sessId:pkgReschedSess.id,
          sessLabel,
        },"reschedule");
      }
    }
    setPkgReschedItem(null); setPkgReschedAll(null); setPkgReschedDate(null); setPkgReschedSess(null);
    setPkgReschedLoading(false);
  }

  async function saveNote(){
    await updateDoc(doc(db,noteColl,actionItem.id),{coachNote:noteText,coachNoteUpdated:new Date().toISOString()});
    setActionItem(null);
  }

  // Next session slots for dashboard (Fri only)
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
          <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14}}>Upcoming Sessions — Fill Rates</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            {nextFridays.map((d,i)=>{
              const dk=dKey(d);
              const sched=DAY_SCHEDULE[d.getDay()];
              return(
                <div key={i} style={{background:"#0d0b08",borderRadius:10,padding:"12px 14px",border:`1px solid ${C.cardBorder}`}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{fmtDate(d)}</div>
                  {sched.sessions.map(sess=>{
                    const dayNum = d.getDay();
                    const maxP = sessMax(dayNum, sess.id);
                    const confirmed=allSessions.filter(s=>s.dateKey===dk&&s.sessId===sess.id&&s.status==="confirmed").length;
                    const pending=allSessions.filter(s=>s.dateKey===dk&&s.sessId===sess.id&&s.status==="pending").length;
                    const isBlockd=(blocked||[]).some(b=>b.dateKey===dk&&b.sessId===sess.id);
                    const pct=Math.round((confirmed/maxP)*100);
                    return(
                      <div key={sess.id} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{sess.time} · <span style={{color:"#4a9eff"}}>{sess.ageGroup||""}</span></div>
                          <div style={{fontSize:10,color:isBlockd?"#666":confirmed===maxP?C.red:C.silver,fontFamily:D.body}}>{isBlockd?"Blocked":`${confirmed}/${maxP}`}{pending>0&&!isBlockd?` (${pending} pend)`:""}</div>
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

        {/* ── TAB BAR ── */}
        <div style={{display:"flex",gap:4,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:4,marginBottom:20}}>
          {[
            {id:"upcoming",label:`Upcoming (${upcomingSessions.length})`},
            {id:"packages",label:`Packages (${packageGroups.length})`},
            {id:"testimonials",label:`Reviews (${testimonials.filter(t=>t.status==="pending").length} pending)`},
            {id:"past",label:`Past (${pastSessions.length})`},
          ].map(t=>(
            <button key={t.id} onClick={()=>setDashTab(t.id)}
              style={{flex:1,background:dashTab===t.id?`linear-gradient(135deg,${C.red},${C.redDim})`:"transparent",
                border:"none",color:dashTab===t.id?C.white:C.textDim,borderRadius:7,padding:"9px",
                fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:dashTab===t.id?600:400}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── UPCOMING SESSIONS TAB ── */}
        {dashTab==="upcoming"&&(
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
          ):(()=>{
            // Group by dateKey
            const grouped = filteredUpcoming.reduce((acc,s)=>{
              if(!acc[s.dateKey]) acc[s.dateKey]={dateLabel:s.dateLabel,dateKey:s.dateKey,items:[]};
              acc[s.dateKey].items.push(s);
              return acc;
            },{});
            return(
              <div style={{display:"grid",gap:16}}>
                {Object.values(grouped).map((group)=>(
                  <div key={group.dateKey}>
                    {/* Date header */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:3,height:14,background:C.red,borderRadius:2,flexShrink:0}}/>
                      <span style={{fontSize:11,fontWeight:600,color:C.white,fontFamily:D.display,letterSpacing:.5}}>{group.dateLabel}</span>
                      <span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>· {group.items.length} session{group.items.length!==1?"s":""}</span>
                    </div>
                    <div style={{display:"grid",gap:4,paddingLeft:13,borderLeft:`1px solid ${C.cardBorder}`}}>
                      {group.items.map((s,i)=><UpcomingRow key={i} s={s} confirmBooking={confirmBooking} setReminderModal={setReminderModal} setRescheduleItem={setRescheduleItem} setReschedDate={setReschedDate} setReschedSess={setReschedSess} openAction={openAction}/>)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        )}

        {/* ── PACKAGES TAB ── */}
        {dashTab==="packages"&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14,fontWeight:600}}>
            Active Packages — {packageGroups.length} client{packageGroups.length!==1?"s":""}
          </div>
          {packageGroups.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"28px",textAlign:"center",color:C.textDim,fontSize:12,fontFamily:D.body,fontStyle:"italic"}}>No packages yet</div>
          ):(
            <div style={{display:"grid",gap:12}}>
              {packageGroups.map((pkg,i)=>{
                const done  = pkg.sessions.filter(s=>s.dateKey<dKey(new Date())).length;
                const left  = pkg.sessions.filter(s=>s.dateKey>=dKey(new Date())).length;
                const upcoming = pkg.sessions.filter(s=>s.dateKey>=dKey(new Date()));
                return(
                  <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,overflow:"hidden"}}>
                    {/* Package header */}
                    <div style={{background:"#161214",padding:"14px 18px",borderBottom:`1px solid ${C.cardBorder}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display}}>{pkg.name}</span>
                          <span style={{fontSize:8,padding:"3px 10px",borderRadius:8,background:`${C.silver}15`,color:C.silver,fontFamily:D.body,letterSpacing:1,border:`1px solid ${C.silver}25`}}>{pkg.packageName}</span>
                        </div>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                          {pkg.email&&<a href={`mailto:${pkg.email}`} style={{fontSize:10,color:C.textDim,fontFamily:D.body,textDecoration:"none"}}>✉ {pkg.email}</a>}
                          {pkg.phone&&<a href={`tel:${pkg.phone}`} style={{fontSize:10,color:C.textDim,fontFamily:D.body,textDecoration:"none"}}>📞 {pkg.phone}</a>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
                        <div style={{textAlign:"center",background:"#0d0b08",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"8px 14px"}}>
                          <div style={{fontSize:18,fontWeight:700,color:C.green,fontFamily:D.display,lineHeight:1}}>{done}</div>
                          <div style={{fontSize:8,color:C.textDim,fontFamily:D.body,letterSpacing:1}}>Done</div>
                        </div>
                        <div style={{textAlign:"center",background:"#0d0b08",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"8px 14px"}}>
                          <div style={{fontSize:18,fontWeight:700,color:C.red,fontFamily:D.display,lineHeight:1}}>{left}</div>
                          <div style={{fontSize:8,color:C.textDim,fontFamily:D.body,letterSpacing:1}}>Left</div>
                        </div>
                        <div style={{textAlign:"center",background:"#0d0b08",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"8px 14px"}}>
                          <div style={{fontSize:18,fontWeight:700,color:C.silverBright,fontFamily:D.display,lineHeight:1}}>${pkg.total}</div>
                          <div style={{fontSize:8,color:C.textDim,fontFamily:D.body,letterSpacing:1}}>Total</div>
                        </div>
                      </div>
                    </div>
                    {/* Session rows */}
                    <div style={{padding:"12px 18px"}}>
                      <div style={{fontSize:8,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>All Sessions</div>
                      <div style={{display:"grid",gap:6,marginBottom:12}}>
                        {pkg.sessions.map((s,j)=>{
                          const isPast = s.dateKey<dKey(new Date());
                          const isU9 = s.sessId==="s1";
                          return(
                            <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",background:isPast?"#0a0908":"#0d0b0e",borderRadius:8,border:`1px solid ${isPast?"#1a1612":C.cardBorder}`,opacity:isPast?0.5:1,flexWrap:"wrap"}}>
                              <div style={{display:"flex",gap:10,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                                <span style={{fontSize:12,fontWeight:600,color:isPast?C.textDim:C.white,fontFamily:D.display}}>{s.dateLabel}</span>
                                <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>🕐 {s._time||s.sessTime}</span>
                                {isU9
                                  ? <span style={{fontSize:8,padding:"2px 7px",borderRadius:5,background:"#0d1520",border:"1px solid #4a9eff33",color:"#4a9eff",fontFamily:D.body}}>U9–U11</span>
                                  : <span style={{fontSize:8,padding:"2px 7px",borderRadius:5,background:`${C.red}12`,border:`1px solid ${C.red}22`,color:C.red,fontFamily:D.body}}>U12+</span>
                                }
                                <span style={{fontSize:8,padding:"2px 7px",borderRadius:5,background:s.status==="confirmed"?`${C.green}15`:s.status==="pending"?`${C.silver}10`:"#1a1200",color:s.status==="confirmed"?C.green:s.status==="pending"?C.silver:"#c9a84c",fontFamily:D.body,letterSpacing:1}}>{s.status}</span>
                              </div>
                              {!isPast&&(
                                <button onClick={()=>{setPkgReschedItem(s);setPkgReschedAll(upcoming);setPkgReschedDate(null);setPkgReschedSess(null);setPkgReschedMode("one");}}
                                  style={{background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:7,padding:"5px 12px",color:C.silver,fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,flexShrink:0}}>
                                  Move
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Quick action: move all remaining to 4 PM */}
                      {upcoming.length>0&&(
                        <button onClick={()=>{setPkgReschedItem(upcoming[0]);setPkgReschedAll(upcoming);setPkgReschedDate(null);setPkgReschedSess(null);setPkgReschedMode("all");}}
                          style={{background:`${C.silver}08`,border:`1px solid ${C.silver}25`,borderRadius:9,padding:"9px 18px",color:C.silver,fontSize:9,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,width:"100%",textAlign:"center"}}>
                          📅 Reschedule All Remaining ({upcoming.length}) →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* ── TESTIMONIALS TAB ── */}
        {dashTab==="testimonials"&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14,fontWeight:600}}>
            Reviews — {testimonials.length} total · {testimonials.filter(t=>t.status==="pending").length} pending
          </div>
          {testimonials.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"28px",textAlign:"center",color:C.textDim,fontSize:12,fontFamily:D.body,fontStyle:"italic"}}>No reviews yet</div>
          ):(
            <div style={{display:"grid",gap:10}}>
              {["pending","approved","rejected"].map(status=>{
                const group = testimonials.filter(t=>t.status===status);
                if(group.length===0) return null;
                return(
                  <div key={status}>
                    <div style={{fontSize:8,letterSpacing:3,color:status==="pending"?"#c9a84c":status==="approved"?C.green:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:8,fontWeight:600}}>
                      {status==="pending"?"⏳ Pending Approval":status==="approved"?"✓ Live on Site":"✕ Rejected"} ({group.length})
                    </div>
                    {group.map((t,i)=>(
                      <div key={i} style={{background:C.card,border:`1px solid ${status==="pending"?"#c9a84c33":status==="approved"?`${C.green}22`:C.cardBorder}`,borderLeft:`3px solid ${status==="pending"?"#c9a84c":status==="approved"?C.green:C.silverDark}`,borderRadius:10,padding:"14px 16px",marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                              <span style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>{t.name}</span>
                              {t.role&&<span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{t.role}</span>}
                              <span style={{fontSize:12,color:C.red,letterSpacing:1}}>{"★".repeat(t.rating||5)}</span>
                            </div>
                            <p style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.8,margin:"0 0 6px",fontStyle:"italic"}}>"{t.quote}"</p>
                            <div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>{t.submittedAt ? new Date(t.submittedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}</div>
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            {status!=="approved"&&(
                              <button onClick={()=>updateDoc(doc(db,"testimonials",t.id),{status:"approved"})}
                                style={{background:`${C.green}18`,border:`1px solid ${C.green}33`,borderRadius:7,padding:"6px 14px",color:C.green,fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
                                ✓ Approve
                              </button>
                            )}
                            {status==="approved"&&(
                              <button onClick={()=>updateDoc(doc(db,"testimonials",t.id),{status:"pending"})}
                                style={{background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:7,padding:"6px 14px",color:C.silver,fontSize:9,cursor:"pointer",fontFamily:D.body}}>
                                Unpublish
                              </button>
                            )}
                            {status!=="rejected"&&(
                              <button onClick={()=>updateDoc(doc(db,"testimonials",t.id),{status:"rejected"})}
                                style={{background:"transparent",border:`1px solid ${C.redDim}44`,borderRadius:7,padding:"6px 10px",color:C.redDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>
                                ✕
                              </button>
                            )}
                            <button onClick={()=>deleteDoc(doc(db,"testimonials",t.id))}
                              style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"6px 10px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* ── PAST TAB ── */}
        {dashTab==="past"&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14,fontWeight:600}}>
            Past Sessions — {pastSessions.length} total
          </div>
          {pastSessions.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"28px",textAlign:"center",color:C.textDim,fontSize:12,fontFamily:D.body,fontStyle:"italic"}}>No past sessions yet</div>
          ):(()=>{
            const grouped = pastSessions.reduce((acc,s)=>{
              if(!acc[s.dateKey]) acc[s.dateKey]={dateLabel:s.dateLabel,dateKey:s.dateKey,items:[]};
              acc[s.dateKey].items.push(s);
              return acc;
            },{});
            return(
              <div style={{display:"grid",gap:14}}>
                {Object.values(grouped).map((group)=>(
                  <div key={group.dateKey}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:3,height:14,background:C.silverDark,borderRadius:2,flexShrink:0}}/>
                      <span style={{fontSize:11,fontWeight:600,color:C.textMid,fontFamily:D.display,letterSpacing:.5}}>{group.dateLabel}</span>
                      <span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>· {group.items.length} session{group.items.length!==1?"s":""}</span>
                      <span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>· ${group.items.reduce((t,s)=>t+(s.total||s.price||0),0)}</span>
                    </div>
                    <div style={{display:"grid",gap:5,paddingLeft:13,borderLeft:`1px solid ${C.cardBorder}`}}>
                      {group.items.map((s,i)=>(
                        <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 14px",opacity:0.65,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,flexWrap:"wrap"}}>
                              <span style={{fontSize:13,fontWeight:600,color:C.textMid,fontFamily:D.display}}>{s.name}</span>
                              {s.sessId==="s1"&&<span style={{fontSize:7,padding:"1px 6px",borderRadius:5,background:"#0d1520",border:"1px solid #4a9eff33",color:"#4a9eff",fontFamily:D.body}}>U9–U11</span>}
                              {s.sessId==="s2"&&<span style={{fontSize:7,padding:"1px 6px",borderRadius:5,background:`${C.red}10`,border:`1px solid ${C.red}22`,color:C.red,fontFamily:D.body}}>U12+</span>}
                              <span style={{fontSize:7,padding:"1px 6px",borderRadius:5,background:s.status==="confirmed"?`${C.green}12`:`${C.silver}08`,color:s.status==="confirmed"?C.green:C.textDim,fontFamily:D.body}}>{s.status}</span>
                            </div>
                            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                              <span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>🕐 {s._time}</span>
                              {s.email&&<span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>✉ {s.email}</span>}
                            </div>
                            {s.coachNote&&<div style={{fontSize:9,color:C.silverDim,fontFamily:D.body,marginTop:2,fontStyle:"italic"}}>📝 {s.coachNote}</div>}
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                            <span style={{fontSize:11,color:C.silver,fontFamily:D.body,fontWeight:600}}>${s.total||s.price||0}</span>
                            <button onClick={()=>openAction(s)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:"4px 9px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>⋯</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
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
                <div style={{fontSize:9,color:actionItem.status==="confirmed"?C.green:actionItem.status==="awaiting_payment"?"#c9a84c":C.silver,fontFamily:D.body,marginTop:2,letterSpacing:1,textTransform:"uppercase"}}>{actionItem.status==="awaiting_payment"?"⏳ Awaiting Payment":actionItem.status} {actionItem.paymentMethod==="cash"?"· 💵 Cash":""}</div>
                <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:2}}>
                  {actionItem.email&&<a href={`mailto:${actionItem.email}`} style={{fontSize:10,color:C.silver,fontFamily:D.body,textDecoration:"none"}}>✉ {actionItem.email}</a>}
                  {actionItem.phone&&<a href={`tel:${actionItem.phone}`} style={{fontSize:10,color:C.silver,fontFamily:D.body,textDecoration:"none"}}>📞 {actionItem.phone}</a>}
                  {actionItem.parentName&&actionItem.parentName!==actionItem.name&&<span style={{fontSize:10,color:C.textMid,fontFamily:D.body}}>👤 {actionItem.parentName}</span>}
                  {actionItem.count>1&&<span style={{fontSize:10,color:C.textMid,fontFamily:D.body}}>👥 {actionItem.count} players · ${actionItem.total||0}</span>}
                </div>
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
            {actionItem.status==="awaiting_payment"&&(
              <button onClick={()=>confirmBooking(actionItem.id,actionItem._coll||"bookings")}
                style={{display:"block",width:"100%",background:"#1a1200",border:"1px solid #c9a84c55",borderRadius:9,padding:"10px",color:"#c9a84c",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginBottom:8,textAlign:"center",fontWeight:600}}>
                💵 Mark Paid (Manual Override)
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

      {/* ── PACKAGE RESCHEDULE MODAL ── */}
      {pkgReschedItem&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.94)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>{setPkgReschedItem(null);setPkgReschedAll(null);setPkgReschedDate(null);setPkgReschedSess(null);}}>
          <div style={{background:"#111",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"22px",maxWidth:500,width:"100%",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600,color:C.white,fontFamily:D.display}}>Reschedule Session</div>
              <button onClick={()=>setPkgReschedItem(null)} style={{background:"transparent",border:"none",color:C.textDim,fontSize:18,cursor:"pointer"}}>✕</button>
            </div>

            {/* Move one vs all toggle */}
            {pkgReschedAll&&pkgReschedAll.length>1&&(
              <div style={{display:"flex",gap:4,background:"#0d0b08",border:`1px solid ${C.cardBorder}`,borderRadius:9,padding:4,marginBottom:16}}>
                {[{id:"one",label:`Move This Session Only`},{id:"all",label:`Move All ${pkgReschedAll.length} Remaining`}].map(opt=>(
                  <button key={opt.id} onClick={()=>setPkgReschedMode(opt.id)}
                    style={{flex:1,background:pkgReschedMode===opt.id?`linear-gradient(135deg,${C.red},${C.redDim})`:"transparent",border:"none",color:pkgReschedMode===opt.id?C.white:C.textDim,borderRadius:6,padding:"8px 10px",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:pkgReschedMode===opt.id?600:400}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{background:"#0d0b0e",border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:C.textDim,fontFamily:D.body}}>
              {pkgReschedMode==="all"
                ? <span>Moving <strong style={{color:C.white}}>{pkgReschedAll.length} sessions</strong> for <strong style={{color:C.white}}>{pkgReschedItem.name}</strong> to a new time slot</span>
                : <span>Moving <strong style={{color:C.white}}>{pkgReschedItem.name}</strong> — {pkgReschedItem.dateLabel} · {pkgReschedItem._time||pkgReschedItem.sessTime}</span>
              }
            </div>

            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Pick New Date & Time Slot</div>
            <div style={{display:"grid",gap:8,marginBottom:16}}>
              {getDates(8).map((d,i)=>{
                if(pkgReschedMode==="one"&&dKey(d)===pkgReschedItem.dateKey) return null;
                const sched=DAY_SCHEDULE[d.getDay()];
                const isSelDate=pkgReschedDate&&dKey(pkgReschedDate)===dKey(d);
                return(
                  <div key={i} style={{background:isSelDate?`${C.red}06`:C.card,border:`1px solid ${isSelDate?C.red:C.cardBorder}`,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{fmtDate(d)}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {sched.sessions.map(sess=>{
                        const isSel=isSelDate&&pkgReschedSess?.id===sess.id;
                        const isU9=sess.id==="s1";
                        return(
                          <button key={sess.id} onClick={()=>{setPkgReschedDate(d);setPkgReschedSess(sess);}}
                            style={{background:isSel?`${C.red}18`:"#0d0b08",border:`1px solid ${isSel?C.red:C.cardBorder}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:12,fontWeight:600,color:isSel?C.red:C.white,fontFamily:D.display,marginBottom:3}}>{sess.time}</div>
                            <div style={{fontSize:9,color:isU9?"#4a9eff":C.red,fontFamily:D.body,marginBottom:2}}>{sess.ageGroup}</div>
                            <div style={{fontSize:8,color:C.textDim,fontFamily:D.body}}>{sess.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {pkgReschedDate&&pkgReschedSess&&(
              <div style={{background:`${C.green}08`,border:`1px solid ${C.green}22`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:11,color:C.silver,fontFamily:D.body}}>
                ✓ New slot: <strong style={{color:C.white}}>{fmtDate(pkgReschedDate)} · {pkgReschedSess.time}</strong>
                <br/><span style={{fontSize:10,color:C.textDim}}>A reschedule confirmation email will be sent to {pkgReschedItem.email||"the client"}.</span>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setPkgReschedItem(null);setPkgReschedAll(null);setPkgReschedDate(null);setPkgReschedSess(null);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:9,padding:"11px 18px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
              <button disabled={!pkgReschedDate||!pkgReschedSess||pkgReschedLoading} onClick={doPkgReschedule}
                style={{flex:1,background:pkgReschedDate&&pkgReschedSess?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a1a1a",border:"none",color:pkgReschedDate&&pkgReschedSess?C.white:C.textDim,borderRadius:9,padding:"11px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:pkgReschedDate&&pkgReschedSess?"pointer":"not-allowed",fontFamily:D.body,fontWeight:600}}>
                {pkgReschedLoading?"Rescheduling…":pkgReschedMode==="all"?`Move All ${pkgReschedAll?.length} Sessions →`:"Confirm Reschedule →"}
              </button>
            </div>
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

// ── UPCOMING ROW — slim, tap to expand ────────────────────
function UpcomingRow({s,confirmBooking,setReminderModal,setRescheduleItem,setReschedDate,setReschedSess,openAction}){
  const [open,setOpen] = useState(false);
  const accent = s.status==="confirmed"?C.green:s.status==="awaiting_payment"?"#c9a84c":s.status==="pending"?C.silver:C.silverDark;
  const statusLabel = s.status==="confirmed"?"✓":s.status==="awaiting_payment"?"⏳":s.status==="pending"?"·":"?";
  const statusColor = s.status==="confirmed"?C.green:s.status==="awaiting_payment"?"#c9a84c":C.silver;
  return(
    <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${accent}`,borderRadius:9,overflow:"hidden"}}>
      {/* Slim row */}
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8,minWidth:0,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,whiteSpace:"nowrap"}}>{s.name}</span>
          <span style={{fontSize:9,color:C.textDim,fontFamily:D.body,whiteSpace:"nowrap"}}>{s._time}</span>
          {s.sessId==="s1"&&<span style={{fontSize:7,padding:"1px 6px",borderRadius:6,background:"#0d1520",border:"1px solid #4a9eff33",color:"#4a9eff",fontFamily:D.body}}>U9–U11</span>}
          {s.sessId==="s2"&&<span style={{fontSize:7,padding:"1px 6px",borderRadius:6,background:`${C.red}10`,border:`1px solid ${C.red}22`,color:C.red,fontFamily:D.body}}>U12+</span>}
          {s._type==="1on1"&&<span style={{fontSize:7,padding:"1px 6px",borderRadius:6,background:`${C.silver}10`,color:C.silverDim,fontFamily:D.body}}>1:1</span>}
        </div>
        <span style={{fontSize:9,color:statusColor,fontFamily:D.body,fontWeight:600,whiteSpace:"nowrap"}}>{statusLabel}</span>
        <span style={{fontSize:10,color:C.silver,fontFamily:D.body,fontWeight:600,whiteSpace:"nowrap"}}>${s.total||s.price||0}</span>
        <span style={{fontSize:10,color:C.textDim,flexShrink:0,transition:"transform 0.2s",transform:open?"rotate(180deg)":"none"}}>▾</span>
      </div>
      {/* Expanded */}
      {open&&(
        <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:"10px 12px",background:"#0c0b09"}}>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
            {s.email&&<a href={`mailto:${s.email}`} style={{fontSize:10,color:C.silver,fontFamily:D.body,textDecoration:"none"}}>✉ {s.email}</a>}
            {s.phone&&<a href={`tel:${s.phone}`} style={{fontSize:10,color:C.silver,fontFamily:D.body,textDecoration:"none"}}>📞 {s.phone}</a>}
            {s.notes&&<span style={{fontSize:9,color:C.textMid,fontFamily:D.body,fontStyle:"italic"}}>📋 {s.notes}</span>}
            {s.coachNote&&<span style={{fontSize:9,color:C.silver,fontFamily:D.body,fontStyle:"italic"}}>📝 {s.coachNote}</span>}
            {s.paymentMethod==="cash"&&<span style={{fontSize:9,color:"#c9a84c",fontFamily:D.body}}>💵 Cash payment</span>}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {s.status==="awaiting_payment"&&<button onClick={e=>{e.stopPropagation();confirmBooking(s.id,s._coll||"bookings");}} style={{background:"#1a1200",border:"1px solid #c9a84c44",borderRadius:7,padding:"5px 10px",color:"#c9a84c",fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600}}>💵 Mark Paid</button>}
            {s.status==="pending"&&s.paymentMethod!=="cash"&&<button onClick={e=>{e.stopPropagation();confirmBooking(s.id,s._type==="1on1"?"inquiries":"bookings");}} style={{background:`${C.green}18`,border:`1px solid ${C.green}33`,borderRadius:7,padding:"5px 10px",color:C.green,fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600}}>✓ Confirm</button>}
            <button onClick={e=>{e.stopPropagation();setReminderModal(s);}} style={{background:"transparent",border:`1px solid ${C.silver}22`,borderRadius:7,padding:"5px 9px",color:C.silver,fontSize:9,cursor:"pointer",fontFamily:D.body}}>📧</button>
            <button onClick={e=>{e.stopPropagation();setRescheduleItem(s);setReschedDate(null);setReschedSess(null);}} style={{background:"transparent",border:`1px solid ${C.silver}22`,borderRadius:7,padding:"5px 9px",color:C.silver,fontSize:9,cursor:"pointer",fontFamily:D.body}}>📅</button>
            <button onClick={e=>{e.stopPropagation();openAction(s);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"5px 9px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>⋯</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PLAYER CARD (Today's Roster) — tap to expand contact ──
function PlayerCard({s,onAction,onConfirm,onReminder}){
  const [open,setOpen] = useState(false);
  const accent = s.status==="confirmed"?C.green:s.status==="awaiting_payment"?"#c9a84c":s.status==="pending"?C.silver:C.silverDark;
  return(
    <div style={{background:C.card,border:`1px solid ${s.status==="awaiting_payment"?"#c9a84c22":C.cardBorder}`,borderLeft:`3px solid ${accent}`,borderRadius:12,overflow:"hidden"}}>
      {/* Main row — always visible, tap to expand */}
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:3}}>
            <span style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>{s.name}</span>
            {s.status==="confirmed"&&<span style={{fontSize:7,padding:"2px 7px",borderRadius:8,background:`${C.green}18`,color:C.green,fontFamily:D.body,letterSpacing:1,textTransform:"uppercase"}}>✓</span>}
            {s.status==="awaiting_payment"&&<span style={{fontSize:7,padding:"2px 7px",borderRadius:8,background:"#1a1200",border:"1px solid #c9a84c44",color:"#c9a84c",fontFamily:D.body,letterSpacing:1}}>⏳</span>}
            {s.status==="pending"&&<span style={{fontSize:7,padding:"2px 7px",borderRadius:8,background:`${C.silver}12`,color:C.silver,fontFamily:D.body,letterSpacing:1,textTransform:"uppercase"}}>Pending</span>}
            {s.paymentMethod==="cash"&&<span style={{fontSize:7,padding:"2px 7px",borderRadius:8,background:"#1a1200",border:"1px solid #c9a84c33",color:"#c9a84c",fontFamily:D.body}}>💵</span>}
            {s._type==="1on1"&&<span style={{fontSize:7,padding:"2px 7px",borderRadius:8,background:`${C.silver}10`,color:C.silverDim,fontFamily:D.body}}>1:1</span>}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{s._time}</span>
            {s.count>1&&<span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>· {s.count} players</span>}
            <span style={{fontSize:11,color:C.silverBright,fontFamily:D.body,fontWeight:600,marginLeft:"auto"}}>${s.total||s.price||0}</span>
          </div>
        </div>
        <span style={{fontSize:11,color:C.textDim,transition:"transform 0.2s",transform:open?"rotate(180deg)":"none"}}>▾</span>
      </div>

      {/* Expanded: contact + actions */}
      {open&&(
        <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:"10px 14px",background:"#0c0b09"}}>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
            {s.email&&<a href={`mailto:${s.email}`} style={{fontSize:10,color:C.silver,fontFamily:D.body,textDecoration:"none"}}>✉ {s.email}</a>}
            {s.phone&&<a href={`tel:${s.phone}`} style={{fontSize:10,color:C.silver,fontFamily:D.body,textDecoration:"none"}}>📞 {s.phone}</a>}
            {s.parentName&&s.parentName!==s.name&&<span style={{fontSize:10,color:C.textMid,fontFamily:D.body}}>👤 {s.parentName}</span>}
            {s.notes&&<span style={{fontSize:9,color:C.textMid,fontFamily:D.body,fontStyle:"italic"}}>📋 {s.notes}</span>}
            {s.coachNote&&<span style={{fontSize:9,color:C.silver,fontFamily:D.body,fontStyle:"italic"}}>📝 {s.coachNote}</span>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {s.status==="pending"&&(
              <button onClick={e=>{e.stopPropagation();onConfirm(s.id,s._type==="1on1"?"inquiries":"bookings");}}
                style={{flex:1,background:`${C.green}18`,border:`1px solid ${C.green}33`,borderRadius:7,padding:"7px",color:C.green,fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600,letterSpacing:1}}>
                ✓ Confirm
              </button>
            )}
            {s.status==="awaiting_payment"&&(
              <button onClick={e=>{e.stopPropagation();onConfirm(s.id,"bookings");}}
                style={{flex:1,background:"#1a1200",border:"1px solid #c9a84c44",borderRadius:7,padding:"7px",color:"#c9a84c",fontSize:9,cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
                💵 Mark Paid
              </button>
            )}
            <button onClick={e=>{e.stopPropagation();onReminder(s);}} style={{background:"transparent",border:`1px solid ${C.silver}22`,borderRadius:7,padding:"7px 10px",color:C.silver,fontSize:10,cursor:"pointer",fontFamily:D.body}}>📧</button>
            <button onClick={e=>{e.stopPropagation();onAction(s);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"7px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>⋯</button>
          </div>
        </div>
      )}
    </div>
  );
}
