"use client";
import {useEffect,useRef,useState} from "react";
import "./landing.css";

const photos = [
  {title:"Gallery White",cls:"white",alt:"Landscape photograph coming soon"},
  {title:"Carved Mahogany",cls:"mahogany",alt:"Landscape photograph coming soon"},
  {title:"Black Box",cls:"black",alt:"Landscape photograph coming soon"},
];
export default function WelcomePage(){
  const[email,setEmail]=useState("");
  const[consent,setConsent]=useState(false);
  const[busy,setBusy]=useState(false);
  const[status,setStatus]=useState("");
  const[ok,setOk]=useState(false);
  const[signupEnabled,setSignupEnabled]=useState(false);
  const[siteKey,setSiteKey]=useState("");
  const[token,setToken]=useState("");
  const[featuredPhotos,setFeaturedPhotos]=useState<string[]>([]);
  const captchaRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    fetch("/api/landing-photos").then(r=>r.json()).then((v:{photos:string[]})=>setFeaturedPhotos(v.photos||[])).catch(()=>{});
  },[]);
  useEffect(()=>{
    fetch("/api/interest").then(r=>r.json()).then((v:{enabled:boolean,siteKey:string})=>{
      setSignupEnabled(v.enabled);setSiteKey(v.siteKey);
    }).catch(()=>setSignupEnabled(false));
  },[]);
  useEffect(()=>{
    if(!siteKey||!signupEnabled) return;
    let cancelled=false;
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;
    script.onload=()=>{
      if(cancelled||!captchaRef.current)return;
      const turnstile=(window as Window & {turnstile?:{render:(target:HTMLElement,opts:{sitekey:string,callback:(t:string)=>void,"expired-callback":()=>void})=>unknown}}).turnstile;
      turnstile?.render(captchaRef.current,{sitekey:siteKey,callback:setToken,"expired-callback":()=>setToken("")});
    };
    document.head.appendChild(script);
    return ()=>{cancelled=true;script.remove();};
  },[siteKey,signupEnabled]);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!consent)return;
    setBusy(true);setStatus("");
    try{
      const res=await fetch("/api/interest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,consent,website:"",turnstileToken:token})});
      const data=await res.json() as {message?:string};
      if(!res.ok)throw Error(data.message||"Couldn't register your interest.");
      setOk(true);setStatus("Thank you — we've noted your interest.");
    }catch(err){setStatus(err instanceof Error?err.message:"Please try again later.");}
    finally{setBusy(false);}
  }
  return <div className="ff-landing">
    <header className="ff-top"><a className="ff-logo" href="/welcome">framefeed<span>.</span></a><nav><a href="#gallery">The gallery</a><a href="#interest">Join the list</a></nav></header>
    <main className="ff-main">
      <section className="ff-intro">
        <p className="ff-eyebrow">A NEW HOME FOR PHOTOGRAPHS</p>
        <h1>Your photographs deserve <em>a little wall space.</em></h1>
        <p className="ff-deck">A home for the moments worth keeping. Choose a frame, arrange your own gallery, and share your corner of the web. No algorithm deciding what belongs at the top.</p>
        <div className="ff-cta"><a className="ff-button" href="#interest">Get early access <span aria-hidden="true">↗</span></a><a className="ff-secondary" href="#gallery">Take a look around ↓</a></div>
      </section>
      <section id="gallery" className="ff-gallery" aria-label="Frame styles">
        <div className="ff-gallery-title"><span>THE LITTLE GALLERY</span><p>Pick a frame. Make it yours.</p></div>
        <div className="ff-artworks">
          {photos.map((photo,i)=><div className={"ff-artwork ff-artwork-"+photo.cls} key={photo.cls}>
            <div className={"ff-frame ff-frame-"+photo.cls}>
              <div className="ff-mount">
                <div className={"ff-art ff-art-"+i} role="img" aria-label={featuredPhotos[i] ? photo.title+" frame displaying a landscape photograph" : photo.alt}>{featuredPhotos[i] ? <img src={featuredPhotos[i]} alt="Curated landscape photograph" loading="lazy" /> : <span>YOUR LANDSCAPE HERE</span>}</div>
              </div>
            </div>
            <div className="ff-art-label"><b>{photo.title}</b><small>Change the look, whenever you like.</small></div>
          </div>)}
        </div>
        <p className="ff-gallery-foot">A preview of the frames. Featured photographs are selected by the gallery owner.</p>
      </section>
      <section className="ff-control" aria-labelledby="ff-control-title">
        <div className="ff-control-mark" aria-hidden="true">↕</div>
        <div><p className="ff-eyebrow">YOUR PHOTOS, YOUR ORDER</p><h2 id="ff-control-title">No algorithm. You're the curator.</h2><p>Nothing gets pushed up because it's popular. Arrange your posts exactly how you want them, and change the order whenever you like. Your gallery, your rules.</p></div>
      </section>
      <section id="interest" className="ff-interest">
        <div><p className="ff-eyebrow">BE FIRST THROUGH THE DOOR</p><h2>A gallery of your own is coming.</h2><p>We'll let you know when FrameFeed opens for new photographers. Just your email for now — no account or password needed.</p></div>
        <form className="ff-form" onSubmit={submit}>
          <label htmlFor="ff-email">Your email address</label>
          <div className="ff-inputline"><input id="ff-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" disabled={busy||ok||!signupEnabled}/><button type="submit" disabled={!consent||busy||ok||!signupEnabled||!token}>{busy?"Sending…":ok?"Thank you!":"Register interest"} <span aria-hidden="true">↗</span></button></div>
          {signupEnabled ? <div className="ff-captcha" ref={captchaRef} aria-label="Security verification"/> : <p className="ff-unavailable">The early list is being prepared. Registration will open soon.</p>}
          <label className="ff-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy||ok}/> I'd like to hear when FrameFeed opens. My email will only be used for launch updates.</label>
          <p className="ff-privacy">We won't sell your email or send unrelated marketing. You can request removal at any time. <a href="/welcome/privacy">Privacy details</a>.</p>
          <p className="ff-status" role="status" aria-live="polite">{status}</p>
        </form>
      </section>
    </main>
    <footer className="ff-foot"><span className="ff-logo">framefeed<span>.</span></span><p>Make a little space for the good stuff.</p><small>© {new Date().getFullYear()} FrameFeed · An independent photographic home</small></footer>
  </div>;
}
