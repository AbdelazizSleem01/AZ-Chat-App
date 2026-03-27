import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'AZ Chat',
    template: '%s · AZ Chat',
  },
  description:
    'AZ Chat is a modern real-time messaging app with rich media, stories, reactions, calls, tasks, reminders, and collaboration tools.',
  applicationName: 'AZ Chat',
  authors: [{ name: 'Abdelaziz Sleem' }],
  creator: 'Abdelaziz Sleem',
  publisher: 'AZ Chat',
  category: 'communication',
  keywords: [
    'chat',
    'messaging',
    'realtime',
    'calls',
    'stories',
    'reactions',
    'tasks',
    'reminders',
    'collaboration',
  ],
  openGraph: {
    type: 'website',
    url: '/',
    title: 'AZ Chat',
    description:
      'A modern real-time chat experience with rich media, stories, reactions, calls, tasks, reminders, and collaboration tools.',
    siteName: 'AZ Chat',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'AZ Chat',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AZ Chat',
    description:
      'A modern real-time chat experience with rich media, stories, reactions, calls, tasks, reminders, and collaboration tools.',
    images: ['/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
    ],
  },
  manifest: '/site.webmanifest',
  themeColor: '#7c3aed',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
