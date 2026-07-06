'use client';

import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { useState, useMemo } from 'react';
import { ProductCard } from './ProductCard';
import { EmpanadaDozenCard } from './EmpanadaDozenCard';
import { EmpanadaLooseCard } from './EmpanadaLooseCard';
import { PizzaSizeCards } from './PizzaSizeCards';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProducts, useCategories, usePromotions } from '@/hooks/useProducts';
import { useDebounce } from '@/hooks/useDebounce';

/** La docena se arma desde su propia card (categoría Empanadas), no como promo suelta. */
const DOZEN_PROMO_ID = 'promo-docena-empanadas';
const PROMOS_TAB = 'promotions';

export function ProductGrid() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { categories } = useCategories();
  const { products, loading } = useProducts({ available: true });
  const { promotions } = usePromotions(true);

  // Promociones a mostrar en la pestaña (la docena de empanadas tiene su card aparte).
  const promosForTab = useMemo(
    () => promotions.filter((p) => p.id !== DOZEN_PROMO_ID && !/docena/i.test(p.name)),
    [promotions]
  );
  const isPromotionsTab = selectedCategory === PROMOS_TAB;

  const empanadasCategoryId = useMemo(
    () => categories.find((c) => c.slug === 'empanadas')?.id,
    [categories]
  );

  // Para armar docenas: sólo los gustos regulares (excluye la Doble Cambalache).
  const empanadas = useMemo(
    () => products.filter((p) => p.categoryId === empanadasCategoryId && !/doble cambalache/i.test(p.name)),
    [products, empanadasCategoryId]
  );

  const pizzasCategoryId = useMemo(
    () => categories.find((c) => c.slug === 'pizzas')?.id,
    [categories]
  );

  const pizzas = useMemo(
    () => products.filter((p) => p.categoryId === pizzasCategoryId),
    [products, pizzasCategoryId]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesSearch = !debouncedSearch || p.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      // Las pizzas no se muestran sueltas: se arman desde las cards de tamaño.
      const isPizza = p.categoryId === pizzasCategoryId;
      // Los gustos de empanada se eligen desde la card "Empanadas sueltas" / docena.
      // La Doble Cambalache sí se muestra individual (no es un gusto).
      const isRegularEmpanada =
        p.categoryId === empanadasCategoryId && !/doble cambalache/i.test(p.name);
      return matchesCategory && matchesSearch && !isPizza && !isRegularEmpanada;
    });
  }, [products, selectedCategory, debouncedSearch, pizzasCategoryId, empanadasCategoryId]);

  // La opción "Docena de Empanadas" se muestra en "Todo" y en la categoría
  // Empanadas, siempre que no haya una búsqueda activa.
  const showDozenCard =
    !debouncedSearch &&
    empanadas.length > 0 &&
    (selectedCategory === 'all' || selectedCategory === empanadasCategoryId);

  // Las 3 cards de tamaño de pizza se muestran en "Todo" y en la categoría Pizzas.
  const showPizzaCards =
    !debouncedSearch &&
    pizzas.length > 0 &&
    (selectedCategory === 'all' || selectedCategory === pizzasCategoryId);

  if (loading) return <LoadingSpinner message="Cargando menú..." />;

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={selectedCategory}
          onChange={(_, v) => setSelectedCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="🍽️ Todo" value="all" />
          {promosForTab.length > 0 && <Tab label="🏷️ Promociones" value={PROMOS_TAB} />}
          {categories.map((cat) => (
            <Tab key={cat.id} label={`${cat.icon || ''} ${cat.name}`} value={cat.id} />
          ))}
        </Tabs>
      </Box>

      <TextField
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 3, width: { xs: '100%', sm: 320 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {isPromotionsTab ? (
        promosForTab.length === 0 ? (
          <EmptyState icon="🏷️" title="No hay promociones" description="Volvé pronto para ver nuestras ofertas" />
        ) : (
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            {promosForTab.map((promo) => (
              <Grid item xs={6} sm={6} md={4} lg={3} key={promo.id}>
                <PromotionCard promotion={promo} />
              </Grid>
            ))}
          </Grid>
        )
      ) : filtered.length === 0 && !showDozenCard && !showPizzaCards ? (
        <EmptyState
          icon="🍕"
          title="No hay productos"
          description={search ? `No encontramos "${search}"` : 'No hay productos en esta categoría'}
        />
      ) : (
        <Grid container spacing={{ xs: 1.5, sm: 3 }}>
          {showPizzaCards && <PizzaSizeCards pizzas={pizzas} />}
          {showDozenCard && (
            <>
              <Grid item xs={6} sm={6} md={4} lg={3}>
                <EmpanadaLooseCard empanadas={empanadas} />
              </Grid>
              <Grid item xs={6} sm={6} md={4} lg={3}>
                <EmpanadaDozenCard empanadas={empanadas} />
              </Grid>
            </>
          )}
          {filtered.map((product) => (
            <Grid item xs={6} sm={6} md={4} lg={3} key={product.id}>
              <ProductCard product={product} />
            </Grid>
          ))}
        </Grid>

      )}
    </Box>
  );
}
