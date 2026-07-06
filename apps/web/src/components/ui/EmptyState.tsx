'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
}

export function EmptyState({ icon = '📦', title, description, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 6,
        textAlign: 'center',
      }}
    >
      <Typography variant="h1" sx={{ fontSize: '3rem' }}>
        {icon}
      </Typography>
      <Typography variant="h6" color="text.secondary" fontWeight={600}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.disabled">
          {description}
        </Typography>
      )}
      {action && (
        <Button
          variant="contained"
          onClick={action.onClick}
          href={action.href}
          sx={{ mt: 1 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
