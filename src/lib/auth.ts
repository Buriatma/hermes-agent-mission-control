import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  session: { 
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - refresh token if older
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username or Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminUser = process.env.ADMIN_USERNAME || 'keshav'
        const adminPass = process.env.ADMIN_PASSWORD || 'Yehhimrich@01'

        if (
          credentials?.username === adminUser &&
          credentials?.password === adminPass
        ) {
          return {
            id: '1',
            name: 'Keshav Sharma',
            email: 'keshav321sharma.ks@gmail.com',
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      // Allow token refresh on session update
      if (trigger === 'update' && session) {
        token.name = session.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
