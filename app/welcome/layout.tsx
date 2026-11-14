import type {Metadata} from "next";

export const metadata:Metadata={
  title:"FrameFeed — a calmer home for your photographs",
  description:"Build a personal photo journal, frame each photograph, curate a gallery and keep the order yours.",
  openGraph:{
    title:"FrameFeed — a calmer home for your photographs",
    description:"A personal photo journal with frames, galleries and no algorithm deciding what belongs at the top.",
  },
  twitter:{
    card:"summary",
    title:"FrameFeed — a calmer home for your photographs",
    description:"A personal photo journal with frames, galleries and no algorithm deciding what belongs at the top.",
  },
};

export default function WelcomeLayout({children}:{children:React.ReactNode}){
  return children;
}
