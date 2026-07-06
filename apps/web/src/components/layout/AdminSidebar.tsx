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
import { BrandLogo } from './BrandLogo';
import { useUIStore } from '@/store/uiStore';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, href: '/admin/dashboard' },
  { label: 'Mostrador', icon: <PointOfSaleIcon />, href: '/admin/pos' },
  { label: 'Pedidos', icon: <ShoppingBagIcon />, href: '/admin/orders' },
  { label: 'Productos', icon: <LocalPizzaIcon />, href: '/admin/products' },
  { label: 'Categorías', icon: <CategoryIcon />, href: '/admin/categories' },
  { label: 'Promociones', icon: <LocalOfferIcon />, href: '/admin/promotions' },
  { label: 'Usuarios', icon: <PeopleIcon />, href: '/admin/users' },
  { label: 'Finanzas', icon: <AccountBalanceWalletIcon />, href: '/admin/finance' },
  { label: 'Empleados', icon: <BadgeIcon />, href: '/admin/employees' },
  { label: 'Impresión', icon: <PrintIcon />, href: '/admin/print-station' },
  { label: 'Reportes', icon: <BarChartIcon />, href: '/admin/reports' },
  { label: 'Configuración', icon: <SettingsIcon />, href: '/admin/settings' },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

function DrawerContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

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
        {navItems.map((item) => {
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

export function AdminSidebar({ mobileOpen, onClose }: AdminSidebarProps) {
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
        <DrawerContent onNavigate={onClose} />
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
        <DrawerContent />
      </Drawer>
    </Box>
  );
}

export { DRAWER_WIDTH };
