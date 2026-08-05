-- Dos turnos por día (mediodía y noche). Antes había una sola fila por día, así
-- que no se podía expresar "11–15 y 18–00" y el checkout no ofrecía franjas para
-- programar al mediodía.

ALTER TABLE "BusinessHours" ADD COLUMN "shift" INTEGER NOT NULL DEFAULT 0;

-- Lo que ya estaba cargado se clasifica por su hora de apertura: si abre de
-- tarde/noche es el turno 1 y deja libre el turno 0 para el mediodía. Comparar
-- strings 'HH:MM' funciona porque están con cero a la izquierda.
UPDATE "BusinessHours" SET "shift" = 1 WHERE "openTime" >= '15:00';

DROP INDEX "BusinessHours_dayOfWeek_key";
CREATE UNIQUE INDEX "BusinessHours_dayOfWeek_shift_key" ON "BusinessHours"("dayOfWeek", "shift");
