# WhatsApp → "Tomar pedido" (asistente con humano en el medio)

Esbozo del flujo para transcribir un pedido de una conversación de WhatsApp a un
pedido real en la app. La persona siempre revisa y confirma; la IA solo extrae y
pre-carga. Bajo riesgo (mensajería operada por humano, creación de pedido
interna) y bajo costo (~centavos por pedido, Claude Haiku).

## Flujo

1. **Bandeja de entrada** dentro del panel: la app corre una sesión de WhatsApp
   (API oficial a futuro; librería web para prototipo) y muestra las
   conversaciones. Ver [[whatsapp-integration]].
2. El operador abre una conversación con un pedido confirmado y toca
   **"Tomar pedido"**.
3. Backend arma un prompt con: (a) el **catálogo real** (productos con id, nombre,
   tamaños, precio; promos; empanadas), (b) el **texto de la conversación**, y (c)
   un **schema de salida estructurada**. Se llama a Claude Haiku con
   `output_config.format` (JSON garantizado).
4. La IA devuelve el pedido estructurado, **matcheado contra el catálogo** (cada
   ítem con su `productId`/`promotionId` real y tamaño).
5. Backend **valida** contra la base (que los ids existan, recalcula precios) y
   responde al front.
6. El front **pre-carga la pantalla de Mostrador** (`/admin/pos`) con esos ítems +
   datos del cliente. El operador **revisa, corrige y confirma** → se crea el
   pedido y se imprime (cocina + comanda), igual que un pedido de mostrador.

> Nada se confirma solo. La IA transcribe; el humano decide.

## Schema de extracción (salida estructurada)

Se le pide a la IA exactamente esta forma (JSON Schema con
`additionalProperties: false`, todos los campos `required`, opcionales vía enum
con `null`):

```jsonc
{
  "customerName": "string | null",
  "deliveryType": "PICKUP | DELIVERY",
  "address": {                     // null si PICKUP
    "street": "string",
    "number": "string",
    "apartment": "string | null",
    "city": "string",
    "reference": "string | null"
  } ,
  "paymentMethod": "EFECTIVO | TRANSFERENCIA | MIXTO | A_DEFINIR",
  "phone": "string | null",
  "notes": "string | null",        // observaciones generales
  "items": [
    {
      "kind": "PIZZA | EMPANADA_DOCENA | EMPANADA_SUELTA | PRODUCTO | PROMO",
      "productId": "string | null",     // resuelto contra el catálogo
      "promotionId": "string | null",
      "quantity": "number",
      "size": "SMALL | MEDIUM | LARGE | null",   // solo pizzas
      "pizzaHalves": ["productId1", "productId2"] , // null o 1-2 gustos (mitad y mitad)
      "empanadaFlavors": [ { "productId": "string", "quantity": "number" } ], // docenas/sueltas
      "unitPrice": "number | null",     // referencia; el backend recalcula
      "notes": "string | null",         // ej "sin aceitunas"
      "confidence": "number"            // 0-1: qué tan seguro está el match
    }
  ],
  "unmatched": ["string"]          // cosas que pidió y no se pudieron mapear
}
```

## Matching contra el catálogo

La clave es que la IA **no invente** productos: en el prompt se le pasa la lista
de productos disponibles (id + nombre + tamaños) y se le instruye a usar solo
esos `productId`. Reglas:

- **Pizzas**: "muzza grande" → producto *Muzzarella* + `size: LARGE`. Mitad y
  mitad → `pizzaHalves` con los dos `productId` (usa `formatPizzaNotes`).
- **Empanadas**: "6 de carne y 6 de pollo" → `EMPANADA_DOCENA` con
  `empanadaFlavors`. Sueltas → `EMPANADA_SUELTA`. (La *Doble Cambalache* es un
  producto aparte, no un gusto.)
- **Promos**: "promo 1" → `promotionId` de esa promo; si incluye "empanadas a
  elección", los gustos van en `empanadaFlavors` (ver [[printing-architecture]] y
  `src/lib/promos.ts`).
- **Bebidas/postres/pizzas rellenas**: match directo por nombre.
- **Método de pago**: si el cliente no lo aclara → `A_DEFINIR` (ya soportado).
- **Baja confianza / sin match**: va a `unmatched` y se resalta en el Mostrador
  para que el operador lo resuelva a mano. Nunca se descarta silenciosamente.

## Validación en el backend (imprescindible)

- Confirmar que cada `productId`/`promotionId` existe y está disponible.
- **Recalcular precios** desde la base (nunca confiar en el `unitPrice` de la IA).
- Recalcular total (+ envío si DELIVERY).
- Devolver el resultado al Mostrador para revisión; **no** crear el pedido
  automáticamente.

## Costo

Una extracción = 1 llamada a Claude Haiku (catálogo cacheado como prefijo).
≈ 1-5 centavos de dólar por pedido. Ver notas de modelo/costos en la charla.

## Reutiliza lo que ya existe

- Pantalla y lógica de **Mostrador** (`/admin/pos`) para revisar/confirmar.
- `createOrder(..., { confirmImmediately, printOnCreate })` para crear + imprimir.
- Helpers `formatPizzaNotes`, `formatDozensNotes`, `formatPromoNotes`.

## Pendiente antes de construir

- Verificar el número de WhatsApp Business (bloqueante del canal).
- Decidir canal: API oficial (recomendado) vs librería web (prototipo).
- UI de bandeja de entrada + botón "Tomar pedido".
