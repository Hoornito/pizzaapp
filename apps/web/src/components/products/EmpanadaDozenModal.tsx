'use client';

import { useMemo, useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DOZEN_SIZE, type EmpanadaDozen } from '@/types/product.types';
import type { ProductWithCategory } from '@/types/product.types';
import { formatCurrency } from '@/lib/utils';

/** Composición de una docena: productId -> cantidad. */
type Composition = Record<string, number>;

interface EmpanadaDozenModalProps {
  open: boolean;
  onClose: () => void;
  /** Empanadas disponibles para elegir. */
  empanadas: ProductWithCategory[];
  /** Precio de UNA docena. */
  dozenPrice: number;
  promotionName: string;
  /** Se invoca al confirmar, con la cantidad de docenas y su composición. */
  onConfirm: (args: { dozenCount: number; dozens: EmpanadaDozen[]; unitPrice: number }) => void;
}

const sumComposition = (c: Composition) =>
  Object.values(c).reduce((acc, n) => acc + n, 0);

export function EmpanadaDozenModal({
  open,
  onClose,
  empanadas,
  dozenPrice,
  promotionName,
  onConfirm,
}: EmpanadaDozenModalProps) {
  const [dozenCount, setDozenCount] = useState(1);
  const [compositions, setCompositions] = useState<Composition[]>([{}]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reinicia el estado cada vez que se abre el modal.
  useEffect(() => {
    if (open) {
      setDozenCount(1);
      setCompositions([{}]);
      setActiveIndex(0);
    }
  }, [open]);

  const activeComposition = compositions[activeIndex] ?? {};
  const activeTotal = sumComposition(activeComposition);
  const activeComplete = activeTotal === DOZEN_SIZE;
  const allComplete =
    compositions.length === dozenCount &&
    compositions.every((c) => sumComposition(c) === DOZEN_SIZE);
  const isLastDozen = activeIndex >= dozenCount - 1;

  const handleDozenCountChange = (next: number) => {
    if (next < 1) return;
    setDozenCount(next);
    setCompositions((prev) => {
      const copy = [...prev];
      if (next > copy.length) {
        while (copy.length < next) copy.push({});
      } else {
        copy.length = next;
      }
      return copy;
    });
    setActiveIndex((idx) => Math.min(idx, next - 1));
  };

  const changeFlavor = (productId: string, delta: number) => {
    setCompositions((prev) => {
      const copy = prev.map((c) => ({ ...c }));
      const current = copy[activeIndex] ?? {};
      const total = sumComposition(current);
      const currentQty = current[productId] ?? 0;
      const nextQty = currentQty + delta;
      if (nextQty < 0) return prev;
      if (delta > 0 && total >= DOZEN_SIZE) return prev; // no superar 12
      if (nextQty === 0) {
        delete current[productId];
      } else {
        current[productId] = nextQty;
      }
      copy[activeIndex] = current;
      return copy;
    });
  };

  const handleConfirm = () => {
    const dozens: EmpanadaDozen[] = compositions.map((c) => ({
      flavors: empanadas
        .filter((e) => (c[e.id] ?? 0) > 0)
        .map((e) => ({ productId: e.id, name: e.name, quantity: c[e.id] })),
    }));
    onConfirm({ dozenCount, dozens, unitPrice: dozenPrice });
  };

  const totalPrice = useMemo(() => dozenPrice * dozenCount, [dozenPrice, dozenCount]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        🥟 Armá tu {promotionName}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Selector de cantidad de docenas */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Cantidad de docenas
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(dozenPrice)} cada docena
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => handleDozenCountChange(dozenCount - 1)}
              disabled={dozenCount <= 1}
              sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
            >
              <RemoveIcon />
            </IconButton>
            <Typography variant="h6" fontWeight={700} sx={{ minWidth: 32, textAlign: 'center' }}>
              {dozenCount}
            </Typography>
            <IconButton
              onClick={() => handleDozenCountChange(dozenCount + 1)}
              sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
            >
              <AddIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Navegación entre docenas */}
        {dozenCount > 1 && (
          <Tabs
            value={activeIndex}
            onChange={(_, v) => setActiveIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 1, minHeight: 40 }}
          >
            {compositions.map((c, i) => {
              const complete = sumComposition(c) === DOZEN_SIZE;
              return (
                <Tab
                  key={i}
                  value={i}
                  sx={{ minHeight: 40, textTransform: 'none' }}
                  icon={complete ? <CheckCircleIcon color="success" fontSize="small" /> : undefined}
                  iconPosition="end"
                  label={`Docena ${i + 1}`}
                />
              );
            })}
          </Tabs>
        )}

        <Divider sx={{ mb: 1.5 }} />

        {/* Contador de la docena actual */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Docena {activeIndex + 1}
            </Typography>
            <Chip
              size="small"
              color={activeComplete ? 'success' : 'default'}
              label={`${activeTotal} / ${DOZEN_SIZE}`}
              sx={{ fontWeight: 700 }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={(activeTotal / DOZEN_SIZE) * 100}
            color={activeComplete ? 'success' : 'primary'}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        {/* Lista de sabores: 2 por fila, área con scroll interno si hay muchos */}
        <Box
          sx={{
            maxHeight: { xs: '40vh', sm: 320 },
            overflowY: 'auto',
            // pequeño margen para que el scrollbar no tape el borde de las cards
            mx: -0.5,
            px: 0.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
            alignContent: 'start',
          }}
        >
          {empanadas.map((emp) => {
            const qty = activeComposition[emp.id] ?? 0;
            const selected = qty > 0;
            return (
              <Paper
                key={emp.id}
                variant="outlined"
                sx={{
                  p: 0.75,
                  borderRadius: 2,
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.hover' : 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Avatar
                  src={emp.image || undefined}
                  variant="rounded"
                  sx={{ width: 36, height: 36, bgcolor: 'grey.100', fontSize: '1.1rem' }}
                >
                  🥟
                </Avatar>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ flexGrow: 1, minWidth: 0, lineHeight: 1.2 }}
                >
                  {emp.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    onClick={() => changeFlavor(emp.id, -1)}
                    disabled={qty === 0}
                    sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>
                    {qty}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => changeFlavor(emp.id, 1)}
                    disabled={activeTotal >= DOZEN_SIZE}
                    sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Total ({dozenCount} {dozenCount === 1 ? 'docena' : 'docenas'})
          </Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {formatCurrency(totalPrice)}
          </Typography>
        </Box>

        {isLastDozen ? (
          <Button
            variant="contained"
            size="large"
            disabled={!allComplete}
            onClick={handleConfirm}
          >
            Agregar al carrito
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            disabled={!activeComplete}
            onClick={() => setActiveIndex((i) => i + 1)}
          >
            Continuar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
