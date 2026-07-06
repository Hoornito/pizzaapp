'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { buildWazeUrl, formatAddressLine } from '@/lib/utils';

interface MappableAddress {
  street: string;
  number: string;
  apartment?: string | null;
  city: string;
  state?: string | null;
}

interface DeliveryMapQRProps {
  address: MappableAddress;
  size?: number;
  /** Texto opcional debajo del QR. */
  caption?: string;
}

/**
 * QR que el repartidor escanea para abrir Google Maps con la ruta hacia la
 * dirección del cliente.
 */
export function DeliveryMapQR({ address, size = 140, caption }: DeliveryMapQRProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const mapsUrl = buildWazeUrl(address);

  useEffect(() => {
    QRCode.toDataURL(mapsUrl, { margin: 1, width: size * 2 })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [mapsUrl, size]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR ruta de entrega" width={size} height={size} />
      ) : (
        <Box sx={{ width: size, height: size, bgcolor: 'grey.100', borderRadius: 1 }} />
      )}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: size + 40 }}>
        {caption ?? 'Escaneá para ver la ruta'}
      </Typography>
      <Link href={mapsUrl} target="_blank" rel="noopener" variant="caption">
        Abrir en Waze
      </Link>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: size + 60 }}>
        {formatAddressLine(address)}
      </Typography>
    </Box>
  );
}
