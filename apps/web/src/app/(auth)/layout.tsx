import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { BrandLogo } from '@/components/layout/BrandLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: 'background.default',
      }}
    >
      {/* Left panel - hidden on mobile */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          bgcolor: '#F7E7C6',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          color: 'text.primary',
        }}
      >
        <BrandLogo size={240} showText={false} />
        <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ mt: 2 }}>
          Pizzería Cambalache
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.8, textAlign: 'center' }}>
          Pizza a la piedra · San Vicente
        </Typography>
      </Box>

      {/* Right panel - form */}
      <Box
        sx={{
          flex: { xs: 1, md: 'none' },
          width: { md: 480 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 6 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
