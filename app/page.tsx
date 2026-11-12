'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Grid3X3,
  Heart,
  Home,
  ImagePlus,
  Lock,
  LogIn,
  LogOut,
  Maximize2,
  PlusSquare,
  Search,
  Settings,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { PublicSiteConfig } from '../lib/site-config';

type Post = {
  id: string;
  caption: string;
  date: string;
  source: string;
  media: string[];
  bytes: number;
  favorite: number;
};

type FeaturedPhoto = { slot: number; postId: string; key: string; src: string; caption: string };
type FrameStyle = '' | 'white' | 'mahogany' | 'black';
type PhotoFrame = { postId: string; key: string; style: Exclude<FrameStyle, ''> };

type ArchivePost = { id?: string; caption: string; date: string; paths: string[] };
type JsonMedia = { uri?: string; title?: string; creation_timestamp?: number };
type JsonPost = { media?: JsonMedia[]; title?: string; creation_timestamp?: number };
type FrameFeedPost = { id?: string; caption?: string; date?: string; media?: string[] };

const defaultConfig: PublicSiteConfig = {
  siteName: 'Open Photo Journal',
  siteDescription: 'A personal, self-hosted photo journal.',
  profileName: 'Photo journal owner',
  profileHandle: 'photographer',
  profileBio: 'Little moments. Big memories.',
  profileInitial: 'p',
  eyebrow: 'PERSONAL PHOTO JOURNAL',
  visibilityLabel: 'Photo journal',
  locale: 'en-GB',
  storageLimitBytes: 8_000_000_000,
  wordmarkImageUrl: '',
  profileImageUrl: '',
  faviconUrl: '',
  shareImageUrl: '',
  isAdmin: false,
  passwordLoginEnabled: false,
};

type EditableProfile = Pick<PublicSiteConfig,
  'siteName' | 'siteDescription' | 'profileName' | 'profileHandle' |
  'profileBio' | 'eyebrow' | 'visibilityLabel'
>;

function editableProfile(config: PublicSiteConfig): EditableProfile {
  return {
    siteName: config.siteName,
    siteDescription: config.siteDescription,
    profileName: config.profileName,
    profileHandle: config.profileHandle,
    profileBio: config.profileBio,
    eyebrow: config.eyebrow,
    visibilityLabel: config.visibilityLabel,
  };
}

const imageFile = /\.(?:jpe?g|png|webp)$/i;

function cleanPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^(?:\.\.\/|\.\/)+/, '').replace(/^\/+/, '');
}

function indexArchiveFiles(files: File[]) {
  const byPath = new Map<string, File>();
  for (const file of files) {
    const path = cleanPath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    const parts = path.split('/');
    for (let index = 0; index < parts.length; index++) {
      const alias = parts.slice(index).join('/');
      if (!byPath.has(alias)) byPath.set(alias, file);
    }
  }
  return byPath;
}

function parseInstagramDate(value: string) {
  const match = value.trim().match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) ([ap])m$/i);
  if (!match) return null;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  let hour = Number(match[4]) % 12;
  if (match[6].toLowerCase() === 'p') hour += 12;
  const date = new Date(Number(match[3]), month, Number(match[2]), hour, Number(match[5]));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseHtmlPosts(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('main ._a6-g')).flatMap(block => {
    const paths = Array.from(block.querySelectorAll('a[href],img[src],video[src]'))
      .map(node => cleanPath(node.getAttribute('href') || node.getAttribute('src') || ''))
      .filter(path => path.startsWith('media/posts/'));
    const date = parseInstagramDate(block.querySelector('._3-94._a6-o')?.textContent || '');
    if (!paths.length || !date) return [];
    return [{
      caption: block.querySelector('h2')?.textContent?.trim() || '',
      date,
      paths: [...new Set(paths)],
    }];
  });
}

async function archiveId(paths: string[]) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(paths)));
  return `ig_${Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function compress(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(Error('Could not process image')),
      'image/webp',
      0.84,
    );
  });
}

function ProfileAvatar({ config, size = '' }: { config: PublicSiteConfig; size?: 'small' | 'large' | '' }) {
  return <div className={`avatar ${size}`.trim()}>
    {config.profileImageUrl
      ? <img src={config.profileImageUrl} alt="" aria-hidden="true"/>
      : config.profileInitial}
  </div>;
}

function mutedDominantColour(image: HTMLImageElement) {
  try {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !image.naturalWidth || !image.naturalHeight) return '';

    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.clearRect(0, 0, size, size);
    context.drawImage(image, Math.floor((size - width) / 2), Math.floor((size - height) / 2), width, height);

    const pixels = context.getImageData(0, 0, size, size).data;
    const buckets = new Map<number, { count: number; red: number; green: number; blue: number }>();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 200) continue;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
      const bucket = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
      bucket.count++;
      bucket.red += red;
      bucket.green += green;
      bucket.blue += blue;
      buckets.set(key, bucket);
    }

    const candidates = Array.from(buckets.values()).map(bucket => {
      const red = bucket.red / bucket.count / 255;
      const green = bucket.green / bucket.count / 255;
      const blue = bucket.blue / bucket.count / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const delta = maximum - minimum;
      const lightness = (maximum + minimum) / 2;
      const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
      return { ...bucket, red, green, blue, maximum, delta, lightness, saturation };
    });
    const colourful = candidates.filter(colour => colour.saturation >= 0.12 && colour.lightness >= 0.12 && colour.lightness <= 0.9);
    const pool = colourful.length ? colourful : candidates;
    const dominant = pool.sort((left, right) => (
      right.count * (0.7 + right.saturation) - left.count * (0.7 + left.saturation)
    ))[0];
    if (!dominant) return '';

    let hue = 0;
    if (dominant.delta) {
      if (dominant.maximum === dominant.red) hue = ((dominant.green - dominant.blue) / dominant.delta) % 6;
      else if (dominant.maximum === dominant.green) hue = (dominant.blue - dominant.red) / dominant.delta + 2;
      else hue = (dominant.red - dominant.green) / dominant.delta + 4;
      hue = (hue * 60 + 360) % 360;
    }
    const mutedSaturation = colourful.length
      ? Math.round(Math.min(36, Math.max(18, dominant.saturation * 55)))
      : 0;
    const mountLightness = Math.round(Math.min(84, Math.max(70, dominant.lightness * 100 + 25)));
    return `hsl(${Math.round(hue)} ${mutedSaturation}% ${mountLightness}%)`;
  } catch {
    return '';
  }
}

function Photo({
  post, siteName, isAdmin, photoFrames, onOpen, onFrame, onFeature,
}: {
  post: Post;
  siteName: string;
  isAdmin: boolean;
  photoFrames: PhotoFrame[];
  onOpen: (post: Post, mediaIndex: number) => void;
  onFrame: (post: Post, mediaKey: string, style: FrameStyle) => Promise<boolean>;
  onFeature: (post: Post, mediaKey: string, slot: number) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [savingFrame, setSavingFrame] = useState(false);
  const [frameError, setFrameError] = useState(false);
  const [mountColour, setMountColour] = useState('');
  const imageElement = useRef<HTMLImageElement>(null);
  const src = `/api/media/${encodeURIComponent(post.media[index])}`;
  useEffect(() => {
    setMountColour('');
    const image = imageElement.current;
    if (image?.complete && image.naturalWidth) setMountColour(mutedDominantColour(image));
  }, [src]);
  const frameStyle: FrameStyle = photoFrames.find(frame => frame.postId === post.id && frame.key === post.media[index])?.style || '';
  const mountStyle = mountColour ? ({ '--mahogany-mount': mountColour } as CSSProperties) : undefined;
  return <div className="photo-block">
    <div className={`photo ${frameStyle ? `photo-framed photo-frame-${frameStyle}` : ''}`} style={mountStyle}>
    <button className="photo-open" aria-label="Open photo full screen" onClick={() => onOpen(post, index)}>
      <img ref={imageElement} src={src} alt={post.caption || `Photo from ${siteName}`} loading="lazy" decoding="async" onLoad={event => setMountColour(mutedDominantColour(event.currentTarget))}/>
      <span className="expand"><Maximize2 size={16}/> Full screen</span>
    </button>
    {post.media.length > 1 && <>
      <span className="count">{index + 1}/{post.media.length}</span>
      <button className="prev" aria-label="Previous photo" onClick={() => setIndex((index + post.media.length - 1) % post.media.length)}><ChevronLeft size={18}/></button>
      <button className="next" aria-label="Next photo" onClick={() => setIndex((index + 1) % post.media.length)}><ChevronRight size={18}/></button>
      <div className="dots">{post.media.map((_, item) => <i key={item} className={item === index ? 'active' : ''}/>)}</div>
    </>}
    </div>
    {isAdmin && <div className="photo-owner-controls">
      <label className={`feature-photo-control ${frameError ? 'frame-save-error' : ''}`}>
        <span aria-live="polite">{savingFrame ? 'Saving…' : frameError ? 'Couldn’t save' : 'Frame style'}</span>
        <select key={`style:${post.id}:${index}`} value={frameStyle} disabled={savingFrame} aria-label="Choose photo frame" onChange={async event => {
          setSavingFrame(true);
          setFrameError(false);
          const saved = await onFrame(post, post.media[index], event.target.value as FrameStyle);
          setFrameError(!saved);
          setSavingFrame(false);
        }}>
          <option value="">No frame</option>
          <option value="white">Gallery white</option>
          <option value="mahogany">Carved mahogany</option>
          <option value="black">Black box</option>
        </select>
      </label>
      <label className="feature-photo-control landing-feature-control">Feature on landing
        <select key={`landing:${post.id}:${index}`} defaultValue="" aria-label="Choose landing-page frame" onChange={event => {
          const slot=Number(event.target.value);
          if(event.target.value !== '') void onFeature(post,post.media[index],slot);
          event.target.value='';
        }}>
          <option value="">Choose slot…</option>
          <option value="0">Gallery white</option>
          <option value="1">Carved mahogany</option>
          <option value="2">Black box</option>
        </select>
      </label>
    </div>}
  </div>;
}

export default function Page() {
  const [config, setConfig] = useState<PublicSiteConfig>(defaultConfig);
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState('feed');
  const [modal, setModal] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [photoFrames, setPhotoFrames] = useState<PhotoFrame[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerMountColour, setViewerMountColour] = useState('');
  const [reordering, setReordering] = useState(false);
  const [profileDraft, setProfileDraft] = useState<EditableProfile>(() => editableProfile(defaultConfig));
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const folder = useRef<HTMLInputElement>(null);
  const archiveFiles = useRef<HTMLInputElement>(null);

  async function load() {
    const [postsResponse, configResponse, framesResponse] = await Promise.all([
      fetch('/api/posts'),
      fetch('/api/config', { cache: 'no-store' }),
      fetch('/api/photo-frames', { cache: 'no-store' }),
    ]);
    if (!postsResponse.ok) throw Error('Could not load the photos. Please refresh.');
    if (!configResponse.ok) throw Error('Could not load the journal settings. Please refresh.');
    setPosts(await postsResponse.json());
    setConfig(await configResponse.json());
    if (framesResponse.ok) {
      const data = await framesResponse.json() as { frames?: PhotoFrame[] };
      setPhotoFrames(data.frames || []);
    }
  }

  useEffect(() => {
    load().catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  async function upload(id: string, postCaption: string, postDate: string, source: string, photos: File[]) {
    const form = new FormData();
    form.set('id', id);
    form.set('caption', postCaption);
    form.set('date', postDate);
    form.set('source', source);
    for (const file of photos) form.append('photos', await compress(file), 'photo.webp');
    const response = await fetch('/api/posts', { method: 'POST', body: form });
    if (!response.ok) throw Error(await response.text());
    return response.json() as Promise<{ duplicate?: boolean; ok?: boolean }>;
  }

  async function publish() {
    setBusy(true);
    setStatus('Preparing your photos…');
    try {
      await upload(crypto.randomUUID(), caption, new Date(date).toISOString(), 'native', files);
      await load();
      setModal('');
      setFiles([]);
      setCaption('');
      setStatus('Photo added to your journal.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function importArchive(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    let added = 0;
    let duplicates = 0;
    let skipped = 0;
    try {
      const archiveFiles = Array.from(list);
      const byPath = indexArchiveFiles(archiveFiles);
      const htmls = archiveFiles.filter(file => /^posts(?:_\d+)?\.html$/i.test(file.name));
      const jsons = archiveFiles.filter(file => /^posts(?:_\d+)?\.json$/i.test(file.name));
      if (!htmls.length && !jsons.length) throw Error('No Instagram posts HTML or JSON file was found. Select the whole extracted export folder.');

      const rows: ArchivePost[] = [];
      for (const file of htmls) rows.push(...parseHtmlPosts(await file.text()));
      for (const file of jsons) {
        const data = JSON.parse(await file.text()) as JsonPost[] | { ig_posts?: JsonPost[]; framefeed_posts?: FrameFeedPost[] };
        if (!Array.isArray(data) && Array.isArray(data.framefeed_posts)) {
          for (const row of data.framefeed_posts) {
            const paths = (row.media || []).map(cleanPath);
            if (!row.id || !row.date || !paths.length) {
              skipped++;
              continue;
            }
            rows.push({ id: row.id, caption: row.caption || '', date: row.date, paths });
          }
          continue;
        }
        const items = Array.isArray(data) ? data : data.ig_posts || [];
        for (const row of items) {
          const media = row.media || [];
          const timestamp = row.creation_timestamp || media[0]?.creation_timestamp;
          if (!media.length || !timestamp) {
            skipped++;
            continue;
          }
          let title = media.find(item => item.title)?.title || row.title || '';
          try { title = decodeURIComponent(escape(title)); } catch {}
          rows.push({ caption: title, date: new Date(timestamp * 1000).toISOString(), paths: media.map(item => cleanPath(item.uri || '')) });
        }
      }

      const seen = new Set<string>();
      const existingIds = new Set(posts.map(post => post.id));
      for (const row of rows) {
        const signature = JSON.stringify(row.paths);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const images = row.paths.map(path => byPath.get(path) || byPath.get(path.split('/').pop() || ''));
        if (!row.paths.length || row.paths.length > 20 || row.paths.some(path => !imageFile.test(path)) || images.some(file => !file)) {
          skipped++;
          continue;
        }
        const id = row.id || await archiveId(row.paths);
        if (existingIds.has(id)) {
          duplicates++;
          continue;
        }
        setStatus(`Importing ${added + duplicates + 1} of ${rows.length} posts…`);
        const result = await upload(id, row.caption, row.date, 'instagram', images as File[]);
        if (result.duplicate) duplicates++;
        else {
          added++;
          existingIds.add(id);
        }
      }
      await load();
      setStatus(`Import complete: ${added} added, ${duplicates} already imported, ${skipped} skipped (missing/unsupported media).`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus(`Import paused: ${message} ${added} saved; select the folder again to resume.`);
    } finally {
      setBusy(false);
      if (folder.current) folder.current.value = '';
      if (archiveFiles.current) archiveFiles.current.value = '';
    }
  }

  function openProfileSettings() {
    setProfileDraft(editableProfile(config));
    setProfilePhoto(null);
    setStatus('');
    setModal('settings');
  }

  async function saveProfileSettings() {
    setBusy(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileDraft),
      });
      if (!response.ok) throw Error(await response.text() || 'Could not save profile settings');
      if (profilePhoto) {
        const form = new FormData();
        form.set('photo', await compress(profilePhoto), 'profile.webp');
        const photoResponse = await fetch('/api/settings', { method: 'POST', body: form });
        if (!photoResponse.ok) throw Error(await photoResponse.text() || 'Could not save profile photo');
      }
      await load();
      setModal('');
      setProfilePhoto(null);
      setStatus('Profile settings saved.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function clearProfilePhoto() {
    setBusy(true);
    try {
      const response = await fetch('/api/settings', { method: 'DELETE' });
      if (!response.ok) throw Error(await response.text() || 'Could not remove profile photo');
      setProfilePhoto(null);
      await load();
      setStatus('Profile photo removed.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function favorite(post: Post) {
    try {
      const response = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, favorite: !post.favorite }),
      });
      if (!response.ok) throw Error(await response.text() || 'Could not save favourite');
      await load();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function movePost(id: string, change: number) {
    if (!config.isAdmin || search || busy) return;
    const oldIndex = posts.findIndex(post => post.id === id);
    const newIndex = oldIndex + change;
    if (oldIndex < 0 || newIndex < 0 || newIndex >= posts.length) return;
    const reordered = [...posts];
    [reordered[oldIndex], reordered[newIndex]] = [reordered[newIndex], reordered[oldIndex]];
    setBusy(true);
    setPosts(reordered);
    try {
      const response = await fetch('/api/posts/order', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ids: reordered.map(post => post.id)}),
      });
      if (!response.ok) throw Error(await response.text() || 'Could not save order');
      setStatus('Gallery order saved.');
    } catch (cause) {
      setPosts(posts);
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function setPhotoFrame(post: Post, mediaKey: string, style: FrameStyle) {
    try {
      const response = await fetch('/api/photo-frames', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, mediaKey, style }),
      });
      if (!response.ok) throw Error(await response.text() || 'Could not save frame');
      await load();
      const frameName = style ? ({ white: 'Gallery white', mahogany: 'Carved mahogany', black: 'Black box' } as const)[style] : 'No frame';
      setStatus(`${frameName} saved for this photograph.`);
      return true;
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
      return false;
    }
  }

  async function featurePhoto(post:Post, mediaKey:string, slot:number) {
    if(!config.isAdmin || busy)return;
    setBusy(true);
    try {
      const response=await fetch('/api/landing-photos',{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({slot,postId:post.id,mediaKey})
      });
      if(!response.ok)throw Error(await response.text());
      setStatus(`Featured photograph saved to homepage frame ${slot + 1}.`);
    }catch(cause){setStatus(cause instanceof Error?cause.message:String(cause));}
    finally{setBusy(false);}
  }

  async function remove(post: Post) {
    if (!confirm(`Delete this post from ${config.siteName}? Your original photograph is unaffected.`)) return;
    try {
      const response = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      if (!response.ok) throw Error(await response.text() || 'Delete failed');
      setViewerIndex(null);
      await load();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function login() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw Error(await response.text());
      setPassword('');
      setModal('');
      await load();
      setStatus('Owner controls unlocked.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setView('feed');
    setStatus('');
    await load();
  }

  const visible = posts.filter(post => (
    (view !== 'saved' || post.favorite) && `${post.caption} ${post.date}`.toLowerCase().includes(search.toLowerCase())
  ));
  const used = posts.reduce((total, post) => total + post.bytes, 0);
  const dateFormat = (value: string) => new Date(value).toLocaleDateString(config.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const photoItems = posts.flatMap(post => post.media.map((key, mediaIndex) => ({ post, key, mediaIndex })));
  const openPhoto = (post: Post, mediaIndex: number) => {
    const index = photoItems.findIndex(item => item.post.id === post.id && item.mediaIndex === mediaIndex);
    if (index >= 0) setViewerIndex(index);
  };
  const viewer = viewerIndex === null ? null : photoItems[viewerIndex];
  const viewerFrameStyle: FrameStyle = viewer
    ? photoFrames.find(frame => frame.postId === viewer.post.id && frame.key === viewer.key)?.style || ''
    : '';
  useEffect(() => setViewerMountColour(''), [viewer?.key]);
  const viewerMountStyle = viewerMountColour ? ({ '--mahogany-mount': viewerMountColour } as CSSProperties) : undefined;


  const postCard = (post: Post) => <article key={post.id}>
    <div className="posthead">
      <ProfileAvatar config={config} size="small"/>
      <div><b>{config.profileHandle}</b><small>{dateFormat(post.date)}</small></div>
      {post.source === 'instagram' && <span className="badge">↗ From Instagram</span>}
    </div>
    <Photo post={post} siteName={config.siteName} isAdmin={config.isAdmin} photoFrames={photoFrames} onOpen={openPhoto} onFrame={setPhotoFrame} onFeature={featurePhoto}/>
    <div className="postbody">
      <div className="actions">
        {config.isAdmin && <button aria-label="Favourite" onClick={() => favorite(post)}><Heart fill={post.favorite ? '#ed476b' : 'none'} color={post.favorite ? '#ed476b' : 'currentColor'}/></button>}
        <a className="sharelink" href={`/p/${encodeURIComponent(post.id)}`} aria-label="Open shareable post" title="Share post"><Share2 size={18}/></a>
        {config.isAdmin && reordering && !search && <span className="order-actions">
          <button type="button" aria-label="Move post up" title="Move post up" disabled={busy || posts[0]?.id === post.id} onClick={() => movePost(post.id,-1)}>↑</button>
          <button type="button" aria-label="Move post down" title="Move post down" disabled={busy || posts[posts.length-1]?.id === post.id} onClick={() => movePost(post.id,1)}>↓</button>
        </span>}
        {config.isAdmin && <span className="onlyyou"><Lock size={12}/> Owner controls</span>}
        {config.isAdmin && <button className="delete" aria-label="Delete post" onClick={() => remove(post)}><Trash2 size={17}/></button>}
      </div>
      <p><b>{config.profileHandle}</b> {post.caption || 'A moment worth keeping.'}</p>
      {post.source === 'instagram' && <small className="origin">Previously hosted on Instagram · original posting date preserved</small>}
    </div>
  </article>;

  return <>
    <aside>
      <a className="wordmark" href="/">
        {config.wordmarkImageUrl
          ? <img className="wordmark-image" src={config.wordmarkImageUrl} alt={config.siteName}/>
          : <>{config.siteName}<span>•</span></>}
      </a>
      <nav>
        <button className={view === 'feed' ? 'chosen' : ''} onClick={() => { setView('feed'); setViewerIndex(null); }}><Home size={23}/>Home</button>
        <button className={view === 'grid' ? 'chosen' : ''} onClick={() => { setView('grid'); setViewerIndex(null); }}><Grid3X3 size={23}/>Photos</button>
        {config.isAdmin && <button className={view === 'saved' ? 'chosen' : ''} onClick={() => { setView('saved'); setViewerIndex(null); }}><Heart size={23}/>Favourites</button>}
        {config.isAdmin && <button onClick={() => setModal('create')}><PlusSquare size={23}/>Create</button>}
        {config.isAdmin && <button onClick={() => setModal('import')}><Download size={23}/>Import Instagram</button>}
        {config.isAdmin && <button onClick={openProfileSettings}><Settings size={23}/>Profile settings</button>}
      </nav>
      <div className="asidebottom">
        <div className="privacy"><Lock size={15}/><div><b>{config.visibilityLabel}</b><small>{config.siteDescription}</small></div></div>
        {config.isAdmin && <div className="storage">
          <span>Photo storage <b>{(used / 1e9).toFixed(2)} / {(config.storageLimitBytes / 1e9).toFixed(0)} GB</b></span>
          <div><i style={{ width: `${Math.max(1, used / config.storageLimitBytes * 100)}%` }}/></div>
          <small>Configurable upload safety limit · compressed photos</small>
        </div>}
        <div className="account">
          <ProfileAvatar config={config}/>
          <div><b>{config.profileName}</b><small>@{config.profileHandle}</small></div>
          {config.isAdmin && config.passwordLoginEnabled
            ? <button aria-label="Sign out" onClick={logout}><LogOut size={16}/></button>
            : <Check size={16}/>}
        </div>
      </div>
    </aside>

    <main>
      <header>
        <div><span className="eyebrow">{config.eyebrow}</span><h1>{view === 'grid' ? 'Photos' : view === 'saved' ? 'Favourites' : 'Moments, all together.'}</h1></div>
        {config.isAdmin && <button className="primary" onClick={() => setModal('create')}><PlusSquare size={17}/> New post</button>}
      </header>
      <div className="profile">
        <ProfileAvatar config={config} size="large"/>
        <div>
          <div className="profilename">{config.profileHandle} <span><Lock size={12}/>{config.visibilityLabel}</span></div>
          <p>{config.profileBio}</p>
          <div className="stats">
            <b>{posts.length}</b> posts <span>·</span>
            <b>{posts.filter(post => post.source === 'instagram').length}</b> from Instagram
            {config.isAdmin && <><span>·</span> <b>{posts.filter(post => post.favorite).length}</b> favourites</>}
          </div>
        </div>
      </div>
      <div className="toolbar">
        <div>
          <button className={view === 'feed' ? 'on' : ''} onClick={() => setView('feed')}><Home size={16}/> Feed</button>
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><Grid3X3 size={16}/> Grid</button>
        </div>
        <div className="toolbar-right">
          {config.isAdmin && <button className={reordering ? 'on order-toggle' : 'order-toggle'} type="button" aria-pressed={reordering} onClick={() => {setReordering(!reordering);setView('feed');setSearch('');}}>{reordering ? 'Done ordering' : 'Arrange posts'}</button>}
        <label><Search size={16}/><input placeholder="Find a memory…" value={search} onChange={event => setSearch(event.target.value)}/></label>
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      {status && <div className="notice" role="status">{status}<button aria-label="Dismiss" onClick={() => setStatus('')} disabled={busy}><X size={14}/></button></div>}
      <section className={view === 'grid' ? 'grid' : 'feed'}>
        {visible.length
          ? view === 'grid'
            ? visible.map(post => <button className="tile" key={post.id} onClick={() => openPhoto(post, 0)}>
              <img src={`/api/media/${encodeURIComponent(post.media[0])}`} alt={post.caption || 'View photo'} loading="lazy" decoding="async"/>
              {post.source === 'instagram' && <span>↗</span>}
              {post.media.length > 1 && <b>{post.media.length} photos</b>}
            </button>)
            : visible.map(postCard)
          : <div className="empty">
            <div className="camera"><Camera size={37}/></div>
            <span className="eyebrow">{config.isAdmin ? 'MAKE YOURSELF AT HOME' : config.eyebrow}</span>
            <h2>{search ? 'No matching memories' : view === 'saved' ? 'Keep your favourites close.' : 'Every photo has a story.'}</h2>
            <p>{search ? 'Try another caption or date.' : view === 'saved' ? 'Tap the heart on a post to keep it here.' : config.isAdmin ? 'Bring an Instagram archive with you, or start with a new moment.' : 'There are no photographs here yet.'}</p>
            {!search && view !== 'saved' && config.isAdmin && <>
              <button className="primary" onClick={() => setModal('import')}><Download size={17}/> Import an Instagram archive</button>
              <button className="textbutton" onClick={() => setModal('create')}>or add your first photo →</button>
            </>}
            <div className="emptyfoot"><Lock size={12}/> No algorithm. Just photographs.</div>
          </div>}
      </section>
      <footer>
        {config.siteName}
        <span>
          Powered by Open Photo Journal
          {!config.isAdmin && config.passwordLoginEnabled && <button className="ownerlogin" onClick={() => setModal('login')}><LogIn size={11}/>Owner sign in</button>}
        </span>
      </footer>
    </main>

    <div className="mobilebar">
      <button onClick={() => setView('feed')}><Home/></button>
      <button onClick={() => setView('grid')}><Grid3X3/></button>
      {config.isAdmin && <button onClick={() => setModal('create')}><PlusSquare/></button>}
      {config.isAdmin && <button onClick={() => setModal('import')}><Download/></button>}
      {config.isAdmin && <button onClick={openProfileSettings}><Settings/></button>}
      {config.isAdmin
        ? <button onClick={() => setView('saved')}><Heart/></button>
        : config.passwordLoginEnabled && <button onClick={() => setModal('login')}><LogIn/></button>}
    </div>

    {viewer && viewerIndex !== null && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Full-screen photo viewer">
      <button className="lightbox-close" aria-label="Close full-screen viewer" onClick={() => setViewerIndex(null)}><X/></button>
      <button className="lightbox-prev" aria-label="Previous photo" onClick={() => setViewerIndex((viewerIndex + photoItems.length - 1) % photoItems.length)}><ChevronLeft/></button>
      <div className={`lightbox-photo-frame ${viewerFrameStyle ? `lightbox-frame-${viewerFrameStyle}` : ''}`} style={viewerMountStyle}>
        <div className="lightbox-mount"><img src={`/api/media/${encodeURIComponent(viewer.key)}`} alt={viewer.post.caption || `Photo from ${config.siteName}`} onLoad={event => setViewerMountColour(mutedDominantColour(event.currentTarget))}/></div>
      </div>
      <button className="lightbox-next" aria-label="Next photo" onClick={() => setViewerIndex((viewerIndex + 1) % photoItems.length)}><ChevronRight/></button>
      <div className="lightbox-caption"><b>{viewer.post.caption || 'A moment worth keeping.'}</b><span>{dateFormat(viewer.post.date)} · {viewerIndex + 1} of {photoItems.length}</span></div>
    </div>}

    {modal && <div className="overlay">
      <div className="dialog">
        <button className="close" disabled={busy} aria-label="Close" onClick={() => setModal('')}><X/></button>
        {modal === 'create'
            ? <>
              <span className="eyebrow">A NEW MEMORY</span>
              <h2>Create a post</h2>
              <p>Select photos from your device or its Photos picker.</p>
              <label className="drop">
                <ImagePlus size={30}/>
                <b>{files.length ? `${files.length} photos selected` : 'Choose your photos'}</b>
                <small>JPEG, PNG or WebP · up to 20 per post</small>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 20))}/>
              </label>
              <label className="field">Caption<textarea value={caption} onChange={event => setCaption(event.target.value)} placeholder="What’s the story?"/></label>
              <label className="field">Date<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
              <small>Photos are resized, compressed and re-encoded before upload, removing embedded location metadata. Originals stay untouched.</small>
              <button className="primary wide" disabled={busy || !files.length || !date} onClick={publish}>{busy ? 'Saving…' : 'Add to my journal'}</button>
            </>
            : modal === 'import'
              ? <>
                <span className="eyebrow">OLD MEMORIES, NEW HOME</span>
                <h2>Import an Instagram archive.</h2>
                <p>Preserve photographs, original dates and captions, with a small source label on imported posts.</p>
                <ol><li>Unzip the Instagram archive on your computer.</li><li>Keep its HTML or JSON post file and media folders together.</li><li>Select the entire extracted folder below.</li></ol>
                <div className="importnote">HTML and JSON exports are supported, including photo carousels. Videos, Stories, missing files and unsupported formats are skipped. Existing imports are detected so you can safely resume.</div>
                <input type="file" ref={folder} style={{ display: 'none' }} {...({ webkitdirectory: '', directory: '' } as object)} multiple onChange={event => importArchive(event.target.files)}/>
                <button className="primary wide" disabled={busy} onClick={() => folder.current?.click()}><Download size={17}/>{busy ? 'Importing…' : 'Select extracted Instagram folder'}</button>
                <input type="file" ref={archiveFiles} style={{ display: 'none' }} multiple accept=".html,.json,.jpg,.jpeg,.png,.webp" onChange={event => importArchive(event.target.files)}/>
                <button className="wide" disabled={busy} onClick={() => archiveFiles.current?.click()}>{busy ? 'Importing…' : 'Or select archive files'}</button>
                <small>The archive is processed in the browser; only compressed photographs and post details are uploaded.</small>
              </>
              : modal === 'settings'
                ? <>
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h2>Profile settings</h2>
                  <p>Update the identity and introductory copy shown throughout your journal.</p>
                  <label className="drop">
                    <ProfileAvatar config={config} size="large"/>
                    <b>{profilePhoto ? profilePhoto.name : config.profileImageUrl ? 'Replace profile photo' : 'Choose profile photo'}</b>
                    <small>JPEG, PNG or WebP · a square image works best</small>
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => setProfilePhoto(event.target.files?.[0] || null)}/>
                  </label>
                  {config.profileImageUrl && <button className="wide" disabled={busy} onClick={clearProfilePhoto}>Remove current profile photo</button>}
                  <label className="field">Display name<input value={profileDraft.profileName} maxLength={80} onChange={event => setProfileDraft({...profileDraft, profileName: event.target.value})}/></label>
                  <label className="field">Username<input value={profileDraft.profileHandle} maxLength={40} onChange={event => setProfileDraft({...profileDraft, profileHandle: event.target.value.replace(/^@+/, '')})}/></label>
                  <label className="field">Bio<textarea value={profileDraft.profileBio} maxLength={240} onChange={event => setProfileDraft({...profileDraft, profileBio: event.target.value})}/></label>
                  <label className="field">Journal name<input value={profileDraft.siteName} maxLength={80} onChange={event => setProfileDraft({...profileDraft, siteName: event.target.value})}/></label>
                  <label className="field">Header label<input value={profileDraft.eyebrow} maxLength={80} onChange={event => setProfileDraft({...profileDraft, eyebrow: event.target.value})}/></label>
                  <label className="field">Privacy label<input value={profileDraft.visibilityLabel} maxLength={40} onChange={event => setProfileDraft({...profileDraft, visibilityLabel: event.target.value})}/></label>
                  <label className="field">Journal description<textarea value={profileDraft.siteDescription} maxLength={180} onChange={event => setProfileDraft({...profileDraft, siteDescription: event.target.value})}/></label>
                  <small>These changes appear immediately throughout the journal. The original open-source defaults remain available as deployment settings.</small>
                  <button className="primary wide" disabled={busy || !profileDraft.profileName.trim() || !profileDraft.profileHandle.trim() || !profileDraft.siteName.trim()} onClick={saveProfileSettings}>{busy ? 'Saving…' : 'Save profile settings'}</button>
                </>
                : <>
                <span className="eyebrow">OWNER ACCESS</span>
                <h2>Manage this journal</h2>
                <p>Enter the administrator password configured by this journal’s owner.</p>
                <label className="field">Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && password) login(); }}/></label>
                <button className="primary wide" disabled={busy || !password} onClick={login}>{busy ? 'Checking…' : 'Sign in'}</button>
              </>}
        {status && <p className="notice" role="status">{status}</p>}
      </div>
    </div>}
  </>;
}

