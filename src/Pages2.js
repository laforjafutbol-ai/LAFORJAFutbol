import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth, googleProvider } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, PRICE_1ON1, POSITIONS, DAY_SCHEDULE, PRIVATE_SCHEDULE, AGE_COLORS, SKILL_COLORS, DAY_ABBR, COACH_DAYS, PRIVATE_DAYS, STRIPE_ENABLED, stripePromise, dKey, fmtDate, getDates, getPrivateDates, callEmailAPI, sendReminderEmail, Crest, SH, SC, FL, AB, GB, NB, IS, GStyles } from "./constants";
export function AuthPage({setPage,authChecked,user}){
  const [mode,setMode]   = useState("login"); // login | signup | reset
  const [name,setName]   = useState("");
  const [email,setEmail] = useState("");
  const [pw,setPw]       = useState("");
  const [err,setErr]     = useState("");
  const [busy,setBusy]   = useState(false);
  const [resetSent,setResetSent] = useState(false);

  useEffect(()=>{
    if(authChecked && user) setPage("account");
  },[authChecked,user]);

  async function handleEmailAuth(e){
    e.preventDefault();
    setErr(""); setBusy(true);
    try{
      if(mode==="signup"){
        const cred = await createUserWithEmailAndPassword(auth,email,pw);
        if(name) await updateProfile(cred.user,{displayName:name});
        // Send email verification
        try{ await cred.user.sendEmailVerification(); }catch(e){}
        // Send welcome email with instructions
        try{ await callEmailAPI({
          name: name||"there",
          email: email,
          subject: "Welcome to La Forja — Verify Your Email & Access Your Sessions",
          message: `Hi ${name||"there"},\n\nWelcome to La Forja Futbol! Your account is almost set up.\n\nIMPORTANT: Please verify your email address by clicking the link we just sent you. Once verified, any sessions you've previously booked with this email address will automatically appear in your account.\n\nHere's what you can do once verified:\n\n1. Book Sessions — Book The Furnace (group) or The Tempering (1-on-1) directly from your account. No re-entering your info.\n\n2. Add Player Profiles — Save your player's name, age, and position so booking takes 10 seconds next time.\n\n3. View Upcoming Sessions — See everything you have booked in one place.\n\n4. Request Reschedules — Need to move a session? Log in, tap Reschedule on any upcoming session, pick a new date from the available spots, and submit. Coach Carlos will confirm within 24 hours.\n\nIf you ever have questions, reply to this email or use the Contact page on the site.\n\nSee you on the field.\n\nCoach Carlos\nLa Forja Futbol\nlaforjafutbol.com`,
        }, "contact"); }catch(e){}
      } else {
        await signInWithEmailAndPassword(auth,email,pw);
      }
    }catch(error){
      setErr(friendlyAuthError(error.code));
    }
    setBusy(false);
  }

  async function handleGoogle(){
    setErr(""); setBusy(true);
    try{
      await signInWithPopup(auth,googleProvider);
    }catch(error){
      setErr(friendlyAuthError(error.code));
    }
    setBusy(false);
  }

  async function handleReset(e){
    e.preventDefault();
    setErr(""); setBusy(true);
    try{
      await sendPasswordResetEmail(auth,email);
      setResetSent(true);
    }catch(error){
      setErr(friendlyAuthError(error.code));
    }
    setBusy(false);
  }

  function friendlyAuthError(code){
    const map = {
      "auth/email-already-in-use":"That email is already registered — try signing in instead.",
      "auth/invalid-email":"That email address doesn't look right.",
      "auth/weak-password":"Password should be at least 6 characters.",
      "auth/user-not-found":"No account found with that email.",
      "auth/wrong-password":"Incorrect password. Try again or reset it.",
      "auth/invalid-credential":"Incorrect email or password.",
      "auth/popup-closed-by-user":"Sign-in was cancelled.",
      "auth/too-many-requests":"Too many attempts — please wait a moment and try again.",
    };
    return map[code] || "Something went wrong. Please try again.";
  }

  return(
    <div style={{maxWidth:440,margin:"0 auto",padding:"120px 24px 80px",animation:"none"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <Crest size={52}/>
        <div style={{fontSize:10,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",marginTop:14,marginBottom:5,fontFamily:D.body}}>
          {mode==="signup"?"Create Account":mode==="reset"?"Reset Password":"Welcome Back"}
        </div>
        <h2 style={{margin:0,fontSize:24,fontWeight:600,color:C.white,fontFamily:D.display}}>
          {mode==="signup"?"Sign Up for La Forja":mode==="reset"?"Reset Your Password":"Sign In to Your Account"}
        </h2>
        <p style={{margin:"10px 0 0",fontSize:12,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>
          {mode==="signup"?"Book sessions faster, track your history, and manage upcoming training.":
           mode==="reset"?"Enter your email and we'll send you a reset link.":
           "Access your bookings, upcoming sessions, and account details."}
        </p>
      </div>

      {mode!=="reset"&&(
        <>
          <button onClick={handleGoogle} disabled={busy} style={{width:"100%",background:C.card,border:`1px solid ${C.cardBorder}`,color:C.white,borderRadius:10,padding:"13px 20px",fontSize:13,cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:14}}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.69-.35-1.42-.35-2.09s.13-1.4.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"18px 0"}}>
            <div style={{flex:1,height:1,background:C.cardBorder}}/>
            <span style={{fontSize:10,color:C.silverDark,letterSpacing:2,textTransform:"uppercase",fontFamily:D.body}}>or</span>
            <div style={{flex:1,height:1,background:C.cardBorder}}/>
          </div>
        </>
      )}

      {mode==="reset"?(
        resetSent?(
          <div style={{background:C.greenDark,border:`1px solid ${C.green}33`,borderRadius:12,padding:"18px",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:8}}>✓</div>
            <div style={{fontSize:13,color:C.green,fontFamily:D.body,marginBottom:4,fontWeight:600}}>Reset link sent!</div>
            <div style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>Check {email} for instructions to reset your password.</div>
          </div>
        ):(
          <form onSubmit={handleReset}>
            <div style={{marginBottom:14}}>
              <FL>Email Address</FL>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={IS}/>
            </div>
            {err&&<div style={{fontSize:12,color:C.red,marginBottom:14,fontFamily:D.body}}>{err}</div>}
            <button onClick={handleSave} disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1}}>
              {busy?"Sending…":"Send Reset Link"}
            </button>
          </form>
        )
      ):(
        <form onSubmit={handleEmailAuth}>
          {mode==="signup"&&(
            <div style={{marginBottom:14}}>
              <FL>Full Name</FL>
              <input type="text" required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={IS}/>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <FL>Email Address</FL>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={IS}/>
          </div>
          <div style={{marginBottom:14}}>
            <FL>Password</FL>
            <input type="password" required minLength={6} value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" style={IS}/>
          </div>
          {err&&<div style={{fontSize:12,color:C.red,marginBottom:14,fontFamily:D.body}}>{err}</div>}
          <button onClick={handleSave} disabled={busy} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"14px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1,marginBottom:14}}>
            {busy?"Please wait…":mode==="signup"?"Create Account":"Sign In"}
          </button>
          {mode==="login"&&(
            <div style={{textAlign:"center"}}>
              <button type="button" onClick={()=>{setMode("reset");setErr("");}} style={{background:"none",border:"none",color:C.silver,fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline"}}>Forgot your password?</button>
            </div>
          )}
        </form>
      )}

      <div style={{textAlign:"center",marginTop:24,paddingTop:20,borderTop:`1px solid ${C.cardBorder}`}}>
        {mode==="signup"?(
          <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>Already have an account? <button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",color:C.silverBright,cursor:"pointer",fontFamily:D.body,fontWeight:600,textDecoration:"underline"}}>Sign in</button></span>
        ):mode==="reset"?(
          <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}><button onClick={()=>{setMode("login");setErr("");setResetSent(false);}} style={{background:"none",border:"none",color:C.silverBright,cursor:"pointer",fontFamily:D.body,fontWeight:600,textDecoration:"underline"}}>← Back to sign in</button></span>
        ):(
          <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>New to La Forja? <button onClick={()=>{setMode("signup");setErr("");}} style={{background:"none",border:"none",color:C.silverBright,cursor:"pointer",fontFamily:D.body,fontWeight:600,textDecoration:"underline"}}>Create an account</button></span>
        )}
      </div>
    </div>
  );
}

// ── ACCOUNT PAGE ──────────────────────────────────────────
export function AccountPage({setPage,user,authChecked,bookings,inquiries,getDates,getPrivateDates}){
  const [tab,setTab] = useState("upcoming");
  const [players,setPlayers] = useState([]);
  const [playersLoaded,setPlayersLoaded] = useState(false);
  const [requestModal,setRequestModal] = useState(null);
  const [reschedDate,setReschedDate] = useState(null);
  const [reschedSess,setReschedSess] = useState(null);

  useEffect(()=>{
    if(authChecked && !user) setPage("login");
  },[authChecked,user]);

  // Don't render anything until auth is checked
  if(!authChecked) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",paddingTop:80}}>
      <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,letterSpacing:4,textTransform:"uppercase"}}>Loading…</div>
    </div>
  );

  // Load saved player profiles
  useEffect(()=>{
    if(!user) return;
    const q = collection(db,"users",user.uid,"players");
    const unsub = onSnapshot(q, s=>{
      setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));
      setPlayersLoaded(true);
    });
    return unsub;
  },[user]);

  // Auto-link guest bookings by email when account is verified
  useEffect(()=>{
    if(!user||!user.emailVerified||!user.email) return;
    async function linkGuestBookings(){
      try{
        const { collection:col, query:q, where, getDocs, updateDoc:upDoc, doc:d } = await import("firebase/firestore");
        // Find unlinked bookings with matching email
        const bSnap = await getDocs(q(col(db,"bookings"),where("email","==",user.email)));
        for(const bDoc of bSnap.docs){
          if(!bDoc.data().userId){
            await upDoc(d(db,"bookings",bDoc.id),{userId:user.uid,linkedAt:new Date().toISOString()});
          }
        }
        // Find unlinked inquiries with matching email
        const iSnap = await getDocs(q(col(db,"inquiries"),where("email","==",user.email)));
        for(const iDoc of iSnap.docs){
          if(!iDoc.data().userId){
            await upDoc(d(db,"inquiries",iDoc.id),{userId:user.uid,linkedAt:new Date().toISOString()});
          }
        }
      }catch(e){ console.log("Link error:",e); }
    }
    linkGuestBookings();
  },[user?.uid, user?.emailVerified]);

  if(!user) return null; // handled by authChecked effect above

  const email = user.email;
  const myBookings  = bookings.filter(b=>b.userId===user.uid || (b.email && b.email.toLowerCase()===email?.toLowerCase()));
  const myInquiries = inquiries.filter(i=>i.userId===user.uid || (i.email && i.email.toLowerCase()===email?.toLowerCase()));

  // Combine into unified session list
  const allSessions = [
    ...myBookings.map(b=>({...b, type:"group", _time:b.sessTime, _date:b.dateKey, _collection:"bookings"})),
    ...myInquiries.map(i=>({...i, type:"1on1", _time:i.slotTime||i.sessTime, _date:i.dateKey, total:i.price||i.total, _collection:"inquiries"})),
  ].sort((a,b)=>a._date>b._date?1:-1);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split("T")[0];

  const upcoming = allSessions.filter(s=>s._date>=todayStr && s.status!=="cancelled" && s.status!=="removed");
  const past     = allSessions.filter(s=>s._date<todayStr || s.status==="cancelled" || s.status==="removed");

  const packBookings = myBookings.filter(b=>b.packageBooking);
  const packUsed = packBookings.filter(b=>b._date<todayStr||b.status==="confirmed").length;
  const packTotal = packBookings.length;
  const packRemaining = Math.max(0, packTotal - packUsed);
  const hasPack = packTotal > 0;
  const statusLabel = {confirmed:"Confirmed", pending:"Pending Payment", cancelled:"Cancelled", removed:"Cancelled", scheduled:"Confirmed", change_requested:"Change Requested"};

  const statusColor = {
    confirmed:C.green, pending:C.gold, scheduled:C.green,
    cancelled:C.red, removed:C.red, change_requested:C.silver,
    tentative:C.gold,
  };

  async function handleSignOut(){
    await signOut(auth);
    setPage("home");
  }

  async function submitRequest(session, action, note){
    const requestedNew = reschedDate && reschedSess
      ? `${fmtDate(reschedDate)} · ${reschedSess.time}`
      : null;

    await updateDoc(doc(db, session._collection, session.id), {
      requestType: action,
      requestNote: note || "",
      requestedNewDate: requestedNew || null,
      requestedAt: new Date().toISOString(),
    });
    await callEmailAPI({
      name: user.displayName || session.name || "Account holder",
      email: user.email,
      subject: (action==="cancel"?"Cancellation Request":"Reschedule Request") + " — " + session.dateLabel,
      message: `${action==="cancel"?"Cancellation":"Reschedule"} request for session on ${session.dateLabel} at ${session._time}.${requestedNew?`\n\nRequested new date: ${requestedNew}`:""}\n\n${note?("Note: "+note):""}`,
    }, "contact");
    setRequestModal(null);
    setReschedDate(null);
    setReschedSess(null);
  }

  return(
    <div style={{maxWidth:760,margin:"0 auto",padding:"110px 24px 80px"}}>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#1c130a,#120d06)`,border:`1px solid ${C.gold}22`,borderRadius:16,padding:"22px 24px",marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:46,height:46,borderRadius:"50%",background:C.redDark,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⚽</div>
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>La Forja Account</div>
            <div style={{fontSize:22,fontWeight:600,color:C.white,fontFamily:D.display}}>{user.displayName?.split(" ")[0]||"Welcome back"}</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:2}}>{email}</div>
          </div>
        </div>
        <button onClick={handleSignOut} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:8,padding:"9px 18px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Sign Out</button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {[
          {label:"Upcoming",value:upcoming.length,color:C.gold},
          {label:"Completed",value:past.filter(s=>s.status==="confirmed"||s.status==="scheduled").length,color:C.green},
          {label:"Total",value:allSessions.length,color:C.silverBright},
        ].map((s,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:26,fontWeight:700,color:s.color,fontFamily:D.display,marginBottom:3}}>{s.value}</div>
            <div style={{fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Package counter */}
      {hasPack&&(
        <div style={{background:`linear-gradient(135deg,#1a1209,#120d06)`,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:16}}>
          <div style={{fontSize:28}}>📦</div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,letterSpacing:3,color:C.goldDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>4-Session Package</div>
            <div style={{fontSize:13,color:C.white,fontFamily:D.body,marginBottom:8}}>{packRemaining} of {packTotal} sessions remaining</div>
            {/* Progress bar */}
            <div style={{background:"#1a1209",borderRadius:6,height:6,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${((packTotal-packRemaining)/packTotal)*100}%`,background:`linear-gradient(90deg,${C.gold},${C.goldDim})`,borderRadius:6,transition:"width 0.5s ease"}}/>
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:24,fontWeight:700,color:C.gold,fontFamily:D.display}}>{packRemaining}</div>
            <div style={{fontSize:9,color:C.goldDim,fontFamily:D.body,letterSpacing:1}}>LEFT</div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
        <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px 16px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>🔥 Book The Furnace</button>
        <button onClick={()=>setPage("private")} style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"13px 16px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>⚒️ Book The Tempering</button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["upcoming",`Upcoming (${upcoming.length})`],["past",`Past (${past.length})`],["players",`Players (${players.length})`]].map(([key,lbl])=>(
          <button key={key} onClick={()=>setTab(key)} style={{background:tab===key?`linear-gradient(135deg,${C.goldDark},#1c0e04)`:C.card,border:tab===key?`1px solid ${C.gold}44`:`1px solid ${C.cardBorder}`,color:tab===key?C.gold:C.textDim,borderRadius:8,padding:"9px 18px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:tab===key?600:400,transition:"all 0.2s"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      {tab!=="players"&&(
        <div style={{display:"grid",gap:10}}>
          {(tab==="upcoming"?upcoming:past).length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:C.textDim,fontSize:13,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14}}>
              {tab==="upcoming"?"No upcoming sessions — ready to book one?":"No past sessions on record yet."}
            </div>
          ):(tab==="upcoming"?upcoming:past).map((s,i)=>(
            <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${statusColor[s.status]||C.silverDark}`,borderRadius:12,padding:"16px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display}}>{s.dateLabel}</span>
                    <span style={{fontSize:9,padding:"2px 9px",borderRadius:10,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body,background:`${statusColor[s.status]}1a`,color:statusColor[s.status]||C.silverDim,border:`1px solid ${statusColor[s.status]||C.silverDark}33`}}>
                      {statusLabel[s.status]||s.status}
                    </span>
                    {s.requestType&&(
                      <span style={{fontSize:9,padding:"2px 9px",borderRadius:10,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body,background:"rgba(168,168,188,0.1)",color:C.silver,border:`1px solid ${C.silver}33`}}>
                        {s.requestType==="cancel"?"Cancel Requested":"Reschedule Requested"}
                      </span>
                    )}
                    {s.status==="tentative"&&(
                      <span style={{fontSize:9,padding:"2px 9px",borderRadius:10,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body,background:`${C.gold}15`,color:C.gold,border:`1px solid ${C.gold}33`}}>
                        ⏰ Time TBD
                      </span>
                    )}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",marginBottom:s.location?5:0}}>
                    <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>🕐 {s._time||s.sessTime||s.slotTime||"TBD"}</span>
                    {s.type==="group"?(
                      <>
                        <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>🔥 {s.skill||"The Furnace"}</span>
                        <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>👥 {s.count||1} player{(s.count||1)>1?"s":""}</span>
                      </>
                    ):(
                      <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>⚒️ The Tempering{s.position?` · ${s.position}`:""}</span>
                    )}
                  </div>
                  {s.location&&<div style={{fontSize:11,color:C.silverDim,fontFamily:D.body,marginTop:4}}>📍 {s.location}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:C.gold,fontFamily:D.display}}>${s.total||s.price||0}</div>
                </div>
              </div>
              {tab==="upcoming"&&!s.requestType&&(
                <div style={{display:"flex",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`}}>
                  <button onClick={()=>setRequestModal({session:s,action:"reschedule"})} style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.silver,borderRadius:8,padding:"7px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
                    Reschedule
                  </button>
                </div>
              )}
              {s.requestType&&(
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`,fontSize:11,color:C.textDim,fontFamily:D.body}}>
                  Coach Carlos has been notified — you'll hear back by email.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Players tab */}
      {tab==="players"&&<PlayersTab user={user} players={players} playersLoaded={playersLoaded}/>}

      {/* Request modal */}
      {requestModal&&<RequestModal
        session={requestModal.session}
        action={requestModal.action}
        onClose={()=>{setRequestModal(null);setReschedDate(null);setReschedSess(null);}}
        onSubmit={submitRequest}
        getDates={getDates}
        getPrivateDates={getPrivateDates}
        reschedDate={reschedDate}
        setReschedDate={setReschedDate}
        reschedSess={reschedSess}
        setReschedSess={setReschedSess}
      />}

      {/* Questions / contact */}
      <div style={{marginTop:32}}>
        <ContactForm user={user}/>
      </div>
    </div>
  );
}

// ── REQUEST MODAL (Reschedule only) ──────────────────────
export function RequestModal({session,action,onClose,onSubmit,getDates,getPrivateDates,reschedDate,setReschedDate,reschedSess,setReschedSess}){
  const [note,setNote] = useState("");
  const [busy,setBusy] = useState(false);
  const is1on1 = session?.type==="1on1";
  const availDates = is1on1 ? (getPrivateDates?getPrivateDates():[]) : (getDates?getDates():[]);

  async function handleSubmit(){
    if(!reschedDate||!reschedSess) return;
    setBusy(true);
    await onSubmit(session, "reschedule", note);
    setBusy(false);
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#111",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"24px",maxWidth:480,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>Request Reschedule</div>
            <div style={{fontSize:16,fontWeight:600,color:C.white,fontFamily:D.display}}>{session.dateLabel} · {session._time}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,width:30,height:30,color:C.textDim,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
        </div>

        {/* Info */}
        <div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}22`,borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.7}}>Pick your preferred new date below. Coach Carlos will review and confirm by email within 24 hours.</div>
        </div>

        {/* Date picker */}
        <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Select Preferred Date</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
          {availDates.map((d,i)=>{
            const sel=reschedDate&&dKey(d)===dKey(reschedDate);
            return(
              <button key={i} onClick={()=>{setReschedDate(d);setReschedSess(null);}}
                style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"8px 4px",cursor:"pointer",textAlign:"center",color:C.white}}>
                <div style={{fontSize:8,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{is1on1?d.toLocaleDateString("en-US",{weekday:"short"}).slice(0,3).toUpperCase():(DAY_ABBR[d.getDay()]||d.toLocaleDateString("en-US",{weekday:"short"}).slice(0,3).toUpperCase())}</div>
                <div style={{fontSize:15,fontWeight:700,fontFamily:D.display}}>{d.getDate()}</div>
                <div style={{fontSize:8,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
              </button>
            );
          })}
        </div>

        {/* Session/slot picker */}
        {reschedDate&&!is1on1&&(()=>{
          const sched=DAY_SCHEDULE[reschedDate.getDay()];
          if(!sched) return null;
          return(<>
            <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Select Session Time</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
              {sched.sessions.map(sess=>{
                const sel=reschedSess?.id===sess.id;
                return(
                  <button key={sess.id} onClick={()=>setReschedSess(sess)}
                    style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"10px 10px",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:11,fontWeight:600,color:sel?C.gold:C.white,fontFamily:D.display}}>{sess.time}</div>
                    <div style={{fontSize:10,color:sel?C.gold:C.textDim,fontFamily:D.body}}>{sess.ageGroup}</div>
                  </button>
                );
              })}
            </div>
          </>);
        })()}

        {reschedDate&&is1on1&&(()=>{
          const sched=PRIVATE_SCHEDULE[reschedDate.getDay()];
          if(!sched) return null;
          return(<>
            <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Select Time Slot</div>
            <div style={{display:"grid",gap:6,marginBottom:14}}>
              {sched.slots.map(slot=>{
                const sel=reschedSess?.id===slot.id;
                return(
                  <button key={slot.id} onClick={()=>setReschedSess(slot)}
                    style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:600,color:sel?C.gold:C.white,fontFamily:D.display}}>{slot.time}</span>
                    {sel&&<span style={{fontSize:10,color:C.gold,fontFamily:D.body}}>Selected ✓</span>}
                  </button>
                );
              })}
            </div>
          </>);
        })()}

        {/* Confirmation */}
        {reschedDate&&reschedSess&&(
          <div style={{background:`${C.green}10`,border:`1px solid ${C.green}33`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:11,color:C.green,fontFamily:D.body}}>✓ Requesting: {fmtDate(reschedDate)} · {reschedSess.time}</div>
          </div>
        )}

        {/* Note */}
        <div style={{marginBottom:16}}>
          <FL>Additional Note (optional)</FL>
          <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Anything else Coach Carlos should know..." style={IS}/>
        </div>

        {/* Submit */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={handleSubmit} disabled={busy||!reschedDate||!reschedSess}
            style={{flex:1,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",color:"#0a0a0a",borderRadius:10,padding:"13px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:(busy||!reschedDate||!reschedSess)?"not-allowed":"pointer",fontFamily:D.body,fontWeight:600,opacity:(busy||!reschedDate||!reschedSess)?0.5:1}}>
            {busy?"Sending…":"Send Reschedule Request"}
          </button>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:10,padding:"13px 16px",fontSize:11,cursor:"pointer",fontFamily:D.body}}>
            Back
          </button>
        </div>

        {/* How it works */}
        <div style={{marginTop:14,padding:"10px 14px",background:"#0d0d0d",borderRadius:8,border:`1px solid #1a1a1a`}}>
          <div style={{fontSize:9,letterSpacing:2,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>How this works</div>
          <div style={{fontSize:10,color:"#555",fontFamily:D.body,lineHeight:1.8}}>
            1. Pick your preferred new date and time above<br/>
            2. Submit your request<br/>
            3. Coach Carlos reviews and confirms within 24 hours<br/>
            4. You'll get a confirmation email once your session is moved
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PLAYERS TAB (Saved Player Profiles) ──────────────────
export function PlayersTab({user,players,playersLoaded}){
  const [showForm,setShowForm] = useState(false);
  const [editId,setEditId]     = useState(null);
  const [confirmDeleteId,setConfirmDeleteId] = useState(null);
  const [form,setForm] = useState({name:"",age:"",position:"",notes:""});

  function startEdit(p){
    setEditId(p.id);
    setForm({name:p.name||"",age:p.age||"",position:p.position||"",notes:p.notes||""});
    setShowForm(true);
  }
  function startNew(){
    setEditId(null);
    setForm({name:"",age:"",position:"",notes:""});
    setShowForm(true);
  }

  async function handleSave(e){
    e.preventDefault();
    if(!form.name.trim()) return;
    if(editId){
      await updateDoc(doc(db,"users",user.uid,"players",editId), {...form});
    } else {
      await addDoc(collection(db,"users",user.uid,"players"), {...form, createdAt:new Date().toISOString()});
    }
    setShowForm(false);
  }

  async function handleDelete(id){
    await deleteDoc(doc(db,"users",user.uid,"players",id));
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <p style={{fontSize:12,color:C.textDim,fontFamily:D.body,lineHeight:1.7,margin:0,maxWidth:440}}>
          Save your players' info so booking is faster — their name, age, and position pre-fill automatically.
        </p>
        <button onClick={startNew} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"10px 20px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500,whiteSpace:"nowrap"}}>
          + Add Player
        </button>
      </div>

      {showForm&&(
        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 22px",marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div><FL>Player Name</FL><input type="text" required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Jake Smith" style={IS}/></div>
            <div><FL>Age</FL><input type="number" value={form.age} onChange={e=>setForm(p=>({...p,age:e.target.value}))} placeholder="e.g. 10" style={IS}/></div>
          </div>
          <div style={{marginBottom:14}}>
            <FL>Preferred Position</FL>
            <select value={form.position} onChange={e=>setForm(p=>({...p,position:e.target.value}))} style={IS}>
              <option value="">No preference</option>
              {POSITIONS.map(pos=><option key={pos.id} value={pos.id}>{pos.full} ({pos.label})</option>)}
            </select>
          </div>
          <div style={{marginBottom:16}}>
            <FL>Notes (optional)</FL>
            <textarea rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Anything Coach Carlos should know..." style={IS}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={handleSave} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"11px 22px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>
              {editId?"Save Changes":"Add Player"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:10,padding:"11px 18px",fontSize:11,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{display:"grid",gap:10}}>
        {!playersLoaded?(
          <div style={{textAlign:"center",padding:30,color:C.textDim,fontSize:12,fontFamily:D.body}}>Loading…</div>
        ):players.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:13,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14}}>
            No players saved yet.
          </div>
        ):players.map(p=>(
          <div key={p.id} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:3}}>{p.name}</div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>
                {p.age&&`Age ${p.age}`}{p.position&&` · ${POSITIONS.find(x=>x.id===p.position)?.full||p.position}`}
              </div>
              {p.notes&&<div style={{fontSize:11,color:C.silverDim,fontFamily:D.body,marginTop:4,fontStyle:"italic"}}>{p.notes}</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>startEdit(p)} style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.silver,borderRadius:8,padding:"7px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Edit</button>
              {confirmDeleteId===p.id?(
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Remove?</span>
                  <button onClick={()=>{handleDelete(p.id);setConfirmDeleteId(null);}} style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,color:C.red,borderRadius:6,padding:"5px 10px",fontSize:9,cursor:"pointer",fontFamily:D.body}}>Yes</button>
                  <button onClick={()=>setConfirmDeleteId(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:6,padding:"5px 8px",fontSize:9,cursor:"pointer",fontFamily:D.body}}>No</button>
                </div>
              ):(
                <button onClick={()=>setConfirmDeleteId(p.id)} style={{background:"transparent",border:`1px solid ${C.redDim}`,color:C.redDim,borderRadius:8,padding:"7px 14px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CONTACT FORM ──────────────────────────────────────────
export function ContactForm({user}){
  const [name,setName]       = useState(user?.displayName || "");
  const [email,setEmail]     = useState(user?.email || "");
  const [subject,setSubject] = useState("");
  const [message,setMessage] = useState("");
  const [sent,setSent]       = useState(false);
  const [busy,setBusy]       = useState(false);
  const [err,setErr]         = useState("");

  async function handleSubmit(e){
    e.preventDefault();
    if(!message.trim()) return;
    setBusy(true); setErr("");
    try{
      await callEmailAPI({
        name: name || user?.displayName || "Website visitor",
        email: email || user?.email || "",
        subject: subject || "Question from Website",
        message,
      }, "contact");
      setSent(true);
      setSubject(""); setMessage("");
      if(!user) { setName(""); setEmail(""); }
    }catch(error){
      setErr("Couldn't send your message — please email laforjafutbol@gmail.com directly.");
    }
    setBusy(false);
  }

  return(
    <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 22px"}}>
      <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",marginBottom:6,fontFamily:D.body}}>Need Help?</div>
      <div style={{fontSize:15,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:14}}>Send a Question to Coach Carlos</div>
      {sent?(
        <div style={{background:C.greenDark,border:`1px solid ${C.green}33`,borderRadius:10,padding:"16px",textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:6}}>✓</div>
          <div style={{fontSize:13,color:C.green,fontFamily:D.body,fontWeight:600,marginBottom:3}}>Message sent!</div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Coach Carlos will get back to you by email soon.</div>
          <button onClick={()=>setSent(false)} style={{marginTop:12,background:"none",border:"none",color:C.silver,fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline"}}>Send another message</button>
        </div>
      ):(
        <form onSubmit={handleSubmit}>
          {!user&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><FL>Your Name</FL><input type="text" required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={IS}/></div>
              <div><FL>Your Email</FL><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={IS}/></div>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <FL>Subject (optional)</FL>
            <input type="text" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Rescheduling a session" style={IS}/>
          </div>
          <div style={{marginBottom:14}}>
            <FL>Your Message</FL>
            <textarea required rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your question here..." style={IS}/>
          </div>
          {err&&<div style={{fontSize:12,color:C.red,marginBottom:12,fontFamily:D.body}}>{err}</div>}
          <button onClick={handleSave} disabled={busy} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"12px 24px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1}}>
            {busy?"Sending…":"Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── CONTACT PAGE (standalone) ────────────────────────────
export function ContactPage({setPage,user}){
  return(
    <div style={{maxWidth:560,margin:"0 auto",padding:"110px 24px 80px",animation:"none"}}>
      <SH eyebrow="Get in Touch" title="Questions & Comments"/>
      <p style={{fontSize:13,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:24}}>
        Have a question about sessions, scheduling, pricing, or anything else? Send a message below and Coach Carlos will get back to you by email — usually within a day.
      </p>
      <ContactForm user={user}/>
      <div style={{marginTop:24,textAlign:"center"}}>
        <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>Prefer email? Reach out directly at </span>
        <a href="mailto:laforjafutbol@gmail.com" style={{fontSize:12,color:C.silverBright,fontFamily:D.body,textDecoration:"none"}}>laforjafutbol@gmail.com</a>
      </div>
    </div>
  );
}

// ── REVIEWS PAGE ──────────────────────────────────────────
export function ReviewsPage({setPage,user}){
  const [reviews,setReviews] = useState([]);
  const [loaded,setLoaded]   = useState(false);
  const [showForm,setShowForm] = useState(false);
  const [name,setName]       = useState(user?.displayName || "");
  const [rating,setRating]   = useState(5);
  const [text,setText]       = useState("");
  const [sent,setSent]       = useState(false);
  const [busy,setBusy]       = useState(false);

  useEffect(()=>{
    const q = query(collection(db,"reviews"),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, s=>{
      setReviews(s.docs.map(d=>({id:d.id,...d.data()})));
      setLoaded(true);
    });
    return unsub;
  },[]);

  async function handleSubmit(e){
    e.preventDefault();
    if(!text.trim()||!name.trim()) return;
    setBusy(true);
    try{
      await addDoc(collection(db,"reviews"),{
        name: name.trim(),
        rating,
        text: text.trim(),
        email: user?.email || "",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setSent(true);
      setText("");
      setRating(5);
    }catch(error){
      console.error(error);
    }
    setBusy(false);
  }

  const approved = reviews.filter(r=>r.status==="approved");
  const avgRating = approved.length ? (approved.reduce((s,r)=>s+r.rating,0)/approved.length).toFixed(1) : null;

  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"110px 24px 80px",animation:"none"}}>
      <SH eyebrow="Client Feedback" title="Reviews & Feedback"/>

      {avgRating&&(
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"18px 22px"}}>
          <div style={{fontSize:36,fontWeight:700,color:C.gold,fontFamily:D.display}}>{avgRating}</div>
          <div>
            <div style={{color:C.gold,fontSize:16,letterSpacing:2,marginBottom:3}}>{"★".repeat(Math.round(avgRating))}{"☆".repeat(5-Math.round(avgRating))}</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Based on {approved.length} review{approved.length!==1?"s":""}</div>
          </div>
        </div>
      )}

      <p style={{fontSize:13,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:20}}>
        Trained with La Forja? Share your experience — it helps other families know what to expect, and helps Coach Carlos keep improving.
      </p>

      {!showForm&&(
        <button onClick={()=>setShowForm(true)} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"12px 24px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500,marginBottom:28}}>
          + Leave a Review
        </button>
      )}

      {showForm&&(
        sent?(
          <div style={{background:C.greenDark,border:`1px solid ${C.green}33`,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:24,marginBottom:8}}>✓</div>
            <div style={{fontSize:14,color:C.green,fontFamily:D.body,fontWeight:600,marginBottom:4}}>Thank you for your feedback!</div>
            <div style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>Your review has been submitted and will appear once approved.</div>
          </div>
        ):(
          <form onSubmit={handleSubmit} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 22px",marginBottom:28}}>
            <div style={{marginBottom:14}}>
              <FL>Your Name</FL>
              <input type="text" required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={IS}/>
            </div>
            <div style={{marginBottom:14}}>
              <FL>Rating</FL>
              <div style={{display:"flex",gap:6}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} type="button" onClick={()=>setRating(n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:28,color:n<=rating?C.gold:C.cardBorder,padding:0,lineHeight:1}}>★</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <FL>Your Review</FL>
              <textarea required rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="Tell us about your experience training with La Forja..." style={IS}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleSave} disabled={busy} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"12px 24px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:500,opacity:busy?0.6:1}}>
                {busy?"Submitting…":"Submit Review"}
              </button>
              <button onClick={()=>setShowForm(false)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:10,padding:"12px 24px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
                Cancel
              </button>
            </div>
          </form>
        )
      )}

      {/* Approved reviews list */}
      <div style={{display:"grid",gap:12}}>
        {!loaded?(
          <div style={{textAlign:"center",padding:40,color:C.textDim,fontSize:12,fontFamily:D.body}}>Loading reviews…</div>
        ):approved.length===0?(
          <div style={{textAlign:"center",padding:40,color:C.textDim,fontSize:12,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14}}>
            No reviews yet — be the first to share your experience!
          </div>
        ):approved.map(r=>(
          <div key={r.id} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:8}}>
              <span style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display}}>{r.name}</span>
              <span style={{color:C.gold,fontSize:13,letterSpacing:1}}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span>
            </div>
            <div style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.7}}>{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── STRIPE CHECKOUT ───────────────────────────────────────
export function StripeCheckoutForm({amount,metadata,onSuccess,onError}){
  const stripe = useStripe();
  const elements = useElements();
  const [busy,setBusy] = useState(false);
  const [err,setErr]   = useState("");

  async function handleSubmit(e){
    e.preventDefault();
    if(!stripe||!elements) return;
    setBusy(true); setErr("");

    const {error,paymentIntent} = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if(error){
      setErr(error.message || "Payment failed. Please try again.");
      setBusy(false);
      onError && onError(error);
    } else if(paymentIntent && paymentIntent.status === "succeeded"){
      onSuccess && onSuccess(paymentIntent);
    } else {
      setBusy(false);
    }
  }

  return(
    <form onSubmit={handleSubmit}>
      <div style={{background:"#100e0b",border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px",marginBottom:14}}>
        <PaymentElement options={{layout:"tabs"}}/>
      </div>
      {err&&<div style={{fontSize:12,color:C.red,marginBottom:12,fontFamily:D.body}}>{err}</div>}
      <button onClick={handleSave} disabled={!stripe||busy} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:12,padding:"15px",fontSize:14,letterSpacing:3,textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",fontFamily:D.body,fontWeight:700,opacity:busy?0.6:1}}>
        {busy?"Processing…":`Pay $${amount}`}
      </button>
      <div style={{textAlign:"center",marginTop:10,fontSize:10,color:C.silverDark,fontFamily:D.body,letterSpacing:1}}>🔒 Secured by Stripe</div>
    </form>
  );
}

export function StripeCheckout({amount,metadata,onSuccess}){
  const [clientSecret,setClientSecret] = useState(null);
  const [err,setErr] = useState("");

  useEffect(()=>{
    fetch("/api/create-payment-intent",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({amount,metadata}),
    })
      .then(r=>r.json())
      .then(data=>{
        if(data.clientSecret) setClientSecret(data.clientSecret);
        else setErr(data.error || "Could not start checkout.");
      })
      .catch(()=>setErr("Could not connect to payment processor."));
  },[amount]);

  if(err) return(
    <div style={{background:C.redDark,border:`1px solid ${C.red}33`,borderRadius:12,padding:"16px",textAlign:"center"}}>
      <div style={{fontSize:12,color:C.red,fontFamily:D.body}}>{err}</div>
      <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:6}}>Try the Venmo option below instead.</div>
    </div>
  );

  if(!clientSecret) return(
    <div style={{textAlign:"center",padding:"24px",color:C.textDim,fontSize:12,fontFamily:D.body}}>Loading payment form…</div>
  );

  const options = {
    clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#ff4d2e",
        colorBackground: "#100e0b",
        colorText: "#e8e8f0",
        colorDanger: "#ff4d2e",
        fontFamily: "DM Sans, sans-serif",
        borderRadius: "8px",
      },
    },
  };

  return(
    <Elements stripe={stripePromise} options={options}>
      <StripeCheckoutForm amount={amount} metadata={metadata} onSuccess={onSuccess}/>
    </Elements>
  );
}

// ── SHARED ────────────────────────────────────────────────

// ── ABOUT ─────────────────────────────────────────────────
// ── SESSIONS PAGE ─────────────────────────────────────────
export function SessionsPage({setPage,user}){
  useEffect(()=>{
    if(user) setPage("account");
  },[user]);
  if(user) return null;
  return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"110px 24px 80px"}}>

      {/* Hero */}
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:9,letterSpacing:5,color:C.goldDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>La Forja Futbol</div>
        <h1 style={{margin:"0 0 16px",fontSize:32,fontWeight:600,color:C.white,fontFamily:D.display}}>Manage Your Sessions</h1>
        <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.8,maxWidth:440,margin:"0 auto"}}>Create a free account to view your upcoming sessions, request reschedules, add player profiles, and book faster every time.</p>
      </div>

      {/* Benefits */}
      <div style={{display:"grid",gap:10,marginBottom:36}}>
        {[
          {icon:"📅", title:"View Upcoming Sessions", desc:"See everything you have booked in one place — dates, times, and session details."},
          {icon:"↗️", title:"Request Reschedules", desc:"Need to move a session? Pick a new date from available spots and submit. Coach Carlos confirms within 24 hours."},
          {icon:"⚡", title:"Book in 10 Seconds", desc:"Save your player's name, age, and position once. Every future booking auto-fills — no re-entering anything."},
          {icon:"👥", title:"Multiple Players", desc:"Add profiles for each of your kids. Select who's training when you book — the count updates automatically."},
        ].map((item,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{width:40,height:40,borderRadius:10,background:`${C.gold}12`,border:`1px solid ${C.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{item.icon}</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>{item.title}</div>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA buttons */}
      <div style={{display:"grid",gap:10,marginBottom:24}}>
        <button onClick={()=>setPage("login")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:12,padding:"15px",fontSize:12,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600}}>
          Create Free Account →
        </button>
        <button onClick={()=>setPage("login")} style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.silver,borderRadius:12,padding:"15px",fontSize:12,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>
          Sign In to Existing Account
        </button>
      </div>

      {/* Guest note */}
      <div style={{background:`${C.gold}08`,border:`1px solid ${C.gold}22`,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
        <div style={{fontSize:12,color:C.gold,fontFamily:D.display,fontWeight:600,marginBottom:6}}>Booked as a guest?</div>
        <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>Create an account using the same email address you booked with. Your existing sessions will appear in your account automatically.</div>
      </div>

    </div>
  );
}

export function AboutPage({setPage}){
  return(
    <div style={{paddingTop:100}}>
      <div style={{maxWidth:800,margin:"0 auto",padding:"50px 24px 80px"}}>
        <SH eyebrow="La Forja" title="Coaching Staff"/>
        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:18,overflow:"hidden",marginBottom:28}}>
          <div style={{height:3,background:`linear-gradient(90deg,${C.red} 0%,${C.gold} 50%,${C.silver} 100%)`}}/>
          <div style={{padding:"32px 28px"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:24,flexWrap:"wrap",marginBottom:26}}>
              <div style={{width:108,height:108,borderRadius:"50%",flexShrink:0,border:`2px solid ${C.gold}`,boxShadow:`0 0 30px ${C.gold}22`,overflow:"hidden"}}>
                <img src="/carlos.jpg" alt="Carlos Cepeda" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top"}}/>
              </div>
              <div style={{paddingTop:8}}>
                <div style={{fontSize:10,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",marginBottom:5,fontFamily:D.body}}>Head Coach & Founder</div>
                <h2 style={{margin:"0 0 5px",fontSize:30,fontWeight:600,color:C.white,fontFamily:D.display,letterSpacing:1}}>Carlos Cepeda</h2>
                <div style={{fontSize:12,color:C.gold,letterSpacing:3,fontFamily:D.body,fontWeight:300,marginBottom:5}}>La Forja · Private Training</div>
                <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>📍 Charleston · James Island · Summerville Area</div>
              </div>
            </div>

            <p style={{margin:"0 0 14px",fontSize:15,color:"#cccccc",lineHeight:1.95,fontFamily:D.display,fontStyle:"italic"}}>
              "I've stood on pitches across Europe and seen firsthand what separates good players from great ones. My mission is to bring that standard here."
            </p>
            <p style={{margin:"0 0 13px",fontSize:13,color:C.textMid,lineHeight:1.9,fontFamily:D.body}}>
              My name is Carlos Cepeda. I'm 24 years old and have been playing soccer for over 20 years. From a young age the game took me places most players only dream of — including the <span style={{color:C.gold}}>Chicago Fire Academy</span>, one of the most prestigious youth programs in the United States.
            </p>
            <p style={{margin:"0 0 13px",fontSize:13,color:C.textMid,lineHeight:1.9,fontFamily:D.body}}>
              My pursuit of the game took me across Europe, where I competed professionally at multiple levels — <span style={{color:C.silver}}>3rd Division in Portugal</span>, <span style={{color:C.silver}}>2nd Division in Malta</span>, and <span style={{color:C.silver}}>1st Division in Andorra</span>. I also developed at <span style={{color:C.gold}}>Marcet Soccer School in Barcelona</span>, where I trained and competed directly against La Liga and Liga 2 clubs, facing national team players and professionals on a regular basis.
            </p>
            <p style={{margin:"0 0 24px",fontSize:13,color:C.textMid,lineHeight:1.9,fontFamily:D.body}}>
              That experience overseas — seeing firsthand the technical level, mentality, and work ethic of players at the highest level — is what drives everything I do at <span style={{color:C.gold}}>La Forja</span>. I created these sessions because I believe every young player deserves access to that standard of training. My goal is simple: to forge players who are technically sharp, mentally tough, and ready to compete at the next level.
            </p>

            <div style={{background:"#0c0c0c",border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:14,fontFamily:D.body}}>Career Highlights</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {flag:"🇺🇸",club:"Chicago Fire Academy",    detail:"Elite Youth · USA",           division:""},
                  {flag:"🇵🇹",club:"Varzim SC",               detail:"3rd Division · Portugal",      division:"Liga 3 · Póvoa de Varzim"},
                  {flag:"🇲🇹",club:"Sannat Lions FC",          detail:"2nd Division · Malta",         division:"Gozo Football League"},
                  {flag:"🇦🇩",club:"UE Sant Julià",            detail:"1st Division · Andorra",       division:"Primera Divisió · Champions"},
                  {flag:"🇪🇸",club:"Marcet Soccer School",     detail:"Barcelona, Spain",             division:"vs La Liga & Liga 2 Clubs"},
                  {flag:"⚽", club:"Professional Competition",  detail:"vs National Team Players",    division:"& Pro Contract Players"},
                ].map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <span style={{fontSize:18,flexShrink:0}}>{item.flag}</span>
                    <div>
                      <div style={{fontSize:12,color:C.white,fontFamily:D.body,fontWeight:500,marginBottom:2}}>{item.club}</div>
                      <div style={{fontSize:10,color:C.gold,fontFamily:D.body,marginBottom:1}}>{item.detail}</div>
                      {item.division&&<div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>{item.division}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"22px 24px",marginBottom:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",marginBottom:5,fontFamily:D.body}}>Questions?</div>
            <div style={{fontSize:16,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:4}}>Get in Touch</div>
            <a href="mailto:laforjafutbol@gmail.com" style={{fontSize:13,color:C.gold,fontFamily:D.body,textDecoration:"none"}}>laforjafutbol@gmail.com</a>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:3}}>Responses within 24–48 hours</div>
          </div>
          <a href="mailto:laforjafutbol@gmail.com" style={{background:`linear-gradient(135deg,${C.goldDark},#150c04)`,border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"11px 22px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,textDecoration:"none",whiteSpace:"nowrap"}}>Send Email →</a>
        </div>

        {/* Coaching Staff */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",gap:4,marginBottom:20}}><div style={{width:30,height:2,background:C.gold,borderRadius:1}}/><div style={{width:8,height:2,background:C.red,borderRadius:1}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {[
              {name:"Waldo Cepeda Jr.", role:"Coach", img:"/waldo-jr.jpg"},
              {name:"Waldo Cepeda Sr.", role:"Coach", img:"/waldo-sr.jpg"},
            ].map((coach,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{height:3,background:`linear-gradient(90deg,${C.red},${C.gold})`}}/>
                <div style={{padding:"20px 18px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
                  <div style={{width:96,height:96,borderRadius:"50%",overflow:"hidden",border:`2px solid ${C.gold}`,boxShadow:`0 0 20px ${C.gold}22`,marginBottom:14}}>
                    <img src={coach.img} alt={coach.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top"}}/>
                  </div>
                  <div style={{fontSize:15,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>{coach.name}</div>
                  <div style={{fontSize:10,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body}}>{coach.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:32}}>
          {[
            {icon:"🔥",title:"The Furnace",desc:"1v1 dominance, tight space control, and decision-making under pressure. The Forge Method applied every session."},
            {icon:"⚒️",title:"The Tempering",desc:"Private sessions built entirely around your position, your weaknesses, and your game. One player, one coach, full attention."},
            {icon:"👥",title:"Small Groups",desc:"Max 4 players per session — more reps, more feedback, and faster development."},
            {icon:"📅",title:"Age-Specific",desc:"Sessions split by age so training intensity and demands match each player's stage."},
          ].map(item=>(
            <div key={item.title} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"20px 18px"}}>
              <div style={{fontSize:22,marginBottom:8}}>{item.icon}</div>
              <div style={{fontSize:12,color:C.gold,marginBottom:6,letterSpacing:1,fontFamily:D.body,fontWeight:500}}>{item.title}</div>
              <div style={{fontSize:11,color:C.textDim,lineHeight:1.8,fontFamily:D.body}}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center"}}>
          <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px 40px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 6px 24px ${C.red}33`,fontFamily:D.body,fontWeight:500}}>Book a Session</button>
        </div>
      </div>
    </div>
  );
}
