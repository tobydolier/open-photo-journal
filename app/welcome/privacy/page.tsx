import Link from "next/link";
export const metadata = {title:"Privacy · FrameFeed"};
export default function Privacy(){
  return <main style={{margin:"0 auto",maxWidth:700,padding:"50px 24px",fontFamily:"Arial,sans-serif",lineHeight:1.8,color:"#252a27"}}>
    <Link href="/welcome" style={{color:"#c7654d"}}>← FrameFeed</Link>
    <h1 style={{fontFamily:"Georgia,serif",fontSize:44,fontWeight:400}}>Your email, your choice.</h1>
    <p>The FrameFeed early-interest list asks for your email address and your explicit agreement to receive launch updates. This is not account registration.</p>
    <p>Your email and the time of your consent are kept in FrameFeed's Cloudflare D1 database and used only to contact you about access to the platform. We do not sell this information or use it for unrelated marketing.</p>
    <p>Before public registration opens, this notice will be completed with the operator's contact details, retention period and a clear process for withdrawing consent or requesting deletion. Early-interest registration is disabled until those details and spam protection are configured.</p>
  </main>;
}
