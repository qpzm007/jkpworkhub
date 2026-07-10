import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import sql from '@/lib/db';

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
        await sql`
          INSERT INTO user_settings (user_id, api_key, ai_context, custom_names, user_folder_schema)
          VALUES (
            ${user.id},
            '',
            '',
            ${{ dashboard: '대시보드', search: '통합 검색', vendors: '명함첩', components: '공유 자료실', orders: '프로젝트 & 업무 관리', allTasks: '전체 업무 리스트' }}::jsonb,
            ${{ schemaName: '기본', levels: [], fileNameVariables: [] }}::jsonb
          )
          ON CONFLICT (user_id) DO NOTHING
        `;

        // member_access target_user_id 매핑: 다른 사람이 이 사람의 이메일로 요청해둔 것
        await sql`
          UPDATE member_access
          SET target_user_id = ${user.id}
          WHERE target_email = ${user.email} AND target_user_id IS NULL
        `;
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
