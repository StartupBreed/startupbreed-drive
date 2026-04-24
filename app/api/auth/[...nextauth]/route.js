import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Request Drive access + ability to refresh token offline
          scope: 'openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On first sign-in, persist tokens from Google
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
      }

      // Refresh access token when it expires (expires_at is in seconds)
      if (Date.now() / 1000 < token.expires_at - 60) {
        return token;
      }

      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: token.refresh_token,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw data;
        return {
          ...token,
          access_token: data.access_token,
          expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
        };
      } catch {
        return { ...token, error: 'RefreshTokenError' };
      }
    },
    async session({ session, token }) {
      // Expose access_token to API routes via getServerSession()
      session.access_token = token.access_token;
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
