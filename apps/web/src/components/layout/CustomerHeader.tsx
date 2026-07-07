'use client';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListItemIcon from '@mui/material/ListItemIcon';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { isStaff, isAdmin } from '@/lib/roles';
import { BrandLogo } from './BrandLogo';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';

export function CustomerHeader() {
  const { data: session } = useSession();
  const itemCount = useCartStore((s) => s.itemCount());
  const { toggleCart } = useUIStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ bgcolor: '#F7E7C6', color: 'text.primary', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
    >
      <Toolbar sx={{ minHeight: { xs: 68, sm: 72 }, gap: 1 }}>
        <Box
          component={Link}
          href="/menu"
          sx={{ flexGrow: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}
        >
          <BrandLogo size={54} showText={false} />
          <Typography
            variant="h6"
            fontWeight={800}
            noWrap
            sx={{ color: 'primary.main', display: { xs: 'none', sm: 'block' } }}
          >
            Pizzería Cambalache
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Button component={Link} href="/menu" sx={{ color: 'text.primary', display: { xs: 'none', sm: 'flex' } }}>
            Menú
          </Button>
          <Button component={Link} href="/promotions" sx={{ color: 'text.primary', display: { xs: 'none', sm: 'flex' } }}>
            Promociones
          </Button>

          <IconButton color="primary" onClick={toggleCart} aria-label="carrito">
            <Badge badgeContent={itemCount} color="secondary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>

          {session ? (
            <>
              <IconButton color="primary" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: '0.9rem' }}>
                  {session.user.name?.[0]?.toUpperCase() || '?'}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                {isStaff(session.user.role) && [
                  <MenuItem
                    key="admin"
                    component={Link}
                    href={isAdmin(session.user.role) ? '/admin/dashboard' : '/admin/pos'}
                    onClick={() => setAnchorEl(null)}
                  >
                    <ListItemIcon>
                      <DashboardIcon fontSize="small" />
                    </ListItemIcon>
                    {isAdmin(session.user.role) ? 'Panel de administración' : 'Panel de mostrador'}
                  </MenuItem>,
                  <Divider key="admin-divider" />,
                ]}
                <MenuItem component={Link} href="/orders" onClick={() => setAnchorEl(null)}>
                  Mis pedidos
                </MenuItem>
                <MenuItem component={Link} href="/profile" onClick={() => setAnchorEl(null)}>
                  Mi perfil
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setAnchorEl(null);
                    signOut({ callbackUrl: '/login' });
                  }}
                >
                  Cerrar sesión
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button component={Link} href="/login" variant="contained" color="primary" size="small" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
              Iniciar sesión
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
