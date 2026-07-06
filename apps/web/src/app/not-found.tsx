import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 700, color: 'primary.main' }}>
        404
      </Typography>
      <Typography variant="h5" color="text.secondary">
        Página no encontrada
      </Typography>
      <Typography variant="body1" color="text.secondary">
        La página que buscás no existe o fue movida.
      </Typography>
      <Button component={Link} href="/menu" variant="contained" size="large" sx={{ mt: 2 }}>
        Volver al menú
      </Button>
    </Box>
  );
}
