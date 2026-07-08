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
import { RevenueChart } from '@/components/admin/RevenueChart';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = () => {
    setLoading(true);
    fetch(`/api/admin/reports?period=${period}&date=${date}`)
      .then((r) => r.json())
      .then((d) => setReport(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [period, date]);

  const handleExportExcel = async () => {
    const res = await fetch(`/api/admin/reports/export?period=${period}&date=${date}&format=xlsx`);
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
    const res = await fetch(`/api/admin/reports/export?period=${period}&date=${date}&format=csv`);
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
                          <TableCell align="right">{formatCurrency(e.sueldos)}</TableCell>
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
        </Grid>
      )}
    </Box>
  );
}
