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

```
  +-------------------------+
  | Field Wells              |
  |                         |
  | Date *        [Date]    |
  | Value *       [Sales]   |
  | Tooltip       [Orders]  |  (optional, up to 10)
  | Annotation    [Notes]   |  (optional)
  +-------------------------+

  * = required
```

| Field Well | What to Add | Required? |
|---|---|---|
| **Date** | A date column (or Date Hierarchy: Year > Quarter > Month > Day) | Yes |
| **Value** | A measure (e.g., Sales, Count, Revenue) | Yes |
| **Tooltip Fields** | Additional measures shown in the hover tooltip | No |
| **Annotation** | A text column to label specific dates (e.g., "Holiday", "Launch Day") | No |

---

## Visual Layout

### Horizontal Mode (wide containers)

The default layout when the visual is wider than it is tall. Weeks go left to right, days of the week go top to bottom.

```
  2024
  Jan       Feb       Mar       Apr       ...
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  Sun
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |##|##|  |  |  |  |##|##|  |  |  |  |  |  |  |  Mon
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |##|##|  |  |  |  |##|##|##|  |  |  |  |  |  |  Tue
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |  |##|  |  |  |  |  |##|##|##|  |  |  |  |  |  Wed
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |  |  |  |  |  |  |  |##|##|  |  |  |  |  |  |  Thu
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |  |  |  |  |  |  |  |  |##|  |  |  |  |  |  |  Fri
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  Sat
  +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
                                       Less [=====] More
```

### Vertical Mode (tall containers)

Automatically activates when the visual is taller than it is wide. Days of the week go left to right, weeks go top to bottom.

```
       S  M  T  W  T  F  S
       +--+--+--+--+--+--+
  Jan  |  |  |##|##|  |  |
       +--+--+--+--+--+--+
       |  |  |##|##|  |  |
       +--+--+--+--+--+--+
       |  |  |  |##|  |  |
       +--+--+--+--+--+--+
       |  |  |  |  |  |  |
       +--+--+--+--+--+--+
  Feb  |  |##|##|##|##|  |
       +--+--+--+--+--+--+
       |  |##|##|##|##|  |
       +--+--+--+--+--+--+
       ...
```

The visual picks whichever orientation gives the largest cells for the given container size.

---

## Feature Guide

### 1. Color Palettes

Ten built-in palettes, plus a fully custom start/end color gradient.

```
  Greens:   [ ]  [..]  [##]  [##]  [##]     light to dark green
  Blues:    [ ]  [..]  [##]  [##]  [##]     light to dark blue
  Viridis:  [ ]  [..]  [##]  [##]  [##]     purple to yellow
  Custom:   [start color] -----> [end color]
```

Choose the palette and number of color steps (3 to 9) in **Format > Color Settings**.

### 2. Today Marker

A colored border around today's cell so you can quickly find the current date.

```
  +--+--+=========+--+--+
  |  |  || today ||  |  |
  +--+--+=========+--+--+
```

Toggle in **Format > Today Marker**. Works in daily, weekly, and monthly views.

### 3. Data Labels

Show the numeric value inside each cell. Only appears when cells are large enough (16px+).

```
  +------+------+------+
  | 142  | 89   | 205  |
  +------+------+------+
  | 67   |  0   | 178  |
  +------+------+------+
```

Toggle in **Format > Cell Settings > Show Data Labels**.

### 4. Min/Max Markers

Small colored dots on the cells with the highest and lowest values for the year.

```
  +--+--+--+--+--+
  |  |  | *|  |  |    * = gold dot (max)
  +--+--+--+--+--+
  |  | o|  |  |  |    o = red dot (min)
  +--+--+--+--+--+
```

Toggle in **Format > Markers**.

### 5. Week Numbers

ISO week numbers displayed along the grid edge.

```
  W1  W2  W3  W4  W5 ...
  +--+--+--+--+--+
  |  |  |  |  |  |
```

Toggle in **Format > Label Settings > Show Week Numbers**.

### 6. Summary Stats and Sparkline

Summary statistics and a trend sparkline appear below the grid.

```
  +--+--+--+--+--+--+--+--+--+--+--+--+  (grid)
  ...
  Total: 1.6M | Avg: 4.5K | Min: 0 | Max: 12.3K | 366 days

          /\      /\
    _   /    \  /    \       /\
     \_/      \/      \_   /  \__    (sparkline)
                        \_/

  Longest streak above avg: 14 days | Below avg: 8 days
```

Toggle each in **Format > Summary and Analytics**.

### 7. Anomaly Detection

Cells with values more than N standard deviations from the 30-day rolling mean get a pulsing colored border.

```
  +--+--+--+--+--+--+
  |  |  |!!!!|  |  |  |    !!!! = pulsing red border
  +--+--+--+--+--+--+
```

Configure the threshold (1 to 4 std deviations) in **Format > Anomaly Detection**.

### 8. Multi-Measure Tooltips

Hover over any cell to see a rich tooltip. Add extra measures to the Tooltip Fields well for more detail.

```
  +---------------------------+
  | [*] March 15, 2024        |
  |---------------------------|
  | SALES          4,521      |
  | ORDERS           302      |
  | AVG ORDER       14.97     |
  |                           |
  | Product launch day        |  (annotation)
  +---------------------------+
```

### 9. Annotations

Add a text column to the Annotation field well. Annotated dates show a small blue dot in the cell corner and the text appears in the tooltip.

```
  +--+--+--+--+--+
  |  |  |o |  |  |    o = blue annotation dot
  +--+--+--+--+--+
```

### 10. Conditional Formatting (Thresholds)

Override the color palette with value-based threshold zones.

```
  Threshold setup:
    Low   <= 100   [red]
    Mid   <= 500   [yellow]
    High  >  500   [green]

  Result:
  +------+------+------+------+
  | red  | yel  | grn  | grn  |
  |  42  | 310  | 820  | 1.2K |
  +------+------+------+------+
```

Configure in **Format > Conditional Formatting**.

### 11. Aggregation Views

Switch from daily to weekly or monthly aggregation.

**Weekly view** - 53 bars, one per week:

```
  2024 - Weekly View
  +--+--+--+--+--+--+--+--+--+ ... +--+
  |  |  |##|##|##|  |  |##|##|     |  |
  +--+--+--+--+--+--+--+--+--+ ... +--+
  W1 W2 W3 W4 W5 W6 W7 W8 W9     W53
```

**Monthly view** - 4x3 grid:

```
  2024 - Monthly View
  +---------+---------+---------+---------+
  |   Jan   |   Feb   |   Mar   |   Apr   |
  |  4,521  |  3,890  |  5,102  |  4,876  |
  +---------+---------+---------+---------+
  |   May   |   Jun   |   Jul   |   Aug   |
  |  5,443  |  5,210  |  4,998  |  5,321  |
  +---------+---------+---------+---------+
  |   Sep   |   Oct   |   Nov   |   Dec   |
  |  5,102  |  5,678  |  6,234  |  7,891  |
  +---------+---------+---------+---------+
```

If your data only has 12 rows per year, the visual auto-switches to monthly view.

Configure in **Format > Aggregation and Comparison**.

### 12. Year-over-Year Comparison

Side-by-side view of the last two years in your data.

```
         2023                              2024
  Jan  Feb  Mar  ...              Jan  Feb  Mar  ...
  +--+--+--+--+--+              +--+--+--+--+--+
  |  |  |##|  |  |              |  |##|##|  |  |
  |  |##|##|  |  |              |  |##|##|##|  |
  ...                           ...
  Total: 1.2M  Avg: 3.3K       Total: 1.6M  Avg: 4.5K
```

Toggle in **Format > Aggregation and Comparison > Year-over-Year**.

### 13. Cross-Filtering

Click any cell (or drag to select a range) to cross-filter other visuals on the page. When other visuals filter the data, non-matching cells automatically dim.

```
  Before filter:                After clicking March:
  +--+--+--+--+--+            +--+--+--+--+--+
  |##|##|##|##|##|            |..|..|##|..|..|
  |##|##|##|##|##|            |..|..|##|..|..|
  +--+--+--+--+--+            +--+--+--+--+--+

  .. = dimmed (0.15 opacity)
  ## = highlighted (full opacity)
```

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

### Summary and Analytics
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

### Aggregation and Comparison
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
- **Value measure**: Any numeric measure. The visual colors cells by this value.
- **Row limit**: Up to 30,000 rows (covers about 82 years of daily data)
- **Supported granularities**: Daily (365 rows/year), Weekly (52), Monthly (12). Auto-detected based on data density.

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
