"use client";

import {useEffect,useRef,useState} from "react";
import type {CSSProperties,RefObject} from "react";
import {
  ArrowRight,
  Camera,
  Code2,
  Download,
  Grid3X3,
  Images,
  MapPin,
  Maximize2,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import "./landing.css";

type FeaturedPhoto={src:string;caption:string;postId:string;key:string};
type FrameStyle=""|"white"|"mahogany"|"ornate"|"black"|"pine";

const frameOptions:Array<{style:FrameStyle;name:string;shortName:string}>=[
  {style:"",name:"No frame",shortName:"None"},
  {style:"white",name:"Gallery white",shortName:"White"},
  {style:"mahogany",name:"Textured oak",shortName:"Oak"},
  {style:"ornate",name:"Ornate mahogany",shortName:"Ornate"},
  {style:"black",name:"Black box",shortName:"Black"},
  {style:"pine",name:"Natural pine",shortName:"Pine"},
];

const featureCards=[
  {icon:Camera,title:"Photos or camera",copy:"Choose from your photo library or open the native camera. Add up to 20 photographs to one post."},
  {icon:Download,title:"Bring your archive",copy:"Import an Instagram archive in batches, keeping dates, captions, carousels and any location included in the export."},
  {icon:Maximize2,title:"Frame every photograph",copy:"Choose from five current frames, view them full-screen, and let wooden frames borrow a muted colour from the image for the mount."},
  {icon:Images,title:"Curate a gallery",copy:"Choose up to nine photographs for a separate gallery room, replace one when it is full, and change their order whenever you like."},
  {icon:MapPin,title:"Location is optional",copy:"Add a place name or current position only when you choose. New photographs are re-encoded without embedded GPS data."},
  {icon:Grid3X3,title:"Make the journal yours",copy:"Edit the profile, crop and zoom its photograph, then share a calm feed, grid, gallery and permanent post pages."},
];

function FrameFeedLogo({compact=false}:{compact?:boolean}){
  return <span className={`ff-brand ${compact?"ff-brand-compact":""}`}>
    <svg viewBox="0 0 48 44" aria-hidden="true">
      <rect className="ff-logo-back" x="2.5" y="2.5" width="30" height="29" rx="6"/>
      <path className="ff-logo-picture-back" d="M8 25l6-6 5 5 5-7 5 6v4H8z"/>
      <circle className="ff-logo-picture-back" cx="24" cy="10" r="2.7"/>
      <rect className="ff-logo-front" x="14.5" y="11.5" width="30" height="29" rx="6"/>
      <path className="ff-logo-picture-front" d="M20 34l6-6 5 5 5-7 5 6v4H20z"/>
      <circle className="ff-logo-picture-front" cx="36" cy="19" r="2.7"/>
    </svg>
    <span>framefeed</span>
  </span>;
}

function DemoPhoto({photo,index=0,imageRef}:{photo:FeaturedPhoto|null;index?:number;imageRef?:RefObject<HTMLImageElement|null>}){
  if(photo)return <img ref={imageRef} src={photo.src} alt={photo.caption||"A photograph in a FrameFeed journal"} loading={index?"lazy":"eager"}/>;
  return <span className={`ff-sample-photo ff-sample-photo-${index%4}`} role="img" aria-label="Sample mountain landscape">
    <i className="ff-sample-sun"/><i className="ff-sample-ridge ff-sample-ridge-back"/><i className="ff-sample-ridge ff-sample-ridge-front"/>
  </span>;
}

function frameClass(style:FrameStyle,prefix:"photo"|"lightbox"="photo"){
  if(!style)return "ff-frame-unframed";
  return `${prefix}-frame-${style}${style==="ornate"?" frame-variant-1":""}`;
}

function LandingArtwork({photo,index,style}:{photo:FeaturedPhoto|null;index:number;style:Exclude<FrameStyle,"">}){
  const mountStyle={"--mahogany-mount":"#c9d2c8","--pine-mount":"#e5e0d5"} as CSSProperties;
  return <div className={`ff-gallery-art ff-gallery-art-${index+1}`}>
    <div className={`ff-gallery-frame ${frameClass(style)}`} style={mountStyle}>
      <div className="photo-open"><DemoPhoto photo={photo} index={index+1}/></div>
    </div>
    <span>{photo?.caption||["A favourite place","Light, kept","A quiet afternoon"][index]}</span>
  </div>;
}

export default function WelcomePage(){
  const[email,setEmail]=useState("");
  const[consent,setConsent]=useState(false);
  const[busy,setBusy]=useState(false);
  const[status,setStatus]=useState("");
  const[ok,setOk]=useState(false);
  const[signupEnabled,setSignupEnabled]=useState(false);
  const[siteKey,setSiteKey]=useState("");
  const[token,setToken]=useState("");
  const[featuredPhotos,setFeaturedPhotos]=useState<Array<FeaturedPhoto|null>>(Array(9).fill(null));
  const[demoFrame,setDemoFrame]=useState<FrameStyle>("ornate");
  const[viewerOpen,setViewerOpen]=useState(false);
  const captchaRef=useRef<HTMLDivElement>(null);
  const previewImageRef=useRef<HTMLImageElement>(null);
  const demoPhoto=featuredPhotos.find((photo):photo is FeaturedPhoto=>Boolean(photo))||null;
  const demoMountStyle={"--mahogany-mount":"#c9d2c8","--pine-mount":"#e5e0d5"} as CSSProperties;

  useEffect(()=>{
    fetch("/api/landing-photos").then(response=>response.json()).then((value:{photos:Array<FeaturedPhoto|null>})=>{
      const photos=Array.isArray(value.photos)?value.photos.slice(0,9):[];
      setFeaturedPhotos([...photos,...Array(Math.max(0,9-photos.length)).fill(null)]);
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    fetch("/api/interest").then(response=>response.json()).then((value:{enabled:boolean,siteKey:string})=>{
      setSignupEnabled(value.enabled);setSiteKey(value.siteKey);
    }).catch(()=>setSignupEnabled(false));
  },[]);

  useEffect(()=>{
    if(!siteKey||!signupEnabled)return;
    let cancelled=false;
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;
    script.onload=()=>{
      if(cancelled||!captchaRef.current)return;
      const turnstile=(window as Window&{turnstile?:{render:(target:HTMLElement,options:{sitekey:string,callback:(value:string)=>void,"expired-callback":()=>void})=>unknown}}).turnstile;
      turnstile?.render(captchaRef.current,{sitekey:siteKey,callback:setToken,"expired-callback":()=>setToken("")});
    };
    document.head.appendChild(script);
    return()=>{cancelled=true;script.remove();};
  },[siteKey,signupEnabled]);

  useEffect(()=>{
    if(!viewerOpen)return;
    const previous=document.body.style.overflow;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setViewerOpen(false);};
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};
  },[viewerOpen]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!consent)return;
    setBusy(true);setStatus("");
    try{
      const response=await fetch("/api/interest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,consent,website:"",turnstileToken:token})});
      const data=await response.json() as{message?:string};
      if(!response.ok)throw Error(data.message||"Couldn't register your interest.");
      setOk(true);setStatus("Thank you — we've noted your interest.");
    }catch(error){setStatus(error instanceof Error?error.message:"Please try again later.");}
    finally{setBusy(false);}
  }

  return <div className="ff-landing">
    <header className="ff-top">
      <a className="ff-logo-link" href="/welcome" aria-label="FrameFeed home"><FrameFeedLogo/></a>
      <nav aria-label="Landing page">
        <a href="#frames">Frames</a><a href="#gallery">Gallery</a><a href="#features">What it does</a><a href="#open-source">Open source</a>
      </nav>
      <a className="ff-nav-cta" href="#interest">Join the early list <ArrowRight size={14}/></a>
    </header>

    <main className="ff-main">
      <section className="ff-hero">
        <div className="ff-hero-copy">
          <p className="ff-eyebrow">A CALMER HOME FOR YOUR PHOTOGRAPHS</p>
          <h1>Your photographs,<br/><em>framed for keeps.</em></h1>
          <p className="ff-deck">Build a personal photo journal from the pictures you take now and the archive you already have. Choose the frame, shape the gallery, and keep the order yours.</p>
          <div className="ff-hero-actions">
            <a className="ff-button" href="#interest">Join the early list <ArrowRight size={16}/></a>
            <a className="ff-text-link" href="https://toby.framefeed.co.uk/" target="_blank" rel="noreferrer">View a live journal <span aria-hidden="true">↗</span></a>
          </div>
          <p className="ff-hero-note">No algorithm. No public like counts. No suggested posts.</p>
        </div>

        <div className="ff-frame-lab" id="frames">
          <div className="ff-lab-head"><div><span>LIVE PREVIEW</span><b>{frameOptions.find(option=>option.style===demoFrame)?.name}</b></div><button type="button" onClick={()=>setViewerOpen(true)}><Maximize2 size={14}/> Full screen</button></div>
          <div className="ff-demo-stage">
            <div className={`ff-demo-frame ${frameClass(demoFrame)}`} style={demoMountStyle}>
              <div className="photo-open"><DemoPhoto photo={demoPhoto} imageRef={previewImageRef}/></div>
            </div>
          </div>
          <div className="ff-frame-picker" role="group" aria-label="Preview a frame style">
            {frameOptions.map(option=><button type="button" key={option.name} className={demoFrame===option.style?"chosen":""} aria-pressed={demoFrame===option.style} onClick={()=>setDemoFrame(option.style)}><i className={`ff-frame-swatch ff-frame-swatch-${option.style||"none"}`}/><span>{option.shortName}</span></button>)}
          </div>
          <p className="ff-lab-note">Frames change the presentation, never the photograph.</p>
        </div>
      </section>

      <section className="ff-quickline" aria-label="Ways to add photographs">
        <span><Smartphone size={17}/> Choose from Photos</span><span><Camera size={17}/> Take a photograph</span><span><Upload size={17}/> Import your archive</span><span><MapPin size={17}/> Add a location if you want</span>
      </section>

      <section className="ff-gallery-section" id="gallery">
        <div className="ff-section-copy">
          <p className="ff-eyebrow">THE GALLERY</p>
          <h2>Nine favourites.<br/><em>Your own room.</em></h2>
          <p>Pick photographs from the journal and they appear together in a separate gallery. Add until it is full, choose which one to replace next, then rearrange the walls whenever the mood changes.</p>
          <ul><li>The feed frame comes with the photograph</li><li>Mount colours are preserved in the gallery</li><li>Open any work full-screen</li></ul>
        </div>
        <div className="ff-room" aria-label="A preview of the FrameFeed gallery room">
          <div className="ff-room-light ff-room-light-1"/><div className="ff-room-light ff-room-light-2"/><div className="ff-room-light ff-room-light-3"/>
          <div className="ff-picture-rail"/>
          <div className="ff-room-artworks">
            <LandingArtwork photo={featuredPhotos[0]} index={0} style="ornate"/>
            <LandingArtwork photo={featuredPhotos[1]} index={1} style="white"/>
            <LandingArtwork photo={featuredPhotos[2]} index={2} style="pine"/>
          </div>
          <div className="ff-room-floor"/>
          <span className="ff-room-hint"><Images size={13}/> Gallery photographs can be reordered</span>
        </div>
      </section>

      <section className="ff-features" id="features">
        <div className="ff-section-heading"><p className="ff-eyebrow">THE WHOLE JOURNAL</p><h2>From camera roll to a place of your own.</h2><p>Everything below is already part of the current FrameFeed journal.</p></div>
        <div className="ff-feature-grid">
          {featureCards.map(({icon:Icon,title,copy},index)=><article key={title}><span className="ff-feature-number">0{index+1}</span><Icon size={22}/><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="ff-open-source" id="open-source">
        <div className="ff-open-visual" aria-label="Copy the template, make it yours, and publish your own journal">
          <div className="ff-template-card" aria-hidden="true">
            <span>OPEN PHOTO JOURNAL</span>
            <div className="ff-template-ui"><i/><i/><i/><b/></div>
            <small>A complete, empty journal</small>
          </div>
          <ol className="ff-open-steps">
            <li><b>01</b><span><strong>Copy the template</strong>Start with the complete FrameFeed journal.</span></li>
            <li><b>02</b><span><strong>Make it yours</strong>Add your name, identity and photographs.</span></li>
            <li><b>03</b><span><strong>Publish independently</strong>Use your own address and hosting.</span></li>
          </ol>
          <div className="ff-license-badge"><b>MIT</b><span>Use · change · share</span></div>
        </div>
        <div>
          <p className="ff-eyebrow">OPEN BY DESIGN</p>
          <h2>Built to be copied.</h2>
          <p>FrameFeed’s journal template is open source, self-hostable and MIT licensed. Anyone can clone the code, replace the branding, and make a version for their own album.</p>
          <p className="ff-fine-print">The repository contains the application and empty data structure—not anyone’s photographs, account data or secrets. The current version stores compressed display copies; your originals stay wherever you already keep them.</p>
          <a className="ff-source-link" href="https://github.com/tobydolier/open-photo-journal" target="_blank" rel="noreferrer"><Code2 size={18}/> View the source on GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section id="interest" className="ff-interest">
        <div className="ff-interest-copy"><p className="ff-eyebrow">A GALLERY OF YOUR OWN</p><h2>Make room for the photographs worth keeping.</h2><p>Join the early list and we’ll let you know when FrameFeed opens for new photographers. Just your email for now—no account or password needed.</p></div>
        <form className="ff-form" onSubmit={submit}>
          <label htmlFor="ff-email">Your email address</label>
          <div className="ff-inputline"><input id="ff-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" disabled={busy||ok||!signupEnabled}/><button type="submit" disabled={!consent||busy||ok||!signupEnabled||!token}>{busy?"Sending…":ok?"Thank you!":"Register interest"} <ArrowRight size={15}/></button></div>
          {signupEnabled?<div className="ff-captcha" ref={captchaRef} aria-label="Security verification"/>:<p className="ff-unavailable">The early list is being prepared. Registration will open soon.</p>}
          <label className="ff-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy||ok}/> <span>I’d like to hear when FrameFeed opens. My email will only be used for launch updates.</span></label>
          <p className="ff-privacy">We won’t sell your email or send unrelated marketing. You can request removal at any time. <a href="/welcome/privacy">Privacy details</a>.</p>
          <p className="ff-status" role="status" aria-live="polite">{status}</p>
        </form>
      </section>
    </main>

    <footer className="ff-foot">
      <a className="ff-logo-link" href="/welcome"><FrameFeedLogo compact/></a>
      <p>Make a little space for the good stuff.</p>
      <div><a href="https://toby.framefeed.co.uk/" target="_blank" rel="noreferrer">Live journal</a><a href="https://github.com/tobydolier/open-photo-journal" target="_blank" rel="noreferrer">Source</a><a href="/welcome/privacy">Privacy</a><small>© {new Date().getFullYear()} FrameFeed</small></div>
    </footer>

    {viewerOpen&&<div className="ff-viewer" role="dialog" aria-modal="true" aria-label={`${frameOptions.find(option=>option.style===demoFrame)?.name} frame in full screen`} onMouseDown={event=>{if(event.target===event.currentTarget)setViewerOpen(false);}}>
      <button className="ff-viewer-close" type="button" aria-label="Close full-screen preview" onClick={()=>setViewerOpen(false)}><X size={20}/></button>
      <div className={`ff-viewer-frame ${frameClass(demoFrame,"lightbox")}`} style={demoMountStyle}><div className="lightbox-mount"><DemoPhoto photo={demoPhoto}/></div></div>
      <span className="ff-viewer-label">{frameOptions.find(option=>option.style===demoFrame)?.name}</span>
    </div>}
  </div>;
}
