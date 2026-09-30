'use client';

import { useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { FINANCE_PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { computeSeniority, formatYearsMonths } from '@/lib/seniority';

const ROLE_LABELS: Record<string, string> = { COCINERO: 'Cocinero', REPARTIDOR: 'Repartidor', OTRO: 'Otro' };

const MOV_LABELS: Record<string, string> = {
  ADELANTO: 'Adelanto recibido',
  ADELANTO_DESCUENTO: 'Devolución / descuento de adelanto',
  ACUMULADO_APORTE: 'Guardado a favor',
  ACUMULADO_RETIRO: 'Retiro de lo guardado',
};

/**
 * "Mi legajo": lo que ve un empleado en su perfil si su cuenta está vinculada
 * a un empleado del local. Si la cuenta no es de un empleado no muestra nada.
 */
export function MyEmployeeRecord() {
  const [record, setRecord] = useState<any>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    fetch('/api/users/me/employee', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setRecord(json.data ?? null))
      .catch(() => setRecord(null));
  }, []);

  if (!record) return null;

  const prepaidYears = record.seniorityPayouts.reduce((s: number, p: any) => s + p.years, 0);
  const seniority = computeSeniority(record.hireDate, prepaidYears);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight={600}>Mi legajo</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {record.firstName} {record.lastName} · {ROLE_LABELS[record.role] || 'Otro'}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Field label="Fecha de ingreso" value={formatDateShort(record.hireDate)} />
        <Field label="Sueldo por día" value={formatCurrency(record.dailyWage)} />
        <Field label="Teléfono" value={record.phone || '—'} />
        <Field label="Teléfono de familiar" value={record.relativePhone || '—'} />
        <Field label="Dirección" value={record.address || '—'} />
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Stat title="Antigüedad total" value={formatYearsMonths(seniority.total)} />
        <Stat title="Años pre-cobrados" value={prepaidYears === 1 ? '1 año' : `${prepaidYears} años`} />
        <Stat title="Antigüedad vigente" value={formatYearsMonths(seniority.current)} highlight />
        <Stat title="Acumulado a favor" value={formatCurrency(record.acumulado)} />
        <Stat title="Adelantos pendientes" value={formatCurrency(record.adelantosPendientes)} />
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 1 }}>
        <Tab label="Pagos" />
        <Tab label="Adelantos y a favor" />
        <Tab label="Antigüedad pre-cobrada" />
      </Tabs>

      {tab === 0 && (
        <History
          empty="Todavía no hay pagos registrados."
          head={['Fecha', 'Concepto', 'Medio', 'Monto']}
          rows={record.payments.map((p: any) => [
            formatDateShort(p.createdAt),
            p.category,
            FINANCE_PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod,
            `${p.type === 'INCOME' ? '− ' : ''}${formatCurrency(p.amount)}`,
          ])}
        />
      )}
      {tab === 1 && (
        <History
          empty="No hay movimientos."
          head={['Fecha', 'Movimiento', 'Monto']}
          rows={record.movements.map((m: any) => [
            formatDateShort(m.createdAt),
            MOV_LABELS[m.kind] || m.kind,
            formatCurrency(m.amount),
          ])}
        />
      )}
      {tab === 2 && (
        <History
          empty="No pre-cobraste años de antigüedad."
          head={['Fecha', 'Años', 'Monto']}
          rows={record.seniorityPayouts.map((p: any) => [
            formatDateShort(p.paidAt),
            String(p.years),
            p.amount != null ? formatCurrency(p.amount) : '—',
          ])}
        />
      )}
    </Paper>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={500}>{value}</Typography>
    </Grid>
  );
}

function Stat({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <Grid item xs={6} md={4} lg>
      <Paper variant="outlined" sx={{ p: 1.5, height: '100%', ...(highlight && { borderColor: 'primary.main' }) }}>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        <Typography fontWeight={700} color={highlight ? 'primary.main' : 'text.primary'}>{value}</Typography>
      </Paper>
    </Grid>
  );
}

function History({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{empty}</Typography>;
  }
  const last = head.length - 1;
  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {head.map((h, i) => <TableCell key={h} align={i === last ? 'right' : 'left'}>{h}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => <TableCell key={j} align={j === last ? 'right' : 'left'}>{c}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
