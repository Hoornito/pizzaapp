'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { MenuItemCard } from './MenuItemCard';
import { ProductOrderModal, type OrderOption } from './ProductOrderModal';
import { EmpanadaDozenCard } from './EmpanadaDozenCard';
import { EmpanadaLooseCard } from './EmpanadaLooseCard';
import { PizzaSizeCards } from './PizzaSizeCards';
import { DobleCambalacheDialog } from './DobleCambalacheDialog';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useProducts, useCategories, usePromotions } from '@/hooks/useProducts';
import { useMenuFlags } from '@/hooks/useMenuFlags';
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
/** Alto real del Toolbar de CustomerHeader: los tabs se pegan justo debajo. */
const HEADER_H = { xs: 68, sm: 72 };
/** El mismo valor, para calcular scroll (no hay breakpoints en JS puro). */
const headerPx = () => (typeof window !== 'undefined' && window.innerWidth < 600 ? HEADER_H.xs : HEADER_H.sm);

interface Section {
  id: string;
  label: string;
  /** Aclaración chica bajo el título (p. ej. cómo se hacen las pizzas). */
  note?: string;
}

/** Aclaraciones por categoría, para el subtítulo de la sección. */
const SECTION_NOTES: Record<string, string> = {
  pizzas: 'A la piedra · al molde solo en tamaño grande',
};

export function ProductGrid() {
  const [activeId, setActiveId] = useState<string>('');
  // Producto abierto en la ficha (elegir opciones y cantidad).
  const [opened, setOpened] = useState<ProductWithCategory | null>(null);
  const [dobleOpen, setDobleOpen] = useState<ProductWithCategory | null>(null);
  // Al saltar por tab, apagamos el scroll-spy un momento para que no titile.
  const jumpingRef = useRef(false);
  // Para centrar solas las píldoras mientras se scrollea.
  const pillsRef = useRef<HTMLDivElement | null>(null);
  // La barra fija cambia de alto según la sección (algunas llevan aclaración):
  // la medimos en vez de hardcodear el offset.
  const barRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Fotos de las tarjetas armables (mitad y mitad, empanadas sueltas): no son
  // productos, así que su imagen se carga aparte desde Configuración.
  const [cardImages, setCardImages] = useState<Record<string, string>>({});

  // Lo que hoy no se puede hacer (al molde, tamaños sin discos).
  const { moldeDisabled, sizeDisabled } = useMenuFlags();

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
      if (hasProducts) {
        out.push({ id: c.id, label: `${c.icon || ''} ${c.name}`.trim(), note: SECTION_NOTES[c.slug] });
      }
    }
    return out;
  }, [categories, products, promosForTab.length]);

  useEffect(() => {
    fetch('/api/settings/menu-images')
      .then((r) => r.json())
      .then((d) => setCardImages(d.data || {}))
      .catch(() => setCardImages({}));
  }, []);

  // ── Scroll-spy: marca el tab de la sección que estás mirando ──────────────
  useEffect(() => {
    if (sections.length === 0) return;
    const onScroll = () => {
      if (jumpingRef.current) return;
      // La sección activa es la última cuyo inicio ya pasó la barra pegajosa.
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(`sec-${s.id}`);
        const limit = headerPx() + (barRef.current?.offsetHeight ?? 64) + 24;
        if (el && el.getBoundingClientRect().top <= limit) current = s.id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  // La píldora marcada tiene que verse sin scrollear la barra a mano.
  useEffect(() => {
    const cont = pillsRef.current;
    const pill = activeId ? pillRefs.current[activeId] : null;
    if (!cont || !pill) return;
    const target = pill.offsetLeft - cont.clientWidth / 2 + pill.clientWidth / 2;
    const max = cont.scrollWidth - cont.clientWidth;
    cont.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: 'smooth' });
  }, [activeId]);

  const goToSection = (id: string) => {
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    setActiveId(id);
    jumpingRef.current = true;
    // Descontamos el header + la barra de tabs, que también queda fija arriba.
    const bar = barRef.current?.offsetHeight ?? 64;
    window.scrollTo({ top: el.offsetTop - headerPx() - bar, behavior: 'smooth' });
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
      // Sin discos de ese tamaño: se ve pero no se puede elegir.
      disabled: sizeDisabled[s],
      caption: sizeDisabled[s] ? 'Hoy no hay' : undefined,
    }));

  const openProduct = (p: ProductWithCategory) => {
    // La Doble Cambalache pide los gustos antes de agregarse.
    if (/doble cambalache/i.test(p.name)) setDobleOpen(p);
    else setOpened(p);
  };

  const handleAdd = (
    p: ProductWithCategory,
    quantity: number,
    option: OrderOption | null,
    variant: string | null
  ) => {
    if (isPizza(p) && option) {
      const size = option.id as PizzaSize;
      const sel = { size, flavors: [{ productId: p.id, name: p.name }], price: option.price };
      // "AL MOLDE" va en su propia línea: así lo detecta el ticket de cocina.
      const notes =
        variant === 'molde' ? `${formatPizzaNotes(sel)}\nAL MOLDE` : formatPizzaNotes(sel);
      addItem({
        type: 'product',
        productId: p.id,
        name: formatPizzaName(sel),
        image: p.image,
        unitPrice: option.price,
        quantity,
        notes,
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
    // El precio de la card sale de los tamaños que HOY se pueden pedir: si la
    // grande está caída, anunciar su precio sería mentirle al cliente.
    const vendibles = sizes.filter((s) => !s.disabled);
    // En pizzas mostramos el precio MAS ALTO (la grande): adentro se ve el de
    // cada tamaño. Así el cliente no se encuentra con un precio mayor al entrar.
    const price = pizza ? Math.max(...vendibles.map((s) => s.price)) : toNumber(p.price);
    const available = availableFor(p);
    const outOfStock = available != null && available <= 0;

    // Una pizza sin ningún tamaño con precio no se puede pedir. Si están todos
    // los tamaños caídos, tampoco: se muestra como no disponible.
    if (pizza && sizes.length === 0) return null;
    const sinTamanos = pizza && vendibles.length === 0;

    return (
      // En celular ocupa el ancho completo (una entrada por fila).
      <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
        <MenuItemCard
          name={p.name}
          description={p.description}
          image={p.image}
          price={sinTamanos ? 0 : price}
          priceNote={pizza && vendibles.length > 1 ? 'hasta' : null}
          disabled={!p.available || outOfStock || sinTamanos}
          disabledLabel={outOfStock || sinTamanos ? 'Sin stock' : 'No disponible'}
          onOpen={() => openProduct(p)}
        />
      </Grid>
    );
  };

  if (loading) return <LoadingSpinner message="Cargando menú..." />;

  return (
    <Box>
      {/* Tabs píldora, pegados debajo del header mientras se scrollea */}
      {sections.length > 0 && (
        <Box
          ref={barRef}
          sx={{
            // Por debajo del header (1100) pero por encima de cualquier card.
            position: 'sticky', top: HEADER_H, zIndex: 1090,
            bgcolor: 'background.default',
            py: 1, mb: 1,
            // Tapa el contenido que pasa por detrás en los bordes del contenedor.
            mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 },
            borderBottom: '1px solid', borderColor: 'divider',
          }}
        >
          <Box
            ref={pillsRef}
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
                  ref={(el: HTMLButtonElement | null) => { pillRefs.current[s.id] = el; }}
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

          {/* Título de la sección donde estás parado, anclado con las píldoras. */}
          {(() => {
            const current = sections.find((s) => s.id === activeId) ?? sections[0];
            return (
              <Box sx={{ mt: 1, mb: 0.25 }}>
                <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                  {current.label}
                </Typography>
                {current.note && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {current.note}
                  </Typography>
                )}
              </Box>
            );
          })()}
        </Box>
      )}

      {sections.map((s) => (
        <Box key={s.id} id={`sec-${s.id}`} sx={{ scrollMarginTop: 140, mb: 5, pt: 1 }}>
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            {s.id === PROMOS_ID &&
              promosForTab.map((promo) => (
                <Grid item xs={6} sm={6} md={4} lg={3} key={promo.id}>
                  <PromotionCard promotion={promo} />
                </Grid>
              ))}

            {/* Pizzas: solo la card de mitad y mitad; cada gusto tiene la suya
                y el tamaño se elige adentro de la ficha. */}
            {s.id === pizzasCategoryId && (
              <PizzaSizeCards pizzas={pizzas} onlyHalf halfImage={cardImages['half']} />
            )}

            {/* Empanadas: sueltas y docena arman la selección de gustos. */}
            {s.id === empanadasCategoryId && empanadas.length > 0 && (
              <>
                <Grid item xs={6} sm={6} md={4} lg={3}>
                  <EmpanadaLooseCard empanadas={empanadas} image={cardImages['empanadas-loose']} />
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
      ))}

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
          variantLabel={isPizza(opened) ? 'Cocción' : undefined}
          variants={
            isPizza(opened)
              ? (sizeId) =>
                  // Al molde solo se hace en la grande; las otras van a la piedra.
                  sizeId === 'LARGE'
                    ? [
                        { id: 'piedra', label: 'A la piedra' },
                        // Sin masa de molde se muestra en gris, no se esconde:
                        // así el cliente ve que existe pero hoy no está.
                        { id: 'molde', label: 'Al molde', disabled: moldeDisabled, hint: moldeDisabled ? 'hoy no hay' : undefined },
                      ]
                    : [{ id: 'piedra', label: 'A la piedra' }]
              : undefined
          }
          onAdd={({ quantity, option, variant }) => handleAdd(opened, quantity, option, variant)}
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
