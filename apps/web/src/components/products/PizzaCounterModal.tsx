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
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import { PIZZA_SIZES, type PizzaSize, type ProductWithCategory } from '@/types/product.types';
import { flavorPrice, flavorsForSize, pizzaPrice, formatPizzaName, formatPizzaNotes } from '@/lib/pizza';
import { formatCurrency } from '@/lib/utils';

/** Una línea lista para agregar al carrito del mostrador. */
export interface PizzaCartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes: string;
}

type Mode = PizzaSize | 'HALF';

const SHORT_LABEL: Record<PizzaSize, string> = { SMALL: 'Chica', MEDIUM: 'Mediana', LARGE: 'Grande' };
const emptyBySize = (): Record<PizzaSize, Record<string, number>> => ({ SMALL: {}, MEDIUM: {}, LARGE: {} });

interface Props {
  open: boolean;
  onClose: () => void;
  /** Todos los productos-pizza (con precios por tamaño). */
  pizzas: ProductWithCategory[];
  onConfirm: (lines: PizzaCartLine[]) => void;
}

/**
 * Panel unificado de pizzas para el mostrador. Un selector de tamaño
 * (Chica/Mediana/Grande/Mitad y mitad) y, debajo, los gustos con contador +/-
 * como las empanadas. Cada tamaño guarda su propio conteo. "Mitad y mitad" tiene
 * su propio sub-selector de tamaño y cuenta MITADES (el total debe ser par).
 */
export function PizzaCounterModal({ open, onClose, pizzas, onConfirm }: Props) {
  const [mode, setMode] = useState<Mode>('MEDIUM');
  const [halfSize, setHalfSize] = useState<PizzaSize>('LARGE');
  // Enteras: pizzas completas por tamaño. Mitades: mitades por tamaño.
  const [wholeQty, setWholeQty] = useState<Record<PizzaSize, Record<string, number>>>(emptyBySize);
  const [halfQty, setHalfQty] = useState<Record<PizzaSize, Record<string, number>>>(emptyBySize);

  useEffect(() => {
    if (open) {
      setMode('MEDIUM');
      setHalfSize('LARGE');
      setWholeQty(emptyBySize());
      setHalfQty(emptyBySize());
    }
  }, [open]);

  const isHalf = mode === 'HALF';
  const currentSize: PizzaSize = isHalf ? halfSize : (mode as PizzaSize);
  const flavors = useMemo(() => flavorsForSize(pizzas, currentSize), [pizzas, currentSize]);
  const board = isHalf ? halfQty : wholeQty;
  const setBoard = isHalf ? setHalfQty : setWholeQty;

  const change = (id: string, delta: number) => {
    setBoard((prev) => {
      const sizeMap = { ...prev[currentSize] };
      const next = Math.max(0, (sizeMap[id] ?? 0) + delta);
      if (next === 0) delete sizeMap[id];
      else sizeMap[id] = next;
      return { ...prev, [currentSize]: sizeMap };
    });
  };

  // Totales
  const priceAt = (id: string, size: PizzaSize) => flavorPrice(pizzas.find((p) => p.id === id)!, size) ?? 0;

  const wholeSummary = useMemo(() => {
    let count = 0;
    let price = 0;
    for (const size of PIZZA_SIZES) {
      for (const [id, q] of Object.entries(wholeQty[size])) {
        count += q;
        price += q * priceAt(id, size);
      }
    }
    return { count, price };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wholeQty, pizzas]);

  const halfSummary = useMemo(() => {
    let halves = 0;
    let price = 0;
    const oddSizes: PizzaSize[] = [];
    for (const size of PIZZA_SIZES) {
      let sizeHalves = 0;
      let sizePrice = 0;
      for (const [id, q] of Object.entries(halfQty[size])) {
        sizeHalves += q;
        sizePrice += q * priceAt(id, size);
      }
      halves += sizeHalves;
      price += sizePrice / 2; // cada mitad aporta la mitad de su precio
      if (sizeHalves % 2 === 1) oddSizes.push(size);
    }
    return { halves, pairs: Math.floor(halves / 2), price, oddSizes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfQty, pizzas]);

  const totalPrice = wholeSummary.price + halfSummary.price;
  const nothing = wholeSummary.count === 0 && halfSummary.halves === 0;
  const canConfirm = !nothing && halfSummary.oddSizes.length === 0;

  const buildLines = (): PizzaCartLine[] => {
    const out: PizzaCartLine[] = [];
    // Enteras
    for (const size of PIZZA_SIZES) {
      for (const f of flavorsForSize(pizzas, size)) {
        const q = wholeQty[size][f.id] ?? 0;
        if (q <= 0) continue;
        const price = flavorPrice(f, size) ?? 0;
        const sel = { size, flavors: [{ productId: f.id, name: f.name }], price };
        out.push({ productId: f.id, name: formatPizzaName(sel), unitPrice: price, quantity: q, notes: formatPizzaNotes(sel) });
      }
    }
    // Mitad y mitad: aplanamos las mitades por tamaño y las emparejamos de a 2.
    for (const size of PIZZA_SIZES) {
      const flat: { id: string; name: string; price: number }[] = [];
      for (const f of flavorsForSize(pizzas, size)) {
        const q = halfQty[size][f.id] ?? 0;
        const price = flavorPrice(f, size) ?? 0;
        for (let i = 0; i < q; i++) flat.push({ id: f.id, name: f.name, price });
      }
      const grouped: Record<string, PizzaCartLine> = {};
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const a = flat[i];
        const b = flat[i + 1];
        const sel = {
          size,
          flavors: [{ productId: a.id, name: a.name }, { productId: b.id, name: b.name }],
          price: pizzaPrice([a.price, b.price]),
        };
        const notes = formatPizzaNotes(sel);
        if (grouped[notes]) grouped[notes].quantity += 1;
        else grouped[notes] = { productId: a.id, name: formatPizzaName(sel), unitPrice: sel.price, quantity: 1, notes };
      }
      out.push(...Object.values(grouped));
    }
    return out;
  };

  const sizeBtn = (m: Mode, label: string) => (
    <Button
      key={m}
      variant={mode === m ? 'contained' : 'outlined'}
      onClick={() => setMode(m)}
      sx={{ flex: 1, textTransform: 'none', py: 1, minWidth: 0 }}
    >
      {label}
    </Button>
  );

  const subSizeBtn = (s: PizzaSize) => (
    <Button
      key={s}
      size="small"
      variant={halfSize === s ? 'contained' : 'outlined'}
      color="secondary"
      onClick={() => setHalfSize(s)}
      sx={{ flex: 1, textTransform: 'none', minWidth: 0 }}
    >
      {SHORT_LABEL[s]}
    </Button>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        🍕 Pizzas
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Selector de tamaño */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {sizeBtn('SMALL', 'Chica')}
          {sizeBtn('MEDIUM', 'Mediana')}
          {sizeBtn('LARGE', 'Grande')}
          {sizeBtn('HALF', 'Mitad y mitad')}
        </Box>

        {/* Sub-selector de tamaño para mitad y mitad */}
        {isHalf && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Tamaño de la mitad y mitad:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {PIZZA_SIZES.map(subSizeBtn)}
            </Box>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {isHalf
            ? 'Elegí mitades (cada 2 forman una pizza). El total debe ser par.'
            : 'Elegí la cantidad de cada gusto.'}
        </Typography>

        {isHalf && halfSummary.oddSizes.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
            Falta 1 mitad para completar en: {halfSummary.oddSizes.map((s) => SHORT_LABEL[s]).join(', ')}.
          </Alert>
        )}

        {/* Gustos con contador */}
        <Box
          sx={{
            maxHeight: { xs: '42vh', sm: 340 },
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
            alignContent: 'start',
          }}
        >
          {flavors.map((f) => {
            const n = board[currentSize][f.id] ?? 0;
            const price = flavorPrice(f, currentSize) ?? 0;
            return (
              <Paper
                key={f.id}
                variant="outlined"
                sx={{
                  p: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
                  borderColor: n > 0 ? 'primary.main' : 'divider', bgcolor: n > 0 ? 'action.hover' : 'background.paper',
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }} noWrap>{f.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isHalf ? `½ ${formatCurrency(price / 2)}` : formatCurrency(price)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => change(f.id, -1)} disabled={n === 0} sx={{ bgcolor: 'grey.100' }}><RemoveIcon fontSize="small" /></IconButton>
                  <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{n}</Typography>
                  <IconButton size="small" onClick={() => change(f.id, 1)} sx={{ bgcolor: 'grey.100' }}><AddIcon fontSize="small" /></IconButton>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {wholeSummary.count} enteras · {halfSummary.pairs} mitad y mitad
          </Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">{formatCurrency(totalPrice)}</Typography>
        </Box>
        <Button variant="contained" size="large" disabled={!canConfirm} onClick={() => onConfirm(buildLines())}>
          Agregar al carrito
        </Button>
      </DialogActions>
    </Dialog>
  );
}
