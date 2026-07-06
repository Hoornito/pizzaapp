'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import { useSocket } from '@/hooks/useSocket';
import { useSnackbar } from '@/app/snackbar-context';
import { qzConnect, qzDisconnect, qzIsActive, qzListPrinters, qzPrintHtml } from '@/lib/qz';

// No forzamos tamaño de hoja desde la app: dejamos que cada impresora use su
// propio tamaño configurado en el driver (ej. cocina en A4 escala 50%, comanda
// en el rollo de la térmica). Forzar un tamaño que la impresora no soporta hace
// que el driver descarte el trabajo en silencio (no imprime ni encola).

type LogEntry = { time: string; text: string; ok: boolean };

export default function PrintStationPage() {
  const { socket } = useSocket();
  const { showError, showSuccess } = useSnackbar();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [cocinaPrinter, setCocinaPrinter] = useState('');
  const [comandaPrinter, setComandaPrinter] = useState('');
  const [active, setActive] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  // Refs para que el handler del socket lea siempre los valores actuales.
  const activeRef = useRef(false);
  const cocinaRef = useRef('');
  const comandaRef = useRef('');

  const addLog = useCallback((text: string, ok = true) => {
    setLog((prev) => [{ time: new Date().toLocaleTimeString('es-AR'), text, ok }, ...prev].slice(0, 30));
  }, []);

  // Cargar configuración guardada.
  useEffect(() => {
    const c = localStorage.getItem('printStation:cocina') || '';
    const m = localStorage.getItem('printStation:comanda') || '';
    const a = localStorage.getItem('printStation:active') === '1';
    setCocinaPrinter(c); cocinaRef.current = c;
    setComandaPrinter(m); comandaRef.current = m;
    setActive(a); activeRef.current = a;
  }, []);

  const refreshConnection = useCallback(async () => {
    setConnected(await qzIsActive());
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await qzConnect();
      setConnected(true);
      const list = await qzListPrinters();
      setPrinters(list);
      addLog(`Conectado a QZ Tray · ${list.length} impresora(s)`);
    } catch (err) {
      setConnected(false);
      addLog('No se pudo conectar a QZ Tray (¿está instalado y abierto?)', false);
      showError('No se pudo conectar a QZ Tray');
    } finally {
      setConnecting(false);
    }
  }, [addLog, showError]);

  // Intento de conexión automática al entrar.
  useEffect(() => {
    void connect();
    return () => { void qzDisconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMapping = (cocina: string, comanda: string) => {
    setCocinaPrinter(cocina); cocinaRef.current = cocina; localStorage.setItem('printStation:cocina', cocina);
    setComandaPrinter(comanda); comandaRef.current = comanda; localStorage.setItem('printStation:comanda', comanda);
  };

  const toggleActive = (on: boolean) => {
    setActive(on); activeRef.current = on;
    localStorage.setItem('printStation:active', on ? '1' : '0');
  };

  // Imprime ambos tickets de un pedido. El navegador (admin logueado) baja el
  // HTML de cada ticket y se lo pasa a QZ Tray, así QZ no necesita autenticación.
  const printOrder = useCallback(async (orderId: string) => {
    const cocina = cocinaRef.current;
    const comanda = comandaRef.current;
    if (!cocina && !comanda) { addLog('Pedido recibido pero no hay impresoras configuradas', false); return; }

    async function printTicket(route: string, printer: string, label: string) {
      if (!printer) return;
      try {
        const html = await fetch(`/admin/print/${orderId}/${route}?print=qz`, { credentials: 'include' }).then((r) => r.text());
        await qzPrintHtml(printer, html);
        addLog(`${label} → ${printer}`);
      } catch {
        addLog(`Error imprimiendo ${label} en ${printer}`, false);
      }
    }

    await printTicket('cocina', cocina, 'Cocina');
    await printTicket('comanda', comanda, 'Comanda');
  }, [addLog]);

  // Suscripción al evento de impresión del servidor.
  useEffect(() => {
    if (!socket) return;
    // Unirse a la sala 'print' AHORA y también en cada (re)conexión: si el socket
    // se cae y vuelve (corte de red, reinicio del server), hay que volver a
    // entrar a la sala o los pedidos confirmados se pierden.
    const join = () => {
      socket.emit('join:print');
      addLog('Estación en línea (escuchando pedidos)');
    };
    join();
    socket.on('connect', join);
    const handler = (data: { orderId: string }) => {
      if (!activeRef.current) { addLog(`Pedido ${data.orderId} recibido (estación pausada)`, false); return; }
      addLog(`Imprimiendo pedido…`);
      void printOrder(data.orderId);
    };
    socket.on('print:order', handler);
    return () => {
      socket.off('connect', join);
      socket.off('print:order', handler);
    };
  }, [socket, printOrder, addLog]);

  const testPrint = async () => {
    if (!connected) { showError('Conectá QZ Tray primero'); return; }
    const sample = '<html><body style="font-family:monospace;padding:8px"><h3>Prueba de impresión</h3><p>Estación PizzaApp</p></body></html>';
    try {
      if (cocinaPrinter) await qzPrintHtml(cocinaPrinter, sample);
      if (comandaPrinter) await qzPrintHtml(comandaPrinter, sample);
      showSuccess('Prueba enviada');
      addLog('Prueba de impresión enviada');
    } catch {
      showError('Falló la prueba de impresión');
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Estación de impresión</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Dejá esta PC (con QZ Tray y las dos impresoras WiFi) con esta pantalla abierta. Cuando se confirme
        un pedido en cualquier dispositivo, se imprimen acá la cocina y la comanda.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={connected ? 'QZ Tray conectado' : 'QZ Tray desconectado'}
              color={connected ? 'success' : 'default'}
            />
            <Button size="small" variant="outlined" onClick={connect} disabled={connecting}>
              {connecting ? 'Conectando…' : 'Reconectar'}
            </Button>
            <Button size="small" onClick={testPrint} disabled={!connected}>Probar impresión</Button>
          </Box>
          <FormControlLabel
            control={<Switch checked={active} onChange={(e) => toggleActive(e.target.checked)} />}
            label={active ? 'Estación activa' : 'Estación pausada'}
          />
        </Box>

        {!connected && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            QZ Tray no está conectado. Instalalo desde <strong>qz.io</strong>, abrilo en esta PC y tocá
            “Reconectar”. La primera vez te va a pedir permiso (“Allow”).
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Impresoras</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <FormControl fullWidth size="small" disabled={!connected}>
            <InputLabel>🖨️ Cocina (láser, A4)</InputLabel>
            <Select
              label="🖨️ Cocina (láser, A4)"
              value={cocinaPrinter}
              onChange={(e) => saveMapping(e.target.value, comandaPrinter)}
            >
              <MenuItem value=""><em>— sin asignar —</em></MenuItem>
              {printers.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" disabled={!connected}>
            <InputLabel>🧾 Comanda (térmica)</InputLabel>
            <Select
              label="🧾 Comanda (térmica)"
              value={comandaPrinter}
              onChange={(e) => saveMapping(cocinaPrinter, e.target.value)}
            >
              <MenuItem value=""><em>— sin asignar —</em></MenuItem>
              {printers.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          La asignación se guarda en esta PC. La cocina sale en A6; la comanda en el ancho de la térmica.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Actividad</Typography>
        <Divider sx={{ mb: 1.5 }} />
        {log.length === 0 ? (
          <Typography color="text.secondary">Sin actividad todavía.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {log.map((e, i) => (
              <Typography key={i} variant="body2" color={e.ok ? 'text.primary' : 'error'}>
                <span style={{ opacity: 0.6 }}>{e.time}</span> · {e.text}
              </Typography>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
