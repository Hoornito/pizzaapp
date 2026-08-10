'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Chip from '@mui/material/Chip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FINANCE_PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'BOTH' | 'MANANA' | 'NOCHE'>('BOTH');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const shiftQS = `&shift=${shift}`;

  const loadReport = () => {
    setLoading(true);
    fetch(`/api/admin/reports?period=${period}&date=${date}${shiftQS}`)
      .then((r) => r.json())
      .then((d) => setReport(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [period, date, shift]);

  const handleExportExcel = async () => {
    const res = await fetch(`/api/admin/reports/export?period=${period}&date=${date}${shiftQS}&format=xlsx`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${period}-${date}.xlsx`;
      a.click();
    }
  };

  const handleExportCSV = async () => {
    const res = await fetch(`/api/admin/reports/export?period=${period}&date=${date}${shiftQS}&format=csv`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${period}-${date}.csv`;
      a.click();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Reportes</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={handleExportExcel}>📊 Excel</Button>
          <Button variant="outlined" onClick={handleExportCSV}>📄 CSV</Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Período</InputLabel>
            <Select value={period} label="Período" onChange={(e) => setPeriod(e.target.value)}>
              <MenuItem value="day">Día</MenuItem>
              <MenuItem value="week">Semana</MenuItem>
              <MenuItem value="month">Mes</MenuItem>
            </Select>
          </FormControl>
          <TextField
            type="date"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            label="Fecha de referencia"
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={loadReport} disabled={loading}>
            Actualizar
          </Button>
        </Box>

        {/* Filtro por turno (usa los horarios reales de las cajas de cada turno) */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Turno:</Typography>
          {([
            { key: 'BOTH', label: 'Ambos turnos' },
            { key: 'MANANA', label: '🌅 Turno mañana' },
            { key: 'NOCHE', label: '🌙 Turno noche' },
          ] as const).map((s) => (
            <Button
              key={s.key}
              size="small"
              variant={shift === s.key ? 'contained' : 'outlined'}
              onClick={() => setShift(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </Box>
      </Paper>

      {loading ? <LoadingSpinner message="Generando reporte..." /> : report && (
        <Grid container spacing={3}>
          {/* Resumen financiero */}
          {report.finance && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>Resumen financiero del período</Typography>

                {/* Destacados: Total Sobres y Total virtual */}
                <Grid container spacing={2} sx={{ mb: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '2px solid', borderColor: 'success.main' }}>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>TOTAL SOBRES (retiros)</Typography>
                      <Typography variant="h4" fontWeight={800} color="success.main">
                        {formatCurrency(report.finance.sobres)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {(() => {
                      const neto = report.finance.totalVirtualNeto;
                      const color = neto >= 0 ? 'success.main' : 'error.main';
                      return (
                        <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '2px solid', borderColor: color }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                            TOTAL VIRTUAL (neto)
                          </Typography>
                          <Typography variant="h4" fontWeight={800} color={color}>
                            {formatCurrency(neto)}
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  {[
                    { label: 'Caja ingresada (apertura)', value: formatCurrency(report.finance.cajaIngresada), color: 'info.main' },
                    { label: 'Total efectivo (ingresado)', value: formatCurrency(report.finance.totalEfectivoIngresado), color: 'success.main' },
                    { label: 'Total tarjetas / virtual (ingresado)', value: formatCurrency(report.finance.totalVirtualIngresado), color: 'success.main' },
                    { label: 'Gastos en efectivo', value: formatCurrency(report.finance.otrosGastosEfectivo), color: 'error.main' },
                    { label: 'Gastos virtuales', value: formatCurrency(report.finance.otrosGastosVirtual), color: 'error.main' },
                    { label: 'Sueldos pagados (efectivo)', value: formatCurrency(report.finance.sueldosEfectivo), color: 'error.main' },
                    { label: 'Sueldos pagados (virtual)', value: formatCurrency(report.finance.sueldosVirtual), color: 'error.main' },
                    { label: 'Adelantos de sueldo (efectivo)', value: formatCurrency(report.finance.adelantosEfectivo), color: 'error.main' },
                    { label: 'Adelantos de sueldo (virtual)', value: formatCurrency(report.finance.adelantosVirtual), color: 'error.main' },
                    { label: 'Total caja (esperado)', value: formatCurrency(report.finance.totalCaja), color: 'info.main' },
                    { label: 'Real en caja (arqueo)', value: formatCurrency(report.finance.realEnCaja), color: 'info.main' },
                    { label: 'Clientes en efectivo', value: String(report.finance.cantEfectivo) },
                    { label: 'Clientes en virtual', value: String(report.finance.cantVirtual) },
                    { label: 'Total operaciones', value: String(report.finance.totalOperaciones) },
                  ].map((m) => (
                    <Grid item xs={6} sm={4} md={3} key={m.label}>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, height: '100%' }}>
                        <Typography variant="caption" color="text.secondary" display="block">{m.label}</Typography>
                        <Typography variant="h6" fontWeight={700} color={m.color || 'text.primary'}>{m.value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* Detalle de gastos: en qué se gastó, no solo cuánto */}
          {report.finance?.expenses?.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                  <Typography variant="h6" fontWeight={600}>Detalle de gastos</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({report.finance.expenses.length} movimiento{report.finance.expenses.length === 1 ? '' : 's'})
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Fecha</strong></TableCell>
                        <TableCell><strong>Categoría</strong></TableCell>
                        <TableCell><strong>Detalle</strong></TableCell>
                        <TableCell><strong>Forma</strong></TableCell>
                        <TableCell align="right"><strong>Efectivo</strong></TableCell>
                        <TableCell align="right"><strong>Virtual</strong></TableCell>
                        <TableCell align="right"><strong>Total</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.finance.expenses.map((e: any) => (
                        <TableRow key={e.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(e.at)}</TableCell>
                          <TableCell>{e.category}</TableCell>
                          <TableCell>
                            {e.description || <Typography variant="caption" color="text.disabled">—</Typography>}
                            {e.employee && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                👤 {e.employee}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {FINANCE_PAYMENT_METHOD_LABELS[e.paymentMethod] || e.paymentMethod}
                          </TableCell>
                          <TableCell align="right">{e.cash > 0 ? formatCurrency(e.cash) : '—'}</TableCell>
                          <TableCell align="right">{e.virtual > 0 ? formatCurrency(e.virtual) : '—'}</TableCell>
                          <TableCell align="right">
                            <strong>{formatCurrency(e.amount)}</strong>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4}><strong>Total gastado</strong></TableCell>
                        <TableCell align="right">
                          <strong>{formatCurrency(report.finance.cashExpense)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{formatCurrency(report.finance.virtualExpense)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>
                            {formatCurrency(report.finance.cashExpense + report.finance.virtualExpense)}
                          </strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}

          {/* Pagos por empleado */}
          {report.finance?.byEmployee?.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>Pagos por empleado</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Empleado</strong></TableCell>
                        <TableCell align="right"><strong>Sueldos</strong></TableCell>
                        <TableCell align="right"><strong>Adelantos otorgados</strong></TableCell>
                        <TableCell align="right"><strong>Descontado</strong></TableCell>
                        <TableCell align="right"><strong>Adelanto neto</strong></TableCell>
                        <TableCell align="right"><strong>Total recibido</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.finance.byEmployee.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.name}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(e.sueldos)}
                            {/* Método (E/T) solo en el filtro por Día. */}
                            {period === 'day' && e.sueldoMetodo && e.sueldos > 0 && (
                              <Chip
                                size="small"
                                variant="outlined"
                                color={e.sueldoMetodo === 'E' ? 'success' : e.sueldoMetodo === 'T' ? 'info' : 'default'}
                                label={e.sueldoMetodo}
                                sx={{ ml: 0.75, height: 18, fontWeight: 700 }}
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(e.adelantosOtorgados)}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            {e.adelantosDescontado > 0 ? `− ${formatCurrency(e.adelantosDescontado)}` : formatCurrency(0)}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(e.adelantoNeto)}</TableCell>
                          <TableCell align="right"><strong>{formatCurrency(e.total)}</strong></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}

          {/* Revenue chart */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Ingresos por día</Typography>
              <RevenueChart data={report.revenueByDay || []} />
            </Paper>
          </Grid>

          {/* Top products */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Productos más vendidos</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Producto</strong></TableCell>
                      <TableCell align="right"><strong>Cantidad</strong></TableCell>
                      <TableCell align="right"><strong>Ingresos</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(report.topProducts || []).map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Top promotions */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Promociones más vendidas</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Promoción</strong></TableCell>
                      <TableCell align="right"><strong>Cantidad</strong></TableCell>
                      <TableCell align="right"><strong>Ingresos</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(report.topPromotions || []).map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Todos los productos: qué se vende y qué no */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" fontWeight={600}>Todos los productos — qué se vende y qué no</Typography>
                {report.allProducts && (
                  <Box sx={{ display: 'flex', gap: 1, ml: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip size="small" color="success" variant="outlined"
                      label={`${report.allProducts.filter((p: any) => p.totalUnits > 0).length} con salida`} />
                    <Chip size="small" color="default" variant="outlined"
                      label={`${report.allProducts.filter((p: any) => p.totalUnits === 0).length} sin salida`} />
                  </Box>
                )}
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  <b>Suelto</b> es lo que se vendió como producto (y factura). <b>En promos</b> es lo que salió dentro
                  de una promoción: no suma ingresos acá (los cobra la promo), pero sí salió de la cocina. Para saber
                  cuánto se consumió de verdad, mirá <b>Total</b>.
                </Typography>
                <TableContainer sx={{ maxHeight: 480 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Producto</strong></TableCell>
                        <TableCell><strong>Categoría</strong></TableCell>
                        <TableCell align="right"><strong>Suelto</strong></TableCell>
                        <TableCell align="right"><strong>En promos</strong></TableCell>
                        <TableCell align="right"><strong>Total</strong></TableCell>
                        <TableCell align="right"><strong>Ingresos</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(report.allProducts || []).map((item: any, i: number) => {
                        const salio = item.totalUnits > 0;
                        return (
                          <TableRow
                            key={i}
                            sx={{ borderLeft: '3px solid', borderLeftColor: salio ? 'success.main' : 'grey.300' }}
                          >
                            <TableCell sx={{ color: salio ? 'text.primary' : 'text.disabled' }}>{item.name}</TableCell>
                            <TableCell sx={{ color: 'text.secondary' }}>{item.category}</TableCell>
                            <TableCell align="right" sx={{ color: item.quantity > 0 ? 'text.primary' : 'text.disabled' }}>
                              {item.quantity || '—'}
                            </TableCell>
                            <TableCell align="right">
                              {item.inPromo > 0 ? (
                                <Typography component="span" fontWeight={600} color="secondary.main">
                                  {item.inPromo}
                                </Typography>
                              ) : (
                                <Typography component="span" color="text.disabled">—</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {salio ? (
                                <Typography component="span" fontWeight={700} color="success.main">{item.totalUnits}</Typography>
                              ) : (
                                <Chip size="small" color="warning" variant="outlined" label="Sin salida" />
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ color: item.revenue > 0 ? 'text.primary' : 'text.disabled' }}>
                              {formatCurrency(item.revenue)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
