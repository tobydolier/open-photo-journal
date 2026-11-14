import "./globals.css";
import "./theme.css";
import "./photo-frames.css";
import "./gallery-room.css";
import type { Metadata } from "next";
import { getPublicSiteConfig } from "../lib/site-config";

export function generateMetadata(): Metadata {
  const config = getPublicSiteConfig();
  return {
    title: config.siteName,
    description: config.siteDescription,
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
    openGraph: {
      title: config.siteName,
      description: config.siteDescription,
      images: config.shareImageUrl ? [{ url: config.shareImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: config.siteName,
      description: config.siteDescription,
      images: config.shareImageUrl ? [config.shareImageUrl] : undefined,
    },
  };
}

export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
