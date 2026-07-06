'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <AdminHeader onMenuClick={() => setMobileOpen((prev) => !prev)} />
        {/* Espaciador para compensar el AppBar fijo y que el contenido no quede tapado */}
        <Toolbar />
        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 2, md: 3 }, overflowX: 'hidden', overflowY: 'auto', bgcolor: 'grey.50' }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
