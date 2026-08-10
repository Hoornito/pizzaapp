'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { MenuItemCard } from './MenuItemCard';
import { ProductOrderModal, type OrderOption } from './ProductOrderModal';
import { EmpanadaDozenCard } from './EmpanadaDozenCard';
import { EmpanadaLooseCard } from './EmpanadaLooseCard';
import { PizzaSizeCards } from './PizzaSizeCards';
import { DobleCambalacheDialog } from './DobleCambalacheDialog';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProducts, useCategories, usePromotions } from '@/hooks/useProducts';
import { useDebounce } from '@/hooks/useDebounce';
import { useCart } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { useSnackbar } from '@/app/snackbar-context';
import { HIDDEN_MENU_CATEGORY_SLUGS, controlsStock } from '@/lib/constants';
import { formatPizzaName, formatPizzaNotes, flavorPrice } from '@/lib/pizza';
import {
  PIZZA_SIZES,
  PIZZA_SIZE_LABELS,
  type PizzaSize,
  type ProductWithCategory,
} from '@/types/product.types';
import { toNumber } from '@/lib/utils';

/** La docena se arma desde su propia card (categoría Empanadas), no como promo suelta. */
const DOZEN_PROMO_ID = 'promo-docena-empanadas';
const PROMOS_ID = 'promociones';
/** Alto de la barra superior de la app: los tabs se pegan justo debajo. */
const HEADER_H = { xs: 56, sm: 64 };

interface Section {
  id: string;
  label: string;
}

export function ProductGrid() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [activeId, setActiveId] = useState<string>('');
  // Producto abierto en la ficha (elegir opciones y cantidad).
  const [opened, setOpened] = useState<ProductWithCategory | null>(null);
  const [dobleOpen, setDobleOpen] = useState<ProductWithCategory | null>(null);
  // Al saltar por tab, apagamos el scroll-spy un momento para que no titile.
  const jumpingRef = useRef(false);

  const { categories: allCategories } = useCategories();
  const { products: allProducts, loading } = useProducts({ available: true });
  const { promotions } = usePromotions(true);
  const { addItem, addItemAndOpen, items } = useCart();
  const { openCart } = useUIStore();
  const { showError } = useSnackbar();

  // Los "Agregados" son de uso interno: no se muestran en el menú del cliente.
  const categories = useMemo(
    () => allCategories.filter((c) => !HIDDEN_MENU_CATEGORY_SLUGS.includes(c.slug)),
    [allCategories]
  );
  const hiddenIds = useMemo(
    () => new Set(allCategories.filter((c) => HIDDEN_MENU_CATEGORY_SLUGS.includes(c.slug)).map((c) => c.id)),
    [allCategories]
  );
  const products = useMemo(
    () => allProducts.filter((p) => !hiddenIds.has(p.categoryId)),
    [allProducts, hiddenIds]
  );

  const catId = useCallback(
    (slug: string) => categories.find((c) => c.slug === slug)?.id,
    [categories]
  );
  const pizzasCategoryId = catId('pizzas');
  const empanadasCategoryId = catId('empanadas');

  const pizzas = useMemo(
    () => products.filter((p) => p.categoryId === pizzasCategoryId),
    [products, pizzasCategoryId]
  );
  // Gustos de empanada: se eligen desde las cards de docena/sueltas, no sueltos.
  // La Doble Cambalache sí es un producto propio.
  const isRegularEmpanada = useCallback(
    (p: ProductWithCategory) =>
      p.categoryId === empanadasCategoryId && !/doble cambalache/i.test(p.name),
    [empanadasCategoryId]
  );
  const empanadas = useMemo(() => products.filter(isRegularEmpanada), [products, isRegularEmpanada]);

  const promosForTab = useMemo(
    () => promotions.filter((p) => p.id !== DOZEN_PROMO_ID && !/docena/i.test(p.name)),
    [promotions]
  );

  // ── Secciones (en el orden en que se muestran) ────────────────────────────
  const sections: Section[] = useMemo(() => {
    const out: Section[] = [];
    if (promosForTab.length) out.push({ id: PROMOS_ID, label: '🏷️ Promociones' });
    for (const c of categories) {
      const hasProducts = products.some((p) => p.categoryId === c.id);
      if (hasProducts) out.push({ id: c.id, label: `${c.icon || ''} ${c.name}`.trim() });
    }
    return out;
  }, [categories, products, promosForTab.length]);

  // ── Scroll-spy: marca el tab de la sección que estás mirando ──────────────
  useEffect(() => {
    if (debouncedSearch || sections.length === 0) return;
    const headerOffset = window.innerWidth < 600 ? 56 : 64;
    const onScroll = () => {
      if (jumpingRef.current) return;
      // La sección activa es la última cuyo inicio ya pasó la barra pegajosa.
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(`sec-${s.id}`);
        if (el && el.getBoundingClientRect().top <= headerOffset + 90) current = s.id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections, debouncedSearch]);

  const goToSection = (id: string) => {
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    setActiveId(id);
    jumpingRef.current = true;
    const headerOffset = window.innerWidth < 600 ? 56 : 64;
    window.scrollTo({ top: el.offsetTop - headerOffset - 64, behavior: 'smooth' });
    // El smooth scroll dispara muchos eventos: reactivamos el spy al terminar.
    window.setTimeout(() => { jumpingRef.current = false; }, 700);
  };

  // ── Agregar al carrito ────────────────────────────────────────────────────
  /** Stock disponible del producto, descontando lo que ya está en el carrito. */
  const availableFor = useCallback(
    (p: ProductWithCategory) => {
      if (!controlsStock(p.category?.slug)) return undefined;
      const inCart = items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
      return Math.max(0, (p.stock ?? 0) - inCart);
    },
    [items]
  );

  const isPizza = (p: ProductWithCategory) => p.categoryId === pizzasCategoryId;

  /** Tamaños con precio cargado, como opciones de la ficha. */
  const sizeOptions = (p: ProductWithCategory): OrderOption[] =>
    PIZZA_SIZES.filter((s) => flavorPrice(p, s) != null).map((s) => ({
      id: s,
      label: PIZZA_SIZE_LABELS[s],
      price: flavorPrice(p, s)!,
    }));

  const openProduct = (p: ProductWithCategory) => {
    // La Doble Cambalache pide los gustos antes de agregarse.
    if (/doble cambalache/i.test(p.name)) setDobleOpen(p);
    else setOpened(p);
  };

  const handleAdd = (p: ProductWithCategory, quantity: number, option: OrderOption | null) => {
    if (isPizza(p) && option) {
      const size = option.id as PizzaSize;
      const sel = { size, flavors: [{ productId: p.id, name: p.name }], price: option.price };
      addItem({
        type: 'product',
        productId: p.id,
        name: formatPizzaName(sel),
        image: p.image,
        unitPrice: option.price,
        quantity,
        notes: formatPizzaNotes(sel),
        pizza: sel,
      });
      openCart();
      return;
    }

    const available = availableFor(p);
    if (available != null && quantity > available) {
      showError(`No quedan más de ${p.name} por ahora.`);
      return;
    }
    addItemAndOpen({
      type: 'product',
      productId: p.id,
      name: p.name,
      image: p.image,
      unitPrice: toNumber(p.price),
      quantity,
    });
  };

  // ── Render de una card de producto ────────────────────────────────────────
  const renderProduct = (p: ProductWithCategory) => {
    const pizza = isPizza(p);
    const sizes = pizza ? sizeOptions(p) : [];
    const price = pizza ? Math.min(...sizes.map((s) => s.price)) : toNumber(p.price);
    const available = availableFor(p);
    const outOfStock = available != null && available <= 0;

    // Una pizza sin ningún tamaño con precio no se puede pedir.
    if (pizza && sizes.length === 0) return null;

    return (
      <Grid item xs={6} sm={6} md={4} lg={3} key={p.id}>
        <MenuItemCard
          name={p.name}
          description={p.description}
          image={p.image}
          price={price}
          priceNote={pizza && sizes.length > 1 ? 'desde' : null}
          disabled={!p.available || outOfStock}
          disabledLabel={outOfStock ? 'Sin stock' : 'No disponible'}
          onOpen={() => openProduct(p)}
        />
      </Grid>
    );
  };

  if (loading) return <LoadingSpinner message="Cargando menú..." />;

  // ── Búsqueda: una sola lista de resultados, sin secciones ─────────────────
  const searching = debouncedSearch.trim().length > 0;
  const results = searching
    ? products.filter(
        (p) => !isRegularEmpanada(p) && p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : [];

  return (
    <Box>
      <TextField
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Tabs píldora, pegados debajo del header mientras se scrollea */}
      {!searching && sections.length > 0 && (
        <Box
          sx={{
            position: 'sticky', top: HEADER_H, zIndex: 5,
            bgcolor: 'background.default',
            py: 1, mb: 1,
            // Tapa el contenido que pasa por detrás en los bordes del contenedor.
            mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 },
            borderBottom: '1px solid', borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5,
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
            }}
          >
            {sections.map((s) => {
              const active = activeId === s.id;
              return (
                <Button
                  key={s.id}
                  onClick={() => goToSection(s.id)}
                  disableElevation
                  sx={{
                    flexShrink: 0, borderRadius: 999, px: 2, py: 0.75,
                    textTransform: 'none', whiteSpace: 'nowrap',
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? 'grey.900' : 'grey.100',
                    color: active ? 'common.white' : 'text.secondary',
                    '&:hover': { bgcolor: active ? 'grey.900' : 'grey.200' },
                  }}
                >
                  {s.label}
                </Button>
              );
            })}
          </Box>
        </Box>
      )}

      {searching ? (
        results.length === 0 ? (
          <EmptyState icon="🍕" title="No hay productos" description={`No encontramos "${search}"`} />
        ) : (
          <>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
              Resultados
            </Typography>
            <Grid container spacing={{ xs: 1.5, sm: 3 }}>{results.map(renderProduct)}</Grid>
          </>
        )
      ) : (
        sections.map((s) => (
          <Box key={s.id} id={`sec-${s.id}`} sx={{ scrollMarginTop: 140, mb: 5 }}>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5 }}>
              {s.label}
            </Typography>

            <Grid container spacing={{ xs: 1.5, sm: 3 }}>
              {s.id === PROMOS_ID &&
                promosForTab.map((promo) => (
                  <Grid item xs={6} sm={6} md={4} lg={3} key={promo.id}>
                    <PromotionCard promotion={promo} />
                  </Grid>
                ))}

              {/* Pizzas: primero armar por tamaño y mitad y mitad, después los gustos. */}
              {s.id === pizzasCategoryId && <PizzaSizeCards pizzas={pizzas} />}

              {/* Empanadas: sueltas y docena arman la selección de gustos. */}
              {s.id === empanadasCategoryId && empanadas.length > 0 && (
                <>
                  <Grid item xs={6} sm={6} md={4} lg={3}>
                    <EmpanadaLooseCard empanadas={empanadas} />
                  </Grid>
                  <Grid item xs={6} sm={6} md={4} lg={3}>
                    <EmpanadaDozenCard empanadas={empanadas} />
                  </Grid>
                </>
              )}

              {s.id !== PROMOS_ID &&
                products
                  .filter((p) => p.categoryId === s.id && !isRegularEmpanada(p))
                  .map(renderProduct)}
            </Grid>
          </Box>
        ))
      )}

      {opened && (
        <ProductOrderModal
          open
          onClose={() => setOpened(null)}
          name={opened.name}
          description={opened.description}
          image={opened.image}
          price={isPizza(opened) ? null : toNumber(opened.price)}
          optionsLabel={isPizza(opened) ? 'Tamaño' : undefined}
          options={isPizza(opened) ? sizeOptions(opened) : undefined}
          maxQuantity={availableFor(opened)}
          onAdd={({ quantity, option }) => handleAdd(opened, quantity, option)}
        />
      )}

      {dobleOpen && (
        <DobleCambalacheDialog
          open
          onClose={() => setDobleOpen(null)}
          price={toNumber(dobleOpen.price)}
          onConfirm={(notes) => {
            addItemAndOpen({
              type: 'product',
              productId: dobleOpen.id,
              name: dobleOpen.name,
              image: dobleOpen.image,
              unitPrice: toNumber(dobleOpen.price),
              quantity: 1,
              notes,
            });
            setDobleOpen(null);
          }}
        />
      )}
    </Box>
  );
}
