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
  Images,
  Lock,
  LogIn,
  LogOut,
  MapPin,
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
  location: PostLocation | null;
};

type FeaturedPhoto = { slot: number; postId: string; key: string; src: string; caption: string };
type FrameStyle = '' | 'white' | 'mahogany' | 'ornate' | 'black' | 'pine';
type PhotoFrame = { postId: string; key: string; style: Exclude<FrameStyle, ''>; mountColour?: string };
type PostLocation = { name: string; latitude: number | null; longitude: number | null };

type ArchivePost = { id?: string; caption: string; date: string; paths: string[]; location?: PostLocation };
type JsonExif = { latitude?: number | string; longitude?: number | string };
type JsonMedia = { uri?: string; title?: string; creation_timestamp?: number; location?: unknown; latitude?:number|string; longitude?:number|string; media_metadata?:{photo_metadata?:{exif_data?:JsonExif[]}} };
type JsonPost = { media?: JsonMedia[]; title?: string; creation_timestamp?: number; location?:unknown; place?:unknown; location_name?:string };
type FrameFeedPost = { id?: string; caption?: string; date?: string; media?: string[]; location?:PostLocation };

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
const postBatchSize = 24;
const profileCropSize = 260;

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
    const place = block.querySelector('a[href*="/explore/locations/"]')?.textContent?.trim();
    return [{
      caption: block.querySelector('h2')?.textContent?.trim() || '',
      date,
      paths: [...new Set(paths)],
      location: place ? {name:place,latitude:null,longitude:null} : undefined,
    }];
  });
}

async function archiveId(paths: string[]) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(paths)));
  return `ig_${Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function compress(file: File) {
  const isHeic = /(?:image\/hei[cf]|\.hei[cf]$)/i.test(file.type || file.name);
  let readableFile: Blob = file;
  if (isHeic) {
    try {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      readableFile = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw Error('This iPhone photo could not be converted. Please try it again or share it as a JPEG.');
    }
  }
  let source:ImageBitmap|HTMLImageElement;
  let objectUrl='';
  try{
    if (typeof createImageBitmap !== 'function') throw Error('ImageBitmap unavailable');
    source=await createImageBitmap(readableFile);
  }catch{
    objectUrl=URL.createObjectURL(readableFile);
    source=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(Error('This photo format could not be read. Try sharing it as a JPEG.'));
      image.src=objectUrl;
    });
  }
  const bitmap = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap;
  const width=bitmap?source.width:source.naturalWidth;
  const height=bitmap?source.height:source.naturalHeight;
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  if(bitmap)source.close();
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  const makeJpeg = (quality:number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not process image')), 'image/jpeg', quality);
  });
  let output = await makeJpeg(0.86);
  if (output.size > 3_800_000) output = await makeJpeg(0.72);
  if (output.size > 3_800_000) output = await makeJpeg(0.58);
  if (output.size > 4_000_000) throw Error('This photo is still too large after resizing. Please try a smaller version.');
  return new File([output], 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

function instagramLocation(...values:unknown[]):PostLocation|undefined {
  let name='';
  let latitude:number|null=null;
  let longitude:number|null=null;
  const visit=(value:unknown)=>{
    if(typeof value==='string'&&!name){name=value.trim().slice(0,160);return;}
    if(!value||typeof value!=='object')return;
    const item=value as Record<string,unknown>;
    if(!name)name=String(item.name??item.title??item.location_name??'').trim().slice(0,160);
    const lat=Number(item.latitude??item.lat);
    const lon=Number(item.longitude??item.lng??item.lon);
    if(latitude===null&&Number.isFinite(lat)&&lat>=-90&&lat<=90)latitude=lat;
    if(longitude===null&&Number.isFinite(lon)&&lon>=-180&&lon<=180)longitude=lon;
    if(item.location&&item.location!==value)visit(item.location);
  };
  values.forEach(visit);
  return name||latitude!==null&&longitude!==null?{name,latitude,longitude}:undefined;
}

async function cropProfileImage(file: File, zoom: number, offset: {x:number;y:number}) {
  let source:ImageBitmap|HTMLImageElement;
  let objectUrl='';
  try{source=await createImageBitmap(file);}catch{
    objectUrl=URL.createObjectURL(file);
    source=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('This photo format could not be read. Try sharing it as a JPEG.'));image.src=objectUrl;
    });
  }
  const width=source instanceof ImageBitmap?source.width:source.naturalWidth;
  const height=source instanceof ImageBitmap?source.height:source.naturalHeight;
  const baseScale = Math.max(profileCropSize / width, profileCropSize / height);
  const scale = baseScale * zoom;
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const left = (profileCropSize - renderedWidth) / 2 + offset.x;
  const top = (profileCropSize - renderedHeight) / 2 + offset.y;
  const sourceSize = profileCropSize / scale;
  const sourceX = Math.max(0, Math.min(width - sourceSize, -left / scale));
  const sourceY = Math.max(0, Math.min(height - sourceSize, -top / scale));
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  canvas.getContext('2d')!.drawImage(source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 800, 800);
  if(source instanceof ImageBitmap)source.close();
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not crop profile photo')), 'image/webp', 0.88);
  });
}

function ProfileAvatar({ config, size = '' }: { config: PublicSiteConfig; size?: 'small' | 'large' | '' }) {
  return <div className={`avatar ${size}`.trim()}>
    {config.profileImageUrl
      ? <img src={config.profileImageUrl} alt="" aria-hidden="true"/>
      : config.profileInitial}
  </div>;
}

function FrameFeedLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`framefeed-logo ${compact ? 'framefeed-logo-compact' : ''}`}>
    <svg viewBox="0 0 48 44" aria-hidden="true">
      <rect className="logo-frame-back" x="2.5" y="2.5" width="30" height="29" rx="6"/>
      <path className="logo-picture-back" d="M8 25l6-6 5 5 5-7 5 6v4H8z"/>
      <circle className="logo-sun-back" cx="24" cy="10" r="2.7"/>
      <rect className="logo-frame-front" x="14.5" y="11.5" width="30" height="29" rx="6"/>
      <path className="logo-picture-front" d="M20 34l6-6 5 5 5-7 5 6v4H20z"/>
      <circle className="logo-sun-front" cx="36" cy="19" r="2.7"/>
    </svg>
    <span>framefeed</span>
  </span>;
}

function PostLocationLabel({location}:{location:PostLocation|null}) {
  if(!location)return null;
  const label=location.name||'Pinned location';
  if(location.latitude!==null&&location.longitude!==null){
    const href=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(location.latitude)}&mlon=${encodeURIComponent(location.longitude)}#map=14/${encodeURIComponent(location.latitude)}/${encodeURIComponent(location.longitude)}`;
    return <a className="post-location" href={href} target="_blank" rel="noreferrer"><MapPin size={11}/>{label}</a>;
  }
  return <span className="post-location"><MapPin size={11}/>{label}</span>;
}

function frameVariant(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 3;
}

function mutedDominantColour(image: HTMLImageElement, frame: 'mahogany' | 'pine' = 'mahogany') {
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
      ? frame === 'pine'
        ? Math.round(Math.min(16, Math.max(7, dominant.saturation * 24)))
        : Math.round(Math.min(36, Math.max(18, dominant.saturation * 55)))
      : 0;
    const mountLightness = frame === 'pine'
      ? Math.round(Math.min(91, Math.max(82, dominant.lightness * 100 + 38)))
      : Math.round(Math.min(84, Math.max(70, dominant.lightness * 100 + 25)));
    return `hsl(${Math.round(hue)} ${mutedSaturation}% ${mountLightness}%)`;
  } catch {
    return '';
  }
}

function Photo({
  post, siteName, isAdmin, photoFrames, galleryPhotos, onOpen, onFrame, onPreserveMount, onGallery, onRemoveFromGallery,
}: {
  post: Post;
  siteName: string;
  isAdmin: boolean;
  photoFrames: PhotoFrame[];
  galleryPhotos: Array<FeaturedPhoto | null>;
  onOpen: (post: Post, mediaIndex: number) => void;
  onFrame: (post: Post, mediaKey: string, style: FrameStyle, mountColour?:string) => Promise<boolean>;
  onPreserveMount: (post:Post,mediaKey:string,style:FrameStyle,mountColour:string)=>void;
  onGallery: (post: Post, mediaKey: string) => Promise<void>;
  onRemoveFromGallery: (slot: number) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [savingFrame, setSavingFrame] = useState(false);
  const [frameError, setFrameError] = useState(false);
  const [mountColour, setMountColour] = useState('');
  const imageElement = useRef<HTMLImageElement>(null);
  const src = `/api/media/${encodeURIComponent(post.media[index])}`;
  const frame=photoFrames.find(item => item.postId === post.id && item.key === post.media[index]);
  const frameStyle: FrameStyle = frame?.style || '';
  const savedMountColour=frame?.mountColour||'';
  const applyMountColour=(image:HTMLImageElement)=>{
    const colour=savedMountColour||mutedDominantColour(image,frameStyle==='pine'?'pine':'mahogany');
    setMountColour(colour);
    if(isAdmin&&!savedMountColour&&colour&&['mahogany','ornate','pine'].includes(frameStyle))onPreserveMount(post,post.media[index],frameStyle,colour);
  };
  useEffect(() => {
    setMountColour(savedMountColour);
    const image = imageElement.current;
    if (image?.complete && image.naturalWidth) applyMountColour(image);
  }, [src, frameStyle, savedMountColour]);
  const gallerySlot = galleryPhotos.findIndex(photo => photo?.postId === post.id && photo.key === post.media[index]);
  const mountStyle = mountColour ? ({ [frameStyle === 'pine' ? '--pine-mount' : '--mahogany-mount']: mountColour } as CSSProperties) : undefined;
  return <div className="photo-block">
    <div className={`photo ${frameStyle ? `photo-framed photo-frame-${frameStyle}` : ''} ${frameStyle === 'ornate' ? `frame-variant-${frameVariant(post.id)}` : ''}`.trim()} style={mountStyle}>
    <button className="photo-open" aria-label="Open photo full screen" onClick={() => onOpen(post, index)}>
      <img ref={imageElement} src={src} alt={post.caption || `Photo from ${siteName}`} loading="lazy" decoding="async" onLoad={event => applyMountColour(event.currentTarget)}/>
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
          const nextStyle = event.target.value as FrameStyle;
          const image = imageElement.current;
          const nextMountColour = image && ['mahogany','ornate','pine'].includes(nextStyle)
            ? mutedDominantColour(image, nextStyle === 'pine' ? 'pine' : 'mahogany')
            : '';
          const saved = await onFrame(post, post.media[index], nextStyle, nextMountColour);
          setFrameError(!saved);
          setSavingFrame(false);
        }}>
          <option value="">No frame</option>
          <option value="white">Gallery white</option>
          <option value="mahogany">Textured oak</option>
          <option value="ornate">Ornate mahogany</option>
          <option value="black">Black box</option>
          <option value="pine">Natural pine</option>
        </select>
      </label>
      {gallerySlot >= 0
        ? <button className="feature-photo-control gallery-membership gallery-membership-on" type="button" onClick={() => void onRemoveFromGallery(gallerySlot)}><Images size={15}/> In gallery <span>Remove</span></button>
        : <button className="feature-photo-control gallery-membership" type="button" onClick={() => void onGallery(post,post.media[index])}><Images size={15}/> Add to gallery</button>}
    </div>}
  </div>;
}

function GalleryArtwork({
  photo, post, mediaIndex, frameStyle, savedMountColour, slot, onOpen, onPreserveMount, arranging, canMoveEarlier, canMoveLater, onMove,
}: {
  photo: FeaturedPhoto;
  post: Post;
  mediaIndex: number;
  frameStyle: FrameStyle;
  savedMountColour: string;
  slot: number;
  onOpen: (post: Post, mediaIndex: number) => void;
  onPreserveMount: (post:Post,mediaKey:string,style:FrameStyle,mountColour:string)=>void;
  arranging: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onMove: (change: number) => void;
}) {
  const [mountColour, setMountColour] = useState('');
  const imageElement = useRef<HTMLImageElement>(null);
  const applyMountColour=(image:HTMLImageElement)=>{
    const colour=savedMountColour||mutedDominantColour(image,frameStyle==='pine'?'pine':'mahogany');
    setMountColour(colour);
    if(!savedMountColour&&colour&&['mahogany','ornate','pine'].includes(frameStyle))onPreserveMount(post,photo.key,frameStyle,colour);
  };
  useEffect(() => {
    setMountColour(savedMountColour);
    const image = imageElement.current;
    if (image?.complete && image.naturalWidth) applyMountColour(image);
  }, [photo.src, frameStyle, savedMountColour]);
  const mountStyle = mountColour ? ({ [frameStyle === 'pine' ? '--pine-mount' : '--mahogany-mount']: mountColour } as CSSProperties) : undefined;
  return <div className={`gallery-artwork gallery-position-${slot + 1} ${arranging ? 'gallery-artwork-arranging' : ''}`}>
    <button className="gallery-artwork-open" onClick={() => onOpen(post,mediaIndex)} aria-label={`Open gallery photograph ${slot + 1} full screen`}>
      <span className={`gallery-frame ${frameStyle ? `photo-frame-${frameStyle}` : 'gallery-frame-unframed'} ${frameStyle === 'ornate' ? `frame-variant-${frameVariant(post.id)}` : ''}`.trim()} style={mountStyle}>
        <span className="photo-open gallery-mount"><img ref={imageElement} src={photo.src} alt={photo.caption || `Gallery photograph ${slot + 1}`} loading="lazy" decoding="async" onLoad={event => applyMountColour(event.currentTarget)}/></span>
      </span>
      <small>{photo.caption || 'Untitled'}</small>
    </button>
    {arranging && <div className="gallery-order-controls" aria-label="Reorder gallery photograph">
      <button type="button" disabled={!canMoveEarlier} onClick={() => onMove(-1)} aria-label="Move photograph earlier"><ChevronLeft size={16}/></button>
      <span>{slot + 1}</span>
      <button type="button" disabled={!canMoveLater} onClick={() => onMove(1)} aria-label="Move photograph later"><ChevronRight size={16}/></button>
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
  const [includeLocation, setIncludeLocation] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationCoordinates, setLocationCoordinates] = useState<{latitude:number;longitude:number}|null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [photoFrames, setPhotoFrames] = useState<PhotoFrame[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<Array<FeaturedPhoto | null>>(() => Array(9).fill(null));
  const [pendingGalleryPhoto, setPendingGalleryPhoto] = useState<{post: Post; mediaKey: string} | null>(null);
  const [arrangingGallery, setArrangingGallery] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerMountColour, setViewerMountColour] = useState('');
  const [reordering, setReordering] = useState(false);
  const [visibleCount, setVisibleCount] = useState(postBatchSize);
  const [profileDraft, setProfileDraft] = useState<EditableProfile>(() => editableProfile(defaultConfig));
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState('');
  const [profileDimensions, setProfileDimensions] = useState({width:0,height:0});
  const [profileZoom, setProfileZoom] = useState(1);
  const [profileOffset, setProfileOffset] = useState({x:0,y:0});
  const folder = useRef<HTMLInputElement>(null);
  const archiveFiles = useRef<HTMLInputElement>(null);
  const feedEnd = useRef<HTMLDivElement>(null);
  const profileDrag = useRef<{pointerId:number;startX:number;startY:number;x:number;y:number} | null>(null);
  const preservingMounts = useRef(new Set<string>());

  async function load() {
    const [postsResponse, configResponse, framesResponse, galleryResponse] = await Promise.all([
      fetch('/api/posts'),
      fetch('/api/config', { cache: 'no-store' }),
      fetch('/api/photo-frames', { cache: 'no-store' }),
      fetch('/api/landing-photos', { cache: 'no-store' }),
    ]);
    if (!postsResponse.ok) throw Error('Could not load the photos. Please refresh.');
    if (!configResponse.ok) throw Error('Could not load the journal settings. Please refresh.');
    setPosts(await postsResponse.json());
    setConfig(await configResponse.json());
    if (framesResponse.ok) {
      const data = await framesResponse.json() as { frames?: PhotoFrame[] };
      setPhotoFrames(data.frames || []);
    }
    if (galleryResponse.ok) {
      const data = await galleryResponse.json() as { photos?: Array<FeaturedPhoto | null> };
      setGalleryPhotos(Array.from({length:9},(_,slot)=>data.photos?.[slot] || null));
    }
  }

  useEffect(() => {
    load().catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  useEffect(() => {
    if (!profilePhoto) {
      setProfilePreview('');
      return;
    }
    const url = URL.createObjectURL(profilePhoto);
    setProfilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profilePhoto]);

  function profileImageSize(zoom=profileZoom,dimensions=profileDimensions) {
    if (!dimensions.width || !dimensions.height) return {width:profileCropSize,height:profileCropSize};
    const scale=Math.max(profileCropSize/dimensions.width,profileCropSize/dimensions.height)*zoom;
    return {width:dimensions.width*scale,height:dimensions.height*scale};
  }

  function clampProfileOffset(offset:{x:number;y:number},zoom=profileZoom,dimensions=profileDimensions) {
    const rendered=profileImageSize(zoom,dimensions);
    const maxX=Math.max(0,(rendered.width-profileCropSize)/2);
    const maxY=Math.max(0,(rendered.height-profileCropSize)/2);
    return {x:Math.max(-maxX,Math.min(maxX,offset.x)),y:Math.max(-maxY,Math.min(maxY,offset.y))};
  }

  function chooseProfilePhoto(file:File|null) {
    setProfilePhoto(file);
    setProfileDimensions({width:0,height:0});
    setProfileZoom(1);
    setProfileOffset({x:0,y:0});
  }

  async function upload(id: string, postCaption: string, postDate: string, source: string, photos: File[], location?:PostLocation) {
    const form = new FormData();
    form.set('id', id);
    form.set('caption', postCaption);
    form.set('date', postDate);
    form.set('source', source);
    if(location){
      form.set('locationProvided','1');
      form.set('locationName',location.name);
      if(location.latitude!==null)form.set('latitude',String(location.latitude));
      if(location.longitude!==null)form.set('longitude',String(location.longitude));
    }
    for (const file of photos) form.append('photos', await compress(file));
    const response = await fetch('/api/posts', { method: 'POST', body: form });
    if (!response.ok) throw Error(await response.text());
    return response.json() as Promise<{ duplicate?: boolean; ok?: boolean }>;
  }

  async function publish() {
    setBusy(true);
    setStatus('Preparing your photos…');
    try {
      const location=includeLocation?{
        name:locationName.trim(),
        latitude:locationCoordinates?.latitude??null,
        longitude:locationCoordinates?.longitude??null,
      }:undefined;
      await upload(crypto.randomUUID(), caption, new Date(date).toISOString(), 'native', files, location);
      await load();
      setModal('');
      setFiles([]);
      setCaption('');
      setIncludeLocation(false);
      setLocationName('');
      setLocationCoordinates(null);
      setLocationStatus('');
      setStatus('Photo added to your journal.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if(!navigator.geolocation){setLocationStatus('Location is not available in this browser.');return;}
    setLocationStatus('Finding your position…');
    navigator.geolocation.getCurrentPosition(position=>{
      setLocationCoordinates({latitude:position.coords.latitude,longitude:position.coords.longitude});
      setIncludeLocation(true);
      setLocationStatus('Position added. You can give it a public place name below.');
    },()=>setLocationStatus('Location was not added. You can still type a place name.'),{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  }

  async function importArchive(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    let added = 0;
    let duplicates = 0;
    let skipped = 0;
    let locationsRestored = 0;
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
            rows.push({ id: row.id, caption: row.caption || '', date: row.date, paths, location: row.location });
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
          const exif=media.flatMap(item=>item.media_metadata?.photo_metadata?.exif_data||[]);
          const location=instagramLocation(row.location,row.place,row.location_name,...media.map(item=>item.location),...media,...exif);
          rows.push({ caption: title, date: new Date(timestamp * 1000).toISOString(), paths: media.map(item => cleanPath(item.uri || '')), location });
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
          if(row.location){
            const response=await fetch('/api/posts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,location:row.location})});
            if(response.ok)locationsRestored++;
          }
          duplicates++;
          continue;
        }
        setStatus(`Importing ${added + duplicates + 1} of ${rows.length} posts…`);
        const result = await upload(id, row.caption, row.date, 'instagram', images as File[], row.location);
        if (result.duplicate) duplicates++;
        else {
          added++;
          existingIds.add(id);
        }
      }
      await load();
      setStatus(`Import complete: ${added} added, ${duplicates} already imported, ${locationsRestored} locations restored, ${skipped} skipped (missing/unsupported media).`);
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
    chooseProfilePhoto(null);
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
        form.set('photo', await cropProfileImage(profilePhoto, profileZoom, profileOffset), 'profile.webp');
        const photoResponse = await fetch('/api/settings', { method: 'POST', body: form });
        if (!photoResponse.ok) throw Error(await photoResponse.text() || 'Could not save profile photo');
      }
      await load();
      setModal('');
      chooseProfilePhoto(null);
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
      chooseProfilePhoto(null);
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

  async function setPhotoFrame(post: Post, mediaKey: string, style: FrameStyle, mountColour='') {
    try {
      const response = await fetch('/api/photo-frames', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, mediaKey, style, mountColour }),
      });
      if (!response.ok) throw Error(await response.text() || 'Could not save frame');
      await load();
      const frameName = style ? ({ white: 'Gallery white', mahogany: 'Textured oak', ornate: 'Ornate mahogany', black: 'Black box', pine: 'Natural pine' } as const)[style] : 'No frame';
      setStatus(`${frameName} saved for this photograph.`);
      return true;
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
      return false;
    }
  }

  function preserveMountColour(post:Post,mediaKey:string,style:FrameStyle,mountColour:string) {
    const identity=`${post.id}:${mediaKey}`;
    if(!config.isAdmin||!['mahogany','ornate','pine'].includes(style)||!mountColour||preservingMounts.current.has(identity))return;
    if(photoFrames.find(frame=>frame.postId===post.id&&frame.key===mediaKey)?.mountColour)return;
    preservingMounts.current.add(identity);
    fetch('/api/photo-frames',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({postId:post.id,mediaKey,style,mountColour})})
      .then(response=>{
        if(!response.ok)return;
        setPhotoFrames(frames=>frames.map(frame=>frame.postId===post.id&&frame.key===mediaKey?{...frame,mountColour}:frame));
      }).finally(()=>preservingMounts.current.delete(identity));
  }

  async function placeInGallery(post:Post, mediaKey:string, slot:number) {
    if(!config.isAdmin || busy)return false;
    setBusy(true);
    try {
      const response=await fetch('/api/landing-photos',{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({slot,postId:post.id,mediaKey})
      });
      if(!response.ok)throw Error(await response.text());
      await load();
      setStatus('Photograph added to the gallery.');
      return true;
    }catch(cause){setStatus(cause instanceof Error?cause.message:String(cause));return false;}
    finally{setBusy(false);}
  }

  async function addToGallery(post:Post, mediaKey:string) {
    if(!config.isAdmin || busy)return;
    const emptySlot=galleryPhotos.findIndex(photo=>!photo);
    if(emptySlot>=0){
      await placeInGallery(post,mediaKey,emptySlot);
      return;
    }
    setPendingGalleryPhoto({post,mediaKey});
  }

  async function replaceGalleryPhoto(slot:number) {
    if(!pendingGalleryPhoto)return;
    const saved=await placeInGallery(pendingGalleryPhoto.post,pendingGalleryPhoto.mediaKey,slot);
    if(saved)setPendingGalleryPhoto(null);
  }

  async function moveGalleryPhoto(slot:number,change:number) {
    if(!config.isAdmin || busy)return;
    const ordered=galleryPhotos.filter((photo):photo is FeaturedPhoto=>Boolean(photo));
    const current=ordered.findIndex(photo=>photo.slot===slot);
    const destination=current+change;
    if(current<0||destination<0||destination>=ordered.length)return;
    [ordered[current],ordered[destination]]=[ordered[destination],ordered[current]];
    setBusy(true);
    try{
      const response=await fetch('/api/landing-photos',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({items:ordered.map(photo=>({postId:photo.postId,mediaKey:photo.key}))}),
      });
      if(!response.ok)throw Error(await response.text());
      await load();
      setStatus('Gallery order saved.');
    }catch(cause){setStatus(cause instanceof Error?cause.message:String(cause));}
    finally{setBusy(false);}
  }

  async function removeFromGallery(slot:number) {
    if(!config.isAdmin || busy || slot < 0)return;
    setBusy(true);
    try {
      const response=await fetch(`/api/landing-photos?slot=${slot}`,{method:'DELETE'});
      if(!response.ok)throw Error(await response.text());
      await load();
      setStatus('Photograph removed from the gallery.');
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
  const renderedPosts = visible.slice(0, visibleCount);
  useEffect(() => {
    const target = feedEnd.current;
    if (!target || visibleCount >= visible.length || view === 'gallery') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisibleCount(count => Math.min(count + postBatchSize, visible.length));
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, visible.length, view]);
  const used = posts.reduce((total, post) => total + post.bytes, 0);
  const dateFormat = (value: string) => new Date(value).toLocaleDateString(config.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const photoItems = posts.flatMap(post => post.media.map((key, mediaIndex) => ({ post, key, mediaIndex })));
  const openPhoto = (post: Post, mediaIndex: number) => {
    const index = photoItems.findIndex(item => item.post.id === post.id && item.mediaIndex === mediaIndex);
    if (index >= 0) setViewerIndex(index);
  };
  const viewer = viewerIndex === null ? null : photoItems[viewerIndex];
  const viewerFrame=viewer?photoFrames.find(frame=>frame.postId===viewer.post.id&&frame.key===viewer.key):undefined;
  const viewerFrameStyle: FrameStyle = viewerFrame?.style || '';
  const viewerSavedMountColour=viewerFrame?.mountColour||'';
  useEffect(() => setViewerMountColour(viewerSavedMountColour), [viewer?.key, viewerFrameStyle, viewerSavedMountColour]);
  const viewerMountStyle = viewerMountColour ? ({ [viewerFrameStyle === 'pine' ? '--pine-mount' : '--mahogany-mount']: viewerMountColour } as CSSProperties) : undefined;
  const galleryItems = galleryPhotos.flatMap((photo, slot) => {
    if (!photo) return [];
    const post = posts.find(item => item.id === photo.postId);
    if (!post) return [];
    const mediaIndex = post.media.indexOf(photo.key);
    if (mediaIndex < 0) return [];
    const frame=photoFrames.find(item => item.postId === photo.postId && item.key === photo.key);
    const frameStyle: FrameStyle = frame?.style || '';
    return [{ photo, post, mediaIndex, frameStyle, savedMountColour:frame?.mountColour||'', slot }];
  });


  const postCard = (post: Post) => <article key={post.id}>
    <div className="posthead">
      <ProfileAvatar config={config} size="small"/>
      <div><b>{config.profileHandle}</b><small>{dateFormat(post.date)}</small><PostLocationLabel location={post.location}/></div>
      {post.source === 'instagram' && <span className="badge">↗ From Instagram</span>}
    </div>
    <Photo post={post} siteName={config.siteName} isAdmin={config.isAdmin} photoFrames={photoFrames} galleryPhotos={galleryPhotos} onOpen={openPhoto} onFrame={setPhotoFrame} onPreserveMount={preserveMountColour} onGallery={addToGallery} onRemoveFromGallery={removeFromGallery}/>
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
          : <FrameFeedLogo/>}
      </a>
      <nav>
        <button className={view === 'feed' ? 'chosen' : ''} onClick={() => { setView('feed'); setViewerIndex(null); }}><Home size={23}/>Home</button>
        <button className={view === 'grid' ? 'chosen' : ''} onClick={() => { setView('grid'); setViewerIndex(null); }}><Grid3X3 size={23}/>Photos</button>
        <button className={view === 'gallery' ? 'chosen' : ''} onClick={() => { setView('gallery'); setViewerIndex(null); }}><Images size={23}/>Gallery</button>
        {config.isAdmin && <button className={view === 'saved' ? 'chosen' : ''} onClick={() => { setView('saved'); setViewerIndex(null); }}><Heart size={23}/>Favourites</button>}
        {config.isAdmin && <button onClick={() => setModal('create')}><PlusSquare size={23}/>Create</button>}
        {config.isAdmin && <button onClick={() => setModal('import')}><Download size={23}/>Import Instagram</button>}
        {config.isAdmin && <button onClick={openProfileSettings}><Settings size={23}/>Edit profile</button>}
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
        {!config.isAdmin && config.passwordLoginEnabled && <button className="sidebar-owner-login" onClick={() => setModal('login')}><LogIn size={14}/>Owner sign in</button>}
      </div>
    </aside>

    <main>
      <a className="mobile-wordmark" href="/" aria-label="FrameFeed home"><FrameFeedLogo compact/></a>
      <header>
        <div><span className="eyebrow">{config.eyebrow}</span><h1>{view === 'grid' ? 'Photos' : view === 'gallery' ? 'The gallery' : view === 'saved' ? 'Favourites' : 'Moments, all together.'}</h1></div>
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
          <button className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}><Images size={16}/> Gallery</button>
        </div>
        <div className="toolbar-right">
          {config.isAdmin && <button className={reordering ? 'on order-toggle' : 'order-toggle'} type="button" aria-pressed={reordering} onClick={() => {setReordering(!reordering);setView('feed');setSearch('');}}>{reordering ? 'Done ordering' : 'Arrange posts'}</button>}
        <label><Search size={16}/><input placeholder="Find a memory…" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(postBatchSize); }}/></label>
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      {status && <div className="notice" role="status">{status}<button aria-label="Dismiss" onClick={() => setStatus('')} disabled={busy}><X size={14}/></button></div>}
      {view === 'gallery' ? <section className="virtual-gallery" aria-label="Curated virtual gallery">
        {config.isAdmin && galleryItems.length > 1 && <div className="gallery-toolbar">
          <button className={arrangingGallery ? 'gallery-arrange-toggle on' : 'gallery-arrange-toggle'} type="button" aria-pressed={arrangingGallery} onClick={()=>setArrangingGallery(value=>!value)}>{arrangingGallery ? 'Done arranging' : 'Arrange gallery'}</button>
          {arrangingGallery && <span>Use the arrows beneath each photograph to change its position.</span>}
        </div>}
        <div className="gallery-room">
          <div className="gallery-walk" aria-label="Gallery walls">
          {galleryItems.length ? Array.from({ length: Math.ceil(galleryItems.length / 3) }, (_, wall) =>
            <div className="gallery-wall" key={wall} aria-label={`Gallery wall ${wall + 1}`}>
              {galleryItems.slice(wall * 3, wall * 3 + 3).map(({photo,post,mediaIndex,frameStyle,savedMountColour,slot},wallIndex) => {
                const galleryIndex=wall*3+wallIndex;
                return <GalleryArtwork key={`${photo.postId}:${photo.key}`} photo={photo} post={post} mediaIndex={mediaIndex} frameStyle={frameStyle} savedMountColour={savedMountColour} slot={slot} onOpen={openPhoto} onPreserveMount={preserveMountColour} arranging={arrangingGallery} canMoveEarlier={galleryIndex>0} canMoveLater={galleryIndex<galleryItems.length-1} onMove={change=>void moveGalleryPhoto(slot,change)}/>;
              }) }
            </div>)
          : <div className="gallery-wall gallery-wall-empty"><div className="gallery-empty"><Images size={38}/><h2>The gallery is waiting.</h2><p>{config.isAdmin ? 'Add up to nine photographs using the gallery control beneath any post.' : 'No photographs have been hung here yet.'}</p></div></div>}
          </div>
        </div>
        {galleryItems.length > 3 && <p className="gallery-guide">Swipe or scroll sideways to walk through the gallery</p>}
      </section> : <section className={view === 'grid' ? 'grid' : 'feed'}>
        {visible.length
          ? view === 'grid'
            ? renderedPosts.map(post => <button className="tile" key={post.id} onClick={() => openPhoto(post, 0)}>
              <img src={`/api/media/${encodeURIComponent(post.media[0])}`} alt={post.caption || 'View photo'} loading="lazy" decoding="async"/>
              {post.source === 'instagram' && <span>↗</span>}
              {post.media.length > 1 && <b>{post.media.length} photos</b>}
            </button>)
            : renderedPosts.map(postCard)
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
        {visibleCount < visible.length && <div ref={feedEnd} className="feed-loader" aria-label="Loading more posts"><span/></div>}
      </section>}
      <footer>
        {config.siteName}
        <span>
          Powered by Open Photo Journal
        </span>
      </footer>
    </main>

    <div className="mobilebar">
      <button onClick={() => setView('feed')}><Home/></button>
      <button onClick={() => setView('grid')}><Grid3X3/></button>
      <button onClick={() => setView('gallery')}><Images/></button>
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
      <div className={`lightbox-photo-frame ${viewerFrameStyle ? `lightbox-frame-${viewerFrameStyle}` : ''} ${viewerFrameStyle === 'ornate' ? `frame-variant-${frameVariant(viewer.post.id)}` : ''}`.trim()} style={viewerMountStyle}>
        <div className="lightbox-mount"><img src={`/api/media/${encodeURIComponent(viewer.key)}`} alt={viewer.post.caption || `Photo from ${config.siteName}`} onLoad={event => {
          const colour=viewerSavedMountColour||mutedDominantColour(event.currentTarget,viewerFrameStyle==='pine'?'pine':'mahogany');
          setViewerMountColour(colour);
          if(colour&&!viewerSavedMountColour)preserveMountColour(viewer.post,viewer.key,viewerFrameStyle,colour);
        }}/></div>
      </div>
      <button className="lightbox-next" aria-label="Next photo" onClick={() => setViewerIndex((viewerIndex + 1) % photoItems.length)}><ChevronRight/></button>
      <div className="lightbox-caption"><b>{viewer.post.caption || 'A moment worth keeping.'}</b><span>{dateFormat(viewer.post.date)}{viewer.post.location ? ` · ${viewer.post.location.name||'Pinned location'}` : ''} · {viewerIndex + 1} of {photoItems.length}</span></div>
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
                <small>iPhone Photos, JPEG, PNG or WebP · up to 20 per post</small>
                <input type="file" accept="image/*" multiple disabled={busy} onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 20))}/>
              </label>
              <label className="field">Caption<textarea value={caption} onChange={event => setCaption(event.target.value)} placeholder="What’s the story?"/></label>
              <label className="field">Date<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
              <label className="location-choice"><input type="checkbox" checked={includeLocation} onChange={event=>{
                setIncludeLocation(event.target.checked);
                if(!event.target.checked){setLocationCoordinates(null);setLocationStatus('');}
              }}/><span><b>Add a location</b><small>Off by default. You decide what is shown with this post.</small></span></label>
              {includeLocation&&<div className="location-editor">
                <label className="field">Place name<input value={locationName} maxLength={160} placeholder="e.g. Guildford, Surrey" onChange={event=>setLocationName(event.target.value)}/></label>
                <button type="button" className="location-pin" onClick={useCurrentLocation}><MapPin size={14}/>{locationCoordinates?'Update current position':'Use current position'}</button>
                {locationStatus&&<small>{locationStatus}</small>}
              </div>}
              <small>Photos are resized and re-encoded, so embedded GPS metadata is removed. Only a location you choose above is saved. Originals stay untouched.</small>
              <button className="primary wide" disabled={busy || !files.length || !date} onClick={publish}>{busy ? 'Saving…' : 'Add to my journal'}</button>
            </>
            : modal === 'import'
              ? <>
                <span className="eyebrow">OLD MEMORIES, NEW HOME</span>
                <h2>Import an Instagram archive.</h2>
                <p>Preserve photographs, original dates, captions and any location data Instagram included, with a small source label on imported posts.</p>
                <ol><li>Unzip the Instagram archive on your computer.</li><li>Keep its HTML or JSON post file and media folders together.</li><li>Select the entire extracted folder below.</li></ol>
                <div className="importnote">HTML and JSON exports are supported, including photo carousels. Re-selecting an archive can restore locations to posts already imported without duplicating them. Videos, Stories, missing files and unsupported formats are skipped.</div>
                <input type="file" ref={folder} style={{ display: 'none' }} {...({ webkitdirectory: '', directory: '' } as object)} multiple onChange={event => importArchive(event.target.files)}/>
                <button className="primary wide" disabled={busy} onClick={() => folder.current?.click()}><Download size={17}/>{busy ? 'Importing…' : 'Select extracted Instagram folder'}</button>
                <input type="file" ref={archiveFiles} style={{ display: 'none' }} multiple accept=".html,.json,.jpg,.jpeg,.png,.webp" onChange={event => importArchive(event.target.files)}/>
                <button className="wide" disabled={busy} onClick={() => archiveFiles.current?.click()}>{busy ? 'Importing…' : 'Or select archive files'}</button>
                <small>The archive is processed in the browser; only compressed photographs and post details are uploaded.</small>
              </>
              : modal === 'settings'
                ? <>
                  <span className="eyebrow">YOUR PROFILE</span>
                  <h2>Edit profile</h2>
                  <p>Update how you appear throughout your journal.</p>
                  <label className="drop">
                    <ProfileAvatar config={config} size="large"/>
                    <b>{profilePhoto ? 'Choose a different photo' : config.profileImageUrl ? 'Replace profile photo' : 'Choose profile photo'}</b>
                    <small>JPEG, PNG or WebP · you can crop and zoom before saving</small>
                    <input type="file" accept="image/*" disabled={busy} onChange={event => chooseProfilePhoto(event.target.files?.[0] || null)}/>
                  </label>
                  {profilePhoto && profilePreview && <div className="profile-cropper">
                    <div className="profile-crop-window" onPointerDown={event=>{
                      profileDrag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:profileOffset.x,y:profileOffset.y};
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }} onPointerMove={event=>{
                      const drag=profileDrag.current;
                      if(!drag||drag.pointerId!==event.pointerId)return;
                      setProfileOffset(clampProfileOffset({x:drag.x+event.clientX-drag.startX,y:drag.y+event.clientY-drag.startY}));
                    }} onPointerUp={event=>{
                      if(profileDrag.current?.pointerId===event.pointerId)profileDrag.current=null;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }} onPointerCancel={()=>{profileDrag.current=null;}}>
                      <img src={profilePreview} alt="Profile crop preview" draggable={false} onLoad={event=>{
                        const dimensions={width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight};
                        setProfileDimensions(dimensions);
                        setProfileOffset(current=>clampProfileOffset(current,profileZoom,dimensions));
                      }} style={{width:profileImageSize().width,height:profileImageSize().height,transform:`translate(-50%, -50%) translate(${profileOffset.x}px, ${profileOffset.y}px)`}}/>
                      <span>Drag to reposition</span>
                    </div>
                    <label className="profile-zoom">Zoom
                      <input type="range" min="1" max="3" step="0.01" value={profileZoom} onChange={event=>{
                        const zoom=Number(event.target.value);
                        setProfileZoom(zoom);
                        setProfileOffset(current=>clampProfileOffset(current,zoom));
                      }}/>
                    </label>
                    <button type="button" className="profile-crop-reset" onClick={()=>{setProfileZoom(1);setProfileOffset({x:0,y:0});}}>Reset crop</button>
                  </div>}
                  {config.profileImageUrl && <button className="wide" disabled={busy} onClick={clearProfilePhoto}>Remove current profile photo</button>}
                  <label className="field">Name<input value={profileDraft.profileName} maxLength={80} onChange={event => setProfileDraft({...profileDraft, profileName: event.target.value})}/></label>
                  <label className="field">Username<input value={profileDraft.profileHandle} maxLength={40} onChange={event => setProfileDraft({...profileDraft, profileHandle: event.target.value.replace(/^@+/, '')})}/></label>
                  <label className="field">Bio<textarea value={profileDraft.profileBio} maxLength={240} onChange={event => setProfileDraft({...profileDraft, profileBio: event.target.value})}/></label>
                  <details className="journal-wording">
                    <summary>Journal wording</summary>
                    <p>Only change these if you want to rename or reword the journal itself.</p>
                    <label className="field">Journal title<input value={profileDraft.siteName} maxLength={80} onChange={event => setProfileDraft({...profileDraft, siteName: event.target.value})}/></label>
                    <label className="field">Small heading<input value={profileDraft.eyebrow} maxLength={80} onChange={event => setProfileDraft({...profileDraft, eyebrow: event.target.value})}/></label>
                    <label className="field">Journal type<input value={profileDraft.visibilityLabel} maxLength={40} onChange={event => setProfileDraft({...profileDraft, visibilityLabel: event.target.value})}/></label>
                    <label className="field">Short description<textarea value={profileDraft.siteDescription} maxLength={180} onChange={event => setProfileDraft({...profileDraft, siteDescription: event.target.value})}/></label>
                  </details>
                  <button className="primary wide" disabled={busy || !profileDraft.profileName.trim() || !profileDraft.profileHandle.trim() || !profileDraft.siteName.trim()} onClick={saveProfileSettings}>{busy ? 'Saving…' : 'Save changes'}</button>
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

    {pendingGalleryPhoto && <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose a gallery photograph to replace">
      <div className="dialog gallery-replacement-dialog">
        <button className="close" disabled={busy} aria-label="Close" onClick={()=>setPendingGalleryPhoto(null)}><X/></button>
        <span className="eyebrow">GALLERY FULL</span>
        <h2>Which photograph should this replace?</h2>
        <p>Your gallery can hold nine photographs. Tap one of the small previews below to replace it; the others will stay exactly where they are.</p>
        <div className="gallery-replacement-grid">
          {galleryPhotos.flatMap((photo,slot)=>photo ? [<button type="button" key={`${photo.postId}:${photo.key}`} disabled={busy} onClick={()=>void replaceGalleryPhoto(slot)} aria-label={`Replace gallery photograph ${slot+1}${photo.caption ? `: ${photo.caption}` : ''}`}>
            <img src={photo.src} alt=""/>
            <span>{slot+1}</span>
          </button>] : [])}
        </div>
        <button className="wide" type="button" disabled={busy} onClick={()=>setPendingGalleryPhoto(null)}>Keep the current gallery</button>
      </div>
    </div>}
  </>;
}

