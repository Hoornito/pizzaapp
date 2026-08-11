import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { BUSINESS_WHATSAPP_DISPLAY, BUSINESS_WHATSAPP_LINK } from '@/lib/constants';

export function CustomerFooter() {
  return (
    <Box component="footer" sx={{ bgcolor: '#1a1a1a', color: '#fff', mt: 'auto', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 3 }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              🍕 Pizzería Cambalache
            </Typography>
            <Typography variant="body2" color="grey.400">
              Pizza a la piedra · San Vicente.
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Horarios
            </Typography>
            <Typography variant="body2" color="grey.400">
              Lunes a Sábado
            </Typography>
            <Typography variant="body2" color="grey.400" sx={{ mb: 1 }}>
              11:00 – 15:00 · 18:00 – 00:00
            </Typography>
            <Typography variant="body2" color="grey.400">
              Domingo
            </Typography>
            <Typography variant="body2" color="grey.400">
              18:00 – 00:00
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Contacto
            </Typography>
            {/* Logo de WhatsApp: es lo que la gente busca para escribir. */}
            <Link
              href={BUSINESS_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              aria-label={`Escribinos por WhatsApp al ${BUSINESS_WHATSAPP_DISPLAY}`}
              sx={{
                color: 'grey.300', display: 'inline-flex', alignItems: 'center', gap: 1,
                '&:hover': { color: '#25D366' },
              }}
            >
              <WhatsAppIcon sx={{ fontSize: 30, color: '#25D366' }} />
              <Box component="span" sx={{ fontWeight: 600 }}>{BUSINESS_WHATSAPP_DISPLAY}</Box>
            </Link>
          </Box>
        </Box>
        <Divider sx={{ borderColor: 'grey.800', mb: 2 }} />
        <Typography variant="caption" color="grey.600" align="center" display="block">
          © {new Date().getFullYear()} Pizzería Cambalache. Todos los derechos reservados.
        </Typography>
      </Container>
    </Box>
  );
}
