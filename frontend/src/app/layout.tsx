import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata = {
  title: 'Jig & Fixtures',
  description: 'Jig & Fixtures Management Dashboard',
  icons: {
    icon: '/assets/img/logoapp.png',
    shortcut: '/assets/img/logoapp.png',
    apple: '/assets/img/logoapp.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,wght@0,400;0,500;0,700;1,400;1,500&family=Google+Sans+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className="bg-surface text-on-surface font-sans h-screen w-screen overflow-hidden flex">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

