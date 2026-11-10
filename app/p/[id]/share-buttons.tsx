'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';

export default function ShareButtons({url, caption, siteName}: {url: string; caption: string; siteName: string}) {
  const [copied, setCopied] = useState(false);
  const lead = (caption || `A moment from ${siteName}`).replace(/\s+/g, ' ').trim();
  const blueskyText = `${lead.slice(0, Math.max(0, 294 - url.length))} ${url}`.trim();
  const blueskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(blueskyText)}`;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({title: siteName, text: lead, url});
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copyLink();
    }
  }

  return <>
    <div className="sharebuttons">
      <button type="button" onClick={nativeShare}><Share2 size={15}/> Share</button>
      <button type="button" onClick={copyLink}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy link'}</button>
      <a className="bluesky" href={blueskyUrl} target="_blank" rel="noreferrer">Share on Bluesky</a>
    </div>
    <p className="sharehint">The photo preview will appear in Bluesky when this journal is public. Sharing never posts automatically. Bluesky opens a draft for you to confirm.</p>
  </>;
}
