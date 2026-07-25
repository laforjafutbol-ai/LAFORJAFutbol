import { useState, useEffect } from "react";
import { db, auth, googleProvider } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, POSITIONS, DAY_SCHEDULE, COACH_DAYS, dKey, fmtDate, getDates, callEmailAPI, IS, SH, FL, SC, AB, GB } from "./constants";

// ── AUTH PAGE ─────────────────────────────────────────────
export function AuthPage({setPage,authChecked,user}){
  const [mode,setMode]   = useState("login");
  const [name,setName]   = useState("");
  const [email,setEmail] = useState("");
  const [pw,setPw]       = useState("");
  const [err,setErr]     = useState("");
  const [busy,setBusy]   = useState(false);
  const [resetSent,setResetSent] = useState(false);

  useEffect(()=>{ if(authChecked&&user) setPage("account"); },[authChecked,user]);

  async function handleEmailAuth(e){
    e.preventDefault(); setErr(""); setBusy(true);
    try{
      if(mode==="signup"){
        const cred=await createUserWithEmailAndPassword(auth,email,pw);
        if(name) await updateProfile(cred.user,{displayName:name});
      } else {
        await signInWithEmailAndPassword(auth,email,pw);
      }
      setPage("account");
    }catch(e){ setErr(e.message?.replace("Firebase: ","").replace(/\(auth\/.*\)/,"").trim()||"Something went wrong"); }
    setBusy(false);
  }

  async function handleGoogle(){
    setBusy(true); setErr("");
    try{ await signInWithPopup(auth,googleProvider); setPage("account"); }
    catch(e){ setErr("Google sign in failed"); }
    setBusy(false);
  }

  async function handleReset(e){
    e.preventDefault(); setErr(""); setBusy(true);
    try{ await sendPasswordResetEmail(auth,email); setResetSent(true); }
    catch(e){ setErr("Could not send reset email"); }
    setBusy(false);
  }

  if(mode==="reset") return(
    <div style={{maxWidth:420,margin:"60px auto",padding:"0 24px"}}>
      <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"32px 28px"}}>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:24,marginBottom:8}}>🔑</div><div style={{fontSize:18,fontWeight:600,color:C.white,fontFamily:D.display}}>Reset Password</div></div>
        {resetSent?(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:13,color:C.green,fontFamily:D.body,marginBottom:16}}>Reset link sent to {email}</div>
            <button onClick={()=>setMode("login")} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:12,textDecoration:"underline"}}>Back to Sign In</button>
          </div>
        ):(
          <form onSubmit={handleReset}>
            <div style={{marginBottom:14}}><div style={{fontSize:9,letterSpacing:2,color:C.textDim,marginBottom:6,fontFamily:D.body,textTransform:"uppercase"}}>Email</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{...IS}}/></div>
            {err&&<div style={{color:C.red,fontSize:11,fontFamily:D.body,marginBottom:12}}>{err}</div>}
            <button type="submit" disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1}}>{busy?"Sending…":"Send Reset Link"}</button>
            <button type="button" onClick={()=>setMode("login")} style={{width:"100%",marginTop:10,background:"none",border:"none",color:C.textDim,cursor:"pointer",fontFamily:D.body,fontSize:11}}>← Back to Sign In</button>
          </form>
        )}
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:420,margin:"60px auto",padding:"0 24px"}}>
      <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"32px 28px"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:24,marginBottom:8}}>{mode==="signup"?"⚒️":"🔥"}</div>
          <div style={{fontSize:18,fontWeight:600,color:C.white,fontFamily:D.display}}>{mode==="signup"?"Create Account":"Welcome Back"}</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:4}}>La Forja Futbol</div>
        </div>
        <form onSubmit={handleEmailAuth}>
          {mode==="signup"&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,letterSpacing:2,color:C.textDim,marginBottom:6,fontFamily:D.body,textTransform:"uppercase"}}>Name</div>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} required style={{...IS}}/>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:2,color:C.textDim,marginBottom:6,fontFamily:D.body,textTransform:"uppercase"}}>Email</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{...IS}}/>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:9,letterSpacing:2,color:C.textDim,marginBottom:6,fontFamily:D.body,textTransform:"uppercase"}}>Password</div>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} required minLength={6} style={{...IS}}/>
          </div>
          {err&&<div style={{color:C.red,fontSize:11,fontFamily:D.body,marginBottom:12,lineHeight:1.5}}>{err}</div>}
          <button type="submit" disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1,marginBottom:12}}>
            {busy?"Please wait…":mode==="signup"?"Create Account":"Sign In"}
          </button>
        </form>
        <button onClick={handleGoogle} disabled={busy} style={{width:"100%",background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.silver,borderRadius:10,padding:"12px",fontSize:11,cursor:"pointer",fontFamily:D.body,marginBottom:16}}>
          Continue with Google
        </button>
        <div style={{textAlign:"center",fontSize:11,color:C.textDim,fontFamily:D.body}}>
          {mode==="login"?(
            <span>No account? <button onClick={()=>setMode("signup")} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:11,textDecoration:"underline"}}>Sign Up</button> · <button onClick={()=>setMode("reset")} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:11,textDecoration:"underline"}}>Forgot Password</button></span>
          ):(
            <span>Have an account? <button onClick={()=>setMode("login")} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:11,textDecoration:"underline"}}>Sign In</button></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ACCOUNT PAGE ──────────────────────────────────────────
export function AccountPage({setPage,user,authChecked,bookings,inquiries,getDates,getPrivateDates}){
  const [players,setPlayers]         = useState([]);
  const [playersLoaded,setPlayersLoaded] = useState(false);
  const [showPast,setShowPast]       = useState(false);
  const [showPlayers,setShowPlayers] = useState(false);
  const [rescheduleSession,setRescheduleSession] = useState(null);
  const [reschedDate,setReschedDate] = useState(null);
  const [reschedSess,setReschedSess] = useState(null);
  const [reschedLoading,setReschedLoading] = useState(false);

  // Load player profiles
  useEffect(()=>{
    if(!user) return;
    const unsub=onSnapshot(collection(db,"users",user.uid,"players"),s=>{
      setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));
      setPlayersLoaded(true);
    });
    return unsub;
  },[user]);

  // Link guest bookings
  useEffect(()=>{
    if(!user||!user.email) return;
    async function link(){
      try{
        const bs=await import("firebase/firestore").then(m=>m.getDocs(m.query(collection(db,"bookings"),m.where("email","==",user.email))));
        for(const d of bs.docs){ if(!d.data().userId) await updateDoc(doc(db,"bookings",d.id),{userId:user.uid}); }
      }catch(e){}
    }
    link();
  },[user?.uid]);

  useEffect(()=>{ if(authChecked&&!user) setPage("login"); },[authChecked,user]);
  if(!authChecked) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",paddingTop:80}}><div style={{fontSize:11,color:C.textDim,fontFamily:D.body,letterSpacing:4}}>Loading…</div></div>;
  if(!user) return null;

  const email = user.email||"";
  const myBookings  = (bookings||[]).filter(b=>b.userId===user.uid||(b.email&&b.email.toLowerCase()===email.toLowerCase()));
  const myInquiries = (inquiries||[]).filter(i=>i.userId===user.uid||(i.email&&i.email.toLowerCase()===email.toLowerCase()));
  const allSessions = [
    ...myBookings.filter(b=>b.status!=="cancelled"&&b.status!=="removed").map(b=>({...b,type:"group",_coll:"bookings",_time:b.sessTime})),
    ...myInquiries.filter(i=>i.status!=="cancelled"&&i.status!=="removed").map(i=>({...i,type:"1on1",_coll:"inquiries",_time:i.slotTime})),
  ].sort((a,b)=>a.dateKey?.localeCompare(b.dateKey)||0);

  const todayKey = dKey(new Date());
  const upcoming = allSessions.filter(s=>s.dateKey>=todayKey);
  const past     = allSessions.filter(s=>s.dateKey<todayKey).reverse();
  const nextSession = upcoming[0]||null;
  const completedCount = past.filter(s=>s.status==="confirmed"||s.status==="scheduled").length;

  async function handleSignOut(){ await signOut(auth); setPage("home"); }

  // Self-serve reschedule
  async function doReschedule(){
    if(!reschedDate||!reschedSess||!rescheduleSession) return;
    setReschedLoading(true);
    const coll=rescheduleSession._coll||"bookings";
    await updateDoc(doc(db,coll,rescheduleSession.id),{
      dateKey:dKey(reschedDate), dateLabel:fmtDate(reschedDate),
      sessId:reschedSess.id, sessTime:reschedSess.time,
      rescheduledAt:new Date().toISOString(),
      status:"pending",
    });
    if(rescheduleSession.email) await callEmailAPI({...rescheduleSession,dateLabel:fmtDate(reschedDate),sessTime:reschedSess.time,message:"Your La Forja session has been rescheduled."},"reminder");
    setRescheduleSession(null); setReschedDate(null); setReschedSess(null);
    setReschedLoading(false);
  }

  const availDates = getDates(8);

  return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"80px 20px 80px"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div>
          <div style={{fontSize:8,letterSpacing:5,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:5}}>La Forja</div>
          <div style={{fontSize:26,fontWeight:600,color:C.white,fontFamily:D.display,letterSpacing:1,marginBottom:3}}>{user.displayName?.split(" ")[0]||"Welcome back"}</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{email}</div>
        </div>
        <button onClick={handleSignOut} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:8,padding:"8px 16px",fontSize:9,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginTop:4}}>Sign Out</button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:24}}>
        {[
          {label:"Upcoming",value:upcoming.length,color:C.red},
          {label:"Completed",value:completedCount,color:C.green},
          {label:"Players",value:players.length,color:C.silverBright},
        ].map((s,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"16px 12px",textAlign:"center"}}>
            <div style={{fontSize:30,fontWeight:700,color:s.color,fontFamily:D.display,lineHeight:1,marginBottom:5}}>{s.value}</div>
            <div style={{fontSize:8,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Next Session */}
      {nextSession?(
        <div style={{background:"linear-gradient(135deg,#1a1618,#141416)",border:`1px solid ${C.silver}33`,borderRadius:14,padding:"20px 22px",marginBottom:16}}>
          <div style={{fontSize:8,letterSpacing:4,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:14,fontWeight:600}}>Next Session</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <div>
              <div style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:6}}>{nextSession.dateLabel}</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.silver,fontFamily:D.body}}>🕐 {nextSession._time||nextSession.sessTime||"TBD"}</span>
                <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>{nextSession.type==="1on1"?"⚒️ Tempering":"🔥 Furnace"}</span>
              </div>
              {nextSession.status==="tentative"&&<div style={{marginTop:8,fontSize:10,color:C.silver,fontFamily:D.body}}>⏰ Time TBD — Coach Carlos will confirm</div>}
            </div>
            <span style={{fontSize:8,padding:"4px 10px",borderRadius:8,background:nextSession.status==="confirmed"?`${C.green}18`:`${C.silver}18`,color:nextSession.status==="confirmed"?C.green:C.silver,border:`1px solid ${nextSession.status==="confirmed"?C.green+"33":C.silver+"33"}`,fontFamily:D.body,flexShrink:0,letterSpacing:1}}>
              {nextSession.status==="confirmed"?"Confirmed":"Pending"}
            </span>
          </div>
          <button onClick={()=>setRescheduleSession(nextSession)} style={{background:"transparent",border:`1px solid ${C.silver}33`,color:C.silver,borderRadius:8,padding:"8px 20px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
            Reschedule
          </button>
        </div>
      ):(
        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"28px 22px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:14,color:C.textDim,fontFamily:D.body,marginBottom:4}}>No upcoming sessions</div>
          <button onClick={()=>setPage("book")} style={{marginTop:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:C.white,borderRadius:9,padding:"10px 24px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>Book a Session →</button>
        </div>
      )}

      {/* All Upcoming */}
      {upcoming.length>1&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:8,letterSpacing:4,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:10,fontWeight:600}}>All Upcoming</div>
          <div style={{display:"grid",gap:6}}>
            {upcoming.slice(1).map((s,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${s.status==="confirmed"?C.green:C.silver}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>{s.dateLabel}</div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:C.textMid,fontFamily:D.body}}>🕐 {s._time||s.sessTime||"TBD"}</span>
                    <span style={{fontSize:11,color:C.textMid,fontFamily:D.body}}>{s.type==="1on1"?"⚒️ Tempering":"🔥 Furnace"}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:8,padding:"2px 8px",borderRadius:6,background:s.status==="confirmed"?`${C.green}18`:`${C.silver}18`,color:s.status==="confirmed"?C.green:C.silver,fontFamily:D.body}}>{s.status==="confirmed"?"Confirmed":"Pending"}</span>
                  <button onClick={()=>setRescheduleSession(s)} style={{background:"transparent",border:`1px solid ${C.silver}33`,color:C.silver,borderRadius:7,padding:"5px 12px",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Reschedule</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {past.length>0&&(
        <div style={{marginBottom:16}}>
          <button onClick={()=>setShowPast(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"10px 0",borderBottom:`1px solid ${C.cardBorder}`}}>
            <div style={{fontSize:8,letterSpacing:4,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Past Sessions ({past.length})</div>
            <span style={{fontSize:11,color:C.textDim}}>{showPast?"▲":"▼"}</span>
          </button>
          {showPast&&(
            <div style={{display:"grid",gap:5,marginTop:10}}>
              {past.map((s,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:"3px solid #2a2520",borderRadius:10,padding:"10px 14px",opacity:0.7,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.textMid,fontFamily:D.display,marginBottom:2}}>{s.dateLabel}</div>
                    <div style={{display:"flex",gap:10}}>
                      <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>🕐 {s._time||s.sessTime||"—"}</span>
                      <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{s.type==="1on1"?"⚒️ Tempering":"🔥 Furnace"}</span>
                    </div>
                  </div>
                  <span style={{fontSize:8,padding:"2px 8px",borderRadius:6,background:`${C.green}10`,color:C.green,fontFamily:D.body,flexShrink:0}}>Done</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player Profiles */}
      <div style={{marginBottom:24}}>
        <button onClick={()=>setShowPlayers(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"10px 0",borderBottom:`1px solid ${C.cardBorder}`}}>
          <div style={{fontSize:8,letterSpacing:4,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Player Profiles ({players.length})</div>
          <span style={{fontSize:11,color:C.textDim}}>{showPlayers?"▲":"▼"}</span>
        </button>
        {showPlayers&&<PlayersTab user={user} players={players} playersLoaded={playersLoaded}/>}
      </div>

      {/* Quick Actions */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>🔥 Book Session</button>
        <button onClick={()=>setPage("contact")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:10,padding:"13px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>📧 Contact Coach</button>
      </div>

      {/* Reschedule Modal */}
      {rescheduleSession&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>{setRescheduleSession(null);setReschedDate(null);setReschedSess(null);}}>
          <div style={{background:"#111",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"22px",maxWidth:480,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>Reschedule Session</div>
              <button onClick={()=>setRescheduleSession(null)} style={{background:"transparent",border:"none",color:C.textDim,fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginBottom:16}}>Moving: <strong style={{color:C.white}}>{rescheduleSession.dateLabel} · {rescheduleSession._time}</strong></div>
            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Pick a New Friday</div>
            <div style={{display:"grid",gap:8,marginBottom:16}}>
              {availDates.map((d,i)=>{
                if(dKey(d)===rescheduleSession.dateKey) return null;
                const sched=DAY_SCHEDULE[d.getDay()];
                const isSelDate=reschedDate&&dKey(reschedDate)===dKey(d);
                return(
                  <div key={i} style={{background:isSelDate?`${C.red}08`:C.card,border:`1px solid ${isSelDate?C.red:C.cardBorder}`,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{fmtDate(d)}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {sched.sessions.map(sess=>{
                        const isSel=isSelDate&&reschedSess?.id===sess.id;
                        const spots=MAX_PLAYERS-(rescheduleSession?1:0);
                        return(
                          <button key={sess.id} onClick={()=>{setReschedDate(d);setReschedSess(sess);}}
                            style={{background:isSel?`${C.red}18`:"#0d0b08",border:`1px solid ${isSel?C.red:C.cardBorder}`,borderRadius:8,padding:"8px 10px",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:11,fontWeight:600,color:isSel?C.red:C.white,fontFamily:D.display,marginBottom:2}}>{sess.time}</div>
                            <div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>Available</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setRescheduleSession(null);setReschedDate(null);setReschedSess(null);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:9,padding:"11px 18px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
              <button disabled={!reschedDate||!reschedSess||reschedLoading} onClick={doReschedule}
                style={{flex:1,background:reschedDate&&reschedSess?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a1a1a",border:"none",color:reschedDate&&reschedSess?C.white:C.textDim,borderRadius:9,padding:"11px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:reschedDate&&reschedSess?"pointer":"not-allowed",fontFamily:D.body,fontWeight:600}}>
                {reschedLoading?"Rescheduling…":"Confirm Reschedule →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PLAYERS TAB ───────────────────────────────────────────
export function PlayersTab({user,players,playersLoaded}){
  const [showForm,setShowForm] = useState(false);
  const [editId,setEditId]     = useState(null);
  const [confirmDeleteId,setConfirmDeleteId] = useState(null);
  const [form,setForm] = useState({name:"",age:"",position:"",notes:""});

  async function handleSave(e){
    if(e&&e.preventDefault) e.preventDefault();
    if(!form.name.trim()) return;
    if(editId){
      await updateDoc(doc(db,"users",user.uid,"players",editId),{...form,updatedAt:new Date().toISOString()});
      setEditId(null);
    } else {
      await addDoc(collection(db,"users",user.uid,"players"),{...form,createdAt:new Date().toISOString()});
    }
    setForm({name:"",age:"",position:"",notes:""}); setShowForm(false);
  }

  async function handleDelete(id){
    await deleteDoc(doc(db,"users",user.uid,"players",id));
  }

  return(
    <div style={{marginTop:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>{players.length} player{players.length!==1?"s":""} saved</div>
        <button onClick={()=>{setShowForm(v=>!v);setEditId(null);setForm({name:"",age:"",position:"",notes:""}); }}
          style={{background:`${C.red}12`,border:`1px solid ${C.red}33`,borderRadius:7,padding:"5px 14px",color:C.red,fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
          {showForm?"Cancel":"+ Add Player"}
        </button>
      </div>
      {showForm&&(
        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"16px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:8,color:C.textDim,letterSpacing:1,marginBottom:4,textTransform:"uppercase",fontFamily:D.body}}>Name *</div><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={{...IS,fontSize:12}}/></div>
            <div><div style={{fontSize:8,color:C.textDim,letterSpacing:1,marginBottom:4,textTransform:"uppercase",fontFamily:D.body}}>Age</div><input type="number" value={form.age} onChange={e=>setForm(p=>({...p,age:e.target.value}))} style={{...IS,fontSize:12}}/></div>
          </div>
          <div style={{marginBottom:8}}><div style={{fontSize:8,color:C.textDim,letterSpacing:1,marginBottom:4,textTransform:"uppercase",fontFamily:D.body}}>Position</div>
            <select value={form.position} onChange={e=>setForm(p=>({...p,position:e.target.value}))} style={{...IS,fontSize:12}}>
              <option value="">Select...</option>
              {POSITIONS.map(p=><option key={p.id} value={p.id}>{p.full}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}><div style={{fontSize:8,color:C.textDim,letterSpacing:1,marginBottom:4,textTransform:"uppercase",fontFamily:D.body}}>Notes</div><input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Anything Coach should know" style={{...IS,fontSize:12}}/></div>
          <button onClick={handleSave} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:8,padding:"10px 20px",color:C.white,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
            {editId?"Update":"Save Player"}
          </button>
        </div>
      )}
      <div style={{display:"grid",gap:8}}>
        {!playersLoaded&&<div style={{fontSize:11,color:C.textDim,fontFamily:D.body,fontStyle:"italic",padding:"12px 0"}}>Loading...</div>}
        {playersLoaded&&players.length===0&&<div style={{fontSize:11,color:C.textDim,fontFamily:D.body,fontStyle:"italic",padding:"12px 0"}}>No players added yet. Add your player's info to speed up booking.</div>}
        {players.map(p=>(
          <div key={p.id} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:3}}>{p.name}</div>
              <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{p.age?"Age "+p.age:""}{p.age&&p.position?" · ":""}{p.position||""}</div>
              {p.notes&&<div style={{fontSize:9,color:C.textDim,fontFamily:D.body,marginTop:2,fontStyle:"italic"}}>{p.notes}</div>}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>{setEditId(p.id);setForm({name:p.name,age:p.age||"",position:p.position||"",notes:p.notes||""});setShowForm(true);}} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:"4px 10px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>Edit</button>
              {confirmDeleteId===p.id?(
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>Remove?</span>
                  <button onClick={()=>{handleDelete(p.id);setConfirmDeleteId(null);}} style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:5,padding:"3px 8px",fontSize:9,cursor:"pointer",fontFamily:D.body}}>Yes</button>
                  <button onClick={()=>setConfirmDeleteId(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:5,padding:"3px 6px",fontSize:9,cursor:"pointer",fontFamily:D.body}}>No</button>
                </div>
              ):(
                <button onClick={()=>setConfirmDeleteId(p.id)} style={{background:"transparent",border:`1px solid ${C.redDim}33`,borderRadius:6,padding:"4px 10px",color:C.redDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SESSIONS PAGE (logged out) ────────────────────────────
export function SessionsPage({setPage,user}){
  useEffect(()=>{ if(user) setPage("account"); },[user]);
  if(user) return null;
  return(
    <div style={{maxWidth:480,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:20}}>🔥</div>
      <h2 style={{fontSize:24,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:12}}>Track Your Sessions</h2>
      <p style={{fontSize:13,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:28}}>Create a free account to view your upcoming sessions, reschedule directly, manage player profiles, and track your history.</p>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <button onClick={()=>setPage("login")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>Sign Up Free</button>
        <button onClick={()=>setPage("login")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.silver,borderRadius:10,padding:"13px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Sign In</button>
      </div>
    </div>
  );
}

// ── ABOUT PAGE ────────────────────────────────────────────
export function AboutPage({setPage}){
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"60px 24px 100px"}}>
      <SH eyebrow="The Program" title="About La Forja"/>

      {/* Mission */}
      <div style={{marginBottom:48}}>
        <p style={{fontSize:15,color:C.textMid,fontFamily:D.display,fontStyle:"italic",lineHeight:2,marginBottom:20}}>La Forja — The Forge. A place where raw iron becomes something sharper, stronger, and more precise than what walked in.</p>
        <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:2,marginBottom:16}}>Most training isn't honest. Fun drills, cones in a row, controlled environments that have nothing to do with what happens in a real game. We train differently. Every session is built around real game situations — pressure, decision-making, 1v1 dominance. We don't just work on your skill. We work on your composure when the game is on the line.</p>
        <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:2}}>The Furnace is where raw players become forged ones. Small groups. Full intensity. Real results. Every player is treated as an individual — because the forge doesn't mass-produce, it crafts.</p>
      </div>

      {/* Coaching Staff */}
      <div style={{marginBottom:48}}>
        <div style={{fontSize:9,letterSpacing:5,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:24}}>The Coaching Staff</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>

          {/* Carlos */}
          <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,overflow:"hidden"}}>
            <img src="/carlos.jpg" alt="Coach Carlos Cepeda" style={{width:"100%",height:280,objectFit:"cover",objectPosition:"top center",display:"block"}}/>
            <div style={{padding:"20px 22px"}}>
              <div style={{fontSize:9,letterSpacing:3,color:C.red,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>Head Coach · Founder</div>
              <div style={{fontSize:20,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>Carlos Cepeda</div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:14}}>Former professional soccer player with experience across multiple leagues and levels. Coaching is not just a job — it's a calling to give back what the game gave him. Carlos built La Forja because he saw the gap between recreational training and what it actually takes to develop at a high level.</div>
              <div style={{display:"grid",gap:6}}>
                {["Former professional player","USSF licensed coach","Specialist in 1v1 and technical development","Founder & head of curriculum"].map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:C.red,flexShrink:0,marginTop:6,opacity:0.8}}/>
                    <span style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Waldo Sr. */}
          <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,overflow:"hidden"}}>
            <img src="/waldo-sr.jpg" alt="Coach Waldo Sr." style={{width:"100%",height:280,objectFit:"cover",objectPosition:"top center",display:"block"}}/>
            <div style={{padding:"20px 22px"}}>
              <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>Assistant Coach</div>
              <div style={{fontSize:20,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>Waldo Cepeda Sr.</div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:14}}>The steady hand in the forge. Waldo Sr. brings decades of experience and an eye for the technical details that separate good players from elite ones. His presence on the field means every player gets individual attention, every session runs with precision.</div>
              <div style={{display:"grid",gap:6}}>
                {["Lifelong student of the game","Technical fundamentals specialist","Keeps every session organized and sharp","The foundation the program is built on"].map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:C.silver,flexShrink:0,marginTop:6,opacity:0.8}}/>
                    <span style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Waldo Jr. */}
          <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,overflow:"hidden",position:"relative"}}>
            <img src="/waldo-jr.jpg" alt="Coach Waldo Jr." style={{width:"100%",height:280,objectFit:"cover",objectPosition:"top center",display:"block"}}/>
            <div style={{padding:"20px 22px"}}>
              <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>Coach</div>
              <div style={{fontSize:20,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>Waldo Cepeda Jr.</div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:14}}>The next generation of the forge. Waldo Jr. brings energy, relatability, and a deep understanding of what today's player needs. Close in age to the players he trains, he connects with them in ways that accelerate development — pushing hard and pulling the best out of every session.</div>
              <div style={{display:"grid",gap:6}}>
                {["Dynamic and high-energy coaching style","Connects with players at every level","Emerging leader in the La Forja system","Expanding the program's capacity and reach"].map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:C.silver,flexShrink:0,marginTop:6,opacity:0.8}}/>
                    <span style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* The Forge Philosophy */}
      <div style={{background:"linear-gradient(135deg,#1a0a08,#100806)",border:`1px solid ${C.red}22`,borderRadius:16,padding:"28px 30px",marginBottom:40}}>
        <div style={{fontSize:9,letterSpacing:5,color:C.red,textTransform:"uppercase",fontFamily:D.body,marginBottom:16}}>The Philosophy</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20}}>
          {[
            {title:"Raw Iron",desc:"Every player comes in with raw ability and real weaknesses. We identify both before we do anything else.",icon:"⬜"},
            {title:"The Forge",desc:"Heat and pressure, applied deliberately. Real game situations. No comfort zones. The work that actually makes players better.",icon:"🔥"},
            {title:"Forged Steel",desc:"What comes out is sharper, more composed, and ready to perform when the game is on the line.",icon:"⚔️"},
          ].map((item,i)=>(
            <div key={i} style={{textAlign:"center",padding:"16px 12px"}}>
              <div style={{fontSize:32,marginBottom:12}}>{item.icon}</div>
              <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{item.title}</div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8}}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick facts */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:40}}>
        {[
          {icon:"📍",label:"Location",value:"Bayview Park · James Island, SC"},
          {icon:"⚽",label:"Age Group",value:"U11 and up"},
          {icon:"👥",label:"Group Size",value:`Max ${MAX_PLAYERS} per session`},
          {icon:"🔥",label:"Sessions",value:"Fridays · 5:00 & 6:30 PM"},
          {icon:"💰",label:"Price",value:`$${PRICE_GROUP}/session`},
        ].map((item,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 16px",display:"flex",alignItems:"flex-start",gap:10}}>
            <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
            <div>
              <div style={{fontSize:8,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>{item.label}</div>
              <div style={{fontSize:12,color:C.white,fontFamily:D.body,fontWeight:500}}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{textAlign:"center"}}>
        <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"14px 40px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 6px 24px ${C.red}33`,fontFamily:D.body,fontWeight:600}}>Book The Furnace →</button>
      </div>
    </div>
  );
}

// ── CONTACT PAGE ──────────────────────────────────────────
export function ContactPage({setPage,user}){
  const [form,setForm] = useState({name:user?.displayName||"",email:user?.email||"",message:""});
  const [sent,setSent] = useState(false);
  const [busy,setBusy] = useState(false);

  async function handleSubmit(e){
    e.preventDefault(); setBusy(true);
    await callEmailAPI({...form,type:"contact"},"contact");
    setSent(true); setBusy(false);
  }

  if(sent) return(
    <div style={{maxWidth:480,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:16}}>✓</div>
      <h2 style={{fontSize:22,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:12}}>Message Sent</h2>
      <p style={{fontSize:13,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:24}}>Coach Carlos will get back to you within 24 hours.</p>
      <button onClick={()=>setPage("home")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.silver,borderRadius:9,padding:"10px 24px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Back to Home</button>
    </div>
  );

  return(
    <div style={{maxWidth:520,margin:"0 auto",padding:"60px 24px 100px"}}>
      <SH eyebrow="Get in Touch" title="Contact Coach Carlos"/>
      <form onSubmit={handleSubmit}>
        {[{label:"Your Name",key:"name",type:"text"},{label:"Email",key:"email",type:"email"},{label:"Message",key:"message",type:"textarea"}].map(f=>(
          <div key={f.key} style={{marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>{f.label}</div>
            {f.type==="textarea"
              ?<textarea value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} rows={5} required style={{...IS,fontSize:12}}/>
              :<input type={f.type} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} required style={{...IS,fontSize:12}}/>
            }
          </div>
        ))}
        <button type="submit" disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1}}>
          {busy?"Sending…":"Send Message"}
        </button>
      </form>
    </div>
  );
}

// ── PACKAGES PAGE ─────────────────────────────────────────
export function PackagesPage({setPage}){
  return(
    <div style={{maxWidth:700,margin:"0 auto",padding:"60px 24px 100px"}}>
      <SH eyebrow="Invest in the Process" title="Training Packages"/>
      <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:36}}>Single sessions are great to start. Packages are for players who are serious about getting better.</p>
      <div style={{display:"grid",gap:14,marginBottom:40}}>
        {[
          {name:"Single Session",price:"$40",rate:"$40/session",sessions:"1 session",desc:"Try it out. No commitment. Show up, work hard, see what La Forja is about.",cta:"Book Now",highlight:false},
          {name:"4 Sessions",price:"$140",rate:"$35/session",sessions:"4 sessions",save:"Save $20",desc:"One Friday per week for a month. Good for players building a rhythm.",cta:"Book 4 Sessions",highlight:false},
          {name:"8 Sessions",price:"$260",rate:"$32/session",sessions:"8 sessions",save:"Save $60",desc:"Two months of Fridays. For players locked in and serious about development.",cta:"Book 8 Sessions",highlight:true},
        ].map((p,i)=>(
          <div key={i} style={{background:p.highlight?"linear-gradient(135deg,#1a1618,#141416)":C.card,border:p.highlight?`1px solid ${C.silver}44`:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"22px 24px",position:"relative"}}>
            {p.highlight&&<div style={{position:"absolute",top:-10,left:24,background:`linear-gradient(135deg,${C.silver},${C.silverDim})`,color:"#0a0a0a",fontSize:8,letterSpacing:2,fontWeight:700,textTransform:"uppercase",fontFamily:D.body,padding:"3px 12px",borderRadius:10}}>Best Value</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:18,fontWeight:600,color:p.highlight?C.silver:C.white,fontFamily:D.display,marginBottom:3}}>{p.name}</div>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{p.sessions}</span>
                  <span style={{fontSize:11,color:p.highlight?C.silver:C.textMid,fontFamily:D.body}}>{p.rate}</span>
                  {p.save&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:6,background:p.highlight?`${C.silver}18`:"rgba(255,255,255,0.05)",color:p.highlight?C.silver:C.textDim,fontFamily:D.body}}>{p.save}</span>}
                </div>
              </div>
              <div style={{fontSize:32,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1}}>{p.price}</div>
            </div>
            <p style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.8,margin:"0 0 16px"}}>{p.desc}</p>
            <button onClick={()=>setPage("book")} style={{background:p.highlight?`linear-gradient(135deg,${C.silver},${C.silverDim})`:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:p.highlight?"#0a0a0a":C.white,borderRadius:9,padding:"11px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>{p.cta} →</button>
          </div>
        ))}
      </div>
      <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"18px 22px"}}>
        <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>How Packages Work</div>
        {["Book your sessions directly — pick any available Friday slots.","Reschedule any session from your account — no approval needed, no back and forth.","Session credit never expires within the purchased period.","No cash refunds once a package begins — all value stays as session credit.","Emergencies handled case-by-case with Coach Carlos."].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:i<4?8:0}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:C.silver,flexShrink:0,opacity:0.6,marginTop:6}}/>
            <span style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.7}}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
