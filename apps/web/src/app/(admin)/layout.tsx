import { AdminShell } from '@/components/layout/AdminShell';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  return <AdminShell>{children}</AdminShell>;
}
