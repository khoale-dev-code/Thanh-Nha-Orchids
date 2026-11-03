import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/context/store';
import { ServiceWorker } from '@/components/service-worker';
export const metadata: Metadata = { title: 'Vườn Lan Thanh Nhã | Quản lý bán hàng', description: 'Chốt đơn nhanh, quản lý khách hàng và in hóa đơn cho Vườn Lan Thanh Nhã', manifest: '/manifest.webmanifest', icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#00A651' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="vi"><body><StoreProvider>{children}</StoreProvider><ServiceWorker/></body></html>}
