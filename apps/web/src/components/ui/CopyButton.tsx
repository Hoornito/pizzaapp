'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface Props {
  text: string;
  label?: string;
  size?: 'small' | 'medium' | 'large';
}

/** Botón para copiar un texto al portapapeles con feedback "Copiado". */
export function CopyButton({ text, label = 'Copiar', size = 'small' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback para navegadores/contextos sin Clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      size={size}
      variant="outlined"
      color={copied ? 'success' : 'primary'}
      startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
      onClick={copy}
      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
    >
      {copied ? 'Copiado' : label}
    </Button>
  );
}
