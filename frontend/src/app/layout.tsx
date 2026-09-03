import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata = {
  title: 'PE-Machining: Jig & Fixture Management',
  description: 'Jig and Fixture Management Dashboard',
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
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0" rel="stylesheet" />
      </head>
      <body className="bg-surface text-on-surface font-sans h-screen w-screen overflow-hidden flex">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

