import { AdminShell } from '@/components/layout/AdminShell';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    redirect('/login');
  }

  return <AdminShell role={session.user.role}>{children}</AdminShell>;
}
