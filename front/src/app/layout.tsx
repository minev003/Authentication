// layout.tsx
import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import 'bootstrap/dist/css/bootstrap.min.css';
// НЕ импортирайте Script от 'next/script' тук, ако се ползва само в OpenCVLoader

import './globals.css';

export const metadata: Metadata = {
  title: "Верификация с Камера",
  description: "Приложение за верификация с OpenCV и Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head />
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}