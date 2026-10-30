import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Third Place Lab — A little reason to gather',description:'Turn your community’s cultural interests into thoughtful, practical events for your little space.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
