'use client';

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart,
} from 'recharts';
import { useUiStore } from '@/stores/ui-store';

// Corporate-First Palette: Orange als Primär, Sky-Blue + Primaer als Sekundär,
// Semantic für Status-bezogene Daten. Bewusst reduziert – keine Rainbow-Show.
const CORPORATE_FARBEN = [
  '#ff8049', // Axano Orange
  '#1a2b4c', // Axano Primär
  '#3f4e65', // Axano Graphit
  '#c7d7e8', // Axano Sky-Blue
  '#22c55e', // Erfolg
  '#f59e0b', // Warnung
  '#3b82f6', // Info
];

const CORPORATE_FARBEN_DARK = [
  '#ff8049',
  '#8da4be',
  '#4a6280',
  '#c7d7e8',
  '#22c55e',
  '#f59e0b',
  '#3b82f6',
];

function useChartFarben() {
  const { darkMode } = useUiStore();
  return {
    palette: darkMode ? CORPORATE_FARBEN_DARK : CORPORATE_FARBEN,
    grid: darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(26, 43, 76, 0.06)',
    achse: darkMode ? '#8da4be' : '#6b7d94',
    tooltipBg: darkMode ? 'rgba(26, 36, 53, 0.92)' : 'rgba(255, 255, 255, 0.92)',
    tooltipRahmen: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(26, 43, 76, 0.10)',
    tooltipText: darkMode ? '#f0f4f8' : '#1a2b4c',
    labelText: darkMode ? '#f0f4f8' : '#1a2b4c',
    legendText: darkMode ? '#8da4be' : '#6b7d94',
  };
}

const tooltipBaseStyle = (farben: ReturnType<typeof useChartFarben>) => ({
  borderRadius: 12,
  border: `1px solid ${farben.tooltipRahmen}`,
  backgroundColor: farben.tooltipBg,
  backdropFilter: 'blur(12px) saturate(140%)',
  boxShadow: '0 10px 30px rgba(26, 43, 76, 0.12)',
  padding: '10px 12px',
  fontSize: 12,
  color: farben.tooltipText,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums' as const,
});

interface ZeitreiheDaten {
  datum: string;
  anzahl: number;
}

export function LeadZeitreihe({ daten }: { daten: ZeitreiheDaten[] }) {
  const farben = useChartFarben();
  const formatiert = daten.map((d) => ({
    ...d,
    datum: new Date(d.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formatiert} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8049" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#ff8049" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke={farben.grid} vertical={false} />
        <XAxis
          dataKey="datum"
          tick={{ fontSize: 11, fill: farben.achse }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: farben.achse }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipBaseStyle(farben)}
          cursor={{ stroke: '#ff8049', strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="anzahl"
          stroke="#ff8049"
          strokeWidth={2.5}
          fill="url(#leadGradient)"
          name="Leads"
          dot={false}
          activeDot={{
            r: 5,
            fill: '#ff8049',
            stroke: farben.tooltipBg,
            strokeWidth: 3,
          }}
        />
        <Line
          type="monotone"
          dataKey="anzahl"
          stroke="#ff8049"
          strokeWidth={2.5}
          dot={false}
          name="Leads"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusVerteilung({ daten }: { daten: Record<string, number> }) {
  const farben = useChartFarben();
  const chartDaten = Object.entries(daten).map(([name, wert]) => ({ name, wert }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartDaten} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke={farben.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: farben.achse }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 11, fill: farben.achse }}
          width={130}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipBaseStyle(farben)}
          cursor={{ fill: 'rgba(255, 128, 73, 0.06)' }}
        />
        <Bar dataKey="wert" radius={[0, 6, 6, 0]} name="Leads">
          {chartDaten.map((_, index) => (
            <Cell key={index} fill={farben.palette[index % farben.palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QuellenAufschluesselung({ daten }: { daten: Record<string, number> }) {
  const farben = useChartFarben();
  const quellenNamen: Record<string, string> = {
    facebook_lead_ads: 'Facebook',
    webhook: 'Webhook',
    email: 'E-Mail',
    whatsapp: 'WhatsApp',
    webformular: 'Formular',
    unbekannt: 'Unbekannt',
  };

  const chartDaten = Object.entries(daten).map(([name, wert]) => ({
    name: quellenNamen[name] || name,
    wert,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartDaten}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={100}
          paddingAngle={2}
          dataKey="wert"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: farben.achse, strokeWidth: 1 }}
          stroke={farben.tooltipBg}
          strokeWidth={3}
        >
          {chartDaten.map((_, index) => (
            <Cell key={index} fill={farben.palette[index % farben.palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipBaseStyle(farben)} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: farben.legendText, fontSize: 12, fontWeight: 500, marginLeft: 6 }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
