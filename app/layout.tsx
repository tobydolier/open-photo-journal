import "./globals.css";
import "./theme.css";
import "./photo-frames.css";
import { getPublicSiteConfig } from "../lib/site-config";

export function generateMetadata() {
  const config = getPublicSiteConfig();
  return { title: config.siteName, description: config.siteDescription };
}

export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
