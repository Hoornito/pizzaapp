'use client';

import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LocalPizzaIcon from '@mui/icons-material/LocalPizza';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import CategoryIcon from '@mui/icons-material/Category';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BadgeIcon from '@mui/icons-material/Badge';
import PrintIcon from '@mui/icons-material/Print';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Role } from '@prisma/client';
import { BrandLogo } from './BrandLogo';
import { isAdmin } from '@/lib/roles';

const DRAWER_WIDTH = 240;

// `adminOnly`: solo lo ve el ADMIN. El MOSTRADOR no ve finanzas, empleados,
// usuarios ni reportes.
const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, href: '/admin/dashboard' },
  { label: 'Mostrador', icon: <PointOfSaleIcon />, href: '/admin/pos' },
  { label: 'Pedidos', icon: <ShoppingBagIcon />, href: '/admin/orders' },
  { label: 'Productos', icon: <LocalPizzaIcon />, href: '/admin/products' },
  { label: 'Categorías', icon: <CategoryIcon />, href: '/admin/categories' },
  { label: 'Promociones', icon: <LocalOfferIcon />, href: '/admin/promotions' },
  { label: 'Usuarios', icon: <PeopleIcon />, href: '/admin/users', adminOnly: true },
  { label: 'Finanzas', icon: <AccountBalanceWalletIcon />, href: '/admin/finance', adminOnly: true },
  { label: 'Empleados', icon: <BadgeIcon />, href: '/admin/employees', adminOnly: true },
  { label: 'Impresión', icon: <PrintIcon />, href: '/admin/print-station' },
  { label: 'Reportes', icon: <BarChartIcon />, href: '/admin/reports', adminOnly: true },
  { label: 'Configuración', icon: <SettingsIcon />, href: '/admin/settings' },
];

interface AdminSidebarProps {
  role: Role;
  mobileOpen?: boolean;
  onClose?: () => void;
}

function DrawerContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = navItems.filter((item) => !item.adminOnly || isAdmin(role));

  return (
    <Box>
      <Toolbar sx={{ gap: 1, py: 1, minHeight: '64px !important' }}>
        <BrandLogo size={40} showText={false} />
        <Typography
          variant="subtitle1"
          fontWeight={800}
          color="primary.main"
          sx={{ lineHeight: 1.15, minWidth: 0 }}
        >
          Pizzería Cambalache
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                component={Link}
                href={item.href}
                onClick={onNavigate}
                selected={active}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

export function AdminSidebar({ role, mobileOpen, onClose }: AdminSidebarProps) {
  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        <DrawerContent role={role} onNavigate={onClose} />
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: '1px solid #e0e0e0' },
        }}
        open
      >
        <DrawerContent role={role} />
      </Drawer>
    </Box>
  );
}

export { DRAWER_WIDTH };
