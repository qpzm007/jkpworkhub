import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import prisma from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // 최초 로그인 시 user_settings 자동 생성
      if (user.id && user.email) {
        await prisma.userSettings.upsert({
          where: { userId: user.id },
          update: {
            email: user.email,
          },
          create: {
            userId: user.id,
            email: user.email,
            apiKey: '',
            aiContext: '',
            customNames: JSON.stringify({
              dashboard: '대시보드',
              search: '통합 검색',
              vendors: '명함첩',
              components: '공유 자료실',
              orders: '프로젝트 & 업무 관리',
              allTasks: '전체 업무 리스트',
            }),
            userFolderSchema: JSON.stringify({
              schemaName: '기본',
              levels: [],
              fileNameVariables: [],
            }),
          },
        });

        // member_access target_user_id 매핑: 다른 사람이 이 사람의 이메일로 요청해둔 것
        await prisma.memberAccess.updateMany({
          where: {
            targetEmail: user.email,
            targetUserId: null,
          },
          data: {
            targetUserId: user.id,
          },
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
});
