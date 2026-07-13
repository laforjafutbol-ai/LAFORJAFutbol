import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth, googleProvider } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { PrivatePage, Dashboard, ReviewsModeration } from "./Pages1";
import { AuthPage, AccountPage, ContactPage, ReviewsPage, AboutPage, StripeCheckout, SessionsPage } from "./Pages2";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, PRICE_1ON1, POSITIONS, DAY_SCHEDULE, AGE_COLORS, SKILL_COLORS, DAY_ABBR, COACH_DAYS, PRIVATE_DAYS, STRIPE_ENABLED, stripePromise, TX, EMBER_GLOW, dKey, fmtDate, getDates, getPrivateDates, callEmailAPI, sendReminderEmail, Crest, SH, SC, FL, AB, GB, NB, IS, GStyles } from "./constants";


// ── BOOKING CUTOFF — 3 hours before session start ─────────
function isCutoff(dateObj, sessTime){
  try {
    if(!dateObj||!sessTime) return false;
    const now = new Date();
    const startStr = sessTime.split("–")[0].trim();
    const parts = startStr.split(" ");
    if(parts.length < 2) return false;
    const [time, meridiem] = parts;
    const timeParts = time.split(":");
    if(timeParts.length < 2) return false;
    let hours = parseInt(timeParts[0]);
    let minutes = parseInt(timeParts[1]);
    if(isNaN(hours)||isNaN(minutes)) return false;
    if(meridiem==="PM" && hours!==12) hours+=12;
    if(meridiem==="AM" && hours===12) hours=0;
    const sessionStart = new Date(dateObj);
    sessionStart.setHours(hours, minutes, 0, 0);
    return (sessionStart - now) / (1000*60*60) < 3;
  } catch(e) {
    return false;
  }
}

// ══ ROOT APP ══════════════════════════════════════════════
export default function App(){
  const [page,setPage]       = useState("home");
  const [bookings,setBookings] = useState([]);
  const [inquiries,setInquiries] = useState([]);
  const [loaded,setLoaded]   = useState(false);

  const [blocked,setBlocked]     = useState([]);
  const [locations,setLocations] = useState({});

  // Auth state
  const [user,setUser]           = useState(null);
  const [authChecked,setAuthChecked] = useState(false);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, (u)=>{
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    const q1 = query(collection(db,"bookings"),orderBy("createdAt","desc"));
    const q2 = query(collection(db,"inquiries"),orderBy("createdAt","desc"));
    const q3 = collection(db,"blocked");
    const q4 = collection(db,"locations");
    // Show site immediately, data loads in background
    setLoaded(true);
    const u1 = onSnapshot(q1,s=>{ setBookings(s.docs.map(d=>({id:d.id,...d.data()}))); });
    const u2 = onSnapshot(q2,s=>{ setInquiries(s.docs.map(d=>({id:d.id,...d.data()}))); });
    const u3 = onSnapshot(q3,s=>{ setBlocked(s.docs.map(d=>({id:d.id,...d.data()}))); });
    const u4 = onSnapshot(q4,s=>{ const loc={}; s.docs.forEach(d=>{ loc[d.id]={...d.data()}; }); setLocations(loc); });
    return ()=>{ u1(); u2(); u3(); u4(); };
  },[]);

  // Get location for a date key — falls back to default Bayview Park
  function getLocation(dateKey){
    return locations[dateKey]?.name || locations["default"]?.name || "Bayview Park";
  }
  function getLocationDetail(dateKey){
    return locations[dateKey]?.detail || locations["default"]?.detail || "James Island Youth Soccer Club Fields · James Island, SC";
  }
  function getLocationMaps(dateKey){
    return locations[dateKey]?.mapsUrl || locations["default"]?.mapsUrl || "https://maps.google.com/?q=Bayview+Park+James+Island+SC";
  }

  async function saveLocation(dateKey, name, detail, mapsUrl){
    await import("firebase/firestore").then(({setDoc,doc:fDoc})=>{
      return setDoc(fDoc(db,"locations",dateKey),{name,detail,mapsUrl,updatedAt:new Date().toISOString()});
    });
  }

  async function blockSession(dateKey, sessId, label){
    const existing = blocked.find(b=>b.dateKey===dateKey&&b.sessId===sessId);
    if(existing) await deleteDoc(doc(db,"blocked",existing.id));
    else await addDoc(collection(db,"blocked"),{dateKey,sessId,label,createdAt:new Date().toISOString()});
  }

  function isBlocked(dateObj, sessId){
    return blocked.some(b=>b.dateKey===dKey(dateObj)&&b.sessId===sessId);
  }

  async function addBooking(b){ return await addDoc(collection(db,"bookings"),b); }
  async function addInquiry(i){ return await addDoc(collection(db,"inquiries"),i); }

  async function confirmBooking(id, collection_name="bookings"){
    if(collection_name==="inquiries"){
      const inq = inquiries.find(x=>x.id===id);
      await updateDoc(doc(db,"inquiries",id),{status:"confirmed"});
      if(inq?.email) callEmailAPI({
        ...inq,
        sessTime: inq.slotTime,
        dateLabel: inq.dateLabel,
        skillIcon: "⚽",
        skill: "The Tempering",
        count: 1,
        total: inq.price,
        ageGroup: inq.age ? "Age " + inq.age : "Private",
        ageTag: "9-11",
      }, "group");
    } else {
      const b = bookings.find(x=>x.id===id);
      await updateDoc(doc(db,"bookings",id),{status:"confirmed"});
      if(b?.email) callEmailAPI(b,"group");
    }
  }
  async function removeBooking(id){ await deleteDoc(doc(db,"bookings",id)); }

  async function sendReminders(){
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate()+1);
    const tk = tomorrow.toISOString().split("T")[0];
    const tomorrowBookings = bookings.filter(b=>b.dateKey===tk&&b.status==="confirmed");
    const tomorrowInquiries = inquiries.filter(i=>i.dateKey===tk&&i.status==="confirmed");
    let sent = 0;
    for(const b of tomorrowBookings){ await sendReminderEmail(b,"group"); sent++; }
    for(const i of tomorrowInquiries){ await sendReminderEmail(i,"1on1"); sent++; }
    alert(`Sent ${sent} reminder${sent!==1?"s":""} for tomorrow's sessions!`);
  }

  async function scheduleInquiry(id,scheduledTime){
    await updateDoc(doc(db,"inquiries",id),{status:"scheduled",scheduledTime});
  }
  async function removeInquiry(id){ await deleteDoc(doc(db,"inquiries",id)); }

  function spotsLeft(dateObj,sessId){
    const dk=dKey(dateObj);
    const used=bookings.filter(b=>b.dateKey===dk&&b.sessId===sessId&&b.status!=="cancelled").reduce((s,b)=>s+b.count,0);
    return MAX_PLAYERS-used;
  }

  if(!loaded) return(
    <div style={{minHeight:"100vh",background:C.black,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
      <Crest size={60}/><div style={{fontSize:11,color:C.goldDim,letterSpacing:5,textTransform:"uppercase",fontFamily:D.body,animation:"pulse 1.5s infinite"}}>Loading…</div>
      <GStyles/>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.black,backgroundImage:`${EMBER_GLOW}, ${TX}`,backgroundAttachment:"fixed",fontFamily:D.body}}>
      <Nav page={page} setPage={setPage} user={user}/>
      {page==="home"      && <HomePage      setPage={setPage} user={user}/>}
      {page==="about"     && <AboutPage     setPage={setPage}/>}
      {page==="book"      && <BookPage      spotsLeft={spotsLeft} addBooking={addBooking} bookings={bookings} isBlocked={isBlocked} getLocation={getLocation} getLocationDetail={getLocationDetail} getLocationMaps={getLocationMaps} user={user} setPage={setPage}/>}
      {page==="private"   && <PrivatePage   addInquiry={addInquiry} inquiries={inquiries} isBlocked={isBlocked} blocked={blocked} getLocation={getLocation} getLocationDetail={getLocationDetail} getLocationMaps={getLocationMaps} user={user}/>}
      {page==="dashboard" && <div style={{paddingTop:100,background:C.black,minHeight:"100vh"}}>
        <Dashboard bookings={bookings} inquiries={inquiries} confirmBooking={confirmBooking} removeBooking={removeBooking} scheduleInquiry={scheduleInquiry} removeInquiry={removeInquiry} sendReminderEmail={sendReminderEmail} blocked={blocked} blockSession={blockSession} locations={locations} saveLocation={saveLocation} spotsLeft={spotsLeft} getDates={getDates} getPrivateDates={getPrivateDates}/>
      </div>}
      {page==="login"     && <AuthPage      setPage={setPage} authChecked={authChecked} user={user}/>}
      {page==="sessions"  && <SessionsPage  setPage={setPage} user={user}/>}
      {page==="account"   && <AccountPage   setPage={setPage} user={user} authChecked={authChecked} bookings={bookings} inquiries={inquiries} getDates={getDates} getPrivateDates={getPrivateDates}/>}
      {page==="contact"   && <ContactPage   setPage={setPage} user={user}/>}
      {page==="reviews"   && <ReviewsPage   setPage={setPage} user={user}/>}
      <Footer setPage={setPage}/>
      <GStyles/>
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────
function Nav({page,setPage,user}){
  const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const fn=()=>setScrolled(window.scrollY>20);
    window.addEventListener("scroll",fn);
    return ()=>window.removeEventListener("scroll",fn);
  },[]);
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:scrolled?"rgba(10,10,10,0.98)":"rgba(10,10,10,0.7)",borderBottom:`1px solid ${scrolled?C.goldDim:"transparent"}`,backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:62,transition:"all 0.3s"}}>
      <button onClick={()=>setPage("home")} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
        <Crest size={30}/><span style={{fontSize:18,letterSpacing:4,color:C.gold,textTransform:"uppercase",fontFamily:D.display,fontWeight:600}}>La Forja</span>
      </button>
      <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
        {[["home","Home"],["about","About"],["book","Book"],["private","1-on-1"],["sessions","My Sessions"]].map(([key,lbl])=>(
          <button key={key} onClick={()=>setPage(key)} style={{background:key==="book"&&page!=="book"?`linear-gradient(135deg,${C.red},${C.redDim})`:page===key?"rgba(201,168,76,0.1)":"transparent",border:key==="book"&&page!=="book"?`1px solid ${C.red}`:page===key?`1px solid ${C.silver}44`:"1px solid transparent",color:key==="book"&&page!=="book"?C.white:page===key?C.silverBright:C.textMid,borderRadius:8,padding:"6px 13px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",fontFamily:D.body,fontWeight:500}}>
            {lbl}
          </button>
        ))}
        <button onClick={()=>setPage(user?"account":"login")} style={{background:page==="account"||page==="login"?"rgba(201,168,76,0.1)":"transparent",border:page==="account"||page==="login"?`1px solid ${C.silver}44`:"1px solid transparent",color:page==="account"||page==="login"?C.silverBright:C.textMid,borderRadius:8,padding:"6px 13px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",fontFamily:D.body,fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
          {user?<>👤 My Account</>:<>Sign In</>}
        </button>
        <button onClick={()=>setPage("dashboard")} style={{background:page==="dashboard"?"rgba(201,168,76,0.1)":"transparent",border:page==="dashboard"?`1px solid ${C.silver}44`:"1px solid transparent",color:page==="dashboard"?C.silverBright:C.silverDark,borderRadius:8,padding:"6px 10px",fontSize:14,cursor:"pointer",transition:"all 0.2s",fontFamily:D.body,fontWeight:500}}>
          ⚙
        </button>
      </div>
    </nav>
  );
}


function Footer({setPage}){
  return(
    <footer style={{borderTop:`1px solid ${C.cardBorder}`,padding:"36px 24px",marginTop:60}}>
      <div style={{maxWidth:900,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Crest size={26}/>
          <div>
            <div style={{fontSize:13,letterSpacing:3,color:C.silverBright,fontFamily:D.display,fontWeight:600}}>La Forja</div>
            <div style={{fontSize:9,color:C.textDim,letterSpacing:1}}>Where Champions Are Forged</div>
          </div>
        </div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center"}}>
          {[["home","Home"],["about","About"],["book","Book"],["private","1-on-1"],["reviews","Reviews"],["contact","Contact"]].map(([k,l])=>(
            <button key={k} onClick={()=>setPage(k)} style={{background:"none",border:"none",color:C.textDim,fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>{l}</button>
          ))}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:C.silverDark,marginBottom:3}}>📍 Charleston · James Island · Summerville Area</div>
          <a href="mailto:laforjafutbol@gmail.com" style={{fontSize:10,color:C.silverDark,textDecoration:"none",display:"block",marginBottom:3}}>✉️ laforjafutbol@gmail.com</a>
          <div style={{fontSize:10,color:C.silverDark}}>© {new Date().getFullYear()} La Forja · Carlos Cepeda</div>
        </div>
      </div>
    </footer>
  );
}

// ── HOME ──────────────────────────────────────────────────
function HomePage({setPage,user}){
  return(
    <div>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"100px 24px 60px",textAlign:"center",background:`radial-gradient(ellipse at 50% 80%,${C.redDark} 0%,transparent 55%),radial-gradient(ellipse at 20% 20%,#0e0e18 0%,transparent 45%)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${C.goldDim}08 1px,transparent 1px),linear-gradient(90deg,${C.goldDim}08 1px,transparent 1px)`,backgroundSize:"60px 60px",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1,animation:"fadeUp 0.8s ease"}}>
          <Crest size={96}/>
          <div style={{fontSize:10,letterSpacing:7,color:C.silverDim,textTransform:"uppercase",marginTop:22,marginBottom:8,fontFamily:D.body,fontWeight:300}}>Private Group Training</div>
          <h1 style={{margin:"0 0 8px",fontFamily:D.display,fontWeight:700,fontSize:"clamp(52px,10vw,90px)",letterSpacing:8,textTransform:"uppercase",background:`linear-gradient(135deg,${C.silverDark} 0%,${C.silver} 35%,${C.silverBright} 55%,${C.gold} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>La Forja</h1>
          <p style={{fontSize:12,letterSpacing:5,color:C.silver,marginBottom:16,textTransform:"uppercase",fontFamily:D.body,fontWeight:300}}>{BRAND.tagline}</p>
          <p style={{fontSize:15,color:C.textMid,marginBottom:50,maxWidth:500,lineHeight:2,fontFamily:D.display,fontStyle:"italic",textAlign:"center"}}>We are dedicated to perfecting the basics and ironing out imperfections — building players who are smooth on the ball, sharp in their decisions, and confident enough to do anything on the field.</p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center"}}>
            <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"14px 40px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 8px 32px ${C.red}44`,fontFamily:D.body,fontWeight:500}}>Book Group Session</button>
            <button onClick={()=>setPage("private")} style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"14px 40px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>Request 1-on-1</button>
          </div>
        </div>
        <div style={{position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",animation:"bounce 2s infinite"}}>
          <div style={{width:1,height:44,background:`linear-gradient(to bottom,${C.goldDim},transparent)`,margin:"0 auto"}}/>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"70px 24px"}}>
        <SH eyebrow="Training" title="What We Work On"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:44}}>

          {/* The Furnace */}
          <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderTop:`3px solid ${C.red}`,borderRadius:16,padding:"26px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:12,background:C.redDark,border:`1px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🔥</div>
              <div>
                <div style={{fontSize:16,color:C.red,fontFamily:D.display,fontWeight:600,marginBottom:2}}>The Furnace</div>
                <div style={{fontSize:9,letterSpacing:2,color:C.redDim,textTransform:"uppercase",fontFamily:D.body}}>Mon · Tue · Thu · Fri</div>
              </div>
            </div>
            <p style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:14}}>Most players fall apart under pressure. La Forja players don't. Every session is built around 1v1 dominance — tight spaces, real defenders, split-second decisions. We train players to receive under pressure, manipulate in confined space, beat their opponent, and make the right move at full speed.</p>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {["1v1 dominance — beat defenders in tight spaces","Pressure control — receive and move under pressure","Decision making — right move, right time, full speed","Finishing — composure and technique in front of goal"].map((pt,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:C.red,flexShrink:0,marginTop:5,opacity:0.7}}/>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The Tempering */}
          <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderTop:`3px solid ${C.gold}`,borderRadius:16,padding:"26px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:12,background:C.goldDark,border:`1px solid ${C.gold}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⚒️</div>
              <div>
                <div style={{fontSize:16,color:C.gold,fontFamily:D.display,fontWeight:600,marginBottom:2}}>The Tempering</div>
                <div style={{fontSize:9,letterSpacing:2,color:C.goldDim,textTransform:"uppercase",fontFamily:D.body}}>Wed · Sat — Private</div>
              </div>
            </div>
            <p style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:14}}>Your position. Your weaknesses. Your game. Private sessions are designed entirely around you — no generic curriculum, no one-size-fits-all. Your coach builds every session around your specific position, what you need to improve, and where your game breaks down under pressure.</p>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {["Position-specific training — built around how you actually play","Film-informed sessions — we find your weaknesses, then fix them","One player, one coach, full attention","The same foundation as The Furnace — applied only to you"].map((pt,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:C.gold,flexShrink:0,marginTop:5,opacity:0.7}}/>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>


        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:44}}>
          {[{val:"4",label:"Max Players",sub:"per session"},{val:`$${PRICE_GROUP}`,label:"Group Rate",sub:"per player"},{val:`$${PRICE_1ON1}`,label:"1-on-1 Rate",sub:"private session"}].map(s=>(
            <div key={s.label} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"22px 18px",textAlign:"center"}}>
              <div style={{fontSize:34,fontWeight:700,color:C.silverBright,marginBottom:4,fontFamily:D.display}}>{s.val}</div>
              <div style={{fontSize:11,color:C.white,letterSpacing:2,textTransform:"uppercase",fontFamily:D.body,fontWeight:500,marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"22px 26px",marginBottom:40,display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div style={{fontSize:32}}>📍</div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",marginBottom:5,fontFamily:D.body}}>Service Area</div>
            <div style={{fontSize:18,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:6}}>Charleston · James Island · Summerville</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>Private group training available across the Charleston area.</div>
          </div>
          <a href="https://maps.google.com/?q=Bayview+Park+James+Island+SC" target="_blank" rel="noopener noreferrer" style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"10px 18px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,textDecoration:"none"}}>Get Directions →</a>
        </div>

        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:40}}>
          <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px 36px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 6px 24px ${C.red}33`,fontFamily:D.body,fontWeight:500}}>Book The Furnace</button>
          <button onClick={()=>setPage("private")} style={{background:"transparent",border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"13px 36px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>Book The Tempering</button>
        </div>

                {/* ── ACCOUNT SIGN UP SECTION ── */}
        <div style={{marginTop:32,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          {user?(
            <>
              <div style={{fontSize:13,color:C.textMid,fontFamily:D.body}}>👋 Welcome back, <span style={{color:C.white,fontWeight:600}}>{user.displayName?.split(" ")[0]||"there"}</span></div>
              <button onClick={()=>setPage("account")} style={{background:"transparent",border:`1px solid ${C.silver}33`,color:C.silver,borderRadius:8,padding:"9px 20px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>My Account →</button>
            </>
          ):(
            <>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:3}}>Book faster with a free account</div>
                <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Save your info, track sessions, manage player profiles.</div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>setPage("login")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:8,padding:"9px 20px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500,whiteSpace:"nowrap"}}>Sign Up</button>
                <button onClick={()=>setPage("login")} style={{background:"transparent",border:`1px solid ${C.silver}33`,color:C.silver,borderRadius:8,padding:"9px 16px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>Sign In</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BOOK ──────────────────────────────────────────────────
function BookPage({spotsLeft,addBooking,bookings,isBlocked,getLocation,getLocationDetail,getLocationMaps,user,setPage}){
  const [step,setStep]           = useState(1);
  const [selDate,setSelDate]     = useState(null);
  const [selSess,setSelSess]     = useState(null);
  const [count,setCount]         = useState(1);
  const [form,setForm]           = useState({name:"",email:"",phone:"",notes:""});
  const [myId,setMyId]           = useState(null);
  const [weekOff,setWeekOff]     = useState(0);
  const [lookEmail,setLookEmail] = useState("");
  const [lookSt,setLookSt]       = useState("idle");
  const [retClient,setRetClient] = useState(null);
  const [players,setPlayers]     = useState([]);
  const [selPlayerIds,setSelPlayerIds] = useState([]); // array of selected player ids
  const [addingPlayer,setAddingPlayer] = useState(false);
  const [newPlayerForm,setNewPlayerForm] = useState({name:"",age:"",position:""});

  // If logged in, load saved players and auto-fill email/name
  useEffect(()=>{
    if(!user) return;
    setForm(f=>({...f, name: f.name||user.displayName||"", email: f.email||user.email||""}));
    const q = collection(db,"users",user.uid,"players");
    const unsub = onSnapshot(q, s=>{
      setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[user]);

  // If logged in and we have past bookings under their email, auto-lookup once.
  // If no match, skip the "Returning Client?" prompt entirely since we already know who they are.
  useEffect(()=>{
    if(!user || lookSt!=="idle") return;
    const matches=[...bookings].filter(b=>b.email?.toLowerCase()===user.email?.toLowerCase()).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    if(matches.length>0){
      const l=matches[0];
      setRetClient(l);
      setForm(f=>({...f,name:l.name,email:l.email,phone:l.phone||f.phone}));
      setLookSt("found");
    } else {
      setLookSt("notfound");
    }
  },[user,bookings]);

  const allDates=getDates();
  const weeks=[];
  for(let i=0;i<allDates.length;i+=4) weeks.push(allDates.slice(i,i+4));
  const visDates=weeks[weekOff]||[];
  const myBooking=bookings.find(b=>b.id===myId);
  const effectiveCount = user&&selPlayerIds.length>0 ? selPlayerIds.length : count;
  const total=effectiveCount*PRICE_GROUP;
  const canNext1=selDate&&selSess;
  const canNext2=form.name&&form.email;

  function doLookup(){
    if(!lookEmail.trim()) return;
    const matches=[...bookings].filter(b=>b.email?.toLowerCase()===lookEmail.trim().toLowerCase()).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    if(matches.length>0){
      const l=matches[0];
      setRetClient(l);
      setForm({name:l.name,email:l.email,phone:l.phone||"",notes:""});
      setLookSt("found");
    } else {
      setLookSt("notfound");
      setForm(f=>({...f,email:lookEmail.trim()}));
    }
  }

  function clearLookup(){ setLookEmail(""); setLookSt("idle"); setRetClient(null); setForm({name:"",email:"",phone:"",notes:""}); }

  const [bookingLoading,setBookingLoading] = useState(false);

  async function doBook(){
    if(bookingLoading) return;
    setBookingLoading(true);

    // Build name and count from selected players
    const selectedPlayers = players.filter(p=>selPlayerIds.includes(p.id));
    const bookingName = selectedPlayers.length>0
      ? selectedPlayers.map(p=>p.name).join(", ")
      : form.name;
    const bookingCount = selectedPlayers.length>0 ? selectedPlayers.length : count;
    const bookingTotal = bookingCount * PRICE_GROUP;
    const bookingNotes = selectedPlayers.length>0
      ? selectedPlayers.map(p=>`${p.name}${p.age?` (Age ${p.age})`:""}${p.position?` · ${p.position}`:""}`).join(" | ")
      : form.notes;

    const booking={
      status:"pending",dateKey:dKey(selDate),dateLabel:fmtDate(selDate),
      sessId:selSess.id,sessTime:selSess.time,ageGroup:selSess.ageGroup,ageTag:selSess.ageTag,
      skill:DAY_SCHEDULE[selDate.getDay()].skill,skillIcon:DAY_SCHEDULE[selDate.getDay()].skillIcon,
      count:bookingCount,total:bookingTotal,
      name:bookingName,email:form.email,phone:form.phone,notes:bookingNotes,
      parentName:user?user.displayName||form.name:null,
      returning:!!retClient,createdAt:new Date().toISOString(),
      location:getLocation(dKey(selDate)),locationDetail:getLocationDetail(dKey(selDate)),locationMaps:getLocationMaps(dKey(selDate)),
      ...(user?{userId:user.uid}:{}),
      ...(selPlayerIds.length>0?{playerIds:selPlayerIds}:{}),
    };
    const ref=await addBooking(booking);
    if(ref?.id) setMyId(ref.id);
    setBookingLoading(false);
    setStep(3);
  }

  function reset(){
    setStep(1);setSelDate(null);setSelSess(null);setCount(1);setMyId(null);setLookEmail("");setPayMethod(STRIPE_ENABLED?null:"venmo");setSelPlayerId(null);
    setBookMode(null);setPackDates([]);setPackWeekOff(0);setPackMyIds([]);setSelPlayerIds([]);setAddingPlayer(false);setNewPlayerForm({name:"",age:"",position:""});
    if(user){
      setForm({name:user.displayName||"",email:user.email||"",phone:retClient?.phone||"",notes:""});
      setLookSt(retClient?"found":"notfound");
    } else {
      setForm({name:"",email:"",phone:"",notes:""});
      setLookSt("idle");
      setRetClient(null);
    }
  }

  const [payMethod,setPayMethod] = useState(STRIPE_ENABLED ? null : "venmo");

  // ── PACKAGE BOOKING STATE ──────────────────────────────
  const [bookMode,setBookMode]   = useState(null); // null | "single" | "package"
  const PACK_SIZE = 4;
  const PRICE_PACK = 160; // $40/session x 4
  const [packDates,setPackDates] = useState([]);
  const [packWeekOff,setPackWeekOff] = useState(0);
  const [packMyIds,setPackMyIds] = useState([]);

  // All available dates for package picker (4 weeks out)
  const packAllDates = getDates(4); // 4 weeks out
  const packWeeks = [];
  for(let i=0;i<packAllDates.length;i+=4) packWeeks.push(packAllDates.slice(i,i+4));
  const packVisDates = packWeeks[packWeekOff]||[];

  function togglePackDate(date,sess){
    const key = dKey(date)+"_"+sess.id;
    const exists = packDates.find(p=>dKey(p.date)+"_"+p.sessId===key);
    if(exists){
      setPackDates(pd=>pd.filter(p=>!(dKey(p.date)+"_"+p.sessId===key)));
    } else {
      if(packDates.length>=PACK_SIZE) return;
      setPackDates(pd=>[...pd,{
        date,dateKey:dKey(date),dateLabel:fmtDate(date),
        sessId:sess.id,sessTime:sess.time,ageGroup:sess.ageGroup,ageTag:sess.ageTag,
        skill:DAY_SCHEDULE[date.getDay()].skill,skillIcon:DAY_SCHEDULE[date.getDay()].skillIcon,
        location:getLocation(dKey(date)),locationDetail:getLocationDetail(dKey(date)),locationMaps:getLocationMaps(dKey(date)),
      }]);
    }
  }

  async function doBookPack(){
    if(bookingLoading) return;
    setBookingLoading(true);
    const selectedPlayers = players.filter(p=>selPlayerIds.includes(p.id));
    const bookingName = selectedPlayers.length>0 ? selectedPlayers.map(p=>p.name).join(", ") : form.name;
    const refs=[];
    for(const pd of [...packDates].sort((a,b)=>a.dateKey>b.dateKey?1:-1)){
      const b={
        status:"pending",dateKey:pd.dateKey,dateLabel:pd.dateLabel,
        sessId:pd.sessId,sessTime:pd.sessTime,ageGroup:pd.ageGroup,ageTag:pd.ageTag,
        skill:pd.skill,skillIcon:pd.skillIcon,
        count:selectedPlayers.length>0?selectedPlayers.length:1,
        total:selectedPlayers.length>0?(selectedPlayers.length*(PRICE_PACK/PACK_SIZE)):(PRICE_PACK/PACK_SIZE),
        name:bookingName,email:form.email,phone:form.phone,notes:form.notes,
        parentName:user?user.displayName||form.name:null,
        returning:!!retClient,createdAt:new Date().toISOString(),
        location:pd.location,locationDetail:pd.locationDetail,locationMaps:pd.locationMaps,
        packageBooking:true,packageTotal:PRICE_PACK,packageSize:PACK_SIZE,
        ...(user?{userId:user.uid}:{}),
        ...(selPlayerIds.length>0?{playerIds:selPlayerIds}:{}),
      };
      const ref=await addBooking(b);
      if(ref?.id) refs.push(ref.id);
    }
    setPackMyIds(refs);
    setBookingLoading(false);
    setStep(3);
  }

  async function handleStripeSuccessPack(){
    for(const id of packMyIds){
      await updateDoc(doc(db,"bookings",id),{status:"confirmed",paymentMethod:"stripe"});
    }
    const first=bookings.find(b=>b.id===packMyIds[0]);
    if(first) await callEmailAPI({...first,packageBooking:true,packageDates:packDates.map(p=>p.dateLabel).join(", "),total:PRICE_PACK},"group");
  }

  async function handleStripeSuccess(){
    if(!myBooking) return;
    await updateDoc(doc(db,"bookings",myBooking.id),{status:"confirmed",paymentMethod:"stripe"});
    await callEmailAPI(myBooking,"group");
  }

  return(
    <div style={{paddingTop:100}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:"40px 20px 100px"}}>
        <SH eyebrow="Reserve" title="Book a Spot"/>

        {/* ── MODE PICKER ── */}
        {!bookMode&&(
          <div style={{animation:"fadeUp 0.4s ease"}}>
            <p style={{fontSize:13,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:28}}>
              Choose how you want to book. Single sessions are great for trying it out — packages lock in your spot for the month at a better rate.
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {/* Single */}
              <button onClick={()=>setBookMode("single")} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"24px 20px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",position:"relative",overflow:"hidden"}}>
                <div style={{fontSize:28,marginBottom:10}}>⚽</div>
                <div style={{fontSize:16,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>Single Session</div>
                <div style={{fontSize:22,fontWeight:700,color:C.gold,fontFamily:D.display,marginBottom:8}}>${PRICE_GROUP}</div>
                <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>Pick one session. Pay per session.</div>
              </button>
              {/* Package */}
              <button onClick={()=>setBookMode("package")} style={{background:`linear-gradient(135deg,${C.goldDark},#1c0e04)`,border:`1px solid ${C.gold}44`,borderRadius:16,padding:"24px 20px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:10,right:12,fontSize:9,letterSpacing:2,color:C.gold,fontFamily:D.body,textTransform:"uppercase",background:`${C.gold}22`,border:`1px solid ${C.gold}44`,borderRadius:20,padding:"2px 8px"}}>Best Value</div>
                <div style={{fontSize:28,marginBottom:10}}>🔥</div>
                <div style={{fontSize:16,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:4}}>4-Session Pack</div>
                <div style={{fontSize:22,fontWeight:700,color:C.gold,fontFamily:D.display,marginBottom:4}}>${PRICE_PACK}</div>
                <div style={{fontSize:11,color:C.gold,fontFamily:D.body,opacity:0.7,marginBottom:8}}>${PRICE_PACK/PACK_SIZE}/session · Save $${PRICE_GROUP*PACK_SIZE-PRICE_PACK}</div>
                <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.7}}>Pick any 4 dates. One payment. Spots held for the month.</div>
              </button>
            </div>
            <div style={{marginTop:18,textAlign:"center",fontSize:11,color:C.silverDim,fontFamily:D.body}}>⚡ Spots fill fast — max 4 players per session</div>
          </div>
        )}

        {/* ── SINGLE BOOKING FLOW ── */}
        {bookMode==="single"&&(<>
          {step<3&&(
            <div style={{marginBottom:24}}>
              <button onClick={()=>{setBookMode(null);setStep(1);}} style={{background:"none",border:"none",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body,marginBottom:16,padding:0}}>← Back to options</button>
              <div style={{display:"flex",gap:8}}>
                {["Date & Session","Your Details","Payment"].map((lbl,i)=>(
                  <div key={i} style={{flex:1}}>
                    <div style={{height:2,borderRadius:2,marginBottom:5,background:step>i+1?C.gold:step===i+1?C.goldBright:C.cardBorder,transition:"background 0.4s"}}/>
                    <div style={{fontSize:9,color:step>=i+1?C.gold:C.silverDark,letterSpacing:2,textTransform:"uppercase",fontFamily:D.body}}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {step===1&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <FL>Choose a Date</FL>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <NB disabled={weekOff===0} onClick={()=>setWeekOff(w=>w-1)}>← Prev</NB>
              <span style={{fontSize:10,color:C.gold,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body}}>Week {weekOff+1}</span>
              <NB disabled={weekOff>=weeks.length-1} onClick={()=>setWeekOff(w=>w+1)}>Next →</NB>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:28}}>
              {visDates.map((d,i)=>{
                const sched=DAY_SCHEDULE[d.getDay()];
                const tot=sched.sessions.reduce((s,sess)=>s+spotsLeft(d,sess.id),0);
                const allCutoff=sched.sessions.every(sess=>isCutoff(d,sess.time));
                const full=tot===0||sched.sessions.every(sess=>isBlocked(d,sess.id))||allCutoff;
                const sel=selDate&&dKey(d)===dKey(selDate);
                const sc=SKILL_COLORS[sched.skill]||{color:C.gold,bg:C.goldDark};
                // Color coding: green = plenty open, orange = almost full (1-2 left), red = full/closed
                const spotColor = full ? C.silverDark : tot<=2 ? "#f97316" : C.green;
                const spotBg = full ? "rgba(255,255,255,0.04)" : tot<=2 ? "rgba(249,115,22,0.12)" : "rgba(61,220,132,0.12)";
                const spotLabel = allCutoff ? "CLOSED" : full ? "FULL" : tot<=2 ? `${tot} left` : `${tot} open`;
                return(
                  <button key={i} disabled={full} onClick={()=>{setSelDate(d);setSelSess(null);setCount(1);}}
                    style={{background:sel?C.goldDark:C.card,border:sel?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"12px 6px",cursor:full?"not-allowed":"pointer",textAlign:"center",transition:"all 0.2s",boxShadow:sel?`0 0 20px ${C.gold}33`:"none",color:C.white,opacity:full?0.4:1,fontFamily:D.body}}>
                    <div style={{fontSize:9,letterSpacing:2,color:sel?C.goldBright:C.silverDim,marginBottom:3}}>{DAY_ABBR[d.getDay()]}</div>
                    <div style={{fontSize:19,fontWeight:700,marginBottom:1,fontFamily:D.display}}>{d.getDate()}</div>
                    <div style={{fontSize:9,color:sel?C.goldBright:C.silverDim,marginBottom:6}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:8,alignItems:"center"}}>
                      {sched.sessions.map((sess,si)=>{
                        const ac=AGE_COLORS[sess.ageTag]||{bg:C.card,border:C.gold,text:C.gold,badge:C.goldDark};
                        const sp=spotsLeft(d,sess.id);
                        return(<div key={si} style={{display:"flex",alignItems:"center",gap:3,fontSize:8,color:sp===0?C.silverDark:ac.text}}><div style={{width:5,height:5,borderRadius:"50%",background:sp===0?C.silverDark:ac.text,flexShrink:0}}/><span style={{whiteSpace:"nowrap"}}>{sess.ageGroup.replace("Ages ","")}</span></div>);
                      })}
                    </div>
                    {/* Color-coded spot badge */}
                    <div style={{background:spotBg,borderRadius:6,padding:"3px 6px",display:"inline-block"}}>
                      <span style={{fontSize:9,fontWeight:600,color:spotColor,fontFamily:D.body,letterSpacing:0.5}}>{spotLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selDate&&(()=>{
              const sched=DAY_SCHEDULE[selDate.getDay()];
              const sc=SKILL_COLORS[sched.skill]||{color:C.gold,bg:C.goldDark};
              return(<>
                <div style={{background:sc.bg,border:`1px solid ${sc.color}33`,borderRadius:10,padding:"10px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:22}}>{sched.skillIcon}</span>
                  <div>
                    <div style={{fontSize:9,letterSpacing:2,color:sc.color,textTransform:"uppercase",fontFamily:D.body,marginBottom:2}}>Today's Focus</div>
                    <div style={{fontSize:15,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:6}}>{sched.skill}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"3px 12px"}}>
                      {(sched.skillDesc||"").split(" · ").map((pt,pi)=>(
                        <div key={pi} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:sc.color,opacity:0.8,fontFamily:D.body}}>
                          <div style={{width:3,height:3,borderRadius:"50%",background:sc.color,flexShrink:0}}/>
                          {pt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                  <div style={{background:C.redDark,border:`1px solid ${C.red}33`,borderRadius:10,padding:"10px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:18}}>📍</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,letterSpacing:2,color:C.red,textTransform:"uppercase",fontFamily:D.body,marginBottom:2}}>Training Location</div>
                  <div style={{fontSize:13,color:C.white,fontFamily:D.body,fontWeight:500}}>{getLocation(dKey(selDate))}</div>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{getLocationDetail(dKey(selDate))}</div>
                </div>
                <a href={getLocationMaps(dKey(selDate))} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:C.red,textDecoration:"none",border:`1px solid ${C.redDim}`,borderRadius:6,padding:"5px 10px",fontFamily:D.body,whiteSpace:"nowrap",flexShrink:0}}>Map →</a>
                </div>
                <FL>Choose a Session</FL>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:22}}>
                  {sched.sessions.map(sess=>{
                    const sp=spotsLeft(selDate,sess.id);
                    const full=sp===0;
                    const cutoff=isCutoff(selDate,sess.time);
                    const unavailable=full||isBlocked(selDate,sess.id)||cutoff;
                    const sel=selSess?.id===sess.id;
                    const ac=AGE_COLORS[sess.ageTag]||{bg:C.card,border:C.gold,text:C.gold,badge:C.goldDark};
                    return(
                      <button key={sess.id} disabled={unavailable} onClick={()=>{ if(!unavailable){setSelSess(sess);setCount(1);} }}
                        style={{background:sel?ac.bg:C.card,border:sel?`1px solid ${ac.border}`:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"18px 16px",cursor:unavailable?"not-allowed":"pointer",textAlign:"left",transition:"all 0.2s",boxShadow:sel?`0 0 22px ${ac.border}28`:"none",opacity:unavailable?0.35:1,color:C.white}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:4,fontFamily:D.display}}>{sess.label}</div>
                        <div style={{fontSize:11,color:C.textDim,marginBottom:10,fontFamily:D.body}}>{sess.time}</div>
                        <div style={{display:"inline-block",fontSize:10,padding:"3px 9px",borderRadius:20,marginBottom:8,background:ac.badge,color:ac.text,border:`1px solid ${ac.border}44`,fontFamily:D.body}}>{sess.ageGroup}</div>
                        <div style={{fontSize:10,color:unavailable?C.silverDark:sp<=2?C.red:C.silverDim,fontFamily:D.body}}>{cutoff?"Booking closed":full?"FULL":`${sp} / ${MAX_PLAYERS} spots`}</div>
                      </button>
                    );
                  })}
                </div>
              </>);
            })()}

            {selSess&&(()=>{
              const sp=spotsLeft(selDate,selSess.id);
              const ac=AGE_COLORS[selSess.ageTag]||{bg:C.card,border:C.gold,text:C.gold,badge:C.goldDark};
              return(<>
                {/* For guests — show manual picker */}
                {!user&&(<>
                  <FL>How many players are training?</FL>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32}}>
                    {[1,2,3,4].map(n=>{
                      const avail=n<=sp;
                      const sel=count===n;
                      return(<button key={n} disabled={!avail} onClick={()=>setCount(n)} style={{width:52,height:52,borderRadius:12,border:sel?`1px solid ${ac.border}`:`1px solid ${C.cardBorder}`,background:sel?ac.bg:C.card,color:avail?(sel?ac.text:C.white):C.silverDark,fontSize:18,fontWeight:700,cursor:avail?"pointer":"not-allowed",opacity:avail?1:0.25,transition:"all 0.2s",fontFamily:D.display}}>{n}</button>);
                    })}
                    <div style={{marginLeft:8,fontSize:13,color:C.textDim,fontFamily:D.body}}>× ${PRICE_GROUP} = <span style={{color:C.gold,fontWeight:600,fontSize:18,marginLeft:4,fontFamily:D.display}}>${count*PRICE_GROUP}</span></div>
                  </div>
                </>)}
              </>);
            })()}
            <AB disabled={!canNext1} onClick={()=>setStep(2)}>Continue →</AB>
          </div>
        )}

        {step===2&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            {selSess&&(()=>{
              const ac=AGE_COLORS[selSess.ageTag]||{bg:C.card,border:C.gold,text:C.gold,badge:C.goldDark};
              const sc=SKILL_COLORS[DAY_SCHEDULE[selDate.getDay()].skill]||{color:C.gold,bg:C.goldDark};
              return(<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:22}}>
                {[{label:fmtDate(selDate),color:C.gold,bg:C.goldDark},{label:selSess.time,color:C.silver,bg:C.card},{label:selSess.ageGroup,color:ac.text,bg:ac.badge},{label:`${DAY_SCHEDULE[selDate.getDay()].skillIcon} ${DAY_SCHEDULE[selDate.getDay()].skill}`,color:sc.color,bg:sc.bg}].map((chip,i)=>(
                  <span key={i} style={{fontSize:10,padding:"4px 11px",borderRadius:20,background:chip.bg,color:chip.color,border:`1px solid ${chip.color}33`,fontFamily:D.body,letterSpacing:1}}>{chip.label}</span>
                ))}
              </div>);
            })()}

            {/* Account nudge — guests only, always visible at top of step 2 */}
            {!user&&(
              <div style={{background:`linear-gradient(135deg,#1c130a,#120d06)`,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:3}}>⚡ Book faster next time</div>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Create a free account to save your info and player profiles.</div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button onClick={()=>setPage("login")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:8,padding:"8px 16px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500,whiteSpace:"nowrap"}}>Sign Up</button>
                  <button onClick={()=>setPage("login")} style={{background:"transparent",border:`1px solid ${C.silver}33`,color:C.silver,borderRadius:8,padding:"8px 14px",fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>Sign In</button>
                </div>
              </div>
            )}

            {lookSt==="idle"&&(
              <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 18px",marginBottom:22}}>
                <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:4,fontFamily:D.body}}>Returning Client?</div>
                <div style={{fontSize:12,color:C.textDim,marginBottom:14,lineHeight:1.7,fontFamily:D.body}}>Enter your email to auto-fill from a past booking.</div>
                <div style={{display:"flex",gap:10}}>
                  <input type="email" placeholder="your@email.com" value={lookEmail} onChange={e=>setLookEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLookup()} style={{...IS,flex:1}}/>
                  <button onClick={doLookup} style={{background:`linear-gradient(135deg,${C.goldDark},#150c04)`,border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"10px 16px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>Look Up</button>
                </div>
                <div style={{marginTop:10,textAlign:"right"}}>
                  <button onClick={()=>setLookSt("notfound")} style={{background:"none",border:"none",color:C.silverDark,fontSize:10,cursor:"pointer",letterSpacing:1,fontFamily:D.body}}>Skip — I'm new →</button>
                </div>
              </div>
            )}
            {lookSt==="found"&&retClient&&(
              <div style={{background:"linear-gradient(135deg,#081408,#060e06)",border:`1px solid ${C.green}44`,borderRadius:14,padding:"16px 18px",marginBottom:20,animation:"fadeUp 0.3s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:9,letterSpacing:3,color:C.green,textTransform:"uppercase",marginBottom:5,fontFamily:D.body}}>👋 Welcome Back!</div>
                    <div style={{fontSize:15,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:3}}>{retClient.name}</div>
                    <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Last session: <span style={{color:C.silver}}>{retClient.dateLabel}</span></div>
                  </div>
                  <button onClick={clearLookup} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Not me</button>
                </div>
                <div style={{marginTop:8,fontSize:11,color:C.green,opacity:0.7,fontFamily:D.body}}>✓ Details pre-filled — update anything that's changed.</div>
              </div>
            )}
            {lookSt==="notfound"&&(
              <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"11px 16px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>{user?`Welcome, ${user.displayName?.split(" ")[0]||"there"}! Fill in the details below.`:lookEmail?`No past bookings found for ${lookEmail}`:"New client — fill in your details below."}</span>
                {!user&&<button onClick={clearLookup} style={{background:"none",border:"none",color:C.silverDark,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Try again</button>}
              </div>
            )}

            {lookSt!=="idle"&&(<>
              {user&&players.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body}}>Who is training? *</div>
                    {selPlayerIds.length>0&&<div style={{fontSize:11,color:C.green,fontFamily:D.body}}>{selPlayerIds.length} selected · ${selPlayerIds.length*PRICE_GROUP}</div>}
                  </div>
                  <div style={{display:"grid",gap:8,marginBottom:10}}>
                    {players.map(p=>{
                      const sel=selPlayerIds.includes(p.id);
                      return(
                        <button key={p.id} onClick={()=>{
                          setSelPlayerIds(ids=>sel?ids.filter(id=>id!==p.id):[...ids,p.id]);
                          if(!form.email&&user) setForm(f=>({...f,email:user.email||"",phone:f.phone}));
                        }} style={{background:sel?`linear-gradient(135deg,${C.redDark},#1a0804)`:C.card,border:sel?`1px solid ${C.red}`:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"12px 16px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:600,color:sel?C.white:C.silverBright,fontFamily:D.display,marginBottom:2}}>{p.name}</div>
                            <div style={{fontSize:11,color:sel?C.red:C.textDim,fontFamily:D.body}}>{p.age?`Age ${p.age}`:""}{p.position?` · ${p.position}`:""}</div>
                          </div>
                          <div style={{width:22,height:22,borderRadius:6,border:sel?`none`:`1px solid ${C.cardBorder}`,background:sel?C.red:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {sel&&<span style={{color:C.white,fontSize:12,fontWeight:700}}>✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add another player inline */}
                  {!addingPlayer?(
                    <button onClick={()=>setAddingPlayer(true)} style={{background:"none",border:`1px dashed ${C.cardBorder}`,borderRadius:10,padding:"10px 16px",cursor:"pointer",width:"100%",textAlign:"left",color:C.textDim,fontSize:12,fontFamily:D.body,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:16,color:C.gold}}>+</span> Add another player
                    </button>
                  ):(
                    <div style={{background:C.card,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"14px 16px"}}>
                      <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>New Player</div>
                      <div style={{display:"grid",gap:10,marginBottom:12}}>
                        {[{key:"name",ph:"Player name *"},{key:"age",ph:"Age"},{key:"position",ph:"Position (e.g. Forward)"}].map(f=>(
                          <input key={f.key} placeholder={f.ph} value={newPlayerForm[f.key]} onChange={e=>setNewPlayerForm(p=>({...p,[f.key]:e.target.value}))} style={{...IS,fontSize:13}}/>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={async()=>{
                          if(!newPlayerForm.name.trim()) return;
                          const ref = await addDoc(collection(db,"users",user.uid,"players"),{...newPlayerForm,createdAt:new Date().toISOString()});
                          setSelPlayerIds(ids=>[...ids,ref.id]);
                          setNewPlayerForm({name:"",age:"",position:""});
                          setAddingPlayer(false);
                        }} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:8,padding:"9px 18px",color:C.white,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>Save & Select</button>
                        <button onClick={()=>{setAddingPlayer(false);setNewPlayerForm({name:"",age:"",position:""}); }} style={{background:"none",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"9px 14px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {selPlayerIds.length===0&&!addingPlayer&&(
                    <div style={{marginTop:10,padding:"10px 14px",background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8}}>
                      <div style={{fontSize:11,color:C.red,fontFamily:D.body}}>⚠ Select which players are training. Parents don't take up a spot.</div>
                    </div>
                  )}
                </div>
              )}
              {user&&players.length===0&&(
                <div style={{marginBottom:18}}>
                  {!addingPlayer?(
                    <button onClick={()=>setAddingPlayer(true)} style={{background:`${C.gold}11`,border:`1px dashed ${C.gold}44`,borderRadius:10,padding:"14px 16px",cursor:"pointer",width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20,color:C.gold}}>+</span>
                      <div>
                        <div style={{fontSize:13,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:2}}>Add your player</div>
                        <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Save their name, age and position for faster booking next time</div>
                      </div>
                    </button>
                  ):(
                    <div style={{background:C.card,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                      <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Add Player</div>
                      <div style={{display:"grid",gap:10,marginBottom:12}}>
                        {[{key:"name",ph:"Player name *"},{key:"age",ph:"Age"},{key:"position",ph:"Position (e.g. Forward)"}].map(f=>(
                          <input key={f.key} placeholder={f.ph} value={newPlayerForm[f.key]} onChange={e=>setNewPlayerForm(p=>({...p,[f.key]:e.target.value}))} style={{...IS,fontSize:13}}/>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={async()=>{
                          if(!newPlayerForm.name.trim()) return;
                          const ref = await addDoc(collection(db,"users",user.uid,"players"),{...newPlayerForm,createdAt:new Date().toISOString()});
                          setSelPlayerIds(ids=>[...ids,ref.id]);
                          setNewPlayerForm({name:"",age:"",position:""});
                          setAddingPlayer(false);
                        }} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",borderRadius:8,padding:"9px 18px",color:C.white,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>Save & Select</button>
                        <button onClick={()=>{setAddingPlayer(false);setNewPlayerForm({name:"",age:"",position:""});}} style={{background:"none",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"9px 14px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div style={{marginTop:10,padding:"10px 14px",background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8}}>
                    <div style={{fontSize:11,color:C.red,fontFamily:D.body}}>⚠ Enter your <strong style={{color:C.white}}>player's name</strong> below — not yours as the parent.</div>
                  </div>
                </div>
              )}
              <FL>Parent / Guardian Contact Details</FL>
              <div style={{display:"grid",gap:13,marginBottom:20}}>
                {[{key:"name",label:"Player's Full Name *",type:"text",ph:"Player's name"},{key:"email",label:"Parent Email *",type:"email",ph:"parent@email.com"},{key:"phone",label:"Parent Phone",type:"tel",ph:"+1 (555) 000-0000"},{key:"notes",label:"Player Age / Position / Notes",type:"textarea",ph:"e.g. Age 11, Midfielder. Working on weak-foot."}].map(f=>(
                  <div key={f.key}>
                    <label style={{display:"block",fontSize:9,letterSpacing:2,color:C.gold,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>{f.label}</label>
                    {f.type==="textarea"?<textarea rows={3} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IS}/>:<input type={f.type} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={{...IS,borderColor:lookSt==="found"&&form[f.key]?`${C.green}55`:C.cardBorder}}/>}
                  </div>
                ))}
              </div>
              <SC rows={[{label:"Date",value:fmtDate(selDate)},{label:"Session",value:selSess?.time},{label:"Age Group",value:selSess?.ageGroup,color:AGE_COLORS[selSess?.ageTag]?.text},{label:"Focus",value:`${DAY_SCHEDULE[selDate?.getDay()]?.skillIcon} ${DAY_SCHEDULE[selDate?.getDay()]?.skill}`,color:SKILL_COLORS[DAY_SCHEDULE[selDate?.getDay()]?.skill]?.color},{label:"Players Training",value:`${effectiveCount} player${effectiveCount>1?"s":""}`},{label:"Total Due",value:`$${total}`,accent:true}]}/>
              <div style={{display:"flex",gap:10,marginTop:18}}>
                <GB onClick={()=>setStep(1)}>← Back</GB>
                <AB disabled={!canNext2||bookingLoading} onClick={doBook}>{bookingLoading?"Reserving…":"Reserve My Spot →"}</AB>
              </div>
            </>)}
            {lookSt==="idle"&&<div style={{marginTop:4}}><GB onClick={()=>setStep(1)}>← Back</GB></div>}
          </div>
        )}

        {step===3&&myBooking&&(
          <div style={{animation:"fadeUp 0.5s ease"}}>
            {myBooking.status==="confirmed"?(
              <>
                <div style={{textAlign:"center",marginBottom:28}}>
                  <div style={{width:76,height:76,borderRadius:"50%",margin:"0 auto 16px",background:`linear-gradient(135deg,${C.green},#0e7a47)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,color:C.white,boxShadow:`0 0 48px ${C.green}55`}}>✓</div>
                  <h2 style={{margin:"0 0 8px",fontSize:28,fontWeight:600,color:C.white,fontFamily:D.display}}>Booking Confirmed!</h2>
                  <p style={{margin:0,fontSize:13,color:C.textDim,fontFamily:D.body}}>Coach Carlos confirmed your payment. A confirmation email has been sent. See you on the field! ⚽</p>
                </div>
                <SC title="Your Session" rows={[{label:"Name",value:myBooking.name},{label:"Date",value:myBooking.dateLabel},{label:"Time",value:myBooking.sessTime},{label:"Age Group",value:myBooking.ageGroup,color:AGE_COLORS[myBooking.ageTag]?.text},{label:"Skill Focus",value:`${myBooking.skillIcon} ${myBooking.skill}`,color:SKILL_COLORS[myBooking.skill]?.color},{label:"Players",value:`${myBooking.count} player${myBooking.count>1?"s":""}`},{label:"Paid",value:`$${myBooking.total}`,accent:true}]}/>
                <div style={{textAlign:"center",marginTop:22}}><GB onClick={reset}>Book Another Spot</GB></div>
              </>
            ):(
              <>
                {/* Payment header */}
                <div style={{textAlign:"center",marginBottom:22}}>
                  <div style={{width:64,height:64,borderRadius:"50%",margin:"0 auto 14px",background:C.redDark,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,animation:"pulse 2s infinite"}}>⏳</div>
                  <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:600,color:C.white,fontFamily:D.display}}>Spot Reserved — Payment Needed</h2>
                  <p style={{margin:0,fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.7}}>Your spot is held. Complete payment below to confirm it instantly.</p>
                </div>

                {/* Payment method selector */}
                {STRIPE_ENABLED&&!payMethod&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    <button onClick={()=>setPayMethod("stripe")} style={{background:C.card,border:`1px solid ${C.silver}44`,borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:24,marginBottom:8}}>💳</div>
                      <div style={{fontSize:13,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:3}}>Pay by Card</div>
                      <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Instant confirmation</div>
                    </button>
                    <button onClick={()=>setPayMethod("venmo")} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:24,marginBottom:8}}>📲</div>
                      <div style={{fontSize:13,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:3}}>Pay with Venmo</div>
                      <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Coach confirms manually</div>
                    </button>
                  </div>
                )}

                {/* Stripe checkout */}
                {payMethod==="stripe"&&(
                  <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"20px",marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                      <div>
                        <div style={{fontSize:10,letterSpacing:2,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>Amount Due</div>
                        <div style={{fontSize:34,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1}}>${total}</div>
                      </div>
                      <button onClick={()=>setPayMethod(null)} style={{background:"none",border:"none",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline"}}>Change method</button>
                    </div>
                    <StripeCheckout
                      amount={total}
                      metadata={{docId:myBooking?.id||"",collectionName:"bookings",sessionType:"Group Session — "+myBooking?.dateLabel}}
                      onSuccess={handleStripeSuccess}
                    />
                  </div>
                )}

                {/* Venmo card */}
                {payMethod==="venmo"&&(
                <div style={{background:C.redDark,border:`1px solid ${C.red}33`,borderRadius:16,padding:"20px",marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div>
                      <div style={{fontSize:10,letterSpacing:2,color:C.red,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>Amount Due</div>
                      <div style={{fontSize:40,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1}}>${total}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#888",fontFamily:D.body,marginBottom:3,letterSpacing:1}}>VENMO</div>
                      <div style={{fontSize:16,color:C.silverBright,fontFamily:D.body,fontWeight:600}}>@{BRAND.venmo}</div>
                    </div>
                  </div>
                  <a href={`https://venmo.com/u/${BRAND.venmo}`} target="_blank" rel="noopener noreferrer"
                    style={{display:"block",textAlign:"center",background:`linear-gradient(135deg,${C.red},${C.redDim})`,color:C.white,textDecoration:"none",padding:"15px",borderRadius:12,fontSize:14,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body,fontWeight:700,marginBottom:12}}>
                    📲 Pay on Venmo →
                  </a>
                  <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontSize:10,color:"#555",fontFamily:D.body,marginBottom:2,letterSpacing:1}}>PAYMENT NOTE</div>
                    <div style={{fontSize:12,color:C.silverBright,fontFamily:D.body}}>{myBooking.name} — {myBooking.dateLabel} · {myBooking.ageGroup}</div>
                  </div>
                  {STRIPE_ENABLED&&<button onClick={()=>setPayMethod(null)} style={{background:"none",border:"none",color:"#aaa",fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline"}}>Change method</button>}
                </div>
                )}

                {/* Simple steps */}
                {payMethod==="venmo"&&(
                <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:16}}>
                  {[
                    {n:"1",text:"Tap Pay on Venmo above and send $"+total},
                    {n:"2",text:"Include your name and date in the payment note"},
                    {n:"3",text:"Carlos confirms and you receive a confirmation email"},
                  ].map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:i<2?10:0}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:C.redDark,border:`1px solid ${C.red}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.red,flexShrink:0,fontWeight:700}}>{s.n}</div>
                      <div style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.6,paddingTop:2}}>{s.text}</div>
                    </div>
                  ))}
                </div>
                )}

                {/* Awaiting */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,marginBottom:16}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:C.silver,animation:"pulse 1.5s infinite",flexShrink:0}}/>
                  <span style={{fontSize:11,color:C.textMid,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body}}>Waiting for payment confirmation</span>
                </div>

                <SC title="Booking Summary" rows={[
                  {label:"Name",       value:myBooking.name},
                  {label:"Date",       value:myBooking.dateLabel},
                  {label:"Time",       value:myBooking.sessTime},
                  {label:"Location",   value:myBooking.location||"Bayview Park · James Island"},
                  {label:"Age Group",  value:myBooking.ageGroup, color:AGE_COLORS[myBooking.ageTag]?.text},
                  {label:"Skill Focus",value:`${myBooking.skillIcon} ${myBooking.skill}`, color:SKILL_COLORS[myBooking.skill]?.color},
                  {label:"Players",    value:`${myBooking.count} player${myBooking.count>1?"s":""}`},
                  {label:"Total Due",  value:`$${myBooking.total}`, accent:true},
                ]}/>

                <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 16px",marginTop:12,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>📩</span>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Need to reschedule? Email <a href="mailto:laforjafutbol@gmail.com" style={{color:C.silver,textDecoration:"none"}}>laforjafutbol@gmail.com</a></div>
                </div>

                <AutoRefresh bookingId={myBooking.id}/>
              </>
            )}
          </div>
        )}
        {step===3&&!myBooking&&<div style={{textAlign:"center",padding:"60px 20px",color:C.textDim,fontFamily:D.body}}>Loading your booking…</div>}
        </>)} {/* end single flow */}

        {/* ── PACKAGE BOOKING FLOW ── */}
        {bookMode==="package"&&(
          <div style={{animation:"fadeUp 0.4s ease"}}>
            {step<3&&(
              <div style={{marginBottom:24}}>
                <button onClick={()=>{setBookMode(null);setStep(1);setPackDates([]);setPackWeekOff(0);}} style={{background:"none",border:"none",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body,marginBottom:16,padding:0}}>← Back to options</button>
                <div style={{display:"flex",gap:8}}>
                  {["Pick 4 Dates","Your Details","Payment"].map((lbl,i)=>(
                    <div key={i} style={{flex:1}}>
                      <div style={{height:2,borderRadius:2,marginBottom:5,background:step>i+1?C.gold:step===i+1?C.goldBright:C.cardBorder,transition:"background 0.4s"}}/>
                      <div style={{fontSize:9,color:step>=i+1?C.gold:C.silverDark,letterSpacing:2,textTransform:"uppercase",fontFamily:D.body}}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1 — Pick 4 dates */}
            {step===1&&(
              <div style={{animation:"fadeUp 0.3s ease"}}>
                {/* Package header */}
                <div style={{background:`linear-gradient(135deg,${C.goldDark},#1c0e04)`,border:`1px solid ${C.gold}33`,borderRadius:14,padding:"16px 20px",marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>4-Session Package</div>
                    <div style={{fontSize:28,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1}}>${PRICE_PACK} <span style={{fontSize:13,color:C.gold,fontWeight:400}}>${PRICE_PACK/PACK_SIZE}/session</span></div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:32,fontWeight:700,color:packDates.length===PACK_SIZE?C.green:C.gold,fontFamily:D.display}}>{packDates.length}<span style={{fontSize:16,color:C.textDim}}>/{PACK_SIZE}</span></div>
                    <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>dates selected</div>
                  </div>
                </div>

                <FL>Select any 4 sessions</FL>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <NB disabled={packWeekOff===0} onClick={()=>setPackWeekOff(w=>w-1)}>← Prev</NB>
                  <span style={{fontSize:10,color:C.gold,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body}}>Week {packWeekOff+1}</span>
                  <NB disabled={packWeekOff>=packWeeks.length-1} onClick={()=>setPackWeekOff(w=>w+1)}>Next →</NB>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
                  {packVisDates.map((d,i)=>{
                    const sched=DAY_SCHEDULE[d.getDay()];
                    const sc=SKILL_COLORS[sched.skill]||{color:C.gold,bg:C.goldDark};
                    return(
                      <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"14px 16px"}}>
                        {/* Date header */}
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,paddingBottom:10,borderBottom:`1px solid ${C.cardBorder}`}}>
                          <div style={{textAlign:"center",minWidth:44}}>
                            <div style={{fontSize:10,letterSpacing:2,color:C.gold,fontFamily:D.body,fontWeight:600}}>{DAY_ABBR[d.getDay()]}</div>
                            <div style={{fontSize:28,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1.1}}>{d.getDate()}</div>
                            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                          </div>
                          <div>
                            <div style={{fontSize:12,color:sc.color,fontFamily:D.body,fontWeight:500,marginBottom:2}}>{sched.skillIcon} {sched.skill}</div>
                            <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{sched.sessions.length} session{sched.sessions.length!==1?"s":""} available</div>
                          </div>
                        </div>
                        {/* Sessions */}
                        <div style={{display:"grid",gap:8}}>
                          {sched.sessions.map((sess,si)=>{
                            const sp=spotsLeft(d,sess.id);
                            const bl=isBlocked(d,sess.id);
                            const key=dKey(d)+"_"+sess.id;
                            const selPack=packDates.find(p=>dKey(p.date)+"_"+p.sessId===key);
                            const disabled=sp===0||bl;
                            const atMax=packDates.length>=PACK_SIZE&&!selPack;
                            const ac=AGE_COLORS[sess.ageTag]||{bg:C.card,border:C.gold,text:C.gold,badge:C.goldDark};
                            return(
                              <button key={si} disabled={disabled||atMax} onClick={()=>togglePackDate(d,sess)}
                                style={{background:selPack?`linear-gradient(135deg,${C.green}18,${C.greenDark})`:C.black,border:selPack?`1px solid ${C.green}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 14px",cursor:(disabled||atMax)?"not-allowed":"pointer",textAlign:"left",opacity:disabled?0.35:atMax?0.5:1,transition:"all 0.2s",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div>
                                  <div style={{fontSize:13,fontWeight:600,color:selPack?C.green:C.white,fontFamily:D.display,marginBottom:3}}>
                                    {selPack&&"✓ "}{sess.time}
                                  </div>
                                  <div style={{fontSize:11,color:selPack?C.green:ac.text,fontFamily:D.body}}>{sess.ageGroup}</div>
                                </div>
                                <div style={{textAlign:"right"}}>
                                  <div style={{fontSize:11,color:disabled?C.silverDark:sp<=2?C.red:C.silverDim,fontFamily:D.body}}>{disabled?"FULL":`${sp} left`}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected dates summary */}
                {packDates.length>0&&(
                  <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:20}}>
                    <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Selected Sessions ({packDates.length}/{PACK_SIZE})</div>
                    <div style={{display:"grid",gap:8}}>
                      {[...packDates].sort((a,b)=>a.dateKey>b.dateKey?1:-1).map((pd,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.black,borderRadius:8,padding:"10px 14px"}}>
                          <div>
                            <div style={{fontSize:13,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:2}}>{pd.dateLabel}</div>
                            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{pd.sessTime} · {pd.skillIcon} {pd.skill}</div>
                          </div>
                          <button onClick={()=>togglePackDate(pd.date,{id:pd.sessId,time:pd.sessTime,ageGroup:pd.ageGroup,ageTag:pd.ageTag})} style={{background:"none",border:"none",color:C.redDim,cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <AB disabled={packDates.length<PACK_SIZE} onClick={()=>setStep(2)}>
                  {packDates.length<PACK_SIZE?`Select ${PACK_SIZE-packDates.length} more date${PACK_SIZE-packDates.length!==1?"s":""}…`:"Continue →"}
                </AB>
              </div>
            )}

            {/* Step 2 — Details */}
            {step===2&&(
              <div style={{animation:"fadeUp 0.3s ease"}}>
                {/* Package summary */}
                <div style={{background:`linear-gradient(135deg,${C.goldDark},#1c0e04)`,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"14px 18px",marginBottom:20}}>
                  <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Your 4-Session Package</div>
                  {[...packDates].sort((a,b)=>a.dateKey>b.dateKey?1:-1).map((pd,i)=>(
                    <div key={i} style={{fontSize:12,color:C.silverBright,fontFamily:D.body,marginBottom:3}}>{pd.dateLabel} · {pd.sessTime} · {pd.skillIcon} {pd.skill}</div>
                  ))}
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.gold}22`,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Total</span>
                    <span style={{fontSize:16,fontWeight:700,color:C.gold,fontFamily:D.display}}>${PRICE_PACK} <span style={{fontSize:10,color:C.textDim,fontWeight:400}}>saves ${PRICE_GROUP*PACK_SIZE-PRICE_PACK}</span></span>
                  </div>
                </div>

                {user&&players.length>0&&(
                  <div style={{marginBottom:18}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <FL>Who is training?</FL>
                      {selPlayerIds.length>0&&<div style={{fontSize:11,color:C.green,fontFamily:D.body}}>{selPlayerIds.length} selected</div>}
                    </div>
                    <div style={{display:"grid",gap:8}}>
                      {players.map(p=>{
                        const sel=selPlayerIds.includes(p.id);
                        return(
                          <button key={p.id} onClick={()=>setSelPlayerIds(ids=>sel?ids.filter(id=>id!==p.id):[...ids,p.id])}
                            style={{background:sel?`linear-gradient(135deg,${C.redDark},#1a0804)`:C.card,border:sel?`1px solid ${C.red}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:sel?C.white:C.silverBright,fontFamily:D.display}}>{p.name}</div>
                              <div style={{fontSize:11,color:sel?C.red:C.textDim,fontFamily:D.body}}>{p.age?`Age ${p.age}`:""}{p.position?` · ${p.position}`:""}</div>
                            </div>
                            <div style={{width:20,height:20,borderRadius:5,border:sel?`none`:`1px solid ${C.cardBorder}`,background:sel?C.red:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {sel&&<span style={{color:C.white,fontSize:11,fontWeight:700}}>✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <FL>Your Details</FL>
                <div style={{display:"grid",gap:13,marginBottom:20}}>
                  {[{key:"name",label:"Full Name *",type:"text",ph:"Jane Smith"},{key:"email",label:"Email *",type:"email",ph:"jane@email.com"},{key:"phone",label:"Phone",type:"tel",ph:"+1 (555) 000-0000"},{key:"notes",label:"Player Age / Notes",type:"textarea",ph:"e.g. Age 11. Working on weak-foot."}].map(f=>(
                    <div key={f.key}>
                      <label style={{display:"block",fontSize:9,letterSpacing:2,color:C.gold,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>{f.label}</label>
                      {f.type==="textarea"?<textarea rows={2} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IS}/>:<input type={f.type} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IS}/>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <GB onClick={()=>setStep(1)}>← Back</GB>
                  <AB disabled={!form.name||!form.email||bookingLoading} onClick={doBookPack}>{bookingLoading?"Reserving…":"Reserve Package →"}</AB>
                </div>
              </div>
            )}

            {/* Step 3 — Payment */}
            {step===3&&(
              <div style={{animation:"fadeUp 0.3s ease"}}>
                <div style={{textAlign:"center",marginBottom:22}}>
                  <div style={{width:64,height:64,borderRadius:"50%",margin:"0 auto 14px",background:C.redDark,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,animation:"pulse 2s infinite"}}>⏳</div>
                  <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:600,color:C.white,fontFamily:D.display}}>Package Reserved — Payment Needed</h2>
                  <p style={{margin:0,fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.7}}>All 4 spots are held. Complete payment to confirm all sessions.</p>
                </div>

                {/* Payment method selector */}
                {STRIPE_ENABLED&&!payMethod&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    <button onClick={()=>setPayMethod("stripe")} style={{background:C.card,border:`1px solid ${C.silver}44`,borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:24,marginBottom:8}}>💳</div>
                      <div style={{fontSize:13,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:3}}>Pay by Card</div>
                      <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Instant confirmation</div>
                    </button>
                    <button onClick={()=>setPayMethod("venmo")} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:24,marginBottom:8}}>📲</div>
                      <div style={{fontSize:13,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:3}}>Pay with Venmo</div>
                      <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Coach confirms manually</div>
                    </button>
                  </div>
                )}

                {/* Stripe */}
                {payMethod==="stripe"&&(
                  <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"20px",marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                      <div>
                        <div style={{fontSize:10,letterSpacing:2,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>Package Total</div>
                        <div style={{fontSize:34,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1}}>${PRICE_PACK}</div>
                      </div>
                      {STRIPE_ENABLED&&<button onClick={()=>setPayMethod(null)} style={{background:"none",border:"none",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline"}}>Change</button>}
                    </div>
                    <StripeCheckout amount={PRICE_PACK} metadata={{sessionType:"4-Session Package"}} onSuccess={handleStripeSuccessPack}/>
                  </div>
                )}

                {/* Venmo */}
                {payMethod==="venmo"&&(
                  <div style={{background:C.redDark,border:`1px solid ${C.red}33`,borderRadius:16,padding:"20px",marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div>
                        <div style={{fontSize:10,letterSpacing:2,color:C.red,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>Package Total</div>
                        <div style={{fontSize:40,fontWeight:700,color:C.white,fontFamily:D.display,lineHeight:1}}>${PRICE_PACK}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:10,color:"#888",fontFamily:D.body,marginBottom:3,letterSpacing:1}}>VENMO</div>
                        <div style={{fontSize:16,color:C.silverBright,fontFamily:D.body,fontWeight:600}}>@{BRAND.venmo}</div>
                      </div>
                    </div>
                    <a href={`https://venmo.com/u/${BRAND.venmo}`} target="_blank" rel="noopener noreferrer"
                      style={{display:"block",textAlign:"center",background:`linear-gradient(135deg,${C.red},${C.redDim})`,color:C.white,textDecoration:"none",padding:"15px",borderRadius:12,fontSize:14,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body,fontWeight:700,marginBottom:12}}>
                      📲 Pay on Venmo →
                    </a>
                    <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"10px 14px",marginBottom:10}}>
                      <div style={{fontSize:10,color:"#555",fontFamily:D.body,marginBottom:2,letterSpacing:1}}>PAYMENT NOTE</div>
                      <div style={{fontSize:12,color:C.silverBright,fontFamily:D.body}}>{form.name} — 4-Session Pack · {packDates.length>0?packDates.sort((a,b)=>a.dateKey>b.dateKey?1:-1)[0].dateLabel:""} + more</div>
                    </div>
                    {STRIPE_ENABLED&&<button onClick={()=>setPayMethod(null)} style={{background:"none",border:"none",color:"#aaa",fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline"}}>Change method</button>}
                  </div>
                )}

                {/* Sessions in package */}
                <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"14px 18px",marginBottom:16}}>
                  <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Sessions in Your Package</div>
                  {[...packDates].sort((a,b)=>a.dateKey>b.dateKey?1:-1).map((pd,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,fontFamily:D.body,marginBottom:i<packDates.length-1?8:0,paddingBottom:i<packDates.length-1?8:0,borderBottom:i<packDates.length-1?`1px solid ${C.cardBorder}`:"none"}}>
                      <span style={{color:C.white}}>{pd.dateLabel}</span>
                      <span style={{color:C.textDim}}>{pd.sessTime}</span>
                    </div>
                  ))}
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Package total</span>
                    <span style={{fontSize:15,fontWeight:700,color:C.gold,fontFamily:D.display}}>${PRICE_PACK}</span>
                  </div>
                </div>

                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,marginBottom:16}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:C.silver,animation:"pulse 1.5s infinite",flexShrink:0}}/>
                  <span style={{fontSize:11,color:C.textMid,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body}}>Waiting for payment confirmation</span>
                </div>

                <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>📩</span>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Questions? Email <a href="mailto:laforjafutbol@gmail.com" style={{color:C.silver,textDecoration:"none"}}>laforjafutbol@gmail.com</a></div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function AutoRefresh({bookingId}){
  useEffect(()=>{
    const iv=setInterval(async()=>{
      try{
        const {getDoc,doc:fDoc}=await import("firebase/firestore");
        const snap=await getDoc(fDoc(db,"bookings",bookingId));
        if(snap.exists()&&snap.data().status==="confirmed") window.location.reload();
      }catch(e){}
    },5000);
    return ()=>clearInterval(iv);
  },[bookingId]);
  return <div style={{textAlign:"center",marginTop:14,fontSize:10,color:C.silverDark,fontFamily:D.body}}>Checks for confirmation automatically</div>;
}

// ── PRIVATE 1-ON-1 ────────────────────────────────────────
