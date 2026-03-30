# UI_DESIGN – Design System
## Axano LeadFlow Plattform
**Version:** 1.0.0  
**Stand:** März 2026  
**Schriftart:** Manrope | **Framework:** Tailwind CSS + shadcn/ui

---

## 1. Farbpalette

### 1.1 Primärfarben (Axano Corporate Design)

```css
:root {
  /* Primärfarben */
  --axano-primaer:     #1a2b4c;   /* Dunkelblau – Hauptfarbe */
  --axano-sekundaer:   #2f3542;   /* Graphit-Blau – Sekundär */
  --axano-graphit:     #3f4e65;   /* Graphit – Texte, Icons */

  /* Akzentfarben */
  --axano-sky-blue:    #c7d7e8;   /* Hellblau – Backgrounds, Badges */
  --axano-soft-cloud:  #f5f7fa;   /* Fast Weiß – Seitenhintergrund */
  --axano-orange:      #ff8049;   /* Orange – CTAs, Highlights */

  /* Semantische Farben */
  --axano-erfolg:      #22c55e;   /* Grün – Erfolg, Aktiv */
  --axano-warnung:     #f59e0b;   /* Gelb – Warnung */
  --axano-fehler:      #ef4444;   /* Rot – Fehler */
  --axano-info:        #3b82f6;   /* Blau – Information */
}
```

### 1.2 Tailwind-Konfiguration

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        axano: {
          primaer:    '#1a2b4c',
          sekundaer:  '#2f3542',
          graphit:    '#3f4e65',
          'sky-blue': '#c7d7e8',
          'soft-cloud': '#f5f7fa',
          orange:     '#ff8049',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      }
    }
  }
}
```

### 1.3 Dark Mode Farben

```css
[data-theme="dunkel"] {
  --hintergrund:       #0f1623;   /* Tiefstes Dunkelblau */
  --oberflaeche:       #1a2435;   /* Kartenoberfläche */
  --oberflaeche-2:     #1f2d42;   /* Erhöhte Oberfläche */
  --rahmen:            #2a3f5a;   /* Rahmenfarbe */
  --text-primaer:      #f0f4f8;   /* Haupttext */
  --text-sekundaer:    #8da4be;   /* Sekundärtext */
  --text-teritaer:     #4a6280;   /* Gedimmter Text */
  --orange:            #ff8049;   /* Gleich in beiden Modi */
}
```

---

## 2. Typografie

### 2.1 Schriftart: Manrope

```html
<!-- In layout.tsx einbinden -->
<link 
  href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap" 
  rel="stylesheet"
/>
```

### 2.2 Schriftgrößen-System

| Klasse | Größe | Gewicht | Verwendung |
|--------|-------|---------|------------|
| `text-display` | 36px | 700 | Seitenüberschriften |
| `text-h1` | 28px | 700 | Sektionsüberschriften |
| `text-h2` | 22px | 600 | Unterüberschriften |
| `text-h3` | 18px | 600 | Kartenüberschriften |
| `text-h4` | 16px | 600 | Labels, kleine Überschriften |
| `text-body` | 15px | 400 | Standardtext |
| `text-body-sm` | 13px | 400 | Sekundärtext, Metadaten |
| `text-caption` | 11px | 500 | Badges, Tags, Labels |
| `text-mono` | 13px | 400 | Code, IDs, Webhook-URLs |

---

## 3. Komponenten

### 3.1 Schaltflächen

```tsx
// Primär (Orange CTA)
<button className="bg-axano-orange hover:bg-orange-600 text-white 
  font-semibold px-5 py-2.5 rounded-lg transition-all 
  active:scale-95 text-sm">
  Neue Kampagne
</button>

// Sekundär (Outline)
<button className="border border-axano-graphit/30 text-axano-graphit 
  hover:bg-axano-soft-cloud font-medium px-5 py-2.5 rounded-lg 
  transition-all text-sm">
  Abbrechen
</button>

// Primär (Dunkelblau)
<button className="bg-axano-primaer hover:bg-axano-sekundaer text-white 
  font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
  Speichern
</button>

// Gefährlich (Löschen)
<button className="bg-red-500 hover:bg-red-600 text-white 
  font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
  Löschen
</button>
```

### 3.2 Eingabefelder

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-medium text-axano-graphit">
    Kampagnenname
  </label>
  <input
    type="text"
    className="w-full px-3 py-2.5 text-sm border border-axano-sky-blue 
      rounded-lg bg-white focus:outline-none focus:ring-2 
      focus:ring-axano-orange/50 focus:border-axano-orange 
      placeholder:text-gray-400 transition-all"
    placeholder="z.B. Pferdeversicherung Facebook Q2"
  />
  <p className="text-xs text-gray-400">Hilfstext oder Fehlermeldung</p>
</div>
```

### 3.3 Karten

```tsx
// Standardkarte
<div className="bg-white border border-axano-sky-blue/50 
  rounded-xl p-5 hover:shadow-sm transition-shadow">
  Inhalt
</div>

// Hervorgehobene Karte (aktive Kampagne)
<div className="bg-white border-2 border-axano-orange 
  rounded-xl p-5 shadow-sm">
  Inhalt
</div>

// KPI-Metrikkarte
<div className="bg-axano-soft-cloud rounded-xl p-5">
  <p className="text-xs font-medium text-axano-graphit/60 uppercase tracking-wide">
    Gesamt-Leads
  </p>
  <p className="text-3xl font-bold text-axano-primaer mt-1">247</p>
  <p className="text-xs text-green-500 mt-1 font-medium">+12 heute</p>
</div>
```

### 3.4 Badges / Status-Tags

```tsx
// Status-Badge Farbzuordnung
const statusFarben = {
  'Neu':               'bg-blue-100 text-blue-800',
  'In Bearbeitung':    'bg-amber-100 text-amber-800',
  'Follow-up':         'bg-purple-100 text-purple-800',
  'Nicht erreichbar':  'bg-red-100 text-red-800',
  'Termin gebucht':    'bg-green-100 text-green-800',
  'Nicht interessiert': 'bg-gray-100 text-gray-600',
};

<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusFarben[status]}`}>
  {status}
</span>

// Quellen-Badge
const quellenFarben = {
  'facebook_lead_ads': 'bg-blue-50 text-blue-700',
  'webhook':           'bg-gray-100 text-gray-700',
  'email':             'bg-orange-50 text-orange-700',
  'whatsapp':          'bg-green-50 text-green-700',
};
```

### 3.5 Seitenleiste (Navigation)

```tsx
// Seitenleiste: 240px breit, Axano Primärblau Hintergrund
<aside className="w-60 min-h-screen bg-axano-primaer flex flex-col">
  
  {/* Logo */}
  <div className="px-6 py-5 border-b border-white/10">
    {/* Axano Logo (SVG) */}
    <span className="text-white font-bold text-lg">Axano</span>
    <span className="text-axano-sky-blue text-xs block">LeadFlow</span>
  </div>
  
  {/* Navigation */}
  <nav className="flex-1 px-3 py-4 space-y-1">
    {navElemente.map(element => (
      <Link
        key={element.pfad}
        href={element.pfad}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg 
          text-sm font-medium transition-all ${
          aktiv 
            ? 'bg-white/15 text-white' 
            : 'text-axano-sky-blue/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <element.icon className="w-4 h-4" />
        {element.bezeichnung}
      </Link>
    ))}
  </nav>
  
  {/* Benutzer unten */}
  <div className="px-3 py-4 border-t border-white/10">
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-8 h-8 rounded-full bg-axano-orange flex items-center 
        justify-center text-white text-xs font-bold">
        MM
      </div>
      <div>
        <p className="text-white text-sm font-medium">Max M.</p>
        <p className="text-axano-sky-blue/60 text-xs">Admin</p>
      </div>
    </div>
  </div>
</aside>
```

### 3.6 Lead-Karte (Kanban)

```tsx
<div className="bg-white border border-axano-sky-blue/40 rounded-xl p-4 
  cursor-pointer hover:border-axano-orange/50 hover:shadow-sm 
  transition-all group">
  
  {/* Kopfzeile */}
  <div className="flex items-start justify-between mb-3">
    <div>
      <p className="font-semibold text-axano-primaer text-sm">
        {lead.vorname} {lead.nachname}
      </p>
      <p className="text-xs text-axano-graphit/60 mt-0.5">{lead.email}</p>
    </div>
    {lead.ist_duplikat && (
      <span className="text-xs bg-yellow-100 text-yellow-700 
        px-2 py-0.5 rounded-full font-medium">
        Duplikat
      </span>
    )}
  </div>
  
  {/* Metadaten */}
  <div className="flex items-center gap-2 flex-wrap">
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium 
      ${quellenFarben[lead.quelle]}`}>
      {lead.quelle_bezeichnung}
    </span>
    <span className="text-xs text-axano-graphit/50">
      {zeitVon(lead.erstellt_am)}
    </span>
  </div>
</div>
```

---

## 4. Layout-System

### 4.1 Hauptlayout

```
┌─────────────────────────────────────────────────┐
│  Seitenleiste (240px)  │  Hauptbereich (flex-1) │
│  bg: #1a2b4c           │                        │
│                        │  Kopfzeile (56px)      │
│  Logo                  │  ─────────────────────  │
│  Navigation            │  Inhaltsbereich        │
│  ...                   │  p-6, overflow-auto    │
│  Benutzer              │                        │
└─────────────────────────────────────────────────┘
```

### 4.2 Abstände-System

```
xs:  4px  (0.25rem)  – Enge Elemente
sm:  8px  (0.5rem)   – Innerhalb von Komponenten
md:  12px (0.75rem)  – Standard-Abstand
lg:  16px (1rem)     – Zwischen Komponenten
xl:  24px (1.5rem)   – Sektions-Abstand
2xl: 32px (2rem)     – Großer Abstand
3xl: 48px (3rem)     – Seitenabstand
```

---

## 5. Ikonografie

Alle Icons: **Lucide React** (`lucide-react`)

```tsx
import {
  LayoutDashboard,   // Dashboard
  Users,             // Leads
  Megaphone,         // Kampagnen
  FileText,          // Templates
  BarChart2,         // Analytics
  Zap,               // Automatisierungen
  Calendar,          // Kalender
  Settings,          // Einstellungen
  LogOut,            // Abmelden
  Plus,              // Neu hinzufügen
  Search,            // Suche
  Filter,            // Filtern
  Download,          // Exportieren
  Bell,              // Benachrichtigungen
  ChevronRight,      // Navigation
  ArrowUpRight,      // Externe Links
  Copy,              // Kopieren
  Check,             // Bestätigung
  X,                 // Schließen
  Trash2,            // Löschen
  Edit,              // Bearbeiten
  Eye,               // Anzeigen
} from 'lucide-react';

// Standard Icon-Größe: 16px (w-4 h-4) für Navigation
// Größere Icons: 20px (w-5 h-5) für Aktionen
// Dekorative Icons: 24px (w-6 h-6) für Leer-Zustände
```

---

## 6. Animationen

```css
/* Sanfte Übergänge */
.uebergang-standard {
  transition: all 150ms ease-in-out;
}

/* Karten-Hover */
.karte-hover {
  transition: box-shadow 150ms ease, border-color 150ms ease;
}

/* Seiteneintritt */
@keyframes einblenden {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.seite-einblenden {
  animation: einblenden 200ms ease-out;
}

/* Skeleton Loader */
@keyframes schimmern {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, 
    #f0f4f8 25%, #e2eaf2 50%, #f0f4f8 75%);
  background-size: 200% 100%;
  animation: schimmern 1.5s infinite;
}
```

---

## 7. Responsive Breakpoints

```
sm:  640px  – Kleine Tablets
md:  768px  – Tablets
lg:  1024px – Laptops (Mindestgröße für vollständige UI)
xl:  1280px – Desktop (optimale Ansicht)
2xl: 1536px – Große Bildschirme
```

**Hinweis:** Die Plattform ist primär für Desktop-Nutzung (≥ 1024px) optimiert. Mobile Ansicht (< 768px) wird in v2 hinzugefügt.

---

## 8. Wizard-Schritte Design

```tsx
// Fortschrittsbalken für 5-Schritte-Wizard
<div className="flex items-center gap-0 mb-8">
  {schritte.map((schritt, index) => (
    <React.Fragment key={schritt.id}>
      <div className="flex flex-col items-center gap-1">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center 
          text-xs font-bold transition-all ${
          index < aktuellerSchritt 
            ? 'bg-axano-orange text-white'        // Abgeschlossen
            : index === aktuellerSchritt 
            ? 'bg-axano-primaer text-white'       // Aktuell
            : 'bg-axano-soft-cloud text-axano-graphit/40 border border-axano-sky-blue' // Ausstehend
        }`}>
          {index < aktuellerSchritt ? <Check className="w-4 h-4" /> : index + 1}
        </div>
        <span className={`text-xs font-medium ${
          index === aktuellerSchritt ? 'text-axano-primaer' : 'text-axano-graphit/40'
        }`}>
          {schritt.bezeichnung}
        </span>
      </div>
      {index < schritte.length - 1 && (
        <div className={`flex-1 h-0.5 mb-5 ${
          index < aktuellerSchritt ? 'bg-axano-orange' : 'bg-axano-sky-blue/50'
        }`} />
      )}
    </React.Fragment>
  ))}
</div>
```

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
