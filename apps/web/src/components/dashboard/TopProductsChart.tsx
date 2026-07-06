'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { formatCurrency } from '@/lib/utils';

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface TopProductsChartProps {
  products: TopProduct[];
  title?: string;
}

export function TopProductsChart({ products, title = 'Productos más vendidos' }: TopProductsChartProps) {
  const maxQty = products[0]?.quantity || 1;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          {title}
        </Typography>
        {products.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Sin datos para el período
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {products.slice(0, 8).map((product, index) => (
              <Box key={product.name}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{ width: 20, height: 20, bgcolor: 'primary.main', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}
                    >
                      {index + 1}
                    </Typography>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {product.name}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', ml: 1, flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {product.quantity} uds
                    </Typography>
                    <Typography variant="caption" display="block" fontWeight={600}>
                      {formatCurrency(product.revenue)}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(product.quantity / maxQty) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'grey.100',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: index === 0 ? 'primary.main' : 'primary.light',
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
