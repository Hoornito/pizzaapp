'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { SnackbarProvider } from './snackbar-context';

const theme = createTheme({
  // Paleta tomada del logo: rojo tomate, verde del sombrero y crema del emblema.
  palette: {
    primary: {
      main: '#C62828', // rojo pizza (aros del logo)
      dark: '#8E0000',
      light: '#EF5350',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#2E7D32', // verde del sombrero
      dark: '#1B5E20',
      light: '#60AD5E',
      contrastText: '#ffffff',
    },
    background: {
      default: '#FBF3E2', // crema del emblema
      paper: '#ffffff',
    },
    text: {
      primary: '#3E2723', // marrón oscuro (trazos del logo)
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SessionProvider>
          <SnackbarProvider>
            {children}
          </SnackbarProvider>
        </SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
