'use client';

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useUiStore } from '@/stores/ui-store';

// Farben die in Light UND Dark Mode gut sichtbar sind
const FARBEN = ['#ff8049', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

function useChartFarben() {
  const { darkMode } = useUiStore();
  return {
    grid: darkMode ? '#2a3f5a' : '#d5e1ed',
    achse: darkMode ? '#8da4be' : '#3f4e65',
    tooltipBg: darkMode ? '#1a2435' : '#ffffff',
    tooltipRahmen: darkMode ? '#2a3f5a' : '#c7d7e8',
    tooltipText: darkMode ? '#f0f4f8' : '#1a2b4c',
    labelText: darkMode ? '#f0f4f8' : '#1a2b4c',
    legendText: darkMode ? '#8da4be' : '#3f4e65',
  };
}

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
      <LineChart data={formatiert}>
        <CartesianGrid strokeDasharray="3 3" stroke={farben.grid} />
        <XAxis dataKey="datum" tick={{ fontSize: 12, fill: farben.achse }} stroke={farben.grid} />
        <YAxis tick={{ fontSize: 12, fill: farben.achse }} stroke={farben.grid} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${farben.tooltipRahmen}`,
            fontSize: 13,
            backgroundColor: farben.tooltipBg,
            color: farben.tooltipText,
          }}
        />
        <Line
          type="monotone"
          dataKey="anzahl"
          stroke="#ff8049"
          strokeWidth={2}
          dot={{ fill: '#ff8049', r: 4 }}
          name="Leads"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusVerteilung({ daten }: { daten: Record<string, number> }) {
  const farben = useChartFarben();
  const chartDaten = Object.entries(daten).map(([name, wert]) => ({ name, wert }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartDaten} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={farben.grid} />
        <XAxis type="number" tick={{ fontSize: 12, fill: farben.achse }} stroke={farben.grid} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: farben.achse }} width={120} stroke={farben.grid} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${farben.tooltipRahmen}`,
            fontSize: 13,
            backgroundColor: farben.tooltipBg,
            color: farben.tooltipText,
          }}
        />
        <Bar dataKey="wert" radius={[0, 4, 4, 0]} name="Leads">
          {chartDaten.map((_, index) => (
            <Cell key={index} fill={FARBEN[index % FARBEN.length]} />
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
          outerRadius={100}
          dataKey="wert"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: farben.achse }}
          stroke={farben.tooltipBg}
          strokeWidth={2}
        >
          {chartDaten.map((_, index) => (
            <Cell key={index} fill={FARBEN[index % FARBEN.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${farben.tooltipRahmen}`,
            fontSize: 13,
            backgroundColor: farben.tooltipBg,
            color: farben.tooltipText,
          }}
        />
        <Legend
          formatter={(value) => <span style={{ color: farben.legendText, fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
