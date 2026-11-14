import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from 'cloudflare:workers';
import ShareButtons from './share-buttons';
import { getPublicSiteConfig } from '../../../lib/site-config';
import { ensurePostLocationsTable } from '../../../lib/post-locations';

type Post = {id:string;caption:string;date:string;source:string;media:string[];location:{name:string;latitude:number|null;longitude:number|null}|null};
type PostRow = Omit<Post, 'media'|'location'> & {media:string;location_name:string|null;latitude:number|null;longitude:number|null};

async function getPost(id: string): Promise<Post | null> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return null;
  await ensurePostLocationsTable();
  const row = await env.DB!.prepare(`SELECT p.id,p.caption,p.date,p.source,p.media,l.name AS location_name,l.latitude,l.longitude
    FROM posts p LEFT JOIN post_locations l ON l.post_id=p.id WHERE p.id=?`).bind(id).first<PostRow>();
  if (!row) return null;
  return {id:row.id,caption:row.caption,date:row.date,source:row.source,media:JSON.parse(row.media),
    location:row.location_name||row.latitude!==null&&row.longitude!==null?{name:row.location_name||'',latitude:row.latitude,longitude:row.longitude}:null};
}

async function getOrigin() {
  if (env.PUBLIC_SITE_URL) return env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || 'localhost').split(',')[0].trim();
  const protocol = (requestHeaders.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  return `${protocol}://${host}`;
}

function postDescription(post: Post, siteName: string, locale: string) {
  const caption = post.caption.replace(/\s+/g, ' ').trim();
  return (caption || `A ${siteName} memory from ${new Date(post.date).toLocaleDateString(locale, {day:'numeric', month:'long', year:'numeric'})}`).slice(0, 200);
}

export async function generateMetadata({params}: {params: Promise<{id:string}>}): Promise<Metadata> {
  const {id} = await params;
  const post = await getPost(id);
  const config = getPublicSiteConfig();
  if (!post) return {title: `Post not found · ${config.siteName}`};
  const origin = await getOrigin();
  const url = `${origin}/p/${encodeURIComponent(post.id)}`;
  const image = `${origin}/api/media/${encodeURIComponent(post.media[0])}`;
  const description = postDescription(post, config.siteName, config.locale);
  return {
    title: `${description.slice(0, 65)} · ${config.siteName}`,
    description,
    alternates: {canonical: url},
    openGraph: {
      type: 'article',
      url,
      siteName: config.siteName,
      title: description.slice(0, 65),
      description,
      images: [{url: image, alt: post.caption || `A photo from ${config.siteName}`}]
    },
    twitter: {card: 'summary_large_image', title: description.slice(0, 65), description, images: [image]}
  };
}

export default async function PostPage({params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const post = await getPost(id);
  if (!post) notFound();
  const config = getPublicSiteConfig();
  const origin = await getOrigin();
  const url = `${origin}/p/${encodeURIComponent(post.id)}`;
  const date = new Date(post.date).toLocaleDateString(config.locale, {day:'numeric', month:'long', year:'numeric'});
  return <div className="sharepage">
    <main>
      <div className="sharetop">
        <Link className="wordmark" href="/">
          {config.wordmarkImageUrl
            ? <img className="wordmark-image" src={config.wordmarkImageUrl} alt={config.siteName}/>
            : <>{config.siteName}<span>•</span></>}
        </Link>
        <Link className="backlink" href="/">← Back to all posts</Link>
      </div>
      <article className="sharecard">
        <div className="sharecardhead">
          <div className="avatar small">
            {config.profileImageUrl
              ? <img src={config.profileImageUrl} alt="" aria-hidden="true"/>
              : config.profileInitial}
          </div>
          <div><b>{config.profileHandle}</b><small>{date}</small>{post.location&&<span className="post-location">⌖ {post.location.name||'Pinned location'}</span>}</div>
          {post.source === 'instagram' && <span className="badge">↗ From Instagram</span>}
        </div>
        <div className="postgallery">
          {post.media.map((key, index) => <img key={key} src={`/api/media/${encodeURIComponent(key)}`} alt={post.caption || `${config.siteName} photo ${index + 1}`} />)}
        </div>
        <div className="sharecopy">
          <p className="sharecaption">{post.caption || 'A moment worth keeping.'}</p>
          {post.source === 'instagram' && <span className="shareorigin">Previously hosted on Instagram · original posting date preserved</span>}
          <ShareButtons url={url} caption={post.caption} siteName={config.siteName}/>
        </div>
      </article>
    </main>
  </div>;
}
