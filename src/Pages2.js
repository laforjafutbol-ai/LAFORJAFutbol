import { useState, useEffect } from "react";
import { db, auth, googleProvider } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, POSITIONS, DAY_SCHEDULE, COACH_DAYS, dKey, fmtDate, getDates, callEmailAPI, IS, SH, FL, SC, AB, GB } from "./constants";

// ── AUTH PAGE ─────────────────────────────────────────────
export function AuthPage({setPage,authChecked,user}){
  const [mode,setMode]     = useState("login");
  const [name,setName]     = useState("");
  const [email,setEmail]   = useState("");
  const [pw,setPw]         = useState("");
  const [showPw,setShowPw] = useState(false);
  const [err,setErr]       = useState("");
  const [busy,setBusy]     = useState(false);
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
    catch(e){ setErr("Google sign-in failed. Try again."); }
    setBusy(false);
  }

  async function handleReset(e){
    e.preventDefault(); setErr(""); setBusy(true);
    try{ await sendPasswordResetEmail(auth,email); setResetSent(true); }
    catch(e){ setErr("Could not send reset email. Check your address."); }
    setBusy(false);
  }

  // Shared card wrapper
  const cardStyle={
    background:"linear-gradient(160deg,#140e08 0%,#0e0a06 100%)",
    border:`1px solid #2e1e0e`,
    borderTop:`3px solid ${C.red}`,
    borderRadius:16,
    padding:"36px 28px",
    boxShadow:`0 -2px 20px rgba(255,77,46,0.08)`,
  };

  const labelStyle={fontSize:9,letterSpacing:2,color:"#a07055",marginBottom:6,fontFamily:D.body,textTransform:"uppercase",display:"block"};
  const inputStyle={...IS,background:"#0a0806",border:"1px solid #2a1a0c",color:C.white};

  if(mode==="reset") return(
    <div style={{maxWidth:400,margin:"clamp(60px,8vw,90px) auto",padding:"0 clamp(14px,4vw,24px)"}}>
      <div style={cardStyle}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:5,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>La Forja</div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:D.display,letterSpacing:1}}>Reset Password</div>
        </div>
        {resetSent?(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>✓</div>
            <div style={{fontSize:13,color:C.white,fontFamily:D.body,marginBottom:6}}>Check your inbox</div>
            <div style={{fontSize:11,color:"#a07055",fontFamily:D.body,marginBottom:20}}>Reset link sent to {email}</div>
            <button onClick={()=>setMode("login")} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:11,letterSpacing:2,textDecoration:"underline"}}>← Back to Sign In</button>
          </div>
        ):(
          <form onSubmit={handleReset}>
            <div style={{marginBottom:18}}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inputStyle}/>
            </div>
            {err&&<div style={{color:C.red,fontSize:11,fontFamily:D.body,marginBottom:14,padding:"8px 12px",background:`${C.red}10`,borderRadius:7,border:`1px solid ${C.red}22`}}>{err}</div>}
            <button type="submit" disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,#e83820,#c02810)`,border:`1px solid rgba(255,100,60,0.4)`,color:C.white,borderRadius:10,padding:"14px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:600,opacity:busy?0.6:1,boxShadow:`0 4px 20px rgba(255,77,46,0.3)`}}>
              {busy?"Sending…":"Send Reset Link →"}
            </button>
            <button type="button" onClick={()=>setMode("login")} style={{width:"100%",marginTop:12,background:"none",border:"none",color:"#a07055",cursor:"pointer",fontFamily:D.body,fontSize:11,letterSpacing:1}}>← Back to Sign In</button>
          </form>
        )}
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:400,margin:"clamp(60px,8vw,90px) auto",padding:"0 clamp(14px,4vw,24px)"}}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:11,letterSpacing:5,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>La Forja</div>
          <div style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:D.display,letterSpacing:1}}>
            {mode==="signup"?"Join the Program":"Welcome Back"}
          </div>
          <div style={{fontSize:11,color:"#a07055",fontFamily:D.body,marginTop:6}}>
            {mode==="signup"?"Create your account to manage bookings":"Sign in to view your sessions"}
          </div>
        </div>

        {/* Google button — prominent at top */}
        <button onClick={handleGoogle} disabled={busy} style={{width:"100%",background:"#0a0806",border:`1px solid #2e1e0e`,color:C.white,borderRadius:10,padding:"13px",fontSize:11,cursor:busy?"not-allowed":"pointer",fontFamily:D.body,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10,letterSpacing:1}}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <div style={{flex:1,height:1,background:"#2a1a0c"}}/>
          <span style={{fontSize:9,letterSpacing:2,color:"#4a3020",textTransform:"uppercase",fontFamily:D.body}}>or email</span>
          <div style={{flex:1,height:1,background:"#2a1a0c"}}/>
        </div>

        <form onSubmit={handleEmailAuth}>
          {mode==="signup"&&(
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Your Name</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="First & last name" required style={inputStyle}/>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inputStyle}/>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <label style={{...labelStyle,marginBottom:0}}>Password</label>
              {mode==="login"&&<button type="button" onClick={()=>setMode("reset")} style={{background:"none",border:"none",color:"#a07055",cursor:"pointer",fontFamily:D.body,fontSize:9,letterSpacing:1}}>Forgot?</button>}
            </div>
            <div style={{position:"relative"}}>
              <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder={mode==="signup"?"Min 6 characters":""} required minLength={6} style={{...inputStyle,paddingRight:42}}/>
              <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#a07055",fontSize:13,lineHeight:1}}>
                {showPw?"🙈":"👁"}
              </button>
            </div>
          </div>
          {err&&<div style={{color:C.red,fontSize:11,fontFamily:D.body,marginBottom:14,padding:"8px 12px",background:`${C.red}10`,borderRadius:7,border:`1px solid ${C.red}22`}}>{err}</div>}
          <button type="submit" disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,#e83820,#c02810)`,border:`1px solid rgba(255,100,60,0.4)`,color:C.white,borderRadius:10,padding:"14px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:600,opacity:busy?0.6:1,boxShadow:`0 4px 20px rgba(255,77,46,0.3)`,marginBottom:16}}>
            {busy?"Please wait…":mode==="signup"?"Create Account →":"Sign In →"}
          </button>
        </form>

        <div style={{textAlign:"center",fontSize:11,color:"#a07055",fontFamily:D.body}}>
          {mode==="login"?(
            <span>No account yet?{" "}<button onClick={()=>{setMode("signup");setErr("");}} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:11,textDecoration:"underline"}}>Sign Up Free</button></span>
          ):(
            <span>Already have one?{" "}<button onClick={()=>{setMode("login");setErr("");}} style={{color:C.silver,background:"none",border:"none",cursor:"pointer",fontFamily:D.body,fontSize:11,textDecoration:"underline"}}>Sign In</button></span>
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
  const [activeTab,setActiveTab]     = useState("sessions"); // "sessions" | "players"
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
        for(const d of bs.docs){ if(!d.data().userId) await updateDoc(doc(db,"bookings",d.id),{userId:user.uid, uid:user.uid}); }
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

  // Status badge helper
  function statusBadge(status){
    if(status==="confirmed") return {label:"Confirmed",color:C.green,bg:`${C.green}18`,border:`${C.green}33`};
    if(status==="awaiting_payment") return {label:"Awaiting Payment",color:"#c9a84c",bg:"#1e1a0c",border:"#c9a84c44"};
    return {label:"Pending",color:C.silver,bg:`${C.silver}18`,border:`${C.silver}33`};
  }

  return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"clamp(70px,8vw,90px) clamp(14px,4vw,20px) 100px"}}>

      {/* ── HEADER ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div>
          <div style={{fontSize:8,letterSpacing:5,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>My Account</div>
          <div style={{fontSize:28,fontWeight:700,color:C.white,fontFamily:D.display,letterSpacing:1,marginBottom:4}}>{user.displayName||"Welcome back"}</div>
          <div style={{fontSize:11,color:"#a07055",fontFamily:D.body}}>{email}</div>
        </div>
        <button onClick={handleSignOut} style={{background:"transparent",border:"1px solid #2e1e0e",color:"#a07055",borderRadius:8,padding:"8px 16px",fontSize:9,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,marginTop:6,flexShrink:0}}>Sign Out</button>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:24}}>
        {[
          {label:"Upcoming",value:upcoming.length,color:C.red},
          {label:"Sessions Done",value:completedCount,color:"#4a9e6a"},
          {label:"Players",value:players.length,color:C.silver},
        ].map((s,i)=>(
          <div key={i} style={{background:"linear-gradient(160deg,#130e09,#0d0a06)",border:"1px solid #2e1e0e",borderRadius:12,padding:"18px 12px",textAlign:"center"}}>
            <div style={{fontSize:"clamp(26px,5vw,34px)",fontWeight:700,color:s.color,fontFamily:D.display,lineHeight:1,marginBottom:6}}>{s.value}</div>
            <div style={{fontSize:8,letterSpacing:2,color:"#a07055",textTransform:"uppercase",fontFamily:D.body}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── NEXT SESSION CARD ── */}
      {nextSession?(
        <div style={{background:"linear-gradient(160deg,#140e08,#0e0a06)",border:"1px solid #2e1e0e",borderTop:`3px solid ${C.red}`,borderRadius:14,padding:"22px",marginBottom:24,boxShadow:"0 -2px 20px rgba(255,77,46,0.08)"}}>
          <div style={{fontSize:8,letterSpacing:5,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:14}}>Next Session</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:18,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:24,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:8}}>{nextSession.dateLabel}</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.silver,fontFamily:D.body}}>🕐 {nextSession._time||nextSession.sessTime||"TBD"}</span>
                <span style={{fontSize:12,color:"#a07055",fontFamily:D.body}}>{nextSession.type==="1on1"?"⚒️ The Tempering":"🔥 The Furnace"}</span>
              </div>
              {nextSession.name&&<div style={{fontSize:10,color:"#a07055",fontFamily:D.body,marginTop:8}}>👤 {nextSession.name}</div>}
            </div>
            <div>
              {(()=>{const b=statusBadge(nextSession.status);return(
                <span style={{fontSize:9,padding:"5px 12px",borderRadius:8,background:b.bg,color:b.color,border:`1px solid ${b.border}`,fontFamily:D.body,letterSpacing:1,whiteSpace:"nowrap"}}>{b.label}</span>
              );})()}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>setRescheduleSession(nextSession)} style={{background:"transparent",border:"1px solid #2e1e0e",color:C.silver,borderRadius:8,padding:"9px 22px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
              Reschedule →
            </button>
            {nextSession.status==="awaiting_payment"&&(
              <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,#c9a84c,#a07830)`,border:"none",color:"#0a0806",borderRadius:8,padding:"9px 22px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>
                Complete Payment →
              </button>
            )}
          </div>
        </div>
      ):(
        <div style={{background:"linear-gradient(160deg,#140e08,#0e0a06)",border:"1px solid #2e1e0e",borderRadius:14,padding:"32px 22px",marginBottom:24,textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:4,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:16}}>No upcoming sessions</div>
          <div style={{fontSize:26,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:8}}>Ready to train?</div>
          <div style={{fontSize:11,color:"#a07055",fontFamily:D.body,marginBottom:24}}>Fridays · James Island · Small groups, max 5</div>
          <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,#e83820,#c02810)`,border:`1px solid rgba(255,100,60,0.4)`,color:C.white,borderRadius:9,padding:"13px 32px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,boxShadow:"0 4px 20px rgba(255,77,46,0.3)"}}>Book a Session →</button>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{display:"flex",gap:4,background:"#0d0a06",border:"1px solid #2e1e0e",borderRadius:10,padding:4,marginBottom:20}}>
        {[
          {id:"sessions",label:`Sessions${upcoming.length>0?` (${upcoming.length})`:""}` },
          {id:"players", label:`Players${players.length>0?` (${players.length})`:""}` },
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{flex:1,background:activeTab===t.id?`linear-gradient(135deg,#e83820,#c02810)`:"transparent",
              border:"none",color:activeTab===t.id?C.white:"#a07055",borderRadius:7,padding:"10px",
              fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:activeTab===t.id?600:400,
              transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SESSIONS TAB ── */}
      {activeTab==="sessions"&&(
        <div>
          {/* Upcoming sessions */}
          {upcoming.length>0&&(
            <div style={{marginBottom:20}}>
              {upcoming.length>1&&<div style={{fontSize:8,letterSpacing:4,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>All Upcoming ({upcoming.length})</div>}
              <div style={{display:"grid",gap:8}}>
                {upcoming.map((s,i)=>{
                  const b=statusBadge(s.status);
                  return(
                    <div key={i} style={{background:"linear-gradient(160deg,#130e09,#0d0a06)",border:"1px solid #2e1e0e",borderLeft:`3px solid ${b.color}`,borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:5}}>{s.dateLabel}</div>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{fontSize:11,color:C.silver,fontFamily:D.body}}>🕐 {s._time||s.sessTime||"TBD"}</span>
                          <span style={{fontSize:11,color:"#a07055",fontFamily:D.body}}>{s.type==="1on1"?"⚒️ Tempering":"🔥 Furnace"}</span>
                          {s.name&&<span style={{fontSize:11,color:"#a07055",fontFamily:D.body}}>· {s.name}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
                        <span style={{fontSize:8,padding:"3px 10px",borderRadius:6,background:b.bg,color:b.color,border:`1px solid ${b.border}`,fontFamily:D.body,letterSpacing:1}}>{b.label}</span>
                        <button onClick={()=>setRescheduleSession(s)} style={{background:"transparent",border:"1px solid #2e1e0e",color:"#a07055",borderRadius:7,padding:"5px 12px",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Move</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past sessions */}
          {past.length>0&&(
            <div style={{marginBottom:16}}>
              <button onClick={()=>setShowPast(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"12px 0",borderBottom:"1px solid #2e1e0e",marginBottom:showPast?12:0}}>
                <div style={{fontSize:8,letterSpacing:4,color:"#a07055",textTransform:"uppercase",fontFamily:D.body}}>Past Sessions ({past.length})</div>
                <span style={{fontSize:10,color:"#a07055",fontFamily:D.body}}>{showPast?"▲ Hide":"▼ Show"}</span>
              </button>
              {showPast&&(
                <div style={{display:"grid",gap:6}}>
                  {past.map((s,i)=>(
                    <div key={i} style={{background:"#0a0806",border:"1px solid #1e1208",borderLeft:"3px solid #2a1a0c",borderRadius:10,padding:"12px 16px",opacity:0.7,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#a07055",fontFamily:D.display,marginBottom:3}}>{s.dateLabel}</div>
                        <div style={{display:"flex",gap:12}}>
                          <span style={{fontSize:10,color:"#6a4a30",fontFamily:D.body}}>🕐 {s._time||s.sessTime||"—"}</span>
                          <span style={{fontSize:10,color:"#6a4a30",fontFamily:D.body}}>{s.type==="1on1"?"⚒️ Tempering":"🔥 Furnace"}</span>
                        </div>
                      </div>
                      <span style={{fontSize:8,padding:"3px 10px",borderRadius:6,background:"rgba(74,158,106,0.12)",color:"#4a9e6a",fontFamily:D.body,flexShrink:0,letterSpacing:1}}>Done</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {upcoming.length===0&&past.length===0&&(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#a07055",fontFamily:D.body,fontSize:12,lineHeight:1.8}}>No sessions yet.<br/><span style={{fontSize:11,color:"#6a4a30"}}>Book your first session to get started.</span></div>
          )}
        </div>
      )}

      {/* ── PLAYERS TAB ── */}
      {activeTab==="players"&&(
        <PlayersTab user={user} players={players} playersLoaded={playersLoaded}/>
      )}

      {/* ── QUICK ACTIONS ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:28}}>
        <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,#e83820,#c02810)`,border:`1px solid rgba(255,100,60,0.4)`,color:C.white,borderRadius:10,padding:"14px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,boxShadow:"0 4px 16px rgba(255,77,46,0.25)"}}>🔥 Book Session</button>
        <button onClick={()=>setPage("contact")} style={{background:"transparent",border:"1px solid #2e1e0e",color:"#a07055",borderRadius:10,padding:"14px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>✉ Contact Coach</button>
      </div>

      {/* Reschedule Modal */}
      {rescheduleSession&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>{setRescheduleSession(null);setReschedDate(null);setReschedSess(null);}}>
          <div style={{background:"linear-gradient(160deg,#140e08,#0e0a06)",border:"1px solid #2e1e0e",borderTop:`3px solid ${C.red}`,borderRadius:16,padding:"24px",maxWidth:480,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display,letterSpacing:1}}>Reschedule Session</div>
              <button onClick={()=>setRescheduleSession(null)} style={{background:"transparent",border:"none",color:"#a07055",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
            </div>
            <div style={{fontSize:11,color:"#a07055",fontFamily:D.body,marginBottom:18,padding:"10px 14px",background:"#0a0806",borderRadius:8,border:"1px solid #2e1e0e"}}>
              Moving: <strong style={{color:C.white}}>{rescheduleSession.dateLabel} · {rescheduleSession._time}</strong>
            </div>
            <div style={{fontSize:9,letterSpacing:3,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Pick a New Friday</div>
            <div style={{display:"grid",gap:8,marginBottom:18}}>
              {availDates.map((d,i)=>{
                if(dKey(d)===rescheduleSession.dateKey) return null;
                const sched=DAY_SCHEDULE[d.getDay()];
                const isSelDate=reschedDate&&dKey(reschedDate)===dKey(d);
                return(
                  <div key={i} style={{background:isSelDate?"rgba(232,56,32,0.06)":"#0a0806",border:`1px solid ${isSelDate?C.red:"#2e1e0e"}`,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:10}}>{fmtDate(d)}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {sched.sessions.map(sess=>{
                        const isSel=isSelDate&&reschedSess?.id===sess.id;
                        return(
                          <button key={sess.id} onClick={()=>{setReschedDate(d);setReschedSess(sess);}}
                            style={{background:isSel?"rgba(232,56,32,0.14)":"#0d0a06",border:`1px solid ${isSel?C.red:"#2e1e0e"}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",textAlign:"left",transition:"all 0.1s"}}>
                            <div style={{fontSize:12,fontWeight:700,color:isSel?C.red:C.white,fontFamily:D.display,marginBottom:2}}>{sess.time}</div>
                            <div style={{fontSize:9,color:"#a07055",fontFamily:D.body}}>Available</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setRescheduleSession(null);setReschedDate(null);setReschedSess(null);}} style={{background:"transparent",border:"1px solid #2e1e0e",color:"#a07055",borderRadius:9,padding:"12px 20px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
              <button disabled={!reschedDate||!reschedSess||reschedLoading} onClick={doReschedule}
                style={{flex:1,background:reschedDate&&reschedSess?`linear-gradient(135deg,#e83820,#c02810)`:"#1a0e08",border:"none",color:reschedDate&&reschedSess?C.white:"#6a4a30",borderRadius:9,padding:"12px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:reschedDate&&reschedSess?"pointer":"not-allowed",fontFamily:D.body,fontWeight:600}}>
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
  const [showForm,setShowForm]       = useState(false);
  const [editId,setEditId]           = useState(null);
  const [confirmDeleteId,setConfirmDeleteId] = useState(null);
  const [saving,setSaving]           = useState(false);
  const [form,setForm]               = useState({name:"",age:"",position:"",league:"",ageGroup:"",notes:""});

  function openAdd(){ setEditId(null); setForm({name:"",age:"",position:"",league:"",ageGroup:"",notes:""}); setShowForm(true); }
  function openEdit(p){ setEditId(p.id); setForm({name:p.name,age:p.age||"",position:p.position||"",league:p.league||"",ageGroup:p.ageGroup||"",notes:p.notes||""}); setShowForm(true); }
  function cancel(){ setShowForm(false); setEditId(null); setForm({name:"",age:"",position:"",league:"",ageGroup:"",notes:""}); }

  async function handleSave(){
    if(!form.name.trim()) return;
    setSaving(true);
    try{
      if(editId){
        await updateDoc(doc(db,"users",user.uid,"players",editId),{...form,updatedAt:new Date().toISOString()});
      } else {
        await addDoc(collection(db,"users",user.uid,"players"),{...form,createdAt:new Date().toISOString()});
      }
      cancel();
    } finally { setSaving(false); }
  }

  async function handleDelete(id){
    await deleteDoc(doc(db,"users",user.uid,"players",id));
    setConfirmDeleteId(null);
  }

  const posMap = Object.fromEntries(POSITIONS.map(p=>[p.id,p]));

  return(
    <div>
      {/* Header row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>
          {players.length===0?"No players yet":`${players.length} player${players.length!==1?"s":""} on file`}
        </div>
        {!showForm&&(
          <button onClick={openAdd}
            style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:8,padding:"9px 20px",color:C.white,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
            + Add Player
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm&&(
        <div style={{background:"linear-gradient(160deg,#140e08,#0e0a06)",border:"1px solid #2e1e0e",borderTop:`3px solid ${C.red}`,borderRadius:14,padding:"20px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.white,fontFamily:D.display,letterSpacing:1,marginBottom:16}}>
            {editId?"Edit Player":"New Player"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>Player Name *</div>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                placeholder="Full name" style={{...IS,fontSize:13}}/>
            </div>
            <div>
              <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>Age</div>
              <input type="number" min="4" max="25" value={form.age} onChange={e=>setForm(p=>({...p,age:e.target.value}))}
                placeholder="—" style={{...IS,fontSize:13,textAlign:"center"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>Position</div>
              <select value={form.position} onChange={e=>setForm(p=>({...p,position:e.target.value}))} style={{...IS,fontSize:12}}>
                <option value="">Any / Not sure</option>
                {POSITIONS.map(p=><option key={p.id} value={p.id}>{p.full} ({p.id})</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>Age Group</div>
              <select value={form.ageGroup} onChange={e=>setForm(p=>({...p,ageGroup:e.target.value}))} style={{...IS,fontSize:12}}>
                <option value="">Not sure</option>
                <option value="U9">U9</option>
                <option value="U10">U10</option>
                <option value="U11">U11</option>
                <option value="U12">U12</option>
                <option value="U13">U13</option>
                <option value="U14">U14</option>
                <option value="U15">U15</option>
                <option value="U16">U16</option>
                <option value="U17">U17</option>
                <option value="U18+">U18+</option>
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>Current Team / League</div>
            <input value={form.league} onChange={e=>setForm(p=>({...p,league:e.target.value}))}
              placeholder="e.g. James Island United, AYSO, club team…" style={{...IS,fontSize:12}}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:2,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>Notes for Coach</div>
            <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
              placeholder="Goals, skill level, injuries, anything relevant…" style={{...IS,fontSize:12}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={cancel} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:8,padding:"10px 18px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
            <button onClick={handleSave} disabled={saving||!form.name.trim()}
              style={{flex:1,background:form.name.trim()?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a1a1a",border:"none",color:form.name.trim()?C.white:C.textDim,borderRadius:8,padding:"10px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:form.name.trim()?"pointer":"not-allowed",fontFamily:D.body,fontWeight:600}}>
              {saving?"Saving…":editId?"Update Player →":"Save Player →"}
            </button>
          </div>
        </div>
      )}

      {/* Player Cards */}
      {!playersLoaded&&(
        <div style={{textAlign:"center",padding:"30px",color:C.textDim,fontFamily:D.body,fontSize:11}}>Loading players…</div>
      )}

      {playersLoaded&&players.length===0&&!showForm&&(
        <div style={{background:"linear-gradient(160deg,#130e09,#0d0a06)",border:"1px solid #2e1e0e",borderRadius:14,padding:"36px 24px",textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:4,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:14}}>No players yet</div>
          <div style={{fontSize:20,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:10}}>Add your first player</div>
          <div style={{fontSize:11,color:"#a07055",fontFamily:D.body,lineHeight:1.8,marginBottom:22}}>
            Name, age, position, league, and age group — makes booking faster and helps Coach prepare for each session.
          </div>
          <button onClick={openAdd}
            style={{background:`linear-gradient(135deg,#e83820,#c02810)`,border:`1px solid rgba(255,100,60,0.4)`,color:C.white,borderRadius:9,padding:"12px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,boxShadow:"0 4px 16px rgba(255,77,46,0.25)"}}>
            Add Player →
          </button>
        </div>
      )}

      <div style={{display:"grid",gap:10}}>
        {players.map(p=>{
          const pos = posMap[p.position];
          return(
            <div key={p.id} style={{background:"linear-gradient(160deg,#130e09,#0d0a06)",border:"1px solid #2e1e0e",borderRadius:13,padding:"16px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:pos||p.notes?10:0}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:4}}>{p.name}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {p.age&&<span style={{fontSize:10,color:C.textMid,fontFamily:D.body}}>Age {p.age}</span>}
                    {p.ageGroup&&<span style={{fontSize:9,padding:"2px 9px",borderRadius:5,background:"rgba(74,158,255,0.12)",color:"#4a9eff",fontFamily:D.body,letterSpacing:1,border:"1px solid rgba(74,158,255,0.2)"}}>{p.ageGroup}</span>}
                    {pos&&(
                      <span style={{fontSize:9,padding:"2px 9px",borderRadius:5,background:`${C.silver}15`,color:C.silver,fontFamily:D.body,letterSpacing:1,border:`1px solid ${C.silver}25`}}>
                        {pos.full}
                      </span>
                    )}
                    {p.league&&<span style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>· {p.league}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>openEdit(p)}
                    style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"6px 14px",color:C.textMid,fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
                    Edit
                  </button>
                  {confirmDeleteId===p.id?(
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      <button onClick={()=>handleDelete(p.id)}
                        style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:6,padding:"6px 12px",fontSize:9,cursor:"pointer",fontFamily:D.body}}>
                        Remove
                      </button>
                      <button onClick={()=>setConfirmDeleteId(null)}
                        style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:6,padding:"6px 10px",fontSize:9,cursor:"pointer",fontFamily:D.body}}>
                        Keep
                      </button>
                    </div>
                  ):(
                    <button onClick={()=>setConfirmDeleteId(p.id)}
                      style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"6px 12px",color:C.textDim,fontSize:9,cursor:"pointer",fontFamily:D.body}}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
              {p.notes&&(
                <div style={{fontSize:10,color:C.textDim,fontFamily:D.body,lineHeight:1.5,padding:"8px 10px",background:"#0d0b0933",borderRadius:6,borderLeft:`2px solid ${C.silver}22`}}>
                  "{p.notes}"
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SESSIONS PAGE (logged out) ────────────────────────────
export function SessionsPage({setPage,user}){
  useEffect(()=>{ if(user) setPage("account"); },[user]);
  if(user) return null;
  return(
    <div style={{maxWidth:460,margin:"clamp(60px,8vw,100px) auto",padding:"0 clamp(14px,4vw,24px)"}}>
      <div style={{background:"linear-gradient(160deg,#140e08,#0e0a06)",border:"1px solid #2e1e0e",borderTop:`3px solid ${C.red}`,borderRadius:16,padding:"40px 28px",textAlign:"center",boxShadow:"0 -2px 20px rgba(255,77,46,0.08)"}}>
        <div style={{fontSize:10,letterSpacing:5,color:"#a07055",textTransform:"uppercase",fontFamily:D.body,marginBottom:14}}>La Forja</div>
        <div style={{fontSize:28,fontWeight:700,color:C.white,fontFamily:D.display,letterSpacing:1,marginBottom:12}}>Your Sessions</div>
        <p style={{fontSize:13,color:"#a07055",fontFamily:D.body,lineHeight:1.9,marginBottom:10}}>Sign in to view upcoming sessions, reschedule, manage player profiles, and see your full history.</p>
        <div style={{height:1,background:"linear-gradient(to right,transparent,#2e1e0e,transparent)",margin:"20px 0"}}/>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={()=>setPage("login")} style={{background:`linear-gradient(135deg,#e83820,#c02810)`,border:`1px solid rgba(255,100,60,0.4)`,color:C.white,borderRadius:10,padding:"13px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,boxShadow:"0 4px 20px rgba(255,77,46,0.3)"}}>Sign In →</button>
          <button onClick={()=>setPage("login")} style={{background:"transparent",border:"1px solid #2e1e0e",color:"#a07055",borderRadius:10,padding:"13px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Create Account</button>
        </div>
        <div style={{fontSize:10,color:"#6a4a30",fontFamily:D.body,marginTop:16}}>Free — takes 30 seconds</div>
      </div>
    </div>
  );
}

// ── ABOUT PAGE ────────────────────────────────────────────
export function AboutPage({setPage}){
  const coaches = [
    {
      img:"/carlos.jpg",
      role:"Head Coach & Founder",
      name:"Carlos Cepeda",
      bio:"Former professional soccer player. Carlos built La Forja from the ground up — every drill, every session structure, every standard is his. Coaching is not just a job; it's a calling to give back what the game gave him.",
      tag:"Pro background · James Island native"
    },
    {
      img:"/waldo-jr.jpg",
      role:"Assistant Coach",
      name:"Waldo Cepeda Jr.",
      bio:"A natural communicator on the field, Waldo Jr. brings energy and precision to every session. He pushes players to compete at a higher level and holds the standard on every rep.",
      tag:"Technical focus · Player development"
    },
    {
      img:"/waldo-sr.jpg",
      role:"Coach",
      name:"Waldo Cepeda Sr.",
      bio:"A seasoned presence with a deep understanding of the game, Waldo Sr. brings experience and calm to the training environment. His knowledge of the game at every level keeps La Forja grounded in fundamentals.",
      tag:"Experience · Fundamentals"
    },
  ];
  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"clamp(40px,6vw,70px) clamp(16px,4vw,28px) 100px"}}>
      <SH eyebrow="The Program" title="About La Forja"/>

      {/* Mission statement */}
      <div style={{background:"#0d0b08",border:`1px solid #1e1810`,borderRadius:14,padding:"24px 28px",marginBottom:48}}>
        <p style={{fontSize:14,color:C.textMid,fontFamily:D.body,lineHeight:2,margin:"0 0 16px"}}>La Forja is not a fitness program. There are no laps, no generic drills, no running for the sake of running. Every single minute is spent on the ball — perfecting the technical details that actually show up on game day. First touch, decision making, 1v1 situations, finishing under pressure.</p>
        <p style={{fontSize:14,color:C.textMid,fontFamily:D.body,lineHeight:2,margin:"0 0 16px"}}>We keep groups small on purpose. Five players maximum means every player gets individual attention, real feedback on every rep, and a coach who knows exactly where their game needs to improve.</p>
        <p style={{fontSize:14,color:C.textMid,fontFamily:D.body,lineHeight:2,margin:0}}>Players leave every session knowing exactly what they worked on and what to focus on before next week. That's the standard.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginTop:24}}>
          {[["📍","Bayview Park, James Island"],["⚽","U9+ · All positions"],["🔥","Fridays · 5:30–6:45 PM"],["👥","Max 5 per session"]].map(([icon,text],i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",background:C.card,borderRadius:9,padding:"10px 12px",border:`1px solid ${C.cardBorder}`}}>
              <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
              <span style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.6}}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coaching staff */}
      <div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:20}}>Coaching Staff</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:20,marginBottom:48}}>
        {coaches.map((coach,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,overflow:"hidden"}}>
            <div style={{width:"100%",height:260,overflow:"hidden",background:"#111",position:"relative"}}>
              <img
                src={coach.img}
                alt={coach.name}
                style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",display:"block"}}
                onError={e=>{e.target.style.display="none"; e.target.parentNode.style.background="#111116";}}
              />
              {i===0&&<div style={{position:"absolute",top:10,right:10,background:`${C.red}cc`,borderRadius:6,padding:"3px 8px",fontSize:8,color:C.white,letterSpacing:2,fontFamily:D.body,textTransform:"uppercase"}}>Founder</div>}
            </div>
            <div style={{padding:"16px 18px"}}>
              <div style={{fontSize:8,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:5}}>{coach.role}</div>
              <div style={{fontSize:18,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:8}}>{coach.name}</div>
              <p style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8,margin:"0 0 10px"}}>{coach.bio}</p>
              <div style={{fontSize:9,color:C.silverDim,fontFamily:D.body,letterSpacing:1}}>{coach.tag}</div>
            </div>
          </div>
        ))}
      </div>

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
    <div style={{maxWidth:520,margin:"0 auto",padding:"clamp(30px,5vw,60px) clamp(14px,4vw,24px) 100px"}}>
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
    <div style={{maxWidth:700,margin:"0 auto",padding:"clamp(30px,5vw,60px) clamp(14px,4vw,24px) 100px"}}>
      <SH eyebrow="Invest in the Process" title="Training Packages"/>
      <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:36}}>Single sessions are great to start. Packages are for players who are serious about getting better.</p>
      <div style={{display:"grid",gap:14,marginBottom:40}}>
        {[
          {name:"Single Session",price:"$40",rate:"$40/session",sessions:"1 session",desc:"Try it out. No commitment. Show up, work hard, see what La Forja is about.",cta:"Book Now",highlight:false},
          {name:"4 Sessions",price:"$140",rate:"$35/session",sessions:"4 sessions",save:"Save $20",desc:"One Friday per week for a month. Good for players building a rhythm.",cta:"Book 4 Sessions",highlight:false},
          {name:"Full Month",price:"$260",rate:"$32/session",sessions:"8 sessions",save:"Save $60",desc:"Both Friday sessions every week for a full month. This is where real development happens.",cta:"Book Full Month",highlight:true},
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
