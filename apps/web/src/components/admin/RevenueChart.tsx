'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatCurrency } from '@/lib/utils';

interface DataPoint {
  date: string;
  revenue: number;
}

interface RevenueChartProps {
  data: DataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Sin datos para mostrar</Typography>
      </Box>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          height: 180,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {data.map((point, i) => {
          const heightPct = (point.revenue / maxRevenue) * 100;
          return (
            <Box
              key={i}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '10px' }}>
                {formatCurrency(point.revenue)}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  height: `${heightPct}%`,
                  minHeight: 4,
                  bgcolor: 'primary.main',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              />
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        {data.map((point, i) => (
          <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {point.date}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
