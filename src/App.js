import { useState, useEffect } from "react";
import { db, auth, googleProvider } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, PRICE_1ON1, PACKAGES, POSITIONS, DAY_SCHEDULE, AGE_COLORS, SKILL_COLORS, DAY_ABBR, COACH_DAYS, PRIVATE_DAYS, STRIPE_ENABLED, SITE_READY, dKey, fmtDate, getDates, getPrivateDates, callEmailAPI, sendReminderEmail, Crest, SH, SC, FL, AB, GB, NB, IS, GStyles } from "./constants";
import { Dashboard } from "./Pages1";
import { AuthPage, AccountPage, SessionsPage, AboutPage, ContactPage, PackagesPage } from "./Pages2";

// ── BOOKING CUTOFF ─────────────────────────────────────────
function isCutoffHour(date, sessTime){
  const now = new Date();
  // Build session datetime in local time
  const match = (sessTime||"").match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!match) return false;
  let h=parseInt(match[1]); const m=parseInt(match[2]); const ampm=match[3].toUpperCase();
  if(ampm==="PM"&&h!==12) h+=12; if(ampm==="AM"&&h===12) h=0;
  const sessionDate = new Date(date);
  sessionDate.setHours(h,m,0,0);
  // Only cut off if it's the same day AND within 2 hours of session
  const sameDay = now.toDateString()===sessionDate.toDateString();
  if(!sameDay) return false;
  return now >= new Date(sessionDate.getTime()-2*60*60*1000);
}

export default function App(){
  const [page,setPage]       = useState("home");
  const [user,setUser]       = useState(null);
  const [authChecked,setAuthChecked] = useState(false);
  const [bookings,setBookings] = useState([]);
  const [inquiries,setInquiries] = useState([]);
  const [blocked,setBlocked]   = useState([]);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{ setUser(u); setAuthChecked(true); });
    return unsub;
  },[]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"bookings"),s=>setBookings(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,"inquiries"),s=>setInquiries(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"blocked"),s=>setBlocked(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();u3();};
  },[]);

  function spotsLeft(dateKey,sessId){
    return MAX_PLAYERS - bookings.filter(b=>b.dateKey===dateKey&&b.sessId===sessId&&b.status!=="cancelled"&&b.status!=="removed").length;
  }
  function isBlocked(dateKey,sessId){
    return blocked.some(b=>b.dateKey===dateKey&&b.sessId===sessId);
  }
  async function blockSession(dateKey,sessId,label){
    const existing=blocked.find(b=>b.dateKey===dateKey&&b.sessId===sessId);
    if(existing) await deleteDoc(doc(db,"blocked",existing.id));
    else await addDoc(collection(db,"blocked"),{dateKey,sessId,label});
  }
  async function addBooking(booking){
    return await addDoc(collection(db,"bookings"),booking);
  }
  async function confirmBooking(id,coll="bookings"){
    const list = coll==="bookings"?bookings:inquiries;
    const b = list.find(x=>x.id===id);
    await updateDoc(doc(db,coll,id),{status:"confirmed"});
    if(b?.email) callEmailAPI({...b,sessTime:b.sessTime||b.slotTime},"group");
  }
  async function removeBooking(id,coll="bookings"){
    await updateDoc(doc(db,coll,id),{status:"cancelled"});
  }
  async function addInquiry(inq){
    return await addDoc(collection(db,"inquiries"),inq);
  }
  async function scheduleInquiry(id,dateKey,slotTime){
    await updateDoc(doc(db,"inquiries",id),{dateKey,slotTime,status:"confirmed"});
  }
  async function removeInquiry(id){
    await updateDoc(doc(db,"inquiries",id),{status:"cancelled"});
  }

  const navItems = user
    ? [["home","Home"],["about","About"],["book","Book"],["account","My Account"]]
    : [["home","Home"],["about","About"],["book","Book"],["sessions","My Sessions"]];

  return(
    <div style={{background:C.black,minHeight:"100vh",color:C.white}}>
      <GStyles/>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"rgba(9,9,11,0.95)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${C.cardBorder}`,padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>setPage("home")} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          <Crest size={32}/>
          <span style={{fontSize:14,letterSpacing:3,color:C.white,fontFamily:D.display,fontWeight:600}}>La Forja</span>
        </button>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {navItems.map(([key,lbl])=>(
            <button key={key} onClick={()=>setPage(key)} style={{background:page===key?"rgba(255,77,46,0.12)":"transparent",border:page===key?`1px solid ${C.red}33`:"1px solid transparent",color:page===key?C.red:C.textMid,borderRadius:8,padding:"5px 10px",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>
              {lbl}
            </button>
          ))}
          {!user&&<button onClick={()=>setPage("login")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:C.white,borderRadius:8,padding:"6px 14px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,marginLeft:4}}>Sign In</button>}
          <button onClick={()=>setPage("dashboard")} style={{background:"transparent",border:"none",color:C.silverDim,fontSize:16,cursor:"pointer",marginLeft:4,padding:"4px 8px"}}>⚙</button>
        </div>
      </nav>

      <div style={{paddingTop:60}}>
        {page==="home"      && <HomePage setPage={setPage} user={user}/>}
        {page==="about"     && <AboutPage setPage={setPage}/>}
        {page==="book"      && <BookPage spotsLeft={spotsLeft} addBooking={addBooking} bookings={bookings} isBlocked={isBlocked} user={user} setPage={setPage}/>}
        {page==="packages"  && <PackagesPage setPage={setPage}/>}
        {page==="contact"   && <ContactPage setPage={setPage} user={user}/>}
        {page==="sessions"  && <SessionsPage setPage={setPage} user={user}/>}
        {page==="login"     && <AuthPage setPage={setPage} authChecked={authChecked} user={user}/>}
        {page==="account"   && <AccountPage setPage={setPage} user={user} authChecked={authChecked} bookings={bookings} inquiries={inquiries} getDates={getDates} getPrivateDates={getPrivateDates}/>}
        {page==="dashboard" && <Dashboard bookings={bookings} inquiries={inquiries} confirmBooking={confirmBooking} removeBooking={removeBooking} scheduleInquiry={scheduleInquiry} removeInquiry={removeInquiry} sendReminderEmail={sendReminderEmail} blocked={blocked} blockSession={blockSession} spotsLeft={spotsLeft} getDates={getDates} getPrivateDates={getPrivateDates}/>}
      </div>

      <Footer setPage={setPage}/>
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────
function HomePage({setPage,user}){
  return(
    <div>
      {/* Hero */}
      <div style={{minHeight:"92vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"clamp(40px,8vw,60px) 20px",textAlign:"center",background:`radial-gradient(ellipse at 50% 80%,${C.redDark} 0%,transparent 55%)`}}>
        <Crest size={80}/>
        <div style={{fontSize:9,letterSpacing:6,color:C.silverDim,textTransform:"uppercase",marginTop:20,marginBottom:8,fontFamily:D.body}}>James Island · Charleston SC</div>
        <h1 style={{margin:"0 0 10px",fontFamily:D.display,fontWeight:700,fontSize:"clamp(48px,9vw,80px)",letterSpacing:6,textTransform:"uppercase",color:C.white,lineHeight:1}}>La Forja</h1>
        <p style={{fontSize:11,letterSpacing:5,color:C.silver,marginBottom:14,textTransform:"uppercase",fontFamily:D.body}}>{BRAND.tagline}</p>
        <p style={{fontSize:15,color:C.textMid,marginBottom:48,maxWidth:480,lineHeight:2,fontFamily:D.display,fontStyle:"italic"}}>Pure technique. Zero filler. Every session is built around perfecting the details that make the difference on game day — first touch, decision making, 1v1 dominance, and composure under pressure.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"14px 40px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 8px 32px ${C.red}44`,fontFamily:D.body,fontWeight:600}}>Book a Session</button>
          <button onClick={()=>setPage("about")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.silver,borderRadius:10,padding:"14px 40px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>About the Program</button>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"clamp(40px,6vw,80px) clamp(16px,4vw,24px) 60px"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:8,letterSpacing:6,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>The Programs</div>
          <h2 style={{fontSize:"clamp(26px,4vw,40px)",color:C.white,fontFamily:D.display,fontWeight:600,margin:0}}>Built Around One Thing</h2>
          <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,marginTop:12,maxWidth:480,margin:"12px auto 0",lineHeight:1.8}}>Pure technical development. Game-ready players. No fitness work — just ball mastery, decision making, and the details that show up on game day.</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:60}}>
          <div style={{background:"#100c08",border:"1px solid #241a10",borderTop:`3px solid ${C.red}`,borderRadius:16,padding:"28px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{width:46,height:46,borderRadius:12,background:C.redDark,border:`1px solid ${C.red}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🔥</div>
              <div>
                <div style={{fontSize:18,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:2}}>The Furnace</div>
                <div style={{fontSize:8,letterSpacing:2,color:C.red,textTransform:"uppercase",fontFamily:D.body}}>Fridays · Group · U11+</div>
              </div>
            </div>
            <p style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:20}}>No fitness drills. No running laps. The Furnace is 100% focused on the technical details that make you dangerous on game day. Small group, full attention, every rep with a purpose.</p>
            {[
              {icon:"🎯",text:"First touch and ball control — receive any pass cleanly and be in control immediately"},
              {icon:"⚔️",text:"1v1 technique — beat defenders with skill, not speed"},
              {icon:"⚡",text:"Decision making — reading the game and picking the right move before the ball arrives"},
              {icon:"🥅",text:"Finishing — clinical in front of goal regardless of pressure or angle"},
            ].map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{item.icon}</span>
                <span style={{fontSize:11,color:"#a89888",fontFamily:D.body,lineHeight:1.8}}>{item.text}</span>
              </div>
            ))}
            <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #241a10"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Up to {MAX_PLAYERS} players · Fridays</span>
                <span style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display}}>${PRICE_GROUP}<span style={{fontSize:10,color:C.textDim,fontWeight:400}}>/session</span></span>
              </div>
              <button onClick={()=>setPage("book")} style={{display:"block",width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:C.white,borderRadius:9,padding:"12px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>Book The Furnace →</button>
            </div>
          </div>

          <div style={{background:"#0d0c08",border:"1px solid #201c10",borderTop:`3px solid ${C.silver}`,borderRadius:16,padding:"28px 24px",position:"relative"}}>
            <div style={{position:"absolute",top:16,right:16,background:`${C.silver}18`,border:`1px solid ${C.silver}33`,borderRadius:20,padding:"3px 12px",fontSize:8,letterSpacing:2,color:C.silver,textTransform:"uppercase",fontFamily:D.body}}>Coming Soon</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{width:46,height:46,borderRadius:12,background:C.goldDark,border:`1px solid ${C.silver}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>⚒️</div>
              <div>
                <div style={{fontSize:18,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:2}}>The Tempering</div>
                <div style={{fontSize:8,letterSpacing:2,color:C.silver,textTransform:"uppercase",fontFamily:D.body}}>Private · 1-on-1</div>
              </div>
            </div>
            <p style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:20}}>Everything in The Furnace is designed for the group. The Tempering is designed entirely for you. One coach, one player, zero distractions — every minute spent on exactly what your game needs.</p>
            {[
              {icon:"🎯",text:"Built around your position, your style, your specific weaknesses"},
              {icon:"📋",text:"Session-by-session plan tailored to you and adjusted as you improve"},
              {icon:"🔍",text:"Rep-by-rep feedback — what went wrong, why, and exactly how to fix it"},
              {icon:"📈",text:"Progress tracked every session so you always know how far you've come"},
              {icon:"🤝",text:"Direct access to Coach Carlos between sessions"},
            ].map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{item.icon}</span>
                <span style={{fontSize:11,color:"#a89888",fontFamily:D.body,lineHeight:1.8}}>{item.text}</span>
              </div>
            ))}
            <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #201c10"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>Private · 75-min session</span>
                <span style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display}}>${PRICE_1ON1}<span style={{fontSize:10,color:C.textDim,fontWeight:400}}>/session</span></span>
              </div>
              <div style={{background:`${C.silver}06`,border:`1px solid ${C.silver}15`,borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.8,marginBottom:10}}>1-on-1 sessions are coming. Email Coach Carlos and you'll be first to know when scheduling opens.</div>
                <a href="mailto:laforjafutbol@gmail.com?subject=1-on-1 Interest — The Tempering" style={{display:"inline-block",background:"transparent",border:`1px solid ${C.silver}44`,color:C.silver,borderRadius:8,padding:"9px 22px",fontSize:9,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body,fontWeight:600,textDecoration:"none"}}>Get Notified →</a>
              </div>
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:60}}>
          {[
            {val:MAX_PLAYERS,label:"Max Players",sub:"small group, real reps"},
            {val:`$${PRICE_GROUP}`,label:"Per Session",sub:"no contracts"},
            {val:"U11+",label:"Age Requirement",sub:"11v11 players only"},
          ].map(s=>(
            <div key={s.label} style={{background:`#0e0b08`,border:`1px solid #1e1810`,borderRadius:14,padding:"24px 18px",textAlign:"center"}}>
              <div style={{fontSize:"clamp(24px,6vw,36px)",fontWeight:700,color:C.white,marginBottom:4,fontFamily:D.display}}>{s.val}</div>
              <div style={{fontSize:10,color:C.silver,letterSpacing:2,textTransform:"uppercase",fontFamily:D.body,fontWeight:500,marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{background:"linear-gradient(135deg,#141416,#0f0f12)",border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:"28px 28px",marginBottom:60,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
          <div>
            <div style={{fontSize:8,letterSpacing:4,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Training Packages</div>
            <h3 style={{fontSize:20,color:C.white,fontFamily:D.display,fontWeight:600,margin:"0 0 6px"}}>Lock In Your Spot & Save</h3>
            <p style={{fontSize:12,color:C.textDim,fontFamily:D.body,lineHeight:1.8,margin:0}}>Single · 4 Sessions · 8 Sessions — pick what works for you.</p>
          </div>
          <button onClick={()=>setPage("packages")} style={{background:`linear-gradient(135deg,${C.silver},${C.silverDim})`,border:"none",color:"#0a0a0a",borderRadius:10,padding:"13px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body,fontWeight:700,flexShrink:0,cursor:"pointer"}}>View Packages →</button>
        </div>

        <div style={{marginBottom:60}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:8,letterSpacing:6,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>First Session</div>
            <h2 style={{fontSize:"clamp(24px,4vw,36px)",color:C.white,fontFamily:D.display,fontWeight:600,margin:0}}>What to Expect</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
            {[
              {icon:"👟",title:"Gear Up",desc:"Cleats or turf shoes. Water bottle. Elastic band. Arrive 15 minutes early. No extra gear needed — this is technical work, not a workout."},
              {icon:"🎯",title:"Technical Focus",desc:"Every minute is spent on the ball. Touches, decisions, movement patterns — the details that separate good players from great ones."},
              {icon:"🎯",title:"Real Feedback",desc:"Coach Carlos is on you every rep. Direct, specific, actionable feedback."},
              {icon:"📋",title:"Debrief",desc:"Sessions end with one win and one focus area. You leave knowing what to work on."},
            ].map((item,i)=>(
              <div key={i} style={{background:"#0e0b08",border:"1px solid #1e1810",borderRadius:12,padding:"20px 18px"}}>
                <div style={{fontSize:24,marginBottom:10}}>{item.icon}</div>
                <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:6}}>{item.title}</div>
                <div style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.8}}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginBottom:60}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:8,letterSpacing:6,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Questions</div>
            <h2 style={{fontSize:"clamp(24px,4vw,36px)",color:C.white,fontFamily:D.display,fontWeight:600,margin:0}}>Quick Answers</h2>
          </div>
          <div style={{display:"grid",gap:8,maxWidth:680,margin:"0 auto",padding:"0 4px"}}>
            {[
              {q:"What age can my player train?",a:"U11 and up — players who are on full 11v11 fields. Younger players can reach out directly."},
              {q:"What if it rains?",a:"Light rain we train. Lightning or severe weather we reschedule at no charge."},
              {q:"Is this a fitness or conditioning program?",a:"No. La Forja is purely technical training — ball work, decision making, and game situations. If your player needs fitness training this is not the right program. If they need to be better on the ball, this is exactly where they should be."},
              {q:"Can I reschedule?",a:"Yes — log into your account and reschedule directly to any open Friday slot. No approval needed."},
              {q:"How many players per session?",a:`Maximum ${MAX_PLAYERS} players. Small on purpose — every player gets real reps and real feedback.`},
              {q:"What should my player bring?",a:"Cleats or turf shoes, water bottle, and an elastic band. Arrive 15 minutes early."},
            ].map((item,i)=>(
              <div key={i} style={{background:"#0e0b08",border:"1px solid #1e1810",borderRadius:10,padding:"16px 20px"}}>
                <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:6}}>{item.q}</div>
                <div style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.8}}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:"#0e0b08",border:"1px solid #1e1810",borderRadius:14,padding:"22px 26px",marginBottom:50,display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div style={{fontSize:28}}>📍</div>
          <div style={{flex:1}}>
            <div style={{fontSize:8,letterSpacing:4,color:C.textDim,textTransform:"uppercase",marginBottom:4,fontFamily:D.body}}>Location</div>
            <div style={{fontSize:17,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:4}}>Bayview Park · James Island, SC</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Sessions every Friday evening.</div>
          </div>
          <a href="https://maps.google.com/?q=Bayview+Park+James+Island+SC" target="_blank" rel="noopener noreferrer" style={{background:"transparent",border:`1px solid ${C.silver}33`,color:C.silver,borderRadius:8,padding:"10px 18px",fontSize:9,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,textDecoration:"none"}}>Directions →</a>
        </div>

        <div style={{textAlign:"center"}}>
          <button onClick={()=>setPage("book")} style={{background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"15px 48px",fontSize:11,letterSpacing:4,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 8px 32px ${C.red}44`,fontFamily:D.body,fontWeight:600,marginBottom:14}}>Book The Furnace</button>
          <div style={{marginTop:12}}>
            {!user
              ?<button onClick={()=>setPage("login")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.silver,borderRadius:8,padding:"10px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Create Account</button>
              :<button onClick={()=>setPage("account")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textMid,borderRadius:8,padding:"10px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>My Account →</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BOOK PAGE ─────────────────────────────────────────────
function BookPage({spotsLeft,addBooking,bookings,isBlocked,user,setPage}){
  const [step,setStep]         = useState(0);
  const [selPkg,setSelPkg]     = useState(null);
  const [selDates,setSelDates] = useState([]);
  const [selDate,setSelDate]   = useState(null);
  const [selSess,setSelSess]   = useState(null);
  const [form,setForm]         = useState({name:"",email:"",phone:"",notes:""});
  const [waiverAgreed,setWaiverAgreed] = useState(false);
  const [bookingLoading,setBookingLoading] = useState(false);
  const [myBookings,setMyBookings] = useState([]);
  const [players,setPlayers]   = useState([]);
  const [selPlayerIds,setSelPlayerIds] = useState([]);
  const [count,setCount]       = useState(1);

  useEffect(()=>{
    if(!user) return;
    const unsub=onSnapshot(collection(db,"users",user.uid,"players"),s=>setPlayers(s.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[user]);

  const allDates   = getDates(10);
  const isPackage  = selPkg && selPkg.sessions > 1;
  const needed     = selPkg?.sessions || 1;
  const effectiveCount = user&&selPlayerIds.length>0 ? selPlayerIds.length : count;
  const total      = isPackage ? selPkg.price * effectiveCount : effectiveCount * PRICE_GROUP;

  const canNext1Single = selDate && selSess && !isBlocked(dKey(selDate),selSess.id) && spotsLeft(dKey(selDate),selSess.id)>=effectiveCount;
  const canNext1Pkg = selDates.length === needed;
  const canNext1 = isPackage ? canNext1Pkg : canNext1Single;
  const canNext2 = (form.name||selPlayerIds.length>0) && form.email && waiverAgreed;

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get("checkout")==="success"){
      setStep(3);
      window.history.replaceState({},"","/");
    }
  },[]);

  useEffect(()=>{
    if(step===2&&user&&!form.email){
      setForm(f=>({...f,email:user.email||"",name:user.displayName||f.name}));
    }
  },[step,user]);

  function togglePackDate(date, sess){
    const dk = dKey(date);
    const existing = selDates.findIndex(s=>s.dk===dk&&s.sess.id===sess.id);
    if(existing>=0){ setSelDates(selDates.filter((_,i)=>i!==existing)); }
    else if(selDates.length < needed){ setSelDates([...selDates, {dk, date, sess, dateLabel:fmtDate(date)}]); }
  }

  async function redirectToCheckout(savedBookingRef){
    setBookingLoading(true);
    try{
      const pricePerSession = isPackage ? selPkg.price / selPkg.sessions : PRICE_GROUP;
      const res = await fetch("/api/create-checkout-session",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          packageName: selPkg?.name || "Single Session",
          sessions: isPackage ? selPkg.sessions : 1,
          players: effectiveCount,
          pricePerSession,
          total,
          bookingRef: savedBookingRef || "",
          email: form.email || user?.email || "",
        }),
      });
      const data = await res.json();
      if(data.url){ window.location.href = data.url; }
      else{ console.error("Checkout error:", data.error); setBookingLoading(false); }
    }catch(e){ console.error("Checkout fetch error:",e); setBookingLoading(false); }
  }

  function reset(){ setStep(0);setSelPkg(null);setSelDate(null);setSelSess(null);setSelDates([]);setForm({name:"",email:"",phone:"",notes:""});setMyBookings([]);setWaiverAgreed(false);setSelPlayerIds([]);setCount(1); }

  async function doBook(paymentMethod="card"){
    setBookingLoading(true);
    const selectedPlayers = players.filter(p=>selPlayerIds.includes(p.id));
    const bookingName = selectedPlayers.length>0 ? selectedPlayers.map(p=>p.name).join(", ") : form.name;
    const bookingEmail = form.email || (user?.email||"");
    const isCash = paymentMethod==="cash";
    const base = {
      skill:"The Furnace", skillIcon:"🔥",
      count:effectiveCount,
      name:bookingName, email:bookingEmail, phone:form.phone, notes:form.notes,
      parentName:user?user.displayName||form.name:null,
      status: "confirmed",
      paymentMethod: isCash ? "cash" : "card",
      packageName:selPkg?.name||"Single Session",
      packageTotal:total,
      waiverAgreed:true, waiverSignedAt:new Date().toISOString(),
      createdAt:new Date().toISOString(),
      ...(user?{userId:user.uid}:{}),
      ...(selPlayerIds.length>0?{playerIds:selPlayerIds}:{}),
    };
    let refs = [];
    if(isPackage){
      for(const s of selDates){
        const booking = {...base, dateKey:s.dk, dateLabel:s.dateLabel, sessId:s.sess.id, sessTime:s.sess.time, total:selPkg.price/needed*effectiveCount};
        const ref = await addBooking(booking);
        if(ref?.id) refs.push({...booking,id:ref.id});
      }
      if(refs.length>0&&bookingEmail) await callEmailAPI({...refs[0], packageBooking:true, packageDates:selDates.map(s=>s.dateLabel).join(", "), packageName:selPkg.name, total},"group");
    } else {
      const daySchedule = DAY_SCHEDULE[selDate.getDay()];
      const booking = {...base, dateKey:dKey(selDate), dateLabel:fmtDate(selDate), sessId:selSess.id, sessTime:selSess.time, total};
      const ref = await addBooking(booking);
      if(ref?.id){ refs.push({...booking,id:ref.id}); if(bookingEmail) await callEmailAPI(booking,"group"); }
    }
    setMyBookings(refs);

    if(paymentMethod==="cash"){
      // Cash — go straight to confirmation
      setBookingLoading(false);
      setStep(3);
    } else {
      // Card — redirect to Stripe Checkout
      const firstRef = refs[0]?.id || "";
      await redirectToCheckout(firstRef);
    }
  }

  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"clamp(20px,4vw,40px) clamp(14px,4vw,20px) 100px"}}>
      <SH eyebrow="Reserve" title="Book a Session"/>

      {step>0&&step<3&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:28}}>
          {["Pick a Date","Your Details","Confirmed"].map((s,i)=>(
            <div key={i}>
              <div style={{height:2,borderRadius:2,marginBottom:5,background:step>i+1?C.silver:step===i+1?C.silverBright:C.cardBorder}}/>
              <div style={{fontSize:"clamp(7px,2vw,9px)",letterSpacing:1,color:step===i+1?C.silver:C.textDim,fontFamily:D.body,textTransform:"uppercase"}}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {step===0&&(
        <div>
          <p style={{fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.9,marginBottom:28}}>Choose how you want to train. Single session to try it out, or lock in a package for a better rate.</p>
          <div style={{display:"grid",gap:12,marginBottom:24}}>
            {[
              {id:"single",name:"Single Session",price:40,rate:"$40/session",sessions:1,desc:"Try it out. No commitment.",highlight:false},
              {id:"month4",name:"4 Sessions",price:140,rate:"$35/session",sessions:4,save:"Save $20",desc:"One Friday per week for a month.",highlight:false},
              {id:"month8",name:"8 Sessions",price:260,rate:"$32/session",sessions:8,save:"Save $60",desc:"Two months of Fridays. Commit to the process.",highlight:true},
            ].map((p,i)=>(
              <div key={i} style={{background:p.highlight?"linear-gradient(135deg,#1a1618,#141416)":C.card,border:p.highlight?`1px solid ${C.silver}44`:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"16px 18px",position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                {p.highlight&&<div style={{position:"absolute",top:-9,left:20,background:`linear-gradient(135deg,${C.silver},${C.silverDim})`,color:"#0a0a0a",fontSize:7,letterSpacing:2,fontWeight:700,textTransform:"uppercase",fontFamily:D.body,padding:"2px 10px",borderRadius:8}}>Best Value</div>}
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontSize:16,fontWeight:600,color:p.highlight?C.silver:C.white,fontFamily:D.display}}>{p.name}</span>
                    <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{p.sessions} session{p.sessions>1?"s":""}</span>
                    <span style={{fontSize:10,color:p.highlight?C.silver:C.textMid,fontFamily:D.body}}>{p.rate}</span>
                    {p.save&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:6,background:p.highlight?`${C.silver}18`:"rgba(255,255,255,0.05)",color:p.highlight?C.silver:C.textDim,fontFamily:D.body}}>{p.save}</span>}
                  </div>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{p.desc}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
                  <div style={{fontSize:26,fontWeight:700,color:C.white,fontFamily:D.display}}>${p.price}</div>
                  <button onClick={()=>{setSelPkg(p);setSelDates([]);setSelDate(null);setSelSess(null);setStep(1);}} style={{background:p.highlight?`linear-gradient(135deg,${C.silver},${C.silverDim})`:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:p.highlight?"#0a0a0a":C.white,borderRadius:9,padding:"10px 20px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700,whiteSpace:"nowrap"}}>Select →</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"14px 18px"}}>
            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>How Packages Work</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8}}>Pick your package, then select your Friday sessions. You can reschedule any session from your account — no approval needed. Session credit never expires within the purchased period.</div>
          </div>
        </div>
      )}

      {step===1&&(
        <div>
          {isPackage&&(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display}}>{selPkg.name}</div>
                <div style={{fontSize:11,color:selDates.length===needed?C.green:C.silver,fontFamily:D.body,fontWeight:600}}>{selDates.length} of {needed} selected</div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {Array.from({length:needed}).map((_,i)=>{
                  const filled = selDates[i];
                  return(
                    <div key={i} style={{flex:"1 1 auto",minWidth:60,background:filled?`${C.green}18`:"#0a0908",border:`1px solid ${filled?C.green:C.cardBorder}`,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                      {filled?(<><div style={{fontSize:9,color:C.green,fontFamily:D.body,fontWeight:600,marginBottom:1}}>✓</div><div style={{fontSize:8,color:C.green,fontFamily:D.body,lineHeight:1.3}}>{filled.dateLabel.split(",")[0]}</div></>):(<div style={{fontSize:18,color:C.cardBorder}}>·</div>)}
                    </div>
                  );
                })}
              </div>
              {selDates.length===needed
                ?<div style={{fontSize:10,color:C.green,fontFamily:D.body,fontWeight:600}}>✓ All sessions selected — continue below</div>
                :selDates.length>0&&<div style={{fontSize:10,color:C.silver,fontFamily:D.body}}>{needed-selDates.length} more to pick</div>
              }
            </div>
          )}

          {user&&players.length>0&&(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"18px",marginBottom:20}}>
              <FL>Select Players</FL>
              <div style={{display:"grid",gap:8}}>
                {players.map(p=>{
                  const sel=selPlayerIds.includes(p.id);
                  return(
                    <button key={p.id} onClick={()=>setSelPlayerIds(sel?selPlayerIds.filter(id=>id!==p.id):[...selPlayerIds,p.id])} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:sel?`${C.red}12`:C.black,border:`1px solid ${sel?C.red:C.cardBorder}`,borderRadius:9,cursor:"pointer"}}>
                      <div style={{textAlign:"left"}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display}}>{p.name}</div>
                        <div style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{p.age?"Age "+p.age:""}{p.age&&p.position?" · ":""}{p.position||""}</div>
                      </div>
                      {sel&&<div style={{width:18,height:18,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.white}}>✓</div>}
                    </button>
                  );
                })}
              </div>
              {selPlayerIds.length>0&&<div style={{fontSize:11,color:C.silver,fontFamily:D.body,marginTop:10,textAlign:"center"}}>{selPlayerIds.length} player{selPlayerIds.length>1?"s":""} · ${selPlayerIds.length*(isPackage?selPkg.price:PRICE_GROUP)} total</div>}
            </div>
          )}

          {!user&&(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,display:"flex",alignItems:"center",gap:6}}>
                <span>Players:</span>
                {[1,2,3,4,5,6].map(n=>(<button key={n} onClick={()=>setCount(n)} style={{background:count===n?`${C.red}22`:"transparent",border:`1px solid ${count===n?C.red:C.cardBorder}`,borderRadius:6,padding:"3px 10px",color:count===n?C.red:C.textDim,fontSize:11,cursor:"pointer",fontFamily:D.body}}>{n}</button>))}
              </div>
              <div style={{fontSize:11,color:C.silver,fontFamily:D.body,fontWeight:600}}>${count*(isPackage?selPkg.price:PRICE_GROUP)} total</div>
            </div>
          )}

          <FL>{isPackage?`Pick Your ${needed} Fridays`:"Available Fridays"}</FL>
          <div style={{display:"grid",gap:8}}>
            {allDates.map((d,i)=>{
              const dk=dKey(d);
              const sched=DAY_SCHEDULE[d.getDay()];
              const isSelDate = !isPackage && selDate && dKey(selDate)===dk;
              return(
                <div key={i} style={{background:isSelDate?`${C.red}08`:C.card,border:`1px solid ${isSelDate?C.red:C.cardBorder}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display,marginBottom:10}}>{fmtDate(d)}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
                    {sched.sessions.map(sess=>{
                      const spots=spotsLeft(dk,sess.id);
                      const blk=isBlocked(dk,sess.id);
                      const cutoff=isCutoffHour(d,sess.time);
                      const disabled=blk||spots<effectiveCount||cutoff;
                      const pkgSel = isPackage && selDates.some(s=>s.dk===dk&&s.sess.id===sess.id);
                      const isSel = isPackage ? pkgSel : (isSelDate&&selSess?.id===sess.id);
                      const pkgFull = isPackage && selDates.length>=needed && !pkgSel;
                      return(
                        <button key={sess.id} onClick={()=>{ if(disabled) return; if(isPackage){ togglePackDate(d,sess); } else{ setSelDate(d);setSelSess(sess); } }}
                          style={{background:isSel?`${C.green}15`:disabled||pkgFull?"#0a0908":"#0d0b08",border:`1px solid ${isSel?C.green:disabled||pkgFull?"#1a1a1a":C.cardBorder}`,borderRadius:9,padding:"10px 14px",cursor:disabled||pkgFull?"not-allowed":"pointer",textAlign:"left",opacity:disabled||pkgFull?0.4:1,position:"relative"}}>
                          {isSel&&<div style={{position:"absolute",top:8,right:10,width:18,height:18,borderRadius:"50%",background:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#0a0a0a",fontWeight:700}}>✓</div>}
                          <div style={{fontSize:12,fontWeight:600,color:isSel?C.green:C.white,fontFamily:D.display,marginBottom:4}}>{sess.time}</div>
                          <div style={{fontSize:10,color:blk?"#666":spots===0?"#666":spots<=2?C.red:C.green,fontFamily:D.body}}>{blk?"Unavailable":spots===0?"Full":`${spots} spot${spots!==1?"s":""} left`}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:16,display:"flex",gap:10}}>
            <GB onClick={()=>setStep(0)}>← Back</GB>
            <AB onClick={()=>setStep(2)} disabled={!canNext1}>{isPackage ? selDates.length===needed ? "Continue →" : `Select ${needed-selDates.length} more…` : "Continue →"}</AB>
          </div>
        </div>
      )}

      {step===2&&(
        <div>
          {isPackage?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,overflow:"hidden",marginBottom:20}}>
              <div style={{padding:"10px 18px",borderBottom:`1px solid ${C.cardBorder}`,fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body}}>{selPkg.name} Summary</div>
              {selDates.map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:i<selDates.length-1?`1px solid ${C.cardBorder}`:"none"}}>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Session {i+1}</span>
                  <span style={{fontSize:12,color:C.white,fontFamily:D.body}}>{s.dateLabel} · {s.sess.time}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"12px 18px",background:"#0a0908"}}>
                <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Total Due</span>
                <span style={{fontSize:14,fontWeight:700,color:C.silver,fontFamily:D.display}}>${selPkg.price * effectiveCount}{effectiveCount>1?` (${effectiveCount} players)`:""}</span>
              </div>
            </div>
          ):(
            <SC title="Session Summary" rows={[
              {label:"Date",value:fmtDate(selDate)},
              {label:"Time",value:selSess?.time},
              {label:"Session",value:"🔥 The Furnace"},
              {label:"Players",value:`${effectiveCount} player${effectiveCount>1?"s":""}`},
              {label:"Total Due",value:`$${total}`,accent:true},
            ]}/>
          )}

          {!user&&(
            <div style={{display:"grid",gap:10,margin:"20px 0"}}>
              {[{label:"Name *",key:"name",type:"text"},{label:"Email *",key:"email",type:"email"},{label:"Phone",key:"phone",type:"tel"}].map(f=>(
                <div key={f.key}>
                  <div style={{fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>{f.label}</div>
                  <input type={f.type} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={{...IS}}/>
                </div>
              ))}
            </div>
          )}
          {user&&(
            <div style={{margin:"16px 0"}}>
              <div style={{fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:6}}>Confirm Email</div>
              <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder={user.email||"your@email.com"} style={{...IS}}/>
              {!form.email&&user.email&&(
                <button onClick={()=>setForm(p=>({...p,email:user.email,name:user.displayName||p.name}))} style={{marginTop:8,background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:"6px 14px",color:C.silver,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Use {user.email}</button>
              )}
            </div>
          )}

          <div style={{background:"#0d0b08",border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"16px",marginTop:16,marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Waiver & Session Policy</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,lineHeight:1.8,marginBottom:12}}>
              Soccer training involves physical risk. I voluntarily allow my player to participate in La Forja Futbol training and release La Forja Futbol and its coaches from liability for injuries from normal training activities. I consent to photos/videos being used for coaching and promotional purposes.
              <br/><br/>
              <strong style={{color:C.textMid}}>Sessions:</strong> Reschedule directly from your account at any time. Same-day no-shows are forfeited. No cash refunds — value stays as session credit. Emergencies handled case-by-case with Coach Carlos.
            </div>
            <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
              <input type="checkbox" checked={waiverAgreed} onChange={e=>setWaiverAgreed(e.target.checked)} style={{marginTop:3,accentColor:C.red,width:14,height:14,flexShrink:0}}/>
              <span style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.6}}>I agree to the waiver and session policy.</span>
            </label>
          </div>

          {/* Price Breakdown */}
          <div style={{background:"#0a0908",border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 20px",marginBottom:16}}>
            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Payment Summary</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>{selPkg?.name || "Single Session"}</span>
              <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>${isPackage ? selPkg.price : PRICE_GROUP}/session</span>
            </div>
            {effectiveCount>1&&(
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>Players</span>
                <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>× {effectiveCount}</span>
              </div>
            )}
            {isPackage&&(
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>Sessions</span>
                <span style={{fontSize:12,color:C.textMid,fontFamily:D.body}}>{selPkg.sessions} sessions</span>
              </div>
            )}
            <div style={{borderTop:`1px solid ${C.cardBorder}`,marginTop:10,paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display}}>Total</span>
              <span style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:D.display}}>${total}</span>
            </div>
          </div>

          {/* Pay by Card — Stripe Checkout */}
          <button disabled={!canNext2||bookingLoading} onClick={()=>doBook("card")}
            style={{display:"block",width:"100%",background:canNext2?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a1a1a",border:"none",borderRadius:10,padding:"14px",color:canNext2?C.white:C.textDim,fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:canNext2?"pointer":"not-allowed",fontFamily:D.body,fontWeight:600,marginBottom:8}}>
            {bookingLoading?"Please wait…":"Pay Securely with Card →"}
          </button>
          <div style={{fontSize:10,color:C.textDim,fontFamily:D.body,textAlign:"center",marginBottom:12}}>
            🔒 You'll be redirected to Stripe's secure checkout — card, Apple Pay, or Google Pay
          </div>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{flex:1,height:1,background:C.cardBorder}}/>
            <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>or</span>
            <div style={{flex:1,height:1,background:C.cardBorder}}/>
          </div>

          {/* Pay with Cash */}
          <button disabled={!canNext2||bookingLoading} onClick={()=>doBook("cash")}
            style={{display:"block",width:"100%",background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:10,padding:"13px",color:canNext2?C.silver:C.silverDark,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:canNext2?"pointer":"not-allowed",fontFamily:D.body,marginBottom:8}}>
            {bookingLoading?"Reserving…":"Pay with Cash at Session →"}
          </button>
          <div style={{fontSize:10,color:C.textDim,fontFamily:D.body,textAlign:"center",marginBottom:16}}>
            Bring exact cash — ${total}. Coach does not carry change.
          </div>

          <div style={{display:"flex",gap:10}}>
            <GB onClick={()=>setStep(1)}>← Back</GB>
            {!STRIPE_ENABLED&&<AB disabled={!canNext2||bookingLoading} onClick={doBook}>{bookingLoading?"Reserving…":"Reserve My Spot →"}</AB>}
          </div>
        </div>
      )}

      {step===3&&(
        <div style={{textAlign:"center"}}>
          <div style={{width:80,height:80,borderRadius:"50%",margin:"0 auto 20px",background:`linear-gradient(135deg,${C.green},#0e7a47)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,color:C.white,boxShadow:`0 0 60px ${C.green}44`}}>⚒️</div>
          <h2 style={{margin:"0 0 8px",fontSize:28,fontWeight:700,color:C.white,fontFamily:D.display,letterSpacing:2}}>You're In The Forge</h2>
          <p style={{margin:"0 0 28px",fontSize:13,color:C.textDim,fontFamily:D.body,lineHeight:1.8}}>{STRIPE_ENABLED?"Payment confirmed. A confirmation email is on its way. If you chose cash, bring exact payment to the session.":"A confirmation email is on its way. Complete payment via Venmo or bring cash to the session."}</p>

          {isPackage&&myBookings.length>0?(
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,overflow:"hidden",marginBottom:20,textAlign:"left"}}>
              <div style={{padding:"10px 18px",borderBottom:`1px solid ${C.cardBorder}`,fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body}}>{selPkg.name} · {myBookings.length} Sessions Booked</div>
              {myBookings.map((b,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:i<myBookings.length-1?`1px solid ${C.cardBorder}`:"none",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:`${C.green}18`,border:`1px solid ${C.green}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.green}}>✓</div>
                    <span style={{fontSize:12,color:C.white,fontFamily:D.body}}>{b.dateLabel}</span>
                  </div>
                  <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{b.sessTime}</span>
                </div>
              ))}
            </div>
          ):myBookings.length>0&&(
            <SC title="Session Details" rows={[
              {label:"Date",value:myBookings[0].dateLabel},
              {label:"Time",value:myBookings[0].sessTime},
              {label:"Session",value:"🔥 The Furnace"},
              {label:"Players",value:`${effectiveCount} player${effectiveCount>1?"s":""}`},
            ]}/>
          )}

          {!STRIPE_ENABLED&&(
            <div style={{background:"#0a0805",border:`1px solid ${C.silver}22`,borderRadius:12,padding:"16px 20px",margin:"20px 0",textAlign:"center"}}>
              <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Pay via Venmo</div>
              <div style={{fontSize:16,color:C.textMid,fontFamily:D.body,marginBottom:8}}>Send <strong style={{color:C.white,fontSize:24}}>${total}</strong></div>
              <a href="https://venmo.com/u/carlos-cepeda-41" target="_blank" rel="noopener noreferrer" style={{display:"inline-block",background:`linear-gradient(135deg,${C.silver},${C.silverDim})`,color:"#0a0a0a",borderRadius:9,padding:"11px 28px",fontSize:10,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body,fontWeight:700,textDecoration:"none"}}>Pay on Venmo →</a>
              <div style={{fontSize:10,color:C.textDim,fontFamily:D.body,marginTop:8}}>@carlos-cepeda-41 · Include your name in the note</div>
            </div>
          )}

          <div style={{background:"#0e0b08",border:"1px solid #1e1810",borderRadius:12,padding:"16px 20px",textAlign:"left",marginBottom:24}}>
            <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>What to Bring</div>
            {["👟 Cleats or turf shoes","💧 Water bottle","🎽 Elastic band","⏰ Arrive 15 minutes early"].map((item,i)=>(
              <div key={i} style={{fontSize:12,color:C.textMid,fontFamily:D.body,marginBottom:6}}>{item}</div>
            ))}
          </div>

          <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:10,padding:"12px 28px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Book Another Spot</button>
        </div>
      )}
    </div>
  );
}

// ── FOOTER ────────────────────────────────────────────────
function Footer({setPage}){
  return(
    <footer style={{borderTop:`1px solid ${C.cardBorder}`,padding:"24px 16px",marginTop:40}}>
      <div style={{maxWidth:960,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Crest size={28}/>
          <div>
            <div style={{fontSize:12,letterSpacing:2,color:C.white,fontFamily:D.display}}>La Forja Futbol</div>
            <div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>James Island · Charleston SC</div>
          </div>
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          {[["home","Home"],["about","About"],["book","Book"],["packages","Packages"],["contact","Contact"]].map(([k,l])=>(
            <button key={k} onClick={()=>setPage(k)} style={{background:"none",border:"none",color:C.textDim,fontSize:10,letterSpacing:1,cursor:"pointer",fontFamily:D.body}}>{l}</button>
          ))}
        </div>
        <div style={{fontSize:9,color:C.textDim,fontFamily:D.body}}>© {new Date().getFullYear()} La Forja Futbol LLC</div>
      </div>
    </footer>
  );
}
