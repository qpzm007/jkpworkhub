import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import { SessionProvider } from 'next-auth/react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansKR = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-noto', weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: 'JKP WorkHub - 통합 업무 관리',
  description: 'JKP WorkHub는 사내 부서별 기획서, 공통 서식 양식, 거래처 연락처 및 프로젝트 일정을 실시간 연동하는 통합 사내 업무 포털 솔루션입니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} ${notoSansKR.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
