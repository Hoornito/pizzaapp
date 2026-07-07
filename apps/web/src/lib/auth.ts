import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import type { Provider } from 'next-auth/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Role } from '@prisma/client';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

declare module 'next-auth' {
  interface User {
    role: Role;
    phone?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      phone?: string | null;
    };
  }
}

// En next-auth v5 (Auth.js) la interfaz JWT vive en @auth/core/jwt; el submódulo
// 'next-auth/jwt' no es resoluble para la augmentation de tipos.
declare module '@auth/core/jwt' {
  interface JWT {
    role: Role;
    phone?: string | null;
  }
}

// Solo habilitamos un proveedor social si sus credenciales están cargadas, así
// la app no se rompe en entornos donde todavía no se configuró OAuth.
const oauthProviders: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  // allowDangerousEmailAccountLinking: enlaza la cuenta social con una cuenta
  // existente del mismo email (Google/Facebook verifican el email).
  oauthProviders.push(Google({ allowDangerousEmailAccountLinking: true }));
}
if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  oauthProviders.push(Facebook({ allowDangerousEmailAccountLinking: true }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Detrás del reverse proxy (Caddy) Auth.js no confía en el Host por defecto;
  // se lo indicamos explícitamente para producción.
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    ...oauthProviders,
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          phone: user.phone,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.phone = user.phone;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role;
        session.user.phone = token.phone;
      }
      return session;
    },
  },
});
