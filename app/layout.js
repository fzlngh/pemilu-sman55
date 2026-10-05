import { Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
const font = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font' });
export const metadata = { title: 'Pemilihan OSIS SMAN 55 Jakarta', icons: { icon: '/depsis.jpg' } };
export default function Root({ children }) {
  return <html lang="id"><body className={font.variable}>{children}</body></html>;
}
