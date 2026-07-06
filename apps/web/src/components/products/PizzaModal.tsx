'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  PIZZA_SIZE_LABELS,
  type PizzaSize,
  type PizzaSelection,
  type ProductWithCategory,
} from '@/types/product.types';
import { flavorPrice, pizzaPrice } from '@/lib/pizza';
import { formatCurrency } from '@/lib/utils';

interface PizzaConfig {
  half: boolean;
  flavorIds: string[];
}

interface PizzaModalProps {
  open: boolean;
  onClose: () => void;
  size: PizzaSize;
  /** Gustos disponibles en este tamaño (con precio cargado). */
  flavors: ProductWithCategory[];
  onConfirm: (pizzas: PizzaSelection[]) => void;
}

const isPizzaComplete = (p: PizzaConfig) =>
  p.half ? p.flavorIds.length === 2 : p.flavorIds.length === 1;

export function PizzaModal({ open, onClose, size, flavors, onConfirm }: PizzaModalProps) {
  const [count, setCount] = useState(1);
  const [pizzas, setPizzas] = useState<PizzaConfig[]>([{ half: false, flavorIds: [] }]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setCount(1);
      setPizzas([{ half: false, flavorIds: [] }]);
      setActiveIndex(0);
    }
  }, [open]);

  // mapa id -> precio del gusto en este tamaño
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of flavors) {
      const p = flavorPrice(f, size);
      if (p != null) m[f.id] = p;
    }
    return m;
  }, [flavors, size]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of flavors) m[f.id] = f.name;
    return m;
  }, [flavors]);

  const priceOf = (cfg: PizzaConfig) => pizzaPrice(cfg.flavorIds.map((id) => priceMap[id] ?? 0));

  const active = pizzas[activeIndex] ?? { half: false, flavorIds: [] };
  const activeComplete = isPizzaComplete(active);
  const allComplete = pizzas.length === count && pizzas.every(isPizzaComplete);
  const isLast = activeIndex >= count - 1;
  const totalPrice = pizzas.reduce((s, p) => s + priceOf(p), 0);

  const handleCountChange = (next: number) => {
    if (next < 1) return;
    setCount(next);
    setPizzas((prev) => {
      const copy = [...prev];
      while (copy.length < next) copy.push({ half: false, flavorIds: [] });
      copy.length = next;
      return copy;
    });
    setActiveIndex((i) => Math.min(i, next - 1));
  };

  const updateActive = (mut: (p: PizzaConfig) => PizzaConfig) => {
    setPizzas((prev) => prev.map((p, i) => (i === activeIndex ? mut({ ...p }) : p)));
  };

  const toggleHalf = (half: boolean) => {
    updateActive((p) => ({
      half,
      // al pasar a entera dejamos 1 gusto; al pasar a mitad mantenemos los que haya (máx 2)
      flavorIds: half ? p.flavorIds.slice(0, 2) : p.flavorIds.slice(0, 1),
    }));
  };

  const toggleFlavor = (flavorId: string) => {
    updateActive((p) => {
      if (!p.half) return { ...p, flavorIds: [flavorId] };
      const has = p.flavorIds.includes(flavorId);
      if (has) return { ...p, flavorIds: p.flavorIds.filter((id) => id !== flavorId) };
      if (p.flavorIds.length >= 2) return p; // máximo 2
      return { ...p, flavorIds: [...p.flavorIds, flavorId] };
    });
  };

  const handleConfirm = () => {
    const result: PizzaSelection[] = pizzas.map((p) => ({
      size,
      flavors: p.flavorIds.map((id) => ({ productId: id, name: nameMap[id] })),
      price: priceOf(p),
    }));
    onConfirm(result);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        🍕 Armá tu {PIZZA_SIZE_LABELS[size]}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Cantidad de pizzas */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Cantidad de pizzas
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => handleCountChange(count - 1)}
              disabled={count <= 1}
              sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
            >
              <RemoveIcon />
            </IconButton>
            <Typography variant="h6" fontWeight={700} sx={{ minWidth: 32, textAlign: 'center' }}>
              {count}
            </Typography>
            <IconButton
              onClick={() => handleCountChange(count + 1)}
              sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
            >
              <AddIcon />
            </IconButton>
          </Box>
        </Box>

        {count > 1 && (
          <Tabs
            value={activeIndex}
            onChange={(_, v) => setActiveIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 1, minHeight: 40 }}
          >
            {pizzas.map((p, i) => (
              <Tab
                key={i}
                value={i}
                sx={{ minHeight: 40, textTransform: 'none' }}
                icon={isPizzaComplete(p) ? <CheckCircleIcon color="success" fontSize="small" /> : undefined}
                iconPosition="end"
                label={`Pizza ${i + 1}`}
              />
            ))}
          </Tabs>
        )}

        <Divider sx={{ mb: 1.5 }} />

        {/* Mitad y mitad */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Pizza {activeIndex + 1}
          </Typography>
          <FormControlLabel
            control={<Switch checked={active.half} onChange={(e) => toggleHalf(e.target.checked)} />}
            label="Mitad y mitad"
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {active.half
            ? `Elegí exactamente 2 gustos (${active.flavorIds.length}/2)`
            : 'Elegí 1 gusto'}
        </Typography>

        {/* Gustos */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {flavors.map((f) => {
            const selected = active.flavorIds.includes(f.id);
            const price = priceMap[f.id];
            const disabled = active.half && !selected && active.flavorIds.length >= 2;
            return (
              <Paper
                key={f.id}
                variant="outlined"
                onClick={() => !disabled && toggleFlavor(f.id)}
                sx={{
                  p: 1,
                  borderRadius: 2,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.hover' : 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {selected ? (
                  <CheckCircleIcon color="primary" fontSize="small" />
                ) : (
                  <Box sx={{ width: 20 }} />
                )}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {f.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatCurrency(price)}
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Total ({count} {count === 1 ? 'pizza' : 'pizzas'})
          </Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {formatCurrency(totalPrice)}
          </Typography>
        </Box>

        {isLast ? (
          <Button variant="contained" size="large" disabled={!allComplete} onClick={handleConfirm}>
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
