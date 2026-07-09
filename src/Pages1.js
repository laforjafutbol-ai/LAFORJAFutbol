import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth, googleProvider } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { C, D, BRAND, MAX_PLAYERS, PRICE_GROUP, PRICE_1ON1, POSITIONS, DAY_SCHEDULE, PRIVATE_SCHEDULE, AGE_COLORS, SKILL_COLORS, DAY_ABBR, COACH_DAYS, PRIVATE_DAYS, STRIPE_ENABLED, stripePromise, dKey, fmtDate, getDates, getPrivateDates, callEmailAPI, sendReminderEmail, Crest, SH, SC, FL, AB, GB, NB, IS, GStyles } from "./constants";

export function PrivatePage({addInquiry, inquiries, isBlocked, blocked, getLocation, getLocationDetail, getLocationMaps, user}){
  const [step,setStep]           = useState(1);
  const [selDate,setSelDate]     = useState(null);
  const [selSlot,setSelSlot]     = useState(null);
  const [myId,setMyId]           = useState(null);
  const [loading,setLoading]     = useState(false);
  const [weekOff,setWeekOff]     = useState(0);
  const [rememberMe,setRememberMe] = useState(false);
  const [form,setForm] = useState({name:"",email:"",phone:"",age:"",position:"",goals:"",notes:""});
  const [lookEmail,setLookEmail] = useState("");
  const [lookSt,setLookSt]       = useState("idle"); // idle | found | notfound
  const [retClient,setRetClient] = useState(null);
  const [players,setPlayers]     = useState([]);
  const [selPlayerId,setSelPlayerId] = useState(null);

  const allDates = getPrivateDates();
  const weeks = [];
  for(let i=0;i<allDates.length;i+=2) weeks.push(allDates.slice(i,i+2));
  const visDates = weeks[weekOff]||[];

  const myBooking = inquiries.find(b=>b.id===myId);

  useEffect(()=>{
    try{
      const saved = localStorage.getItem("laforja_1on1");
      if(saved){ const p=JSON.parse(saved); setForm(f=>({...f,...p})); setRememberMe(true); }
    }catch(e){}
  },[]);

  // If logged in, load saved players and auto-fill from account / past inquiries
  useEffect(()=>{
    if(!user) return;
    setForm(f=>({...f, name: f.name||user.displayName||"", email: f.email||user.email||""}));
    const q = collection(db,"users",user.uid,"players");
    const unsub = onSnapshot(q, s=>{
      setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[user]);

  useEffect(()=>{
    if(!user || lookSt!=="idle") return;
    const matches = [...(inquiries||[])].filter(b=>b.email?.toLowerCase()===user.email?.toLowerCase()).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    if(matches.length>0){
      const l=matches[0];
      setRetClient(l);
      setForm(f=>({...f,name:l.name,email:l.email,phone:l.phone||f.phone,age:l.age||f.age,position:l.position||f.position,goals:l.goals||f.goals}));
      setLookSt("found");
    } else {
      setLookSt("notfound");
    }
  },[user,inquiries]);

  function doLookup(){
    if(!lookEmail.trim()) return;
    const matches = [...(inquiries||[])].filter(b=>b.email?.toLowerCase()===lookEmail.trim().toLowerCase()).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    if(matches.length>0){
      const l=matches[0];
      setRetClient(l);
      setForm({name:l.name,email:l.email,phone:l.phone||"",age:l.age||"",position:l.position||"",goals:l.goals||"",notes:""});
      setLookSt("found");
      setRememberMe(true);
    } else {
      setLookSt("notfound");
      setForm(f=>({...f,email:lookEmail.trim()}));
    }
  }
  function clearLookup(){ setLookEmail("");setLookSt("idle");setRetClient(null);setForm({name:"",email:"",phone:"",age:"",position:"",goals:"",notes:""});setRememberMe(false); }

  function slotBooked(dk,slotId){
    const blockedSlot = (blocked||[]).some(b=>b.dateKey===dk&&b.sessId===slotId);
    return blockedSlot||(inquiries||[]).some(inq=>inq.dateKey===dk&&inq.slotId===slotId&&inq.status!=="cancelled"&&inq.status!=="removed");
  }
  function slotCutoff(dateObj, slotTime){
    if(!dateObj||!slotTime) return false;
    const now = new Date();
    const startStr = slotTime.split("–")[0].trim();
    const [time, meridiem] = startStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if(meridiem==="PM" && hours!==12) hours+=12;
    if(meridiem==="AM" && hours===12) hours=0;
    const sessionStart = new Date(dateObj);
    sessionStart.setHours(hours, minutes||0, 0, 0);
    return (sessionStart - now) / (1000*60*60) < 3;
  }
  function slotsAvail(d){
    return PRIVATE_SCHEDULE[d.getDay()].slots.filter(sl=>!slotBooked(dKey(d),sl.id)&&!slotCutoff(d,sl.time)).length;
  }

  async function doSubmit(){
    if(!form.name||!form.email||!form.phone||!form.position) return;
    setLoading(true);
    if(rememberMe){ try{ localStorage.setItem("laforja_1on1",JSON.stringify({name:form.name,email:form.email,phone:form.phone,age:form.age,position:form.position,goals:form.goals})); }catch(e){} }
    else { try{ localStorage.removeItem("laforja_1on1"); }catch(e){} }
    const ref = await addInquiry({
      ...form,
      status:"pending", type:"1on1", price:PRICE_1ON1,
      dateKey:dKey(selDate), dateLabel:fmtDate(selDate),
      slotId:selSlot.id, slotTime:selSlot.time,
      sessTime:selSlot.time, ageGroup:form.age?"Age "+form.age:"Private",
      ageTag:"9-11", skill:"The Tempering", skillIcon:"⚽",
      count:1, total:PRICE_1ON1,
      location:getLocation(dKey(selDate)), locationDetail:getLocationDetail(dKey(selDate)), locationMaps:getLocationMaps(dKey(selDate)),
      createdAt:new Date().toISOString(),
      ...(user?{userId:user.uid}:{}),
      ...(selPlayerId?{playerId:selPlayerId}:{}),
    });
    if(ref?.id) setMyId(ref.id);
    setLoading(false);
    setStep(3);
  }

  function reset(){
    setStep(1);setSelDate(null);setSelSlot(null);setMyId(null);setPayMethod(null);setSelPlayerId(null);
    if(user){
      setForm(f=>({...f,name:user.displayName||f.name,email:user.email||f.email,goals:"",notes:""}));
    } else {
      setForm(f=>({...f,goals:"",notes:"",age:f.age,position:f.position}));
    }
  }

  const [payMethod,setPayMethod] = useState(STRIPE_ENABLED ? null : "venmo");

  async function handleStripeSuccess(){
    if(!myBooking) return;
    await updateDoc(doc(db,"inquiries",myBooking.id),{status:"confirmed",paymentMethod:"stripe"});
    await callEmailAPI({...myBooking, sessTime:myBooking.slotTime, count:1, total:myBooking.price, ageGroup:myBooking.age?`Age ${myBooking.age}`:"Private", ageTag:"9-11", skillIcon:"⚽", skill:"The Tempering"}, "group");
  }

  const DAY_ABBRp = {3:"WED",6:"SAT"};
  const total = PRICE_1ON1;

  return(
    <div style={{paddingTop:100}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:"40px 20px 100px",animation:"fadeUp 0.4s ease"}}>

        {/* Hero */}
        <div style={{background:`linear-gradient(135deg,${C.goldDark},#1a0e06)`,border:`1px solid ${C.gold}33`,borderRadius:18,padding:"28px 24px",marginBottom:28,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:`radial-gradient(circle,${C.red}18,transparent 70%)`,pointerEvents:"none"}}/>
          <div style={{position:"relative",zIndex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontSize:28}}>⚒️</span>
              <div>
                <div style={{fontSize:9,letterSpacing:5,color:C.goldDim,textTransform:"uppercase",fontFamily:D.body}}>Private Training</div>
                <h1 style={{margin:0,fontSize:26,fontWeight:600,color:C.white,fontFamily:D.display}}>The Tempering</h1>
              </div>
            </div>
            <p style={{margin:"0 0 18px",fontSize:13,color:C.textMid,lineHeight:1.8,fontFamily:D.body}}>Your position. Your weaknesses. Your game. One coach, full attention, every session built around you specifically.</p>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              {[{icon:"📅",label:"Wed · Sat"},
                {icon:"🎯",label:"Position Specific"},
                {icon:"💰",label:`$${PRICE_1ON1} / session`},
              ].map((item,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>{item.icon}</span>
                  <span style={{fontSize:11,color:C.silverBright,fontFamily:D.body}}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress */}
        {step<3&&(
          <div style={{display:"flex",gap:8,marginBottom:28}}>
            {["Pick a Slot","Your Details","Payment"].map((lbl,i)=>(
              <div key={i} style={{flex:1}}>
                <div style={{height:2,borderRadius:2,marginBottom:5,background:step>i+1?C.gold:step===i+1?C.goldBright:C.cardBorder,transition:"background 0.4s"}}/>
                <div style={{fontSize:9,color:step>=i+1?C.gold:C.silverDark,letterSpacing:2,textTransform:"uppercase",fontFamily:D.body}}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 1 — Pick slot */}
        {step===1&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <FL>Choose a Date</FL>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <NB disabled={weekOff===0} onClick={()=>setWeekOff(w=>w-1)}>← Prev</NB>
              <span style={{fontSize:10,color:C.gold,letterSpacing:3,textTransform:"uppercase",fontFamily:D.body}}>Week {weekOff+1}</span>
              <NB disabled={weekOff>=weeks.length-1} onClick={()=>setWeekOff(w=>w+1)}>Next →</NB>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
              {visDates.map((d,i)=>{
                const avail=slotsAvail(d);
                const full=avail===0;
                const sel=selDate&&dKey(d)===dKey(selDate);
                return(
                  <button key={i} disabled={full} onClick={()=>{setSelDate(d);setSelSlot(null);}}
                    style={{background:sel?C.goldDark:C.card,border:sel?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 14px",cursor:full?"not-allowed":"pointer",textAlign:"center",transition:"all 0.2s",boxShadow:sel?`0 0 20px ${C.gold}33`:"none",opacity:full?0.35:1,color:C.white}}>
                    <div style={{fontSize:9,letterSpacing:2,color:sel?C.goldBright:C.silverDim,marginBottom:4,fontFamily:D.body}}>{DAY_ABBRp[d.getDay()]}</div>
                    <div style={{fontSize:26,fontWeight:700,marginBottom:2,fontFamily:D.display}}>{d.getDate()}</div>
                    <div style={{fontSize:10,color:sel?C.goldBright:C.silverDim,marginBottom:8,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                    <div style={{fontSize:10,color:full?C.silverDark:avail===1?C.red:sel?C.goldBright:C.silverDim,fontFamily:D.body}}>{full?"CLOSED":`${avail} slot${avail!==1?"s":""} open`}</div>
                  </button>
                );
              })}
            </div>
            {selDate&&(()=>{
              const sched=PRIVATE_SCHEDULE[selDate.getDay()];
              return(<>
                <FL>Choose a Time</FL>
                <div style={{display:"grid",gap:10,marginBottom:28}}>
                  {sched.slots.map(slot=>{
                    const booked=slotBooked(dKey(selDate),slot.id);
                    const cutoff=slotCutoff(selDate,slot.time);
                    const unavailable=booked||cutoff;
                    const sel=selSlot?.id===slot.id;
                    return(
                      <button key={slot.id} disabled={unavailable} onClick={()=>!unavailable&&setSelSlot(slot)}
                        style={{background:sel?C.goldDark:C.card,border:sel?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 20px",cursor:unavailable?"not-allowed":"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s",opacity:unavailable?0.35:1}}>
                        <span style={{fontSize:15,color:sel?C.gold:C.white,fontFamily:D.display,fontWeight:600}}>{slot.time}</span>
                        <span style={{fontSize:10,color:unavailable?C.silverDark:sel?C.gold:C.silverDim,fontFamily:D.body,letterSpacing:1}}>{cutoff?"CLOSED":booked?"BOOKED":sel?"SELECTED":"OPEN"}</span>
                      </button>
                    );
                  })}
                </div>
              </>);
            })()}
            <AB disabled={!selDate||!selSlot} onClick={()=>setStep(2)}>Continue →</AB>
          </div>
        )}

        {/* STEP 2 — Details */}
        {step===2&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:22}}>
              <span style={{fontSize:10,padding:"4px 11px",borderRadius:20,background:C.goldDark,color:C.gold,border:`1px solid ${C.silver}44`,fontFamily:D.body}}>{fmtDate(selDate)}</span>
              <span style={{fontSize:10,padding:"4px 11px",borderRadius:20,background:C.card,color:C.silver,border:`1px solid ${C.cardBorder}`,fontFamily:D.body}}>{selSlot?.time}</span>
              <span style={{fontSize:10,padding:"4px 11px",borderRadius:20,background:C.goldDark,color:C.gold,border:`1px solid ${C.silver}44`,fontFamily:D.body}}>${PRICE_1ON1}</span>
            </div>

            {/* Location */}
            <div style={{background:C.redDark,border:`1px solid ${C.red}33`,borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:18}}>📍</span>
              <div style={{flex:1}}>
                <div style={{fontSize:9,letterSpacing:2,color:C.red,textTransform:"uppercase",fontFamily:D.body,marginBottom:2}}>Training Location</div>
                <div style={{fontSize:13,color:C.white,fontFamily:D.body,fontWeight:500}}>{getLocation(dKey(selDate))}</div>
                <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{getLocationDetail(dKey(selDate))}</div>
              </div>
              <a href={getLocationMaps(dKey(selDate))} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:C.red,textDecoration:"none",border:`1px solid ${C.redDim}`,borderRadius:6,padding:"5px 10px",fontFamily:D.body,whiteSpace:"nowrap",flexShrink:0}}>Map →</a>
            </div>

            {/* Returning client lookup */}
            {lookSt==="idle"&&(
              <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"18px 18px",marginBottom:20}}>
                <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:4,fontFamily:D.body}}>Returning Client?</div>
                <div style={{fontSize:12,color:C.textDim,marginBottom:12,lineHeight:1.7,fontFamily:D.body}}>Enter your email to auto-fill your details, position and age.</div>
                <div style={{display:"flex",gap:10}}>
                  <input type="email" placeholder="your@email.com" value={lookEmail} onChange={e=>setLookEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLookup()} style={{...IS,flex:1}}/>
                  <button onClick={doLookup} style={{background:`linear-gradient(135deg,${C.goldDark},#150c04)`,border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"10px 16px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>Look Up</button>
                </div>
                <div style={{marginTop:10,textAlign:"right"}}>
                  <button onClick={()=>setLookSt("notfound")} style={{background:"none",border:"none",color:C.silverDark,fontSize:10,cursor:"pointer",fontFamily:D.body,letterSpacing:1}}>Skip — I'm new →</button>
                </div>
              </div>
            )}
            {lookSt==="found"&&retClient&&(
              <div style={{background:"linear-gradient(135deg,#081408,#060e06)",border:`1px solid ${C.green}44`,borderRadius:14,padding:"14px 18px",marginBottom:18,animation:"fadeUp 0.3s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:9,letterSpacing:3,color:C.green,textTransform:"uppercase",marginBottom:5,fontFamily:D.body}}>👋 Welcome Back!</div>
                    <div style={{fontSize:15,color:C.white,fontFamily:D.display,fontWeight:600,marginBottom:3}}>{retClient.name}</div>
                    <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>
                      {retClient.position&&<span style={{color:C.gold,marginRight:8}}>{retClient.position}</span>}
                      {retClient.age&&<span>Age {retClient.age}</span>}
                    </div>
                  </div>
                  <button onClick={clearLookup} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:8,padding:"5px 10px",fontSize:10,cursor:"pointer",fontFamily:D.body}}>Not me</button>
                </div>
                <div style={{marginTop:8,fontSize:11,color:C.green,opacity:0.7,fontFamily:D.body}}>✓ Name, email, phone, position and age pre-filled.</div>
              </div>
            )}
            {lookSt==="notfound"&&(
              <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"10px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.textDim,fontFamily:D.body}}>{user?`Welcome, ${user.displayName?.split(" ")[0]||"there"}! Fill in the details below.`:lookEmail?`No past bookings for ${lookEmail}`:"New client — fill in your details."}</span>
                {!user&&<button onClick={clearLookup} style={{background:"none",border:"none",color:C.silverDark,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Try again</button>}
              </div>
            )}

            {lookSt!=="idle"&&(<>

            {/* Player picker for logged-in users */}
            {user&&players.length>0&&(
              <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:18}}>
                <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:12}}>Who is training?</div>
                <div style={{display:"grid",gap:8}}>
                  {players.map(p=>(
                    <button key={p.id} onClick={()=>{
                      setSelPlayerId(p.id);
                      setForm(f=>({...f, age:p.age||f.age, position:p.position||f.position, goals:p.notes||f.goals, name:p.name||f.name }));
                    }} style={{background:selPlayerId===p.id?`linear-gradient(135deg,${C.goldDark},#1c0e04)`:C.black,border:selPlayerId===p.id?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"11px 16px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:selPlayerId===p.id?C.gold:C.white,fontFamily:D.display,marginBottom:2}}>{p.name}</div>
                        <div style={{fontSize:11,color:selPlayerId===p.id?C.goldDim:C.textDim,fontFamily:D.body}}>{p.age?`Age ${p.age}`:""}{p.position?` · ${p.position}`:""}</div>
                      </div>
                      {selPlayerId===p.id&&<span style={{color:C.gold,fontSize:14}}>✓</span>}
                    </button>
                  ))}
                </div>
                {selPlayerId&&<button onClick={()=>setSelPlayerId(null)} style={{background:"none",border:"none",color:C.silverDark,fontSize:11,cursor:"pointer",fontFamily:D.body,textDecoration:"underline",marginTop:8,padding:0}}>Clear selection</button>}
              </div>
            )}

            {/* Position picker */}
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:18}}>
              <FL>Select Position *</FL>
              <FieldPositionPicker selected={form.position} onSelect={pos=>setForm(p=>({...p,position:pos}))}/>
              {form.position&&<div style={{textAlign:"center",marginTop:10,fontSize:11,color:C.gold,fontFamily:D.body,letterSpacing:1}}>{POSITIONS.find(p=>p.id===form.position)?.full}</div>}
            </div>

            {/* Contact details */}
            <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"16px 18px",marginBottom:18}}>
              <FL>Your Details</FL>
              <div style={{display:"grid",gap:12}}>
                {[
                  {key:"name",  label:"Player's Full Name *", type:"text",     ph:"Player name"},
                  {key:"email", label:"Parent Email *",        type:"email",    ph:"parent@email.com"},
                  {key:"phone", label:"Parent Phone *",        type:"tel",      ph:"+1 (555) 000-0000"},
                  {key:"age",   label:"Player Age",            type:"text",     ph:"e.g. 14"},
                  {key:"goals", label:"Goals / Focus Areas",   type:"textarea", ph:"e.g. Finishing, 1v1, weak foot, decision making..."},
                ].map(f=>(
                  <div key={f.key}>
                    <label style={{display:"block",fontSize:9,letterSpacing:2,color:C.gold,marginBottom:5,textTransform:"uppercase",fontFamily:D.body}}>{f.label}</label>
                    {f.type==="textarea"?<textarea rows={2} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IS}/>:<input type={f.type} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IS}/>}
                  </div>
                ))}
              </div>
            </div>

            {/* Remember Me */}
            {!user&&(
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,cursor:"pointer"}} onClick={()=>setRememberMe(r=>!r)}>
                <div style={{width:20,height:20,borderRadius:5,border:`1px solid ${rememberMe?C.gold:C.cardBorder}`,background:rememberMe?C.goldDark:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                  {rememberMe&&<span style={{color:C.gold,fontSize:12,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:12,color:rememberMe?C.gold:C.textDim,fontFamily:D.body}}>Remember my details for next time</span>
              </div>
            )}

            {/* Summary */}
            <SC rows={[
              {label:"Date",     value:fmtDate(selDate)},
              {label:"Time",     value:selSlot?.time},
              {label:"Location", value:getLocation(dKey(selDate))||"TBD"},
              {label:"Position", value:form.position?POSITIONS.find(p=>p.id===form.position)?.full||form.position:"Not selected", color:C.gold},
              {label:"Total",    value:`$${total}`, accent:true},
            ]}/>

            <div style={{display:"flex",gap:10,marginTop:18}}>
              <GB onClick={()=>setStep(1)}>← Back</GB>
              <AB disabled={!form.name||!form.email||!form.phone||!form.position||loading} onClick={doSubmit}>{loading?"Reserving…":"Reserve My Slot →"}</AB>
            </div>
            </>)}
            {lookSt==="idle"&&<div style={{marginTop:4}}><GB onClick={()=>setStep(1)}>← Back</GB></div>}
          </div>
        )}

        {/* STEP 3 — Pending / Confirmed (same as group) */}
        {step===3&&myBooking&&(
          <div style={{animation:"fadeUp 0.5s ease"}}>
            {myBooking.status==="confirmed"?(
              <>
                <div style={{textAlign:"center",marginBottom:28}}>
                  <div style={{width:76,height:76,borderRadius:"50%",margin:"0 auto 16px",background:`linear-gradient(135deg,${C.green},#0e7a47)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,color:C.white,boxShadow:`0 0 48px ${C.green}55`}}>✓</div>
                  <h2 style={{margin:"0 0 8px",fontSize:28,fontWeight:600,color:C.white,fontFamily:D.display}}>Session Confirmed!</h2>
                  <p style={{margin:0,fontSize:13,color:C.textDim,fontFamily:D.body}}>Coach Carlos confirmed your payment. See you on the field! ⚽</p>
                </div>
                <SC title="Your Session" rows={[
                  {label:"Name",     value:myBooking.name},
                  {label:"Date",     value:myBooking.dateLabel},
                  {label:"Time",     value:myBooking.slotTime},
                  {label:"Location",    value:myBooking.location||"Bayview Park"},
                  {label:"Position", value:myBooking.position, color:C.gold},
                  {label:"Paid",     value:`$${myBooking.price}`, accent:true},
                ]}/>
                <div style={{textAlign:"center",marginTop:22}}><GB onClick={reset}>Book Another Slot</GB></div>
              </>
            ):(
              <>
                {/* Payment header */}
                <div style={{textAlign:"center",marginBottom:22}}>
                  <div style={{width:64,height:64,borderRadius:"50%",margin:"0 auto 14px",background:C.redDark,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,animation:"pulse 2s infinite"}}>⏳</div>
                  <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:600,color:C.white,fontFamily:D.display}}>Slot Reserved — Payment Needed</h2>
                  <p style={{margin:0,fontSize:13,color:C.textMid,fontFamily:D.body,lineHeight:1.7}}>Your slot is held. Complete payment below to confirm it instantly.</p>
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
                      metadata={{docId:myBooking?.id||"",collectionName:"inquiries",sessionType:"1-on-1 — "+myBooking?.dateLabel}}
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
                    <div style={{fontSize:12,color:C.silverBright,fontFamily:D.body}}>{myBooking.name} — {myBooking.dateLabel} · 1-on-1 · {myBooking.position}</div>
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
                  {label:"Name",     value:myBooking.name},
                  {label:"Date",     value:myBooking.dateLabel},
                  {label:"Time",     value:myBooking.slotTime},
                  {label:"Location", value:myBooking.location||"Bayview Park · James Island"},
                  {label:"Position", value:myBooking.position, color:C.gold},
                  {label:"Total Due",value:`$${myBooking.price}`, accent:true},
                ]}/>

                <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 16px",marginTop:12,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>📩</span>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>Need to reschedule? Email <a href="mailto:laforjafutbol@gmail.com" style={{color:C.silver,textDecoration:"none"}}>laforjafutbol@gmail.com</a></div>
                </div>

                <Auto1on1Refresh bookingId={myBooking.id}/>
              </>
            )}
          </div>
        )}
        {step===3&&!myBooking&&<div style={{textAlign:"center",padding:"60px 20px",color:C.textDim,fontFamily:D.body}}>Loading your booking…</div>}
      </div>
    </div>
  );
}

export function Auto1on1Refresh({bookingId}){
  useEffect(()=>{
    const iv=setInterval(async()=>{
      try{
        const {getDoc,doc:fDoc}=await import("firebase/firestore");
        const snap=await getDoc(fDoc(db,"inquiries",bookingId));
        if(snap.exists()&&snap.data().status==="confirmed") window.location.reload();
      }catch(e){}
    },5000);
    return ()=>clearInterval(iv);
  },[bookingId]);
  return <div style={{textAlign:"center",marginTop:14,fontSize:10,color:C.silverDark,fontFamily:D.body}}>Checks for confirmation automatically</div>;
}

// ── LOCATION MANAGER ────────────────────────────────────
function LocationManager({locations,saveLocation,getDates,getPrivateDates,fmtDate,dKey}){
  const DEFAULT_LOC = {name:"Bayview Park",detail:"James Island Youth Soccer Club Fields · James Island, SC",mapsUrl:"https://maps.google.com/?q=Bayview+Park+James+Island+SC"};
  const [selDate,setSelDate] = useState("default");
  const [form,setForm]       = useState({...DEFAULT_LOC});
  const [saved,setSaved]     = useState(false);

  const allDates = [...getDates(8),...getPrivateDates(8)].sort((a,b)=>dKey(a)>dKey(b)?1:-1);

  function handleDateChange(val){
    setSelDate(val);
    const l = locations[val]||DEFAULT_LOC;
    setForm({name:l.name,detail:l.detail,mapsUrl:l.mapsUrl});
  }

  async function handleSave(){
    await saveLocation(selDate,form.name,form.detail,form.mapsUrl);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  }

  return(
    <div style={{background:"#1a1612",border:`1px solid #ff4d2e33`,borderRadius:14,padding:"20px 18px",marginBottom:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontSize:10,letterSpacing:3,color:"#ff4d2e",textTransform:"uppercase",marginBottom:14,fontFamily:"'Montserrat',sans-serif"}}>📍 Set Training Location</div>

      <div style={{marginBottom:12}}>
        <div style={{fontSize:9,letterSpacing:2,color:"#c9a84c",textTransform:"uppercase",marginBottom:6,fontFamily:"'Montserrat',sans-serif"}}>Apply To</div>
        <select value={selDate} onChange={e=>handleDateChange(e.target.value)} style={{...IS,marginBottom:0}}>
          <option value="default">Default — all sessions</option>
          {allDates.slice(0,20).map(d=>(
            <option key={dKey(d)} value={dKey(d)}>{fmtDate(d)}{locations[dKey(d)]?" ✓":""}</option>
          ))}
        </select>
      </div>

      <div style={{display:"grid",gap:10,marginBottom:14}}>
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:"#c9a84c",textTransform:"uppercase",marginBottom:6,fontFamily:"'Montserrat',sans-serif"}}>Location Name</div>
          <input type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Bayview Park" style={IS}/>
        </div>
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:"#c9a84c",textTransform:"uppercase",marginBottom:6,fontFamily:"'Montserrat',sans-serif"}}>Address / Detail</div>
          <input type="text" value={form.detail} onChange={e=>setForm(p=>({...p,detail:e.target.value}))} placeholder="James Island Youth Soccer Club Fields · James Island, SC" style={IS}/>
        </div>
        <div>
          <div style={{fontSize:9,letterSpacing:2,color:"#c9a84c",textTransform:"uppercase",marginBottom:6,fontFamily:"'Montserrat',sans-serif"}}>Google Maps URL</div>
          <input type="text" value={form.mapsUrl} onChange={e=>setForm(p=>({...p,mapsUrl:e.target.value}))} placeholder="https://maps.google.com/?q=..." style={IS}/>
        </div>
      </div>

      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <button onClick={handleSave} style={{background:"linear-gradient(135deg,#ff4d2e,#a8341e)",border:"none",color:"#f5efe6",borderRadius:10,padding:"10px 22px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>💾 Save Location</button>
        {saved&&<span style={{fontSize:12,color:"#22c55e",fontFamily:"'Montserrat',sans-serif"}}>✓ Saved!</span>}
      </div>

      {Object.keys(locations).length>0&&(
        <div style={{marginTop:16,borderTop:"1px solid #222",paddingTop:14}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase",marginBottom:10,fontFamily:"'Montserrat',sans-serif"}}>Saved Locations</div>
          <div style={{display:"grid",gap:6}}>
            {Object.entries(locations).map(([key,loc])=>(
              <div key={key} onClick={()=>handleDateChange(key)} style={{background:"#161310",borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",border:`1px solid ${selDate===key?"#e8a93c44":"#2a251c"}`}}>
                <div>
                  <div style={{fontSize:11,color:"#f5efe6",fontFamily:"'Montserrat',sans-serif",fontWeight:500}}>{key==="default"?"Default (all sessions)":fmtDate(new Date(key+"T12:00:00"))}</div>
                  <div style={{fontSize:10,color:"#666",fontFamily:"'Montserrat',sans-serif"}}>{loc.name} · {loc.detail}</div>
                </div>
                {key==="default"&&<span style={{fontSize:9,color:"#ff4d2e",fontFamily:"'Montserrat',sans-serif",letterSpacing:1}}>DEFAULT</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MOVE MODAL ───────────────────────────────────────────
function MoveModal({booking,type,selDate,selSess,onClose,onSelectDate,onSelectSess,getDates,getPrivateDates,spotsLeft,bookings,inquiries,blocked}){
  const is1on1 = type==="1on1";
  const allDates = is1on1 ? getPrivateDates() : getDates();
  const b = booking;

  function isSlotTaken(dk,slotId){
    return (blocked||[]).some(x=>x.dateKey===dk&&x.sessId===slotId)||
           (inquiries||[]).some(x=>x.dateKey===dk&&x.slotId===slotId&&x.status!=="cancelled"&&x.status!=="removed");
  }

  async function doMove(){
    if(!selDate||!selSess) return;
    const newDateKey=dKey(selDate);
    const newDateLabel=fmtDate(selDate);
    if(is1on1){
      await updateDoc(doc(db,"inquiries",b.id),{dateKey:newDateKey,dateLabel:newDateLabel,slotId:selSess.id,slotTime:selSess.time,requestType:null,requestNote:null,movedAt:new Date().toISOString()});
    } else {
      const sched=DAY_SCHEDULE[selDate.getDay()];
      await updateDoc(doc(db,"bookings",b.id),{dateKey:newDateKey,dateLabel:newDateLabel,sessId:selSess.id,sessTime:selSess.time,ageGroup:selSess.ageGroup,ageTag:selSess.ageTag,skill:sched.skill,skillIcon:sched.skillIcon,requestType:null,requestNote:null,movedAt:new Date().toISOString()});
    }
    try{ await callEmailAPI({...b,dateLabel:newDateLabel,sessTime:selSess.time},"reschedule"); }catch(e){}
    onClose();
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}>
      <div style={{background:"#111",border:`1px solid ${C.gold}44`,borderRadius:16,padding:"28px 24px",maxWidth:520,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>{is1on1?"Move 1-on-1":"Move Group Booking"}</div>
            <div style={{fontSize:18,fontWeight:600,color:C.white,fontFamily:D.display}}>{b.name}</div>
            <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginTop:2}}>Currently: {b.dateLabel} · {b.slotTime||b.sessTime}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,width:32,height:32,color:C.textDim,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
        </div>

        <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Select New Date</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
          {allDates.map((d,i)=>{
            const sel=selDate&&dKey(d)===dKey(selDate);
            if(is1on1){
              const sched=PRIVATE_SCHEDULE[d.getDay()];
              if(!sched) return null;
              const avail=sched.slots.filter(sl=>!isSlotTaken(dKey(d),sl.id)).length;
              return(
                <button key={i} onClick={()=>onSelectDate(d)} style={{background:sel?C.goldDark:C.card,border:sel?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 6px",cursor:"pointer",textAlign:"center",color:C.white}}>
                  <div style={{fontSize:9,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{weekday:"short"}).slice(0,3).toUpperCase()}</div>
                  <div style={{fontSize:17,fontWeight:700,fontFamily:D.display}}>{d.getDate()}</div>
                  <div style={{fontSize:9,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                  <div style={{fontSize:9,color:avail===0?C.silverDark:avail===1?C.red:C.silverDim,marginTop:3,fontFamily:D.body}}>{avail===0?"FULL":`${avail} open`}</div>
                </button>
              );
            } else {
              const sched=DAY_SCHEDULE[d.getDay()];
              if(!sched) return null;
              const sp=sched.sessions.reduce((s,sess)=>s+spotsLeft(d,sess.id),0);
              return(
                <button key={i} onClick={()=>onSelectDate(d)} style={{background:sel?C.goldDark:C.card,border:sel?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 6px",cursor:"pointer",textAlign:"center",color:C.white}}>
                  <div style={{fontSize:9,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{DAY_ABBR[d.getDay()]||d.toLocaleDateString("en-US",{weekday:"short"}).slice(0,3).toUpperCase()}</div>
                  <div style={{fontSize:17,fontWeight:700,fontFamily:D.display}}>{d.getDate()}</div>
                  <div style={{fontSize:9,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                  <div style={{fontSize:9,color:sp===0?C.silverDark:sp<=2?C.red:C.silverDim,marginTop:3,fontFamily:D.body}}>{sp===0?"FULL":`${sp} left`}</div>
                </button>
              );
            }
          })}
        </div>

        {selDate&&is1on1&&(()=>{
          const sched=PRIVATE_SCHEDULE[selDate.getDay()];
          if(!sched) return null;
          return(<>
            <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Select Slot</div>
            <div style={{display:"grid",gap:8,marginBottom:20}}>
              {sched.slots.map(slot=>{
                const taken=isSlotTaken(dKey(selDate),slot.id);
                const sel=selSess?.id===slot.id;
                return(
                  <button key={slot.id} disabled={taken} onClick={()=>onSelectSess(slot)} style={{background:sel?C.goldDark:C.card,border:sel?`1px solid ${C.gold}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 16px",cursor:taken?"not-allowed":"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",opacity:taken?0.4:1}}>
                    <span style={{fontSize:13,fontWeight:600,color:sel?C.gold:C.white,fontFamily:D.display}}>{slot.time}</span>
                    <span style={{fontSize:10,color:taken?C.silverDark:sel?C.gold:C.silverDim,fontFamily:D.body}}>{taken?"BOOKED":"OPEN"}</span>
                  </button>
                );
              })}
            </div>
          </>);
        })()}

        {selDate&&!is1on1&&(()=>{
          const sched=DAY_SCHEDULE[selDate.getDay()];
          if(!sched) return null;
          return(<>
            <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:10}}>Select Session</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
              {sched.sessions.map(sess=>{
                const sp=spotsLeft(selDate,sess.id);
                const sel=selSess?.id===sess.id;
                const ac=AGE_COLORS[sess.ageTag]||{bg:C.card,border:C.gold,text:C.gold};
                return(
                  <button key={sess.id} disabled={sp===0} onClick={()=>onSelectSess(sess)} style={{background:sel?ac.bg:C.card,border:sel?`1px solid ${ac.border}`:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"12px 14px",cursor:sp===0?"not-allowed":"pointer",textAlign:"left",opacity:sp===0?0.4:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:sel?ac.text:C.white,fontFamily:D.display,marginBottom:3}}>{sess.time}</div>
                    <div style={{fontSize:10,color:sel?ac.text:C.textDim,fontFamily:D.body,marginBottom:4}}>{sess.ageGroup}</div>
                    <div style={{fontSize:9,color:sp===0?C.silverDark:sp<=2?C.red:C.silverDim,fontFamily:D.body}}>{sp===0?"FULL":`${sp}/${MAX_PLAYERS} spots`}</div>
                  </button>
                );
              })}
            </div>
          </>);
        })()}

        <button disabled={!selDate||!selSess} onClick={doMove} style={{width:"100%",background:selDate&&selSess?`linear-gradient(135deg,${C.gold},${C.goldDim})`:"#1a1a1a",border:"none",borderRadius:10,padding:"14px",color:selDate&&selSess?C.black:C.silverDark,fontSize:12,letterSpacing:2,textTransform:"uppercase",cursor:selDate&&selSess?"pointer":"not-allowed",fontFamily:D.body,fontWeight:700}}>
          {selDate&&selSess?`Move to ${fmtDate(selDate)} · ${selSess.time}`:"Select a date and slot above"}
        </button>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────
export function Dashboard({bookings,inquiries,confirmBooking,removeBooking,scheduleInquiry,removeInquiry,sendReminderEmail,blocked,blockSession,locations,saveLocation,spotsLeft,getDates,getPrivateDates}){
  const [authed,setAuthed]   = useState(false);
  const [pw,setPw]           = useState("");
  const [pwErr,setPwErr]     = useState(false);
  const [tab,setTab]         = useState("bookings");
  const [moveId,setMoveId] = useState(null);
  const [moveDate,setMoveDate] = useState(null);
  const [moveSess,setMoveSess] = useState(null);
  const [coachNoteId,setCoachNoteId] = useState(null);
  const [coachNoteText,setCoachNoteText] = useState("");
  const [schedId,setSchedId] = useState(null);
  const [schedTime,setSchedTime] = useState("");
  const [showAvail,setShowAvail] = useState(false);
  const [availWeek,setAvailWeek] = useState(0);
  const [showLoc,setShowLoc]     = useState(false);
  const [showPast,setShowPast]   = useState(false);
  const [showPastI,setShowPastI] = useState(false);

  function login(){ if(pw===BRAND.coachPw){setAuthed(true);setPwErr(false);}else setPwErr(true); }

  if(!authed) return(
    <div style={{paddingTop:100,minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"120px 20px 60px"}}>
      <div style={{width:"100%",maxWidth:380,animation:"fadeUp 0.4s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}><Crest size={52}/><div style={{fontSize:10,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",marginTop:14,marginBottom:5,fontFamily:D.body}}>Restricted Access</div><h2 style={{margin:0,fontSize:24,fontWeight:600,color:C.white,fontFamily:D.display}}>Coach Dashboard</h2></div>
        <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:18,padding:"30px 26px"}}>
          <label style={{display:"block",fontSize:9,letterSpacing:2,color:C.gold,marginBottom:7,textTransform:"uppercase",fontFamily:D.body}}>Password</label>
          <input type="password" placeholder="Enter coach password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr(false);}} onKeyDown={e=>e.key==="Enter"&&login()} style={{...IS,marginBottom:8,borderColor:pwErr?C.red:C.cardBorder}}/>
          {pwErr&&<div style={{fontSize:11,color:C.red,marginBottom:10,fontFamily:D.body}}>Incorrect password</div>}
          <button onClick={login} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:`1px solid ${C.red}`,color:C.white,borderRadius:10,padding:"13px",fontSize:11,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,boxShadow:`0 4px 20px ${C.red}33`,marginTop:6}}>Enter Dashboard</button>
        </div>
      </div>
    </div>
  );

  const pendingCount=bookings.filter(b=>b.status==="pending").length;
  const newInquiries=inquiries.filter(i=>i.status==="pending").length;
  const requestCount=[...bookings,...inquiries].filter(x=>x.requestType).length;

  // Today / this week confirmed session counts for quick stats
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr0 = today.toISOString().split("T")[0];

  const todayStr = today.toISOString().split("T")[0];
  const weekFromNow = new Date(today); weekFromNow.setDate(today.getDate()+7);
  const weekStr = weekFromNow.toISOString().split("T")[0];

  const todaysSessions = [...bookings,...inquiries].filter(x=>x.dateKey===todayStr && (x.status==="confirmed"));
  const weekSessions   = [...bookings,...inquiries].filter(x=>x.dateKey>=todayStr && x.dateKey<weekStr && (x.status==="confirmed"));
  const weekRevenue    = weekSessions.reduce((s,x)=>s+(Number(x.total)||0),0);

  return(
    <div style={{paddingTop:100,background:C.black,minHeight:"100vh"}}>
      <div style={{maxWidth:960,margin:"0 auto",padding:"32px 24px 100px"}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:4}}>La Forja</div>
            <h1 style={{margin:0,fontSize:26,fontWeight:600,color:C.white,fontFamily:D.display}}>Coach Dashboard</h1>
          </div>
          {/* Alert badges */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {pendingCount>0&&<button onClick={()=>setTab("bookings")} style={{fontSize:11,padding:"6px 14px",borderRadius:20,background:C.redDark,border:`1px solid ${C.red}44`,color:C.red,fontFamily:D.body,animation:"pulse 2s infinite",cursor:"pointer",whiteSpace:"nowrap"}}>⏳ {pendingCount} pending</button>}
            {newInquiries>0&&<button onClick={()=>setTab("inquiries")} style={{fontSize:11,padding:"6px 14px",borderRadius:20,background:C.goldDark,border:`1px solid ${C.gold}44`,color:C.gold,fontFamily:D.body,animation:"pulse 2s infinite",cursor:"pointer",whiteSpace:"nowrap"}}>🔔 {newInquiries} new 1-on-1</button>}
            {requestCount>0&&<button onClick={()=>setTab("bookings")} style={{fontSize:11,padding:"6px 14px",borderRadius:20,background:"rgba(180,174,160,0.08)",border:`1px solid ${C.silver}33`,color:C.silver,fontFamily:D.body,animation:"pulse 2s infinite",cursor:"pointer",whiteSpace:"nowrap"}}>⚠ {requestCount} request{requestCount>1?"s":""}</button>}
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          {[
            {label:"Today's Sessions", value:todaysSessions.length, color:C.gold, icon:"🔥"},
            {label:"Confirmed This Week", value:weekSessions.length, color:C.green, icon:"✓"},
            {label:"Week Revenue", value:`$${weekRevenue}`, color:C.silverBright, icon:"$"},
          ].map((s,i)=>(
            <div key={i} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${s.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.icon}</div>
              <div>
                <div style={{fontSize:22,fontWeight:700,color:s.color,fontFamily:D.display,lineHeight:1,marginBottom:3}}>{s.value}</div>
                <div style={{fontSize:9,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",fontFamily:D.body}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CONTROLS ROW ── */}
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>setShowAvail(v=>!v)} style={{background:showAvail?`${C.gold}15`:C.card,border:`1px solid ${showAvail?C.gold:C.cardBorder}`,color:showAvail?C.gold:C.textDim,borderRadius:8,padding:"8px 16px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"}}>
            🔒 Availability
          </button>
          <button onClick={()=>setShowLoc(v=>!v)} style={{background:showLoc?`${C.red}15`:C.card,border:`1px solid ${showLoc?C.red:C.cardBorder}`,color:showLoc?C.red:C.textDim,borderRadius:8,padding:"8px 16px",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"}}>
            📍 Locations
          </button>
        </div>

        {showLoc&&<LocationManager locations={locations} saveLocation={saveLocation} getDates={getDates} getPrivateDates={getPrivateDates} fmtDate={fmtDate} dKey={dKey}/>}

        {showAvail&&(()=>{
            const today = new Date(); today.setHours(0,0,0,0);
            const monthStart = new Date(today.getFullYear(), today.getMonth()+availWeek, 1);
            const monthName = monthStart.toLocaleDateString("en-US",{month:"long",year:"numeric"});
            const calDays = [];
            const startDay = new Date(monthStart);
            startDay.setDate(startDay.getDate()-startDay.getDay());
            for(let i=0;i<42;i++){
              const d=new Date(startDay); d.setDate(startDay.getDate()+i); calDays.push(d);
            }
            const allGroupDates = getDates(8);
            const allPrivDates = getPrivateDates(8);
            const DAY_LABELS=["S","M","T","W","T","F","S"];
            const blockedCount=(blocked||[]).length;

            async function blockEntireDay(d){
              const isGroup=COACH_DAYS.includes(d.getDay());
              const isPriv=[3,6].includes(d.getDay());
              if(isGroup){ for(const s of DAY_SCHEDULE[d.getDay()].sessions) await blockSession(dKey(d),s.id,`${fmtDate(d)} ${s.time}`); }
              if(isPriv){ for(const s of PRIVATE_SCHEDULE[d.getDay()].slots) await blockSession(dKey(d),s.id,`${fmtDate(d)} ${s.time}`); }
            }
            async function blockWeekOf(d){
              const sunday=new Date(d); sunday.setDate(d.getDate()-d.getDay());
              for(let i=0;i<7;i++){
                const day=new Date(sunday); day.setDate(sunday.getDate()+i);
                if(COACH_DAYS.includes(day.getDay())||[3,6].includes(day.getDay())) await blockEntireDay(day);
              }
            }
            async function blockByType(skill){
              for(const d of allGroupDates){ if(DAY_SCHEDULE[d.getDay()]?.skill===skill){ for(const s of DAY_SCHEDULE[d.getDay()].sessions) await blockSession(dKey(d),s.id,`${fmtDate(d)} ${s.time}`); } }
            }
            async function blockAllPrivate(){
              for(const d of allPrivDates){ for(const s of PRIVATE_SCHEDULE[d.getDay()].slots) await blockSession(dKey(d),s.id,`${fmtDate(d)} ${s.time}`); }
            }
            async function unblockAll(){
              if(!window.confirm("Unblock all sessions?")) return;
              for(const b of (blocked||[])) await blockSession(b.dateKey,b.sessId,"");
            }

            return(
              <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,padding:"20px 18px",marginTop:12,animation:"fadeUp 0.3s ease"}}>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>

                  {/* LEFT — Quick actions */}
                  <div style={{width:180,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:4,fontFamily:D.body}}>Quick Actions</div>

                    {[
                      {label:"Block The Furnace", action:()=>blockByType("The Furnace"), color:C.red},
                      ,
                      {label:"Block All 1-on-1s",   action:()=>blockAllPrivate(),             color:C.silverDim},
                    ].map((item,i)=>(
                      <button key={i} onClick={item.action} style={{background:"#161310",border:`1px solid ${item.color}44`,color:item.color,borderRadius:8,padding:"9px 12px",fontSize:10,cursor:"pointer",fontFamily:D.body,textAlign:"left",lineHeight:1.4}}>
                        🔒 {item.label}
                      </button>
                    ))}

                    <div style={{height:1,background:C.cardBorder,margin:"4px 0"}}/>

                    {blockedCount>0&&(
                      <button onClick={unblockAll} style={{background:"#041a0c",border:`1px solid ${C.green}44`,color:C.green,borderRadius:8,padding:"9px 12px",fontSize:10,cursor:"pointer",fontFamily:D.body,textAlign:"left"}}>
                        ✓ Unblock All ({blockedCount})
                      </button>
                    )}

                    <div style={{height:1,background:C.cardBorder,margin:"4px 0"}}/>
                    <div style={{fontSize:9,letterSpacing:2,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:2}}>Legend</div>
                    {[
                      {color:C.red, bg:"rgba(255,77,46,0.08)", label:"The Furnace"},
                      ,
                      {color:"#a78bfa",bg:"rgba(167,139,250,0.08)", label:"1-on-1"},
                      {color:C.red,    bg:"#1f0a05",                label:"Blocked"},
                    ].map((l,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:14,height:14,borderRadius:4,background:l.bg,border:`1px solid ${l.color}44`,flexShrink:0}}/>
                        <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>{l.label}</span>
                      </div>
                    ))}

                    <div style={{height:1,background:C.cardBorder,margin:"4px 0"}}/>
                    <div style={{fontSize:9,color:C.textDim,fontFamily:D.body,lineHeight:1.6}}>Tap a session pill to block/unblock. Tap "Block Day" to block all sessions in a day.</div>
                  </div>

                  {/* RIGHT — Calendar */}
                  <div style={{flex:1,minWidth:0}}>
                    {/* Month nav */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <NB disabled={availWeek===0} onClick={()=>setAvailWeek(w=>w-1)}>← Prev</NB>
                      <span style={{fontSize:14,color:C.white,fontFamily:D.display,fontWeight:600,letterSpacing:1}}>{monthName}</span>
                      <NB disabled={availWeek>=4} onClick={()=>setAvailWeek(w=>w+1)}>Next →</NB>
                    </div>

                    {/* Day headers */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
                      {DAY_LABELS.map((d,i)=>(
                        <div key={i} style={{textAlign:"center",fontSize:9,color:C.silverDark,fontFamily:D.body,padding:"3px 0"}}>{d}</div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                      {calDays.map((d,i)=>{
                        const inMonth = d.getMonth()===monthStart.getMonth();
                        const isGroup = COACH_DAYS.includes(d.getDay());
                        const isPriv  = [3,6].includes(d.getDay());
                        const isCoach = isGroup||isPriv;
                        const isPast  = d < today;
                        const dk      = dKey(d);

                        const sessions = isGroup ? DAY_SCHEDULE[d.getDay()]?.sessions||[] : isPriv ? PRIVATE_SCHEDULE[d.getDay()]?.slots||[] : [];
                        const allBlocked = sessions.length>0 && sessions.every(s=>(blocked||[]).some(b=>b.dateKey===dk&&b.sessId===s.id));
                        const anyBlocked = sessions.some(s=>(blocked||[]).some(b=>b.dateKey===dk&&b.sessId===s.id));

                        const bg = !inMonth?"transparent": allBlocked?"#1f0a05": isGroup?"rgba(201,168,76,0.07)": isPriv?"rgba(167,139,250,0.07)": "#161310";
                        const border = !inMonth?"1px solid transparent": allBlocked?`1px solid ${C.red}44`: anyBlocked?`1px solid ${C.red}22`: isGroup?`1px solid ${C.goldDim}22`: isPriv?`1px solid #a78bfa22`: `1px solid #1a1a1a`;

                        return(
                          <div key={i} style={{borderRadius:7,padding:"4px 3px",minHeight:58,background:bg,border,opacity:!inMonth?0.15:isPast?0.4:1,display:"flex",flexDirection:"column"}}>
                            {inMonth&&(
                              <>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                                  <span style={{fontSize:10,fontFamily:D.display,fontWeight:600,color:allBlocked?C.red:isGroup?C.gold:isPriv?"#a78bfa":C.silverDark,paddingLeft:2}}>{d.getDate()}</span>
                                  {isCoach&&!isPast&&(
                                    <button onClick={()=>blockEntireDay(d)} title="Block day" style={{background:"none",border:"none",cursor:"pointer",fontSize:8,color:C.silverDark,padding:"0 2px",lineHeight:1}}>✕</button>
                                  )}
                                </div>
                                {!isPast&&sessions.map(sess=>{
                                  const isBlk=(blocked||[]).some(b=>b.dateKey===dk&&b.sessId===sess.id);
                                  const t=(sess.time||"").split(" – ")[0].replace(":00","").replace(" PM","p").replace(" AM","a");
                                  const isGroup=COACH_DAYS.includes(d.getDay());
                                  const sessBooked=isGroup
                                    ?(bookings||[]).filter(b=>b.dateKey===dk&&b.sessId===sess.id&&b.status!=="cancelled").reduce((s,b)=>s+b.count,0)
                                    :(inquiries||[]).filter(i=>i.dateKey===dk&&i.slotId===sess.id&&i.status!=="cancelled").length;
                                  return(
                                    <div key={sess.id} onClick={()=>blockSession(dk,sess.id,`${fmtDate(d)} ${sess.time}`)}
                                      style={{fontSize:8,padding:"2px 3px",borderRadius:4,marginBottom:1,cursor:"pointer",background:isBlk?"#ff4d2e44":sessBooked>0?"rgba(201,168,76,0.12)":"rgba(255,255,255,0.06)",color:isBlk?C.red:sessBooked>0?C.gold:C.textMid,border:`1px solid ${isBlk?C.red+"55":sessBooked>0?C.gold+"33":"transparent"}`,transition:"all 0.15s",textAlign:"center",fontFamily:D.body}}>
                                      {isBlk?"🔒":sessBooked>0?`${sessBooked}/1`:""}{isBlk?"":t}
                                    </div>
                                  );
                                })}
                                {!isPast&&isCoach&&sessions.length>1&&(
                                  <button onClick={()=>blockWeekOf(d)} title="Block week" style={{marginTop:"auto",fontSize:7,background:"none",border:"none",color:C.silverDark,cursor:"pointer",fontFamily:D.body,textAlign:"center",padding:"1px 0",letterSpacing:0.5}}>wk</button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── TAB BAR ── */}
        <div style={{display:"flex",gap:6,marginBottom:24,flexWrap:"wrap"}}>
          {[
            ["roster","📋 Today's Roster"],
            ["bookings", "🔥 Group", pendingCount],
            ["inquiries", "⚒️ 1-on-1", newInquiries],
            ["reminders", "📧 Reminders", 0],
            ["reviews", "⭐ Reviews", 0],
          ].map(([key,lbl,badge])=>(
            <button key={key} onClick={()=>setTab(key)} style={{background:tab===key?`linear-gradient(135deg,${C.goldDark},#1c0e04)`:C.card,border:tab===key?`1px solid ${C.gold}55`:`1px solid ${C.cardBorder}`,color:tab===key?C.gold:C.textDim,borderRadius:10,padding:"9px 18px",fontSize:11,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:tab===key?600:400,transition:"all 0.2s",display:"flex",alignItems:"center",gap:6}}>
              {lbl}
              {badge>0&&<span style={{background:C.red,color:C.white,borderRadius:10,fontSize:9,padding:"1px 6px",fontWeight:700,fontFamily:D.body}}>{badge}</span>}
            </button>
          ))}
        </div>

        {/* ── ROSTER TAB ── */}
        {tab==="roster"&&(()=>{
          const today = new Date();
          const todayKey = dKey(today);
          const todayBookings = (bookings||[]).filter(b=>b.dateKey===todayKey&&b.status!=="cancelled"&&b.status!=="removed");
          const todayInquiries = (inquiries||[]).filter(i=>i.dateKey===todayKey&&i.status!=="cancelled"&&i.status!=="removed");

          // Group by session time
          const groups = {};
          todayBookings.forEach(b=>{
            const key = b.sessTime||b.sessId||"group";
            if(!groups[key]) groups[key]={time:b.sessTime,skill:b.skill,skillIcon:b.skillIcon,ageGroup:b.ageGroup,players:[],type:"group"};
            groups[key].players.push(b);
          });
          todayInquiries.forEach(i=>{
            const key = i.slotTime||"1on1";
            if(!groups[key]) groups[key]={time:i.slotTime,skill:"The Tempering",skillIcon:"⚒️",players:[],type:"1on1"};
            groups[key].players.push(i);
          });

          const sortedGroups = Object.values(groups).sort((a,b)=>(a.time||"")>(b.time||"")?1:-1);

          if(sortedGroups.length===0) return(
            <div style={{textAlign:"center",padding:"60px 20px",background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14}}>
              <div style={{fontSize:32,marginBottom:12}}>📋</div>
              <div style={{fontSize:14,color:C.textDim,fontFamily:D.body}}>No sessions today.</div>
            </div>
          );

          return(
            <div>
              {/* Date header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>Today's Roster</div>
                  <div style={{fontSize:20,fontWeight:600,color:C.white,fontFamily:D.display}}>{today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
                </div>
                <div style={{background:`${C.gold}15`,border:`1px solid ${C.gold}33`,borderRadius:10,padding:"8px 16px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:700,color:C.gold,fontFamily:D.display}}>{todayBookings.length+todayInquiries.length}</div>
                  <div style={{fontSize:9,color:C.goldDim,fontFamily:D.body,letterSpacing:1}}>PLAYERS</div>
                </div>
              </div>

              {/* Session groups */}
              {sortedGroups.map((group,gi)=>(
                <div key={gi} style={{marginBottom:20}}>
                  {/* Session header */}
                  <div style={{background:group.type==="1on1"?`linear-gradient(135deg,#1a1308,#0f0c05)`:`linear-gradient(135deg,${C.goldDark},#150c04)`,border:`1px solid ${group.type==="1on1"?C.gold+"33":C.gold+"22"}`,borderRadius:12,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20}}>{group.skillIcon}</span>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:C.white,fontFamily:D.display}}>{group.skill}</div>
                        <div style={{fontSize:11,color:C.gold,fontFamily:D.body}}>{group.time}</div>
                      </div>
                    </div>
                    <div style={{background:`${C.gold}15`,borderRadius:8,padding:"4px 12px"}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.gold,fontFamily:D.display}}>{group.players.length}</span>
                      <span style={{fontSize:10,color:C.goldDim,fontFamily:D.body}}> player{group.players.length!==1?"s":""}</span>
                    </div>
                  </div>

                  {/* Player cards */}
                  <div style={{display:"grid",gap:8,paddingLeft:8,borderLeft:`2px solid ${C.gold}22`}}>
                    {group.players.map((p,pi)=>(
                      <div key={pi} style={{background:C.card,border:`1px solid ${p.status==="confirmed"?C.green+"22":C.cardBorder}`,borderLeft:`3px solid ${p.status==="confirmed"?C.green:C.gold}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:C.white,fontFamily:D.display,marginBottom:4}}>{p.name}</div>
                          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                            {p.ageGroup&&<span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>👤 {p.ageGroup}</span>}
                            {p.position&&<span style={{fontSize:10,color:C.gold,fontFamily:D.body}}>⚽ {p.position}</span>}
                            {p.count>1&&<span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>👥 {p.count} players</span>}
                            {p.notes&&<span style={{fontSize:10,color:C.silverDim,fontFamily:D.body,fontStyle:"italic"}}>{p.notes.split("|")[0]}</span>}
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:8,padding:"2px 7px",borderRadius:6,background:p.status==="confirmed"?`${C.green}18`:`${C.gold}18`,color:p.status==="confirmed"?C.green:C.gold,fontFamily:D.body,letterSpacing:1,textTransform:"uppercase"}}>{p.status==="confirmed"?"✓ Confirmed":"⏳ Pending"}</div>
                          {p.phone&&<div style={{fontSize:10,color:C.silverDark,fontFamily:D.body,marginTop:4}}>{p.phone}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {tab==="bookings"&&(()=>{
          const allB = [...bookings].sort((a,b)=>a.dateKey>b.dateKey?1:-1);
          const todayB    = allB.filter(b=>b.dateKey===todayStr0);
          const upcomingB = allB.filter(b=>b.dateKey>todayStr0);
          const pastB     = allB.filter(b=>b.dateKey<todayStr0);

          function renderBookings(grpBookings){
            // group by date+session
            const groups={};
            grpBookings.forEach(b=>{
              const k=`${b.dateKey}_${b.sessId||b.dateKey}`;
              if(!groups[k]) groups[k]={dateLabel:b.dateLabel,sessTime:b.sessTime,ageGroup:b.ageGroup,skill:b.skill,skillIcon:b.skillIcon,bookings:[]};
              groups[k].bookings.push(b);
            });
            return Object.entries(groups).sort((a,b)=>a[0]>b[0]?1:-1).map(([key,group])=>(
              <div key={key} style={{marginBottom:24}}>
                <div style={{background:`linear-gradient(135deg,${C.goldDark},#150c04)`,border:`1px solid ${C.gold}22`,borderRadius:12,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:36,height:36,borderRadius:8,background:`${C.gold}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🔥</div>
                    <div>
                      <div style={{fontSize:15,color:C.white,fontFamily:D.display,fontWeight:600}}>{group.dateLabel}</div>
                      <div style={{fontSize:11,color:C.gold,fontFamily:D.body}}>{group.sessTime}</div>
                    </div>
                  </div>
                  <div style={{background:`${C.gold}15`,border:`1px solid ${C.gold}22`,borderRadius:8,padding:"4px 12px"}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.gold,fontFamily:D.display}}>{group.bookings.length}</span>
                    <span style={{fontSize:10,color:C.goldDim,fontFamily:D.body}}>/{MAX_PLAYERS} players</span>
                  </div>
                </div>
                <div style={{display:"grid",gap:8,paddingLeft:8,borderLeft:`2px solid ${C.gold}22`}}>
                  {group.bookings.map(b=>(
                    <div key={b.id} style={{background:b.requestType?`${C.silver}08`:C.card,border:`1px solid ${b.requestType?C.silver+"33":b.status==="confirmed"?C.green+"22":C.cardBorder}`,borderLeft:`3px solid ${b.requestType?C.silver:b.status==="confirmed"?C.green:C.gold}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:160}}>
                        {/* Name row */}
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                          <span style={{fontSize:15,fontWeight:600,color:C.white,fontFamily:D.display}}>{b.name}</span>
                          {b.parentName&&b.parentName!==b.name&&<span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>· parent: {b.parentName}</span>}
                          <span style={{fontSize:8,padding:"2px 7px",borderRadius:8,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body,background:b.status==="confirmed"?`${C.green}18`:`${C.gold}18`,color:b.status==="confirmed"?C.green:C.gold}}>{b.status==="confirmed"?"✓ Confirmed":"⏳ Pending"}</span>
                          {b.packageBooking&&<span style={{fontSize:8,padding:"2px 6px",borderRadius:8,background:`${C.gold}15`,color:C.gold,fontFamily:D.body}}>📦 Pack</span>}
                          {b.returning&&<span style={{fontSize:8,padding:"2px 6px",borderRadius:8,background:`${C.green}15`,color:C.green,fontFamily:D.body}}>↩ Return</span>}
                          {b.requestType&&<span style={{fontSize:8,padding:"2px 7px",borderRadius:8,background:`${C.silver}15`,color:C.silver,fontFamily:D.body}}>⚠ {b.requestType==="cancel"?"Cancel Req":"Reschedule Req"}</span>}
                        </div>
                        {/* Details row */}
                        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{fontSize:11,color:C.gold,fontFamily:D.body,fontWeight:600}}>${b.total}</span>
                          <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>· {b.count} player{b.count>1?"s":""}</span>
                          {b.phone&&<span style={{fontSize:11,color:C.silverDim,fontFamily:D.body}}>· {b.phone}</span>}
                          <span style={{fontSize:10,color:C.silverDark,fontFamily:D.body}}>{b.email}</span>
                        </div>
                        {b.notes&&<div style={{fontSize:10,color:C.silverDim,marginTop:4,fontStyle:"italic",fontFamily:D.body,lineHeight:1.5}}>{b.notes}</div>}
                        {b.requestType&&b.requestNote&&<div style={{fontSize:10,color:C.silver,marginTop:5,fontFamily:D.body,background:`${C.silver}08`,borderRadius:6,padding:"4px 8px"}}>📩 {b.requestNote}</div>}
                        {b.coachNote&&coachNoteId!==b.id&&<div style={{fontSize:10,color:C.gold,marginTop:6,fontFamily:D.body,background:`${C.gold}08`,border:`1px solid ${C.gold}22`,borderRadius:6,padding:"5px 10px"}}>📝 {b.coachNote}</div>}
                      </div>
                      {/* Action buttons */}
                      <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                        {b.status==="pending"&&<button onClick={()=>confirmBooking(b.id)} style={{background:`linear-gradient(135deg,${C.green},#0e7a47)`,border:"none",borderRadius:8,padding:"8px 14px",color:C.white,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,whiteSpace:"nowrap"}}>✓ Confirm</button>}
                        {b.requestType&&<button onClick={()=>updateDoc(doc(db,"bookings",b.id),{requestType:null,requestNote:null})} style={{background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:8,padding:"6px 10px",color:C.silver,fontSize:10,cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>Clear</button>}
                        <button onClick={()=>{
                          if(coachNoteId===b.id){setCoachNoteId(null);}
                          else{setCoachNoteId(b.id);setCoachNoteText(b.coachNote||"");}
                        }} style={{background:coachNoteId===b.id?`${C.gold}22`:(b.coachNote?"#141008":"transparent"),border:`1px solid ${b.coachNote?C.gold+"44":C.cardBorder}`,borderRadius:8,padding:"6px 10px",color:b.coachNote?C.gold:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>
                          📝{b.coachNote?" Note":""}
                        </button>
                        <button onClick={()=>{setMoveId(moveId===b.id?null:b.id);setMoveDate(null);setMoveSess(null);}} style={{background:moveId===b.id?`${C.gold}22`:"transparent",border:`1px solid ${C.gold}44`,borderRadius:8,padding:"6px 10px",color:C.gold,fontSize:10,cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>↗ Move</button>
                        <button onClick={()=>removeBooking(b.id)} style={{width:30,height:30,background:"transparent",border:`1px solid ${C.redDim}33`,borderRadius:8,color:C.redDim,fontSize:12,cursor:"pointer",fontFamily:D.body,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                      </div>

                      {/* Inline Coach Notes */}
                      {coachNoteId===b.id&&(
                        <div style={{width:"100%",marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`}}>
                          <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Coach Notes — only you can see this</div>
                          <textarea
                            value={coachNoteText}
                            onChange={e=>setCoachNoteText(e.target.value)}
                            placeholder="Schedule change, player notes, anything you need to remember..."
                            rows={3}
                            style={{...IS,width:"100%",marginBottom:10,fontSize:12,resize:"vertical"}}
                          />
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={async()=>{
                              await updateDoc(doc(db,"bookings",b.id),{coachNote:coachNoteText,coachNoteUpdated:new Date().toISOString()});
                              setCoachNoteId(null);
                            }} style={{background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:8,padding:"9px 18px",color:"#0a0a0a",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>
                              Save Note
                            </button>
                            {b.coachNote&&<button onClick={async()=>{
                              await updateDoc(doc(db,"bookings",b.id),{coachNote:"",coachNoteUpdated:new Date().toISOString()});
                              setCoachNoteText("");
                              setCoachNoteId(null);
                            }} style={{background:"transparent",border:`1px solid ${C.redDim}33`,borderRadius:8,padding:"9px 14px",color:C.redDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>
                              Clear
                            </button>}
                            <button onClick={()=>setCoachNoteId(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"9px 14px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Inline Move Picker */}
                      {moveId===b.id&&(
                        <div style={{width:"100%",marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`}}>
                          <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Select New Date</div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                            {getDates().map((d,i)=>{
                              const sel=moveDate&&dKey(d)===dKey(moveDate);
                              const sched=DAY_SCHEDULE[d.getDay()];
                              if(!sched) return null;
                              const sp=sched.sessions.reduce((s,sess)=>s+spotsLeft(d,sess.id),0);
                              return(
                                <button key={i} onClick={()=>{setMoveDate(d);setMoveSess(null);}}
                                  style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"8px 4px",cursor:"pointer",textAlign:"center",color:C.white}}>
                                  <div style={{fontSize:8,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{DAY_ABBR[d.getDay()]}</div>
                                  <div style={{fontSize:15,fontWeight:700,fontFamily:D.display}}>{d.getDate()}</div>
                                  <div style={{fontSize:8,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                                  <div style={{fontSize:8,color:sp===0?"#555":sp<=2?C.red:C.silverDim,marginTop:2,fontFamily:D.body}}>{sp===0?"FULL":`${sp} left`}</div>
                                </button>
                              );
                            })}
                          </div>
                          {moveDate&&(()=>{
                            const sched=DAY_SCHEDULE[moveDate.getDay()];
                            if(!sched) return null;
                            return(
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                                {sched.sessions.map(sess=>{
                                  const sp=spotsLeft(moveDate,sess.id);
                                  const sel=moveSess?.id===sess.id;
                                  return(
                                    <button key={sess.id} disabled={sp===0} onClick={()=>setMoveSess(sess)}
                                      style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"10px 10px",cursor:sp===0?"not-allowed":"pointer",textAlign:"left",opacity:sp===0?0.4:1}}>
                                      <div style={{fontSize:11,fontWeight:600,color:sel?C.gold:C.white,fontFamily:D.display}}>{sess.time}</div>
                                      <div style={{fontSize:10,color:sel?C.gold:C.textDim,fontFamily:D.body}}>{sess.ageGroup}</div>
                                      <div style={{fontSize:9,color:sp===0?"#555":sp<=2?C.red:C.silverDim,marginTop:2,fontFamily:D.body}}>{sp===0?"FULL":`${sp}/${MAX_PLAYERS} open`}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          {moveDate&&moveSess?(
                            <button onClick={async()=>{
                              const sched=DAY_SCHEDULE[moveDate.getDay()];
                              await updateDoc(doc(db,"bookings",b.id),{
                                dateKey:dKey(moveDate),dateLabel:fmtDate(moveDate),
                                sessId:moveSess.id,sessTime:moveSess.time,
                                ageGroup:moveSess.ageGroup,ageTag:moveSess.ageTag,
                                skill:sched.skill,skillIcon:sched.skillIcon,
                                requestType:null,requestNote:null,
                                movedAt:new Date().toISOString(),
                              });
                              try{await callEmailAPI({...b,dateLabel:fmtDate(moveDate),sessTime:moveSess.time},"reschedule");}catch(e){}
                              setMoveId(null);setMoveDate(null);setMoveSess(null);
                            }} style={{width:"100%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:8,padding:"11px",color:"#0a0a0a",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>
                              ✓ Confirm → {fmtDate(moveDate)} · {moveSess.time}
                            </button>
                          ):(
                            <div style={{fontSize:10,color:"#444",fontFamily:D.body,textAlign:"center",padding:"6px 0"}}>
                              {!moveDate?"↑ Pick a date":"↑ Now pick a session time"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          }

          return(<>
            {/* TODAY */}
            {todayB.length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.cardBorder}`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.green,animation:"pulse 1.5s infinite",flexShrink:0}}/>
                  <span style={{fontSize:10,letterSpacing:3,color:C.green,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Today</span>
                  <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>— {todayB.length} booking{todayB.length!==1?"s":""}</span>
                </div>
                {renderBookings(todayB)}
              </div>
            )}

            {/* UPCOMING */}
            <div style={{marginBottom:28}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.cardBorder}`}}>
                <span style={{fontSize:10,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Upcoming</span>
                <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>— {upcomingB.length} booking{upcomingB.length!==1?"s":""}</span>
              </div>
              {upcomingB.length===0?(
                <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:13,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12}}>No upcoming bookings.</div>
              ):renderBookings(upcomingB)}
            </div>

            {/* PAST */}
            <div>
              <button onClick={()=>setShowPast(p=>!p)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",marginBottom:showPast?12:0,padding:"0 0 8px 0",borderBottom:`1px solid ${C.cardBorder}`,width:"100%"}}>
                <span style={{fontSize:10,letterSpacing:3,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body}}>Past Sessions</span>
                <span style={{fontSize:10,color:C.silverDim,fontFamily:D.body}}>— {pastB.length}</span>
                <span style={{color:C.silverDim,fontSize:10,marginLeft:"auto"}}>{showPast?"▲":"▼"}</span>
              </button>
              {showPast&&(
                pastB.length===0?(
                  <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:13,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12}}>No past bookings.</div>
                ):renderBookings(pastB)
              )}
            </div>
          </>);
        })()}

        {tab==="inquiries"&&(()=>{
          const allI = [...inquiries].sort((a,b)=>a.dateKey>b.dateKey?1:-1);
          const todayI    = allI.filter(i=>i.dateKey===todayStr0);
          const upcomingI = allI.filter(i=>i.dateKey>todayStr0);
          const pastI     = allI.filter(i=>i.dateKey<todayStr0);

          function renderInqCard(inq){
            const posColor = C.gold;
            return(
              <div key={inq.id} style={{background:inq.requestType?`${C.silver}08`:C.card,border:`1px solid ${inq.requestType?C.silver+"33":inq.status==="confirmed"?C.green+"22":C.cardBorder}`,borderLeft:`3px solid ${inq.requestType?C.silver:inq.status==="confirmed"?C.green:C.gold}`,borderRadius:12,padding:"14px 18px",transition:"all 0.2s"}}>

                {/* Top row — name + status + actions */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:D.display}}>{inq.name}</span>
                    <span style={{fontSize:8,padding:"2px 7px",borderRadius:8,letterSpacing:1,textTransform:"uppercase",fontFamily:D.body,background:inq.status==="confirmed"?`${C.green}18`:`${C.gold}18`,color:inq.status==="confirmed"?C.green:C.gold}}>{inq.status==="confirmed"?"✓ Confirmed":"⏳ Pending"}</span>
                    {inq.requestType&&<span style={{fontSize:8,padding:"2px 7px",borderRadius:8,background:`${C.silver}15`,color:C.silver,fontFamily:D.body}}>⚠ {inq.requestType==="cancel"?"Cancel Req":"Reschedule Req"}</span>}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                    {inq.status==="pending"&&<button onClick={()=>confirmBooking(inq.id,"inquiries")} style={{background:`linear-gradient(135deg,${C.green},#0e7a47)`,border:"none",borderRadius:8,padding:"7px 14px",color:C.white,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:600,whiteSpace:"nowrap"}}>✓ Confirm</button>}
                    {inq.requestType&&<button onClick={()=>updateDoc(doc(db,"inquiries",inq.id),{requestType:null,requestNote:null})} style={{background:"transparent",border:`1px solid ${C.silver}33`,borderRadius:8,padding:"6px 10px",color:C.silver,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Clear</button>}
                    <button onClick={()=>{
                      if(coachNoteId===inq.id){setCoachNoteId(null);}
                      else{setCoachNoteId(inq.id);setCoachNoteText(inq.coachNote||"");}
                    }} style={{background:coachNoteId===inq.id?`${C.gold}22`:(inq.coachNote?"#141008":"transparent"),border:`1px solid ${inq.coachNote?C.gold+"44":C.cardBorder}`,borderRadius:8,padding:"6px 10px",color:inq.coachNote?C.gold:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>
                      📝{inq.coachNote?" Note":""}
                    </button>
                    <button onClick={()=>setMoveId(moveId===inq.id?null:inq.id)} style={{background:moveId===inq.id?`${C.gold}22`:"transparent",border:`1px solid ${C.gold}44`,borderRadius:8,padding:"6px 10px",color:C.gold,fontSize:10,cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap"}}>↗ Move</button>
                    <button onClick={()=>removeInquiry(inq.id)} style={{width:28,height:28,background:"transparent",border:`1px solid ${C.redDim}33`,borderRadius:7,color:C.redDim,fontSize:12,cursor:"pointer",fontFamily:D.body,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                </div>
                {/* Inline Move Picker for 1-on-1 */}
                {moveId===inq.id&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`}}>
                    <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Select New Date</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                      {getPrivateDates().map((d,i)=>{
                        const sel=moveDate&&dKey(d)===dKey(moveDate);
                        const sched=PRIVATE_SCHEDULE[d.getDay()];
                        if(!sched) return null;
                        const avail=sched.slots.filter(sl=>!(blocked||[]).some(x=>x.dateKey===dKey(d)&&x.sessId===sl.id)&&!(inquiries||[]).some(x=>x.dateKey===dKey(d)&&x.slotId===sl.id&&x.status!=="cancelled")).length;
                        return(
                          <button key={i} onClick={()=>{setMoveDate(d);setMoveSess(null);}}
                            style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"8px 4px",cursor:"pointer",textAlign:"center",color:C.white}}>
                            <div style={{fontSize:8,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{weekday:"short"}).slice(0,3).toUpperCase()}</div>
                            <div style={{fontSize:15,fontWeight:700,fontFamily:D.display}}>{d.getDate()}</div>
                            <div style={{fontSize:8,color:sel?C.gold:C.silverDim,fontFamily:D.body}}>{d.toLocaleDateString("en-US",{month:"short"})}</div>
                            <div style={{fontSize:8,color:avail===0?"#555":avail===1?C.red:C.silverDim,marginTop:2,fontFamily:D.body}}>{avail===0?"FULL":`${avail} open`}</div>
                          </button>
                        );
                      })}
                    </div>
                    {moveDate&&(()=>{
                      const sched=PRIVATE_SCHEDULE[moveDate.getDay()];
                      if(!sched) return null;
                      return(
                        <div style={{display:"grid",gap:6,marginBottom:10}}>
                          {sched.slots.map(slot=>{
                            const taken=(blocked||[]).some(x=>x.dateKey===dKey(moveDate)&&x.sessId===slot.id)||(inquiries||[]).some(x=>x.dateKey===dKey(moveDate)&&x.slotId===slot.id&&x.status!=="cancelled");
                            const sel=moveSess?.id===slot.id;
                            return(
                              <button key={slot.id} disabled={taken} onClick={()=>setMoveSess(slot)}
                                style={{background:sel?"#1c130a":"#0d0d0d",border:sel?`1px solid ${C.gold}`:`1px solid #222`,borderRadius:8,padding:"10px 14px",cursor:taken?"not-allowed":"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",opacity:taken?0.4:1}}>
                                <span style={{fontSize:12,fontWeight:600,color:sel?C.gold:C.white,fontFamily:D.display}}>{slot.time}</span>
                                <span style={{fontSize:10,color:taken?"#555":sel?C.gold:C.silverDim,fontFamily:D.body}}>{taken?"BOOKED":"OPEN"}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {moveDate&&moveSess?(
                      <button onClick={async()=>{
                        await updateDoc(doc(db,"inquiries",inq.id),{
                          dateKey:dKey(moveDate),dateLabel:fmtDate(moveDate),
                          slotId:moveSess.id,slotTime:moveSess.time,
                          requestType:null,requestNote:null,
                          movedAt:new Date().toISOString(),
                        });
                        try{await callEmailAPI({...inq,dateLabel:fmtDate(moveDate),sessTime:moveSess.time},"reschedule");}catch(e){}
                        setMoveId(null);setMoveDate(null);setMoveSess(null);
                      }} style={{width:"100%",background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:8,padding:"11px",color:"#0a0a0a",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>
                        ✓ Confirm → {fmtDate(moveDate)} · {moveSess.time}
                      </button>
                    ):(
                      <div style={{fontSize:10,color:"#444",fontFamily:D.body,textAlign:"center",padding:"6px 0"}}>
                        {!moveDate?"↑ Pick a date":"↑ Now pick a slot"}
                      </div>
                    )}
                  </div>
                )}

                {/* Session info row */}
                <div style={{display:"grid",gridTemplateColumns:"auto auto auto 1fr",gap:10,alignItems:"center",marginBottom:inq.goals||inq.requestNote?10:0,flexWrap:"wrap"}}>
                  <div style={{background:`${C.gold}12`,border:`1px solid ${C.gold}33`,borderRadius:8,padding:"5px 12px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:C.goldDim,fontFamily:D.body,letterSpacing:1,marginBottom:1}}>⚒️ SESSION</div>
                    <div style={{fontSize:11,color:C.gold,fontFamily:D.body,fontWeight:600,whiteSpace:"nowrap"}}>{inq.dateLabel}</div>
                    <div style={{fontSize:10,color:C.goldDim,fontFamily:D.body}}>{inq.slotTime}</div>
                  </div>
                  {inq.position&&(
                    <div style={{background:`${C.red}10`,border:`1px solid ${C.red}33`,borderRadius:8,padding:"5px 12px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:C.redDim,fontFamily:D.body,letterSpacing:1,marginBottom:1}}>POSITION</div>
                      <div style={{fontSize:11,color:C.white,fontFamily:D.body,fontWeight:600}}>{inq.position}</div>
                    </div>
                  )}
                  {inq.age&&(
                    <div style={{background:`${C.silver}08`,border:`1px solid ${C.silver}22`,borderRadius:8,padding:"5px 12px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:C.silverDim,fontFamily:D.body,letterSpacing:1,marginBottom:1}}>AGE</div>
                      <div style={{fontSize:11,color:C.silver,fontFamily:D.body,fontWeight:600}}>{inq.age}</div>
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:2,paddingLeft:4}}>
                    <span style={{fontSize:11,color:C.gold,fontFamily:D.body,fontWeight:600}}>${inq.price||inq.total}</span>
                    {inq.phone&&<span style={{fontSize:10,color:C.silverDim,fontFamily:D.body}}>{inq.phone}</span>}
                    <span style={{fontSize:10,color:C.silverDark,fontFamily:D.body}}>{inq.email}</span>
                  </div>
                </div>

                {/* Goals */}
                {inq.goals&&(
                  <div style={{background:`${C.gold}08`,border:`1px solid ${C.gold}22`,borderRadius:8,padding:"8px 12px",marginTop:2}}>
                    <div style={{fontSize:9,letterSpacing:2,color:C.goldDim,textTransform:"uppercase",fontFamily:D.body,marginBottom:3}}>Goals / Focus</div>
                    <div style={{fontSize:11,color:C.textMid,fontFamily:D.body,lineHeight:1.6}}>{inq.goals}</div>
                  </div>
                )}

                {/* Request note */}
                {inq.requestType&&inq.requestNote&&(
                  <div style={{background:`${C.silver}08`,borderRadius:8,padding:"8px 12px",marginTop:8}}>
                    <div style={{fontSize:10,color:C.silver,fontFamily:D.body}}>📩 {inq.requestNote}</div>
                  </div>
                )}

                {/* Inline Coach Notes for 1-on-1 */}
                {coachNoteId===inq.id&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.cardBorder}`}}>
                    <div style={{fontSize:9,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,marginBottom:8}}>Coach Notes — only you can see this</div>
                    <textarea
                      value={coachNoteText}
                      onChange={e=>setCoachNoteText(e.target.value)}
                      placeholder="Session focus, player notes, anything you need to remember..."
                      rows={3}
                      style={{...IS,width:"100%",marginBottom:10,fontSize:12,resize:"vertical"}}
                    />
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={async()=>{
                        await updateDoc(doc(db,"inquiries",inq.id),{coachNote:coachNoteText,coachNoteUpdated:new Date().toISOString()});
                        setCoachNoteId(null);
                      }} style={{background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,border:"none",borderRadius:8,padding:"9px 18px",color:"#0a0a0a",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:700}}>
                        Save Note
                      </button>
                      {inq.coachNote&&<button onClick={async()=>{
                        await updateDoc(doc(db,"inquiries",inq.id),{coachNote:"",coachNoteUpdated:new Date().toISOString()});
                        setCoachNoteText("");setCoachNoteId(null);
                      }} style={{background:"transparent",border:`1px solid ${C.redDim}33`,borderRadius:8,padding:"9px 14px",color:C.redDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Clear</button>}
                      <button onClick={()=>setCoachNoteId(null)} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"9px 14px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return(<>
            {/* TODAY */}
            {todayI.length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.cardBorder}`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.green,animation:"pulse 1.5s infinite",flexShrink:0}}/>
                  <span style={{fontSize:10,letterSpacing:3,color:C.green,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Today</span>
                  <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>— {todayI.length} session{todayI.length!==1?"s":""}</span>
                </div>
                <div style={{display:"grid",gap:8}}>{todayI.map(i=>renderInqCard(i))}</div>
              </div>
            )}

            {/* UPCOMING */}
            <div style={{marginBottom:28}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.cardBorder}`}}>
                <span style={{fontSize:10,letterSpacing:3,color:C.gold,textTransform:"uppercase",fontFamily:D.body,fontWeight:600}}>Upcoming</span>
                <span style={{fontSize:10,color:C.textDim,fontFamily:D.body}}>— {upcomingI.length} request{upcomingI.length!==1?"s":""}</span>
              </div>
              {upcomingI.length===0?(
                <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:13,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12}}>No upcoming 1-on-1 requests.</div>
              ):<div style={{display:"grid",gap:8}}>{upcomingI.map(i=>renderInqCard(i))}</div>}
            </div>

            {/* PAST */}
            <div>
              <button onClick={()=>setShowPastI(p=>!p)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",marginBottom:showPastI?12:0,padding:"0 0 8px 0",borderBottom:`1px solid ${C.cardBorder}`,width:"100%"}}>
                <span style={{fontSize:10,letterSpacing:3,color:C.silverDim,textTransform:"uppercase",fontFamily:D.body}}>Past Sessions</span>
                <span style={{fontSize:10,color:C.silverDim,fontFamily:D.body}}>— {pastI.length}</span>
                <span style={{color:C.silverDim,fontSize:10,marginLeft:"auto"}}>{showPastI?"▲":"▼"}</span>
              </button>
              {showPastI&&(
                pastI.length===0?(
                  <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:13,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:12}}>No past requests.</div>
                ):<div style={{display:"grid",gap:8}}>{pastI.map(i=>renderInqCard(i))}</div>
              )}
            </div>
          </>);
        })()}

        {tab==="reminders"&&(()=>{
          // Build upcoming sessions grouped by date — include confirmed AND pending
          const today = new Date(); today.setHours(0,0,0,0);
          const upcoming = {};

          // Group bookings (confirmed + pending) by date
          bookings.filter(b=>["confirmed","pending"].includes(b.status)&&new Date(b.dateKey+"T00:00:00")>=today)
            .forEach(b=>{
              const k = b.dateKey+"_"+b.sessId;
              if(!upcoming[k]) upcoming[k]={dateKey:b.dateKey,dateLabel:b.dateLabel,sessTime:b.sessTime,ageGroup:b.ageGroup,skill:b.skill,skillIcon:b.skillIcon,type:"group",clients:[]};
              upcoming[k].clients.push({name:b.name,email:b.email,status:b.status,total:b.total});
            });

          // Group inquiries (confirmed + pending) by date
          inquiries.filter(i=>["confirmed","pending"].includes(i.status)&&new Date(i.dateKey+"T00:00:00")>=today)
            .forEach(inq=>{
              const k = inq.dateKey+"_"+(inq.slotId||"1on1");
              if(!upcoming[k]) upcoming[k]={dateKey:inq.dateKey,dateLabel:inq.dateLabel,sessTime:inq.slotTime||inq.sessTime,type:"1on1",clients:[]};
              upcoming[k].clients.push({name:inq.name,email:inq.email,status:inq.status,total:inq.price||inq.total});
            });

          const sessions = Object.values(upcoming).sort((a,b)=>a.dateKey>b.dateKey?1:-1);

          async function sendSessionReminder(session){
            let sent=0;
            for(const client of session.clients){
              const emailType = client.status==="confirmed"
                ? (session.type==="1on1"?"reminder_1on1":"reminder_group")
                : (session.type==="1on1"?"reminder_pending_1on1":"reminder_pending_group");
              await sendReminderEmail({
                name:client.name, email:client.email,
                dateLabel:session.dateLabel, sessTime:session.sessTime,
                ageGroup:session.ageGroup||"1-on-1",
                skill:session.skill||"The Tempering",
                skillIcon:session.skillIcon||"⚽",
                total:client.total,
              }, emailType);
              sent++;
            }
            alert(`Sent ${sent} reminder${sent!==1?"s":""} for ${session.dateLabel}!`);
          }

          return sessions.length===0?(
            <div style={{textAlign:"center",padding:"80px 20px",color:C.textDim,fontSize:14,fontFamily:D.body}}>No upcoming confirmed sessions yet.</div>
          ):(
            <div style={{display:"grid",gap:12}}>
              <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginBottom:4}}>Send reminder emails to all confirmed clients for each upcoming session.</div>
              {sessions.map((sess,i)=>{
                const isToday = sess.dateKey===today.toISOString().split("T")[0];
                const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
                const isTomorrow = sess.dateKey===tomorrow.toISOString().split("T")[0];
                return(
                  <div key={i} style={{background:C.card,border:`1px solid ${isTomorrow?C.gold+"44":C.cardBorder}`,borderLeft:`3px solid ${isTomorrow?C.gold:isToday?C.green:C.silverDark}`,borderRadius:12,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,color:C.white,fontFamily:D.display,fontWeight:600}}>{sess.dateLabel}</span>
                        {isTomorrow&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:10,background:C.goldDark,color:C.gold,border:`1px solid ${C.silver}44`,fontFamily:D.body,letterSpacing:1}}>TOMORROW</span>}
                        {isToday&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:10,background:C.greenDark,color:C.green,border:`1px solid ${C.green}33`,fontFamily:D.body,letterSpacing:1}}>TODAY</span>}
                      </div>
                      <div style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginBottom:6}}>
                        {sess.sessTime} · {sess.type==="1on1"?"1-on-1 Private":`${sess.skillIcon||""} ${sess.skill||""} · ${sess.ageGroup||""}`}
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {sess.clients.map((c,ci)=>(
                          <span key={ci} style={{fontSize:10,padding:"3px 10px",borderRadius:20,background:"#161310",border:`1px solid ${c.status==="confirmed"?C.green+"33":C.gold+"33"}`,color:c.status==="confirmed"?C.green:C.gold,fontFamily:D.body,display:"flex",alignItems:"center",gap:5}}>
                            {c.status==="confirmed"?"🟢":"🟡"} {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={()=>sendSessionReminder(sess)} style={{background:`linear-gradient(135deg,${C.goldDark},#150c04)`,border:`1px solid ${C.silver}44`,color:C.gold,borderRadius:10,padding:"10px 18px",fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,whiteSpace:"nowrap",boxShadow:`0 4px 16px ${C.gold}22`}}>
                      📧 Send Reminder
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {tab==="reviews"&&<ReviewsModeration/>}
      </div>
    </div>
  );
}

// ── REVIEWS MODERATION (Dashboard) ───────────────────────
export function ReviewsModeration(){
  const [reviews,setReviews] = useState([]);
  const [loaded,setLoaded]   = useState(false);
  const [filter,setFilter]   = useState("pending");

  useEffect(()=>{
    const q = query(collection(db,"reviews"),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, s=>{
      setReviews(s.docs.map(d=>({id:d.id,...d.data()})));
      setLoaded(true);
    });
    return unsub;
  },[]);

  async function setStatus(id,status){
    await updateDoc(doc(db,"reviews",id),{status});
  }
  async function removeReview(id){
    await deleteDoc(doc(db,"reviews",id));
  }

  const filtered = filter==="all"?reviews:reviews.filter(r=>r.status===filter);
  const counts = {
    pending: reviews.filter(r=>r.status==="pending").length,
    approved: reviews.filter(r=>r.status==="approved").length,
    rejected: reviews.filter(r=>r.status==="rejected").length,
  };

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {[["pending",`Pending (${counts.pending})`],["approved",`Approved (${counts.approved})`],["rejected",`Rejected (${counts.rejected})`],["all","All"]].map(([key,lbl])=>(
          <button key={key} onClick={()=>setFilter(key)} style={{background:filter===key?"rgba(168,168,188,0.1)":"transparent",border:filter===key?`1px solid ${C.silver}44`:`1px solid ${C.cardBorder}`,color:filter===key?C.silverBright:C.textDim,borderRadius:8,padding:"7px 16px",fontSize:11,letterSpacing:1,cursor:"pointer",fontFamily:D.body}}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{display:"grid",gap:10}}>
        {!loaded?(
          <div style={{textAlign:"center",padding:40,color:C.textDim,fontSize:12,fontFamily:D.body}}>Loading…</div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:40,color:C.textDim,fontSize:12,fontFamily:D.body,background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14}}>
            No reviews in this category.
          </div>
        ):filtered.map(r=>(
          <div key={r.id} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderLeft:`3px solid ${r.status==="approved"?C.green:r.status==="rejected"?C.red:C.gold}`,borderRadius:12,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:8}}>
              <div>
                <span style={{fontSize:13,fontWeight:600,color:C.white,fontFamily:D.display}}>{r.name}</span>
                {r.email&&<span style={{fontSize:11,color:C.textDim,fontFamily:D.body,marginLeft:8}}>{r.email}</span>}
              </div>
              <span style={{color:C.gold,fontSize:13,letterSpacing:1}}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span>
            </div>
            <div style={{fontSize:12,color:C.textMid,fontFamily:D.body,lineHeight:1.7,marginBottom:12}}>{r.text}</div>
            <div style={{display:"flex",gap:8}}>
              {r.status!=="approved"&&(
                <button onClick={()=>setStatus(r.id,"approved")} style={{background:`linear-gradient(135deg,${C.green},#0e7a47)`,border:"none",borderRadius:8,padding:"7px 14px",color:C.white,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body,fontWeight:500}}>✓ Approve</button>
              )}
              {r.status!=="rejected"&&(
                <button onClick={()=>setStatus(r.id,"rejected")} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"7px 14px",color:C.textDim,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:D.body}}>Hide</button>
              )}
              <button onClick={()=>removeReview(r.id)} style={{background:"transparent",border:`1px solid ${C.redDim}`,borderRadius:8,padding:"7px 14px",color:C.redDim,fontSize:10,cursor:"pointer",fontFamily:D.body}}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── MOVE BOOKING MODAL — outside transformed div so position:fixed works ── */}
    </div>
  );
}

// ── FIELD POSITION PICKER ────────────────────────────────
function FieldPositionPicker({selected, onSelect}){
  // Field layout: rows from attack to defense (top = attack, bottom = defense)
  // Each row: positions left to right
  const rows = [
    [{ id:"ST",  label:"ST" }],
    [{ id:"LW",  label:"LW" }, { id:"CAM", label:"CAM" }, { id:"RW",  label:"RW" }],
    [{ id:"CM",  label:"CM" }],
    [{ id:"LB",  label:"LB" }, { id:"CDM", label:"CDM" }, { id:"RB",  label:"RB" }],
    [{ id:"CB",  label:"CB" }],
  ];

  return(
    <div style={{
      background:"#1a2e1a",
      border:"2px solid #2d5a2d",
      borderRadius:16,
      padding:"16px 12px",
      position:"relative",
      overflow:"hidden",
      userSelect:"none",
    }}>
      {/* Field markings */}
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} preserveAspectRatio="none">
        {/* Outer boundary */}
        <rect x="4%" y="2%" width="92%" height="96%" fill="none" stroke="#ffffff15" strokeWidth="1"/>
        {/* Center line */}
        <line x1="4%" y1="50%" x2="96%" y2="50%" stroke="#ffffff15" strokeWidth="1"/>
        {/* Center circle */}
        <ellipse cx="50%" cy="50%" rx="14%" ry="10%" fill="none" stroke="#ffffff15" strokeWidth="1"/>
        {/* Center dot */}
        <circle cx="50%" cy="50%" r="2" fill="#ffffff20"/>
        {/* Top penalty box */}
        <rect x="25%" y="2%" width="50%" height="18%" fill="none" stroke="#ffffff10" strokeWidth="1"/>
        {/* Bottom penalty box */}
        <rect x="25%" y="80%" width="50%" height="18%" fill="none" stroke="#ffffff10" strokeWidth="1"/>
        {/* Top goal box */}
        <rect x="37%" y="2%" width="26%" height="8%" fill="none" stroke="#ffffff08" strokeWidth="1"/>
        {/* Bottom goal box */}
        <rect x="37%" y="90%" width="26%" height="8%" fill="none" stroke="#ffffff08" strokeWidth="1"/>
        {/* Grass stripes */}
        {[0,1,2,3,4,5].map(i=>(
          <rect key={i} x="0" y={`${i*17}%`} width="100%" height="8%" fill={i%2===0?"#1a2e1a":"#1e321e"} style={{pointerEvents:"none"}}/>
        ))}
      </svg>

      {/* Position buttons laid out top (attack) to bottom (defense) */}
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",gap:10,padding:"4px 0"}}>
        {/* Attack label */}
        <div style={{textAlign:"center",fontSize:8,letterSpacing:3,color:"#ffffff25",textTransform:"uppercase",fontFamily:"Montserrat,sans-serif",marginBottom:-4}}>Attack</div>
        {rows.map((row,ri)=>(
          <div key={ri} style={{display:"flex",justifyContent:"center",gap:10}}>
            {row.map(pos=>{
              const sel = selected===pos.id;
              return(
                <button key={pos.id} type="button" onClick={()=>onSelect(pos.id)}
                  style={{
                    width:52, height:44,
                    background:sel?"linear-gradient(135deg,#c9a84c,#7a6030)":"rgba(0,0,0,0.55)",
                    border:sel?"2px solid #e8c96a":"1px solid rgba(255,255,255,0.2)",
                    borderRadius:10,
                    cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.2s",
                    boxShadow:sel?"0 0 16px #c9a84c66":"none",
                    backdropFilter:"blur(4px)",
                  }}>
                  <span style={{fontSize:12,fontWeight:700,color:sel?"#120f0c":"#f5efe6",fontFamily:"Cormorant Garamond,Georgia,serif",letterSpacing:0.5}}>{pos.label}</span>
                </button>
              );
            })}
          </div>
        ))}
        {/* Defense label */}
        <div style={{textAlign:"center",fontSize:8,letterSpacing:3,color:"#ffffff25",textTransform:"uppercase",fontFamily:"Montserrat,sans-serif",marginTop:-4}}>Defense</div>
      </div>
    </div>
  );
}

// ── AUTH PAGE (Sign Up / Login) ─────────────────────────
