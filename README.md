# Calendar Heatmap for Power BI

A GitHub-style calendar heatmap custom visual for Power BI. Visualize daily, weekly, or monthly patterns with color-coded cells, anomaly detection, sparklines, multi-measure tooltips, year comparison, and more.

**Publisher:** Datayaga

![Power BI](https://img.shields.io/badge/Power%20BI-Custom%20Visual-F2C811?logo=powerbi&logoColor=white)

---

## Quick Start

1. Download the `.pbiviz` file from the [Releases](https://github.com/HungMCLe/datayaga-calendar-heatmap/releases) page
2. In Power BI Desktop, go to **Visualizations pane > ... > Import a visual from a file**
3. Select the `.pbiviz` file
4. Drag the Calendar Heatmap onto your report canvas
5. Add your fields:

| Field Well | What to Add | Required? |
|---|---|---|
| **Date** | A date column (or Date Hierarchy) | Yes |
| **Value** | A measure (e.g., Sales, Count) | Yes |
| **Tooltip Fields** | Additional measures for tooltip detail | No |
| **Annotation** | A text column to label specific dates | No |

---

## Features

### Core Visualization

- **Daily Calendar Grid** — 53-week x 7-day grid showing every day of the year
- **10 Color Palettes** — Green, Blue, Orange, Purple, Red, Viridis, Plasma, Warm, Cool, or Custom
- **Missing Data Distinction** — Zero-with-data gets the lightest color; no-data gets the empty color
- **Responsive Layout** — Cells dynamically resize to fill available space
- **Auto Orientation** — Automatically switches between horizontal (wide) and vertical (tall) layout based on container shape

### Labels & Markers

- **Month Labels** — Positioned along the week axis (top in horizontal, left in vertical)
- **Day-of-Week Labels** — Mon/Tue/Wed or single letters in vertical mode
- **Year Label** — Shown for single-year data; navigation arrows for multi-year
- **Week Numbers** — ISO week numbers along the grid edge
- **Data Labels** — Show values inside cells (auto-hides when cells are too small)
- **Today Marker** — Colored border highlighting today's date
- **Min/Max Markers** — Colored dots on the highest and lowest value cells

### Tooltips

- **Rich Tooltips** — Dark-themed tooltip showing date, color swatch, and value
- **Multi-Measure Tooltips** — Add up to 10 extra measures to the Tooltip Fields well
- **Annotations** — Text annotations shown in the tooltip for annotated dates
- **Anomaly Indicator** — Tooltip flags anomalous values

### Analytics

- **Summary Stats** — Total, Average, Min, Max, and day count displayed below the grid
- **Trend Sparkline** — A line chart showing value distribution across the year
- **Streak Tracking** — Longest consecutive streaks above and below the yearly average
- **Anomaly Detection** — Statistical outlier detection using rolling 30-day mean and standard deviation; anomalous cells pulse with a colored border

### Aggregation & Comparison

- **Daily / Weekly / Monthly Views** — Switch between aggregation levels in the format pane
- **Auto Granularity Detection** — If your data has only 12 points per year, it auto-switches to Monthly view
- **Year-over-Year Comparison** — Side-by-side view of two years for trend comparison
- **Year Navigation** — Arrow buttons to cycle through years when data spans multiple years

### Conditional Formatting

- **Threshold Overrides** — Define up to 3 value thresholds with custom colors (e.g., Red < 100, Yellow < 500, Green above)
- Works in both daily and aggregated views

### Interactions

- **Click to Cross-Filter** — Click a cell to filter other visuals on the page
- **Ctrl+Click** — Add to selection without clearing previous
- **Drag to Select** — Click and drag across cells to select a date range (5px dead-zone prevents accidental drags)
- **Right-Click Context Menu** — Drill-through and other Power BI context actions
- **Inbound Cross-Filtering** — When other visuals filter the data, non-matching cells dim automatically

---

## Format Pane Reference

### Cell Settings
| Setting | Default | Description |
|---|---|---|
| Cell Gap | 2 | Space between cells (1-5 px) |
| Corner Radius | 1 | Cell rounded corners (0-6 px) |
| Empty Day Color | `#161b22` | Color for days with no data |
| Week Starts on Monday | Off | Toggle Sunday/Monday week start |
| Show Data Labels | Off | Display values inside cells |
| Data Label Size | 9 | Font size for data labels (6-14) |
| Data Label Color | `#ffffff` | Color of data label text |

### Color Settings
| Setting | Default | Description |
|---|---|---|
| Color Palette | Green | Choose from 10 presets or Custom |
| Custom Start Color | `#9be9a8` | Low-value color (when Custom selected) |
| Custom End Color | `#216e39` | High-value color (when Custom selected) |
| Color Steps | 5 | Number of gradient steps (3-9) |

### Label Settings
| Setting | Default | Description |
|---|---|---|
| Show Month Labels | On | Show month abbreviations |
| Month Label Size | 10 | Font size (8-16) |
| Month Label Color | `#8b949e` | |
| Show Day Labels | On | Show day-of-week abbreviations |
| Day Label Size | 10 | Font size (8-14) |
| Day Label Color | `#8b949e` | |
| Show Year Label | On | Show year number |
| Year Label Size | 16 | Font size (12-24) |
| Year Label Color | `#c9d1d9` | |
| Show Week Numbers | Off | Show ISO week numbers |
| Week Number Size | 9 | Font size (8-12) |
| Week Number Color | `#8b949e` | |

### Legend Settings
| Setting | Default | Description |
|---|---|---|
| Show Legend | On | Show the color scale legend |
| Legend Position | Bottom Right | Bottom Right / Bottom Left / Top Right / Top Left |
| Legend Label Color | `#8b949e` | |

### Today Marker
| Setting | Default | Description |
|---|---|---|
| Show Today Marker | On | Highlight today's cell |
| Marker Color | `#58a6ff` | Border color |
| Marker Width | 2 | Border width (1-4 px) |

### Min/Max Markers
| Setting | Default | Description |
|---|---|---|
| Show Min/Max Markers | Off | Show dots on min/max cells |
| Min Marker Color | `#f85149` | Color for minimum value |
| Max Marker Color | `#ffd700` | Color for maximum value |

### Summary & Analytics
| Setting | Default | Description |
|---|---|---|
| Show Summary | Off | Display total/avg/min/max stats |
| Summary Font Size | 10 | Font size (9-14) |
| Summary Font Color | `#8b949e` | |
| Show Sparkline | Off | Show trend line below grid |
| Sparkline Color | `#58a6ff` | |
| Sparkline Height | 36 | Height in pixels (20-60) |
| Show Streaks | Off | Show longest streak info |

### Anomaly Detection
| Setting | Default | Description |
|---|---|---|
| Show Anomalies | Off | Enable anomaly highlighting |
| Threshold (Std Dev) | 2 | Standard deviations for outlier detection (1-4) |
| Anomaly Color | `#f85149` | Border color for anomalous cells |

### Aggregation & Comparison
| Setting | Default | Description |
|---|---|---|
| Aggregation Mode | Daily | Daily / Weekly / Monthly |
| Year-over-Year | Off | Side-by-side year comparison |

### Conditional Formatting
| Setting | Default | Description |
|---|---|---|
| Enable Thresholds | Off | Override color scale with threshold zones |
| Low Threshold Value | 0 | Values at or below this use the low color |
| Low Color | `#f85149` | |
| Mid Threshold Value | 50 | Values at or below this use the mid color |
| Mid Color | `#d29922` | |
| High Color | `#3fb950` | Values above mid threshold |

---

## Data Requirements

- **Date column**: Any date/datetime column, or a Power BI Date Hierarchy (Year > Quarter > Month > Day)
- **Value measure**: Any numeric measure — the visual colors cells by this value
- **Row limit**: Up to 30,000 rows (covers ~82 years of daily data)
- **Supported granularities**: Daily (365 rows/year), Weekly (52), Monthly (12) — auto-detected

---

## Development

### Prerequisites
- Node.js 18+
- Power BI Visual Tools: `npm install -g powerbi-visuals-tools`

### Build
```bash
npm install
pbiviz package
```

The `.pbiviz` file will be in the `dist/` folder.

### Dev Server
```bash
pbiviz start
```
Then enable Developer Visual in Power BI Desktop under **File > Options > Report Settings**.

---

## License

MIT
