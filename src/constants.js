import { useState, useEffect } from "react";
import { db } from "./firebase";
import { loadStripe } from "@stripe/stripe-js";


// ── STRIPE ────────────────────────────────────────────────
export const stripePromise = loadStripe("pk_test_51TW0MzFU9deEKlhCmhj0SXJS0kQ4ZFyDnWwdz1AtKmMVhArsCsekwTIcSDpsmp7maruxwIOSSI4Kxk9acRCALAid00FfQtNtmp");

// ── CONFIG ────────────────────────────────────────────────
export const BRAND = { name:"La Forja", coach:"Carlos Cepeda", venmo:"carlos-cepeda-41", tagline:"Where Champions Are Forged", coachPw:"LAForja37" };
// Set to true to show the "Pay by Card" option to clients. Keep false while testing Stripe.
export const STRIPE_ENABLED = false;
export const SITE_READY = true; // Set to false to show Coming Soon on booking pages
export const MAX_PLAYERS = 5;
export const PRICE_GROUP = 40;
export const PRICE_1ON1 = 65;

export const POSITIONS = [
  { id:"CB",  label:"CB",  full:"Center Back" },
  { id:"RB",  label:"RB",  full:"Right Back" },
  { id:"LB",  label:"LB",  full:"Left Back" },
  { id:"CDM", label:"CDM", full:"Defensive Mid" },
  { id:"CM",  label:"CM",  full:"Central Mid" },
  { id:"CAM", label:"CAM", full:"Attacking Mid" },
  { id:"LW",  label:"LW",  full:"Left Wing" },
  { id:"RW",  label:"RW",  full:"Right Wing" },
  { id:"ST",  label:"ST",  full:"Striker" },
];

export const C = {
  // Base — forge dark, slight warm undertone
  black:"#0a0908", card:"#15130f", cardBorder:"#2a251c",
  // Steel silver — dominant accent (from logo shield border)
  silver:"#b4aea0", silverDim:"#6e6859", silverDark:"#332f26",
  silverBright:"#e6dfd2", silverGlow:"#b4aea022",
  // Gold/Ember — heat accent, brighter and warmer
  gold:"#e8a93c", goldBright:"#ffc966", goldDim:"#8a5e1f", goldDark:"#241407",
  // Red/Ember-red — fire accent, hotter and more saturated
  red:"#ff4d2e", redDim:"#a8341e", redDark:"#1f0a05",
  // Text — warm off-whites and greys
  white:"#f5efe6", textDim:"#7a7468", textMid:"#a8a194",
  // Status
  green:"#3ddc84", greenDark:"#0a1f12",
};
export const D = { display:"'Cormorant Garamond',Georgia,serif", body:"'Montserrat',sans-serif" };

export const DAY_SCHEDULE = {
  1:{ skill:"The Furnace", skillDesc:"1v1 dominance · Tight space control · Decision making under pressure", skillIcon:"🔥", sessions:[{id:"s1",label:"Session 1",time:"5:00 PM – 6:15 PM",ageGroup:"U11+", ageTag:"u11+"},{id:"s2",label:"Session 2",time:"6:30 PM – 7:45 PM",ageGroup:"U11+", ageTag:"u11+"}]},
  2:{ skill:"The Furnace", skillDesc:"1v1 dominance · Tight space control · Decision making under pressure", skillIcon:"🔥", sessions:[{id:"s1",label:"Session 1",time:"5:00 PM – 6:15 PM",ageGroup:"U11+", ageTag:"u11+"},{id:"s2",label:"Session 2",time:"6:30 PM – 7:45 PM",ageGroup:"U11+", ageTag:"u11+"}]},
  4:{ skill:"The Furnace", skillDesc:"1v1 dominance · Tight space control · Decision making under pressure", skillIcon:"🔥", sessions:[{id:"s1",label:"Session 1",time:"5:00 PM – 6:15 PM",ageGroup:"U11+", ageTag:"u11+"},{id:"s2",label:"Session 2",time:"6:30 PM – 7:45 PM",ageGroup:"U11+", ageTag:"u11+"}]},
  5:{ skill:"The Furnace", skillDesc:"1v1 dominance · Tight space control · Decision making under pressure", skillIcon:"🔥", sessions:[{id:"s1",label:"Session 1",time:"5:00 PM – 6:15 PM",ageGroup:"U11+", ageTag:"u11+"},{id:"s2",label:"Session 2",time:"6:30 PM – 7:45 PM",ageGroup:"U11+", ageTag:"u11+"}]},
};
export const PRIVATE_SCHEDULE = {
  3: { // Wednesday
    day: "Wednesday",
    slots: [
      { id: "w1", time: "5:00 PM – 6:15 PM" },
      { id: "w2", time: "6:30 PM – 7:45 PM" },
    ],
  },
  6: { // Saturday
    day: "Saturday",
    slots: [
      { id: "s1", time: "8:00 AM – 9:15 AM" },
      { id: "s2", time: "9:20 AM – 10:35 AM" },
    ],
  },
};

export const AGE_COLORS = {
  "u11+": {bg:"#1c160c",border:C.gold,text:C.gold,badge:"#241a08"},
  "9-11": {bg:"#1c160c",border:C.gold,text:C.gold,badge:"#241a08"},
  "12-14":{bg:"#1c160c",border:C.gold,text:C.gold,badge:"#241a08"},
};
export const SKILL_COLORS = {
  "The Furnace":   {color:C.red,  bg:"#1f0a05"},
  "The Tempering": {color:C.gold, bg:"#241a08"},
};
export const DAY_ABBR = {2:"TUE",5:"FRI"};
export const COACH_DAYS = [2,5]; // Tue + Fri
export const PRIVATE_DAYS = [3,6]; // wed + sat 1-on-1

export function getDates(weeks=6){
  const dates=[], today=new Date();
  today.setHours(0,0,0,0);
  for(let i=0;i<weeks*7;i++){
    const d=new Date(today);
    d.setDate(today.getDate()+i+1);
    if(COACH_DAYS.includes(d.getDay())) dates.push(d);
  }
  return dates;
}
export function getPrivateDates(weeks=6){
  const dates=[], today=new Date();
  today.setHours(0,0,0,0);
  for(let i=0;i<weeks*7;i++){
    const d=new Date(today);
    d.setDate(today.getDate()+i+1);
    if(PRIVATE_DAYS.includes(d.getDay())) dates.push(d);
  }
  return dates;
}

export function fmtDate(d){ return d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}); }
export function dKey(d){ return d.toISOString().split("T")[0]; }

export async function callEmailAPI(booking, type){
  try{
    await fetch("/api/send-email",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({booking,type}),
    });
  }catch(e){ console.error("Email error:",e); }
}

export async function sendReminderEmail(booking, type){
  try{
    await fetch("/api/send-email",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({booking, type: type==="1on1"?"reminder_1on1":"reminder_group"}),
    });
  }catch(e){ console.error("Reminder error:",e); }
}

export const TX = `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 60L60 0M-5 5L5-5M55 65L65 55' stroke='%23ff4d2e05' stroke-width='1'/%3E%3C/svg%3E")`;
// Subtle ember glow radiating from the top — adds warmth without overpowering the dark base
export const EMBER_GLOW = `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,77,46,0.10), transparent 60%), radial-gradient(ellipse 60% 40% at 85% 15%, rgba(232,169,60,0.06), transparent 60%)`;

// ══ ROOT APP ══════════════════════════════════════════════

export function Crest({size=48}){
  return(
    <div style={{width:size,height:size,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <img src="/Logo.png" alt="La Forja" width={size} height={size} style={{objectFit:"contain",display:"block"}}/>
    </div>
  );
}

export function SH({eyebrow,title}){
  return(
    <div style={{marginBottom:28}}>
      <div style={{display:"flex",gap:4,marginBottom:12}}><div style={{width:30,height:2,background:C.gold,borderRadius:1}}/><div style={{width:8,height:2,background:C.red,borderRadius:1}}/></div>
      {eyebrow&&<div style={{fontSize:9,letterSpacing:4,color:C.silverDim,textTransform:"uppercase",marginBottom:6,fontFamily:D.body}}>{eyebrow}</div>}
      <h1 style={{margin:0,fontSize:30,fontWeight:600,color:C.white,fontFamily:D.display,letterSpacing:1}}>{title}</h1>
    </div>
  );
}
export function FL({children}){ return <div style={{fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",marginBottom:12,fontFamily:D.body}}>{children}</div>; }
export function SC({title,rows}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,overflow:"hidden"}}>
      {title&&<div style={{padding:"10px 18px",borderBottom:`1px solid ${C.cardBorder}`,fontSize:9,letterSpacing:3,color:C.silver,textTransform:"uppercase",fontFamily:D.body}}>{title}</div>}
      {rows.map((r,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:i<rows.length-1?`1px solid ${C.cardBorder}`:"none"}}>
          <span style={{fontSize:11,color:C.textDim,fontFamily:D.body}}>{r.label}</span>
          <span style={{fontSize:12,color:r.accent?C.gold:r.color||C.white,fontFamily:r.accent?D.display:D.body,fontWeight:r.accent?700:400}}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
export function AB({children,onClick,disabled}){ return <button onClick={onClick} disabled={disabled} style={{flex:1,background:disabled?C.card:`linear-gradient(135deg,${C.red},${C.redDim})`,color:disabled?C.silverDark:C.white,border:disabled?`1px solid ${C.cardBorder}`:`1px solid ${C.red}`,borderRadius:10,padding:"13px 22px",fontSize:11,cursor:disabled?"not-allowed":"pointer",letterSpacing:3,textTransform:"uppercase",boxShadow:disabled?"none":`0 4px 20px ${C.red}33`,transition:"all 0.2s",fontFamily:D.body,fontWeight:500}}>{children}</button>; }
export function GB({children,onClick}){ return <button onClick={onClick} style={{background:"transparent",border:`1px solid ${C.cardBorder}`,color:C.textDim,borderRadius:10,padding:"12px 18px",fontSize:11,cursor:"pointer",letterSpacing:2,textTransform:"uppercase",fontFamily:D.body}}>{children}</button>; }
export function NB({children,onClick,disabled}){ return <button onClick={onClick} disabled={disabled} style={{background:"transparent",border:"none",color:disabled?C.silverDark:C.gold,cursor:disabled?"not-allowed":"pointer",fontSize:11,letterSpacing:1,padding:"4px 8px",fontFamily:D.body}}>{children}</button>; }
export const IS = {width:"100%",background:"#161310",border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"11px 13px",color:C.white,fontSize:14,fontFamily:D.body,outline:"none"};
export function GStyles(){ return <style>{`
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(8px)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes sparkle{0%{opacity:1;transform:scale(0) translate(0,0)}100%{opacity:0;transform:scale(1) translate(var(--tx),var(--ty))}}
@keyframes hammerSwing{0%{transform:rotate(-45deg) translateY(-20px);opacity:0}40%{transform:rotate(0deg) translateY(0);opacity:1}70%{transform:rotate(15deg)}85%{transform:rotate(-5deg)}100%{transform:rotate(0deg)}}
@keyframes anvilBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes swordLeft{0%{transform:translateX(-120px) rotate(-30deg);opacity:0}60%{transform:translateX(0) rotate(0deg);opacity:1}100%{transform:translateX(0) rotate(0deg)}}
@keyframes swordRight{0%{transform:translateX(120px) rotate(30deg);opacity:0}60%{transform:translateX(0) rotate(0deg);opacity:1}100%{transform:translateX(0) rotate(0deg)}}
@keyframes clashFlare{0%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1.4)}100%{opacity:0;transform:scale(2)}}
@keyframes flameFlicker{0%,100%{transform:scaleY(1) scaleX(1)}25%{transform:scaleY(1.1) scaleX(0.95)}75%{transform:scaleY(0.95) scaleX(1.05)}}
@keyframes overlayFade{0%{opacity:1}100%{opacity:0}}
@keyframes transitionIn{0%{opacity:0;transform:scale(0.97)}100%{opacity:1;transform:none}}
*{box-sizing:border-box}textarea{resize:vertical}input::placeholder,textarea::placeholder{color:#333}
`}</style>; }
