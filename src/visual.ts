"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;

import { VisualFormattingSettingsModel } from "./settings";

// ── Interfaces ───────────────────────────────────────────────────────

interface DayData {
    date: Date;
    dateStr: string;
    value: number | null;
    selectionId: ISelectionId | null;
    tooltipValues: { name: string; value: number }[];
    annotation: string | null;
    isMin: boolean;
    isMax: boolean;
    hasData: boolean;
    isAnomaly: boolean;
    isHighlighted: boolean;
}

interface YearLayout {
    year: number;
    days: DayData[];
    stats: { total: number; average: number; min: number; max: number; count: number } | null;
    longestStreakAbove: { start: string; end: string; length: number } | null;
    longestStreakBelow: { start: string; end: string; length: number } | null;
}

interface AggregatedCell {
    label: string;
    startDate: Date;
    endDate: Date;
    value: number;
    count: number;
    days: DayData[];
    col: number;
    row: number;
    selectionIds: ISelectionId[];
}

// ── Constants ────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LOOKUP: Record<string, number> = {
    "january": 0, "jan": 0, "february": 1, "feb": 1,
    "march": 2, "mar": 2, "april": 3, "apr": 3,
    "may": 4, "june": 5, "jun": 5, "july": 6, "jul": 6,
    "august": 7, "aug": 7, "september": 8, "sep": 8, "sept": 8,
    "october": 9, "oct": 9, "november": 10, "nov": 10,
    "december": 11, "dec": 11
};
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

// ── Visual ───────────────────────────────────────────────────────────

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private landingPage: HTMLDivElement;
    private svgContainer: HTMLDivElement;
    private tooltipEl: HTMLDivElement;
    private events: powerbi.extensibility.IVisualEventService;

    private dayDataMap: Map<string, DayData> = new Map();
    private allYearLayouts: YearLayout[] = [];
    private currentYearIndex: number = -1;
    private minValue: number = 0;
    private maxValue: number = 0;
    private measureName: string = "Value";
    private hasHighlights: boolean = false;
    private detectedGranularity: "daily" | "weekly" | "monthly" = "daily";

    // Drag selection state (F12)
    private isDragging: boolean = false;
    private dragStartPos: { x: number; y: number } | null = null;
    private dragStartCell: { col: number; row: number } | null = null;
    private cellsOrigin: { x: number; y: number } = { x: 0, y: 0 };
    private cellSizeCached: number = 0;
    private gapCached: number = 0;
    private mondayStartCached: boolean = false;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = this.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback(() => this.applySelection());
        this.target = options.element;
        this.target.style.overflow = "hidden";
        this.target.style.position = "relative";

        this.svgContainer = document.createElement("div");
        this.svgContainer.className = "ch-container";
        this.target.appendChild(this.svgContainer);

        this.tooltipEl = document.createElement("div");
        this.tooltipEl.className = "ch-tooltip";
        this.tooltipEl.style.display = "none";
        this.target.appendChild(this.tooltipEl);

        this.landingPage = document.createElement("div");
        this.landingPage.className = "landing-page";
        this.buildLandingPage();
        this.target.appendChild(this.landingPage);

        // Clear selection on background click
        this.svgContainer.addEventListener("click", (e) => {
            const el = e.target as Element;
            if (!el.classList || !el.classList.contains("day-cell")) {
                this.selectionManager.clear().then(() => this.applySelection());
            }
        });

        this.svgContainer.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.selectionManager.showContextMenu(
                {} as ISelectionId,
                { x: e.clientX, y: e.clientY }
            );
        });
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);

        const dv = options.dataViews?.[0];
        const hasData = dv?.categorical?.categories && dv.categorical.categories.length > 0;

        if (!hasData) {
            this.landingPage.style.display = "flex";
            this.svgContainer.style.display = "none";
            this.events.renderingFinished(options);
            return;
        }
        this.landingPage.style.display = "none";
        this.svgContainer.style.display = "block";

        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel, dv
        );

        this.parseData(dv);
        this.render();
        this.events.renderingFinished(options);
    }

    // ══════════════════════════════════════════════════════════════════
    // ── DATA PARSING ─────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private parseData(dataView: powerbi.DataView) {
        this.dayDataMap = new Map();
        this.allYearLayouts = [];
        this.hasHighlights = false;

        const cats = dataView.categorical?.categories;
        const vals = dataView.categorical?.values;
        if (!cats || cats.length === 0) return;

        const dateCols = cats.filter(c => c.source.roles?.["dateField"]);
        if (dateCols.length === 0) return;

        const valueCol = vals?.find(v => v.source.roles?.["valueField"]);
        this.measureName = valueCol?.source.displayName || "Value";

        // Detect highlights (cross-filtering from other visuals)
        const highlights = valueCol?.highlights || null;
        this.hasHighlights = highlights !== null && highlights.length > 0;

        // F1: tooltip fields
        const tooltipCols = vals?.filter(v => v.source.roles?.["tooltipFields"]) || [];

        // F2: annotation field
        const annotationCol = cats.find(c => c.source.roles?.["annotationField"]) || null;

        const rowCount = dateCols[0].values.length;

        const parsedDates = dateCols.length === 1
            ? this.parseSingleColumn(dateCols[0], rowCount)
            : this.parseHierarchyColumns(dateCols, rowCount);

        const selectionCol = dateCols[dateCols.length - 1];

        let minVal = Infinity;
        let maxVal = -Infinity;
        const yearSet = new Set<number>();

        for (let i = 0; i < rowCount; i++) {
            const date = parsedDates[i];
            if (!date || date.getFullYear() < 1970 || date.getFullYear() > 2100) continue;

            const dateStr = this.toDateKey(date);
            const value = valueCol ? Number(valueCol.values[i]) || 0 : 0;
            const isHighlighted = highlights ? highlights[i] !== null : true;

            // F1: extra tooltip values
            const tooltipValues: { name: string; value: number }[] = [];
            for (const tc of tooltipCols) {
                const tv = Number(tc.values[i]);
                if (!isNaN(tv)) {
                    tooltipValues.push({ name: tc.source.displayName || "Value", value: tv });
                }
            }

            // F2: annotation
            const annotation = annotationCol ? String(annotationCol.values[i] || "") || null : null;

            let selectionId: ISelectionId | null = null;
            try {
                selectionId = this.host.createSelectionIdBuilder()
                    .withCategory(selectionCol, i)
                    .createSelectionId();
            } catch {
                // ignore
            }

            if (this.dayDataMap.has(dateStr)) {
                const existing = this.dayDataMap.get(dateStr)!;
                existing.value = (existing.value || 0) + value;
                if (isHighlighted) existing.isHighlighted = true;
                // Merge tooltip values
                for (const tv of tooltipValues) {
                    const ex = existing.tooltipValues.find(t => t.name === tv.name);
                    if (ex) ex.value += tv.value;
                    else existing.tooltipValues.push(tv);
                }
                if (annotation && !existing.annotation) existing.annotation = annotation;
            } else {
                this.dayDataMap.set(dateStr, {
                    date, dateStr, value, selectionId,
                    tooltipValues, annotation: annotation || null,
                    isMin: false, isMax: false, hasData: true, isAnomaly: false,
                    isHighlighted
                });
            }

            yearSet.add(date.getFullYear());
        }

        // Compute min/max values
        for (const d of this.dayDataMap.values()) {
            if (d.value !== null) {
                if (d.value < minVal) minVal = d.value;
                if (d.value > maxVal) maxVal = d.value;
            }
        }
        this.minValue = minVal === Infinity ? 0 : minVal;
        this.maxValue = maxVal === -Infinity ? 0 : maxVal;

        // Build year layouts
        const years = Array.from(yearSet).sort((a, b) => a - b);

        for (const year of years) {
            const days: DayData[] = [];
            const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
            const daysInYear = isLeap ? 366 : 365;

            for (let d = 0; d < daysInYear; d++) {
                const date = new Date(year, 0, 1 + d);
                const dateStr = this.toDateKey(date);
                const existing = this.dayDataMap.get(dateStr);
                days.push(existing || {
                    date, dateStr, value: null, selectionId: null,
                    tooltipValues: [], annotation: null,
                    isMin: false, isMax: false, hasData: false, isAnomaly: false,
                    isHighlighted: false
                });
            }

            // F6: flag min/max cells for this year
            let yearMin = Infinity, yearMax = -Infinity;
            let minDay: DayData | null = null, maxDay: DayData | null = null;
            for (const day of days) {
                if (day.hasData && day.value !== null) {
                    if (day.value < yearMin) { yearMin = day.value; minDay = day; }
                    if (day.value > yearMax) { yearMax = day.value; maxDay = day; }
                }
            }
            if (minDay) minDay.isMin = true;
            if (maxDay) maxDay.isMax = true;

            // F8: compute stats
            const dataDays = days.filter(d => d.hasData && d.value !== null);
            let stats: YearLayout["stats"] = null;
            if (dataDays.length > 0) {
                const total = dataDays.reduce((s, d) => s + (d.value || 0), 0);
                stats = {
                    total,
                    average: total / dataDays.length,
                    min: yearMin === Infinity ? 0 : yearMin,
                    max: yearMax === -Infinity ? 0 : yearMax,
                    count: dataDays.length
                };
            }

            // F10: compute streaks
            const avg = stats ? stats.average : 0;
            const streakAbove = this.computeLongestStreak(days, avg, true);
            const streakBelow = this.computeLongestStreak(days, avg, false);

            // F11: compute anomalies
            this.computeAnomalies(days);

            this.allYearLayouts.push({
                year, days, stats,
                longestStreakAbove: streakAbove,
                longestStreakBelow: streakBelow
            });
        }

        if (this.currentYearIndex < 0 || this.currentYearIndex >= this.allYearLayouts.length) {
            this.currentYearIndex = this.allYearLayouts.length - 1;
        }

        // Auto-detect data granularity from actual data points per year
        const dataPointCount = this.dayDataMap.size;
        const yearCount = years.length || 1;
        const avgPointsPerYear = dataPointCount / yearCount;
        if (avgPointsPerYear <= 12) {
            this.detectedGranularity = "monthly";
        } else if (avgPointsPerYear <= 53) {
            this.detectedGranularity = "weekly";
        } else {
            this.detectedGranularity = "daily";
        }
    }

    // ── Date parsing helpers ─────────────────────────────────────────

    private parseSingleColumn(col: powerbi.DataViewCategoryColumn, rowCount: number): (Date | null)[] {
        const dates: (Date | null)[] = [];
        for (let i = 0; i < rowCount; i++) {
            dates.push(this.toDate(col.values[i]));
        }
        return dates;
    }

    private parseHierarchyColumns(dateCols: powerbi.DataViewCategoryColumn[], rowCount: number): (Date | null)[] {
        let yearCol: powerbi.DataViewCategoryColumn | null = null;
        let monthCol: powerbi.DataViewCategoryColumn | null = null;
        let dayCol: powerbi.DataViewCategoryColumn | null = null;

        for (const col of dateCols) {
            const name = (col.source.displayName || "").toLowerCase().trim();
            if (name === "year" || name.endsWith("- year") || name.endsWith(".year")) {
                yearCol = col;
            } else if (name === "month" || name.endsWith("- month") || name.endsWith(".month")) {
                monthCol = col;
            } else if (name === "day" || name.endsWith("- day") || name.endsWith(".day")) {
                dayCol = col;
            }
        }

        if (yearCol && dayCol) {
            return this.reconstructDates(yearCol, monthCol, dayCol, rowCount);
        }
        if (yearCol && monthCol) {
            return this.reconstructDates(yearCol, monthCol, null, rowCount);
        }

        for (const col of dateCols) {
            const testDates = this.parseSingleColumn(col, Math.min(rowCount, 5));
            const validCount = testDates.filter(d => d && d.getFullYear() >= 2000 && d.getFullYear() <= 2100).length;
            if (validCount >= Math.min(3, rowCount)) {
                return this.parseSingleColumn(col, rowCount);
            }
        }

        return this.parseSingleColumn(dateCols[dateCols.length - 1], rowCount);
    }

    private reconstructDates(
        yearCol: powerbi.DataViewCategoryColumn,
        monthCol: powerbi.DataViewCategoryColumn | null,
        dayCol: powerbi.DataViewCategoryColumn | null,
        rowCount: number
    ): (Date | null)[] {
        const dates: (Date | null)[] = [];
        for (let i = 0; i < rowCount; i++) {
            const y = this.toYear(yearCol.values[i]);
            if (!y) { dates.push(null); continue; }
            const m = monthCol ? this.toMonth(monthCol.values[i]) : 0;
            const d = dayCol ? this.toDay(dayCol.values[i]) : 1;
            dates.push(new Date(y, m, d));
        }
        return dates;
    }

    // ── Value converters ─────────────────────────────────────────────

    private toDate(val: unknown): Date | null {
        if (!val && val !== 0) return null;
        if (val instanceof Date) {
            const d = new Date(val.getTime());
            d.setHours(0, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof val === "string") {
            const d = new Date(val);
            if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
                d.setHours(0, 0, 0, 0);
                return d;
            }
            return null;
        }
        if (typeof val === "number") {
            if (val > 9.46e11 && val < 4.1e12) {
                const d = new Date(val);
                d.setHours(0, 0, 0, 0);
                return d;
            }
            if (val > 36000 && val < 55000) {
                const d = new Date(1899, 11, 30 + Math.floor(val));
                d.setHours(0, 0, 0, 0);
                return d;
            }
            return null;
        }
        return null;
    }

    private toYear(val: unknown): number | null {
        if (val instanceof Date) return val.getFullYear();
        const n = Number(val);
        if (!isNaN(n) && n >= 1970 && n <= 2100) return n;
        if (typeof val === "string") {
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed) && parsed >= 1970 && parsed <= 2100) return parsed;
        }
        return null;
    }

    private toMonth(val: unknown): number {
        if (val instanceof Date) return val.getMonth();
        if (typeof val === "number") {
            if (val >= 1 && val <= 12) return val - 1;
            if (val >= 0 && val < 1) return 0;
            return 0;
        }
        if (typeof val === "string") {
            const lower = val.toLowerCase().trim();
            if (MONTH_LOOKUP[lower] !== undefined) return MONTH_LOOKUP[lower];
            const numMatch = lower.match(/(\d+)/);
            if (numMatch) {
                const n = parseInt(numMatch[1], 10);
                if (n >= 1 && n <= 12) return n - 1;
            }
        }
        const d = this.toDate(val);
        if (d) return d.getMonth();
        return 0;
    }

    private toDay(val: unknown): number {
        if (val instanceof Date) return val.getDate();
        if (typeof val === "number") {
            if (val >= 1 && val <= 31) return val;
            return 1;
        }
        if (typeof val === "string") {
            const n = parseInt(val, 10);
            if (!isNaN(n) && n >= 1 && n <= 31) return n;
        }
        const d = this.toDate(val);
        if (d) return d.getDate();
        return 1;
    }

    private toDateKey(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    // ── Analytics helpers ────────────────────────────────────────────

    private computeLongestStreak(
        days: DayData[], threshold: number, above: boolean
    ): { start: string; end: string; length: number } | null {
        let best: { start: string; end: string; length: number } | null = null;
        let curStart: string | null = null;
        let curLen = 0;

        for (const day of days) {
            if (!day.hasData || day.value === null) {
                if (curLen > 0 && (!best || curLen > best.length)) {
                    best = { start: curStart!, end: days[days.indexOf(day) - 1].dateStr, length: curLen };
                }
                curLen = 0;
                curStart = null;
                continue;
            }
            const match = above ? day.value >= threshold : day.value < threshold;
            if (match) {
                if (curLen === 0) curStart = day.dateStr;
                curLen++;
            } else {
                if (curLen > 0 && (!best || curLen > best.length)) {
                    best = { start: curStart!, end: days[days.indexOf(day) - 1].dateStr, length: curLen };
                }
                curLen = 0;
                curStart = null;
            }
        }
        // Check trailing streak
        if (curLen > 0 && (!best || curLen > best.length)) {
            best = { start: curStart!, end: days[days.length - 1].dateStr, length: curLen };
        }

        return best;
    }

    private computeAnomalies(days: DayData[]) {
        const windowSize = 30;
        const values = days.map(d => d.hasData && d.value !== null ? d.value : null);

        for (let i = 0; i < days.length; i++) {
            if (values[i] === null) continue;

            // Gather window values
            const windowVals: number[] = [];
            const start = Math.max(0, i - windowSize);
            const end = Math.min(days.length - 1, i + windowSize);
            for (let j = start; j <= end; j++) {
                if (values[j] !== null) windowVals.push(values[j]!);
            }

            if (windowVals.length < 5) continue;

            const mean = windowVals.reduce((s, v) => s + v, 0) / windowVals.length;
            const variance = windowVals.reduce((s, v) => s + (v - mean) ** 2, 0) / windowVals.length;
            const stdDev = Math.sqrt(variance);

            if (stdDev > 0) {
                const zScore = Math.abs((values[i]! - mean) / stdDev);
                // Threshold applied in render — just flag high z-scores
                days[i].isAnomaly = zScore > 2;
            }
        }
    }

    private getISOWeekNumber(date: Date): number {
        const d = new Date(date.getTime());
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
        const yearStart = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
    }

    // ══════════════════════════════════════════════════════════════════
    // ── COLOR SCALE ──────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private getColorScale(): (value: number) => string {
        const settings = this.formattingSettings;

        // F16: threshold overrides
        if (settings.thresholdSettingsCard.enableThresholds.value) {
            return this.getThresholdColorFn();
        }

        const colorSettings = settings.colorSettingsCard;
        const palette = colorSettings.colorPalette.value?.value as string || "greens";
        const steps = colorSettings.colorSteps.value ?? 5;

        const range = this.maxValue - this.minValue;
        if (range <= 0) {
            return () => "rgba(255,255,255,0.06)";
        }

        let interpolator: (t: number) => string;

        switch (palette) {
            case "blues": interpolator = d3.interpolateBlues; break;
            case "oranges": interpolator = d3.interpolateOranges; break;
            case "purples": interpolator = d3.interpolatePurples; break;
            case "reds": interpolator = d3.interpolateReds; break;
            case "viridis": interpolator = d3.interpolateViridis; break;
            case "plasma": interpolator = d3.interpolatePlasma; break;
            case "warm": interpolator = d3.interpolateWarm; break;
            case "cool": interpolator = d3.interpolateCool; break;
            case "custom": {
                const c1 = colorSettings.customColorStart.value?.value || "#9be9a8";
                const c2 = colorSettings.customColorEnd.value?.value || "#216e39";
                interpolator = d3.interpolateRgb(c1, c2);
                break;
            }
            default: interpolator = d3.interpolateGreens; break;
        }

        return (value: number) => {
            const t = Math.max(0, Math.min(1, (value - this.minValue) / range));
            const step = Math.min(steps - 1, Math.floor(t * steps));
            const quantizedT = 0.25 + (step / Math.max(1, steps - 1)) * 0.75;
            return interpolator(quantizedT);
        };
    }

    // F16: threshold color function
    private getThresholdColorFn(): (value: number) => string {
        const ts = this.formattingSettings.thresholdSettingsCard;
        const t1Val = ts.threshold1Value.value ?? 0;
        const t1Color = ts.threshold1Color.value?.value || "#f85149";
        const t2Val = ts.threshold2Value.value ?? 50;
        const t2Color = ts.threshold2Color.value?.value || "#d29922";
        const t3Color = ts.threshold3Color.value?.value || "#3fb950";

        return (value: number) => {
            if (value < t1Val) return t1Color;
            if (value < t2Val) return t2Color;
            return t3Color;
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // ── LAYOUT ───────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private dateToCellPosition(date: Date, mondayStart: boolean): { col: number; row: number } {
        const dayOfWeek = date.getDay();
        const row = mondayStart ? ((dayOfWeek + 6) % 7) : dayOfWeek;

        const jan1 = new Date(date.getFullYear(), 0, 1);
        const jan1Dow = jan1.getDay();
        const jan1Row = mondayStart ? ((jan1Dow + 6) % 7) : jan1Dow;
        const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
        const col = Math.floor((dayOfYear + jan1Row) / 7);

        return { col, row };
    }

    // ══════════════════════════════════════════════════════════════════
    // ── RENDER (dispatch) ────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private render() {
        const width = this.target.clientWidth;
        const height = this.target.clientHeight;
        if (width <= 0 || height <= 0 || this.allYearLayouts.length === 0) return;

        const settings = this.formattingSettings;
        const aggMode = settings.aggregationSettingsCard.aggregationMode.value?.value as string || "daily";
        const showComparison = settings.aggregationSettingsCard.showComparison.value ?? false;

        // F15: comparison mode
        if (showComparison && this.allYearLayouts.length >= 2) {
            this.renderComparisonView(width, height);
            return;
        }

        // F14: aggregation modes — auto-detect if user set "daily" but data is monthly/weekly
        const effectiveAggMode = aggMode === "daily" ? this.detectedGranularity : aggMode;
        if (effectiveAggMode !== "daily") {
            this.renderAggregatedView(width, height, effectiveAggMode);
            return;
        }

        this.renderDailyView(width, height);
    }

    // ══════════════════════════════════════════════════════════════════
    // ── DAILY VIEW (main render) ─────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private renderDailyView(width: number, height: number) {
        const settings = this.formattingSettings;
        const gap = settings.cellSettingsCard.cellGap.value ?? 2;
        const cornerRadius = settings.cellSettingsCard.cornerRadius.value ?? 2;
        const emptyColor = settings.cellSettingsCard.emptyColor.value?.value || "#161b22";
        const mondayStart = settings.cellSettingsCard.weekStartsOnMonday.value ?? false;

        const showMonthLabels = settings.labelSettingsCard.showMonthLabels.value ?? true;
        const monthLabelSize = settings.labelSettingsCard.monthLabelSize.value ?? 10;
        const monthLabelColor = settings.labelSettingsCard.monthLabelColor.value?.value || "#8b949e";
        const showDayLabels = settings.labelSettingsCard.showDayLabels.value ?? true;
        const dayLabelSize = settings.labelSettingsCard.dayLabelSize.value ?? 9;
        const dayLabelColor = settings.labelSettingsCard.dayLabelColor.value?.value || "#8b949e";
        const showYearLabel = settings.labelSettingsCard.showYearLabel.value ?? true;
        const yearLabelSize = settings.labelSettingsCard.yearLabelSize.value ?? 14;
        const yearLabelColor = settings.labelSettingsCard.yearLabelColor.value?.value || "#c9d1d9";
        const showLegend = settings.legendSettingsCard.showLegend.value ?? true;
        const legendPos = settings.legendSettingsCard.legendPosition.value?.value as string || "bottomRight";
        const legendLabelColor = settings.legendSettingsCard.legendLabelColor.value?.value || "#8b949e";

        // F5: week numbers
        const showWeekNumbers = settings.labelSettingsCard.showWeekNumbers.value ?? false;
        const weekNumberSize = settings.labelSettingsCard.weekNumberSize.value ?? 9;
        const weekNumberColor = settings.labelSettingsCard.weekNumberColor.value?.value || "#8b949e";

        // F3: data labels
        const showDataLabels = settings.cellSettingsCard.showDataLabels.value ?? false;
        const dataLabelSize = settings.cellSettingsCard.dataLabelSize.value ?? 9;
        const dataLabelColor = settings.cellSettingsCard.dataLabelColor.value?.value || "#ffffff";

        // F4: today marker
        const showTodayMarker = settings.todayMarkerCard.showTodayMarker.value ?? true;
        const todayMarkerColor = settings.todayMarkerCard.todayMarkerColor.value?.value || "#58a6ff";
        const todayMarkerWidth = settings.todayMarkerCard.todayMarkerWidth.value ?? 2;

        // F6: min/max markers
        const showMinMaxMarkers = settings.markerSettingsCard.showMinMaxMarkers.value ?? false;
        const minMarkerColor = settings.markerSettingsCard.minMarkerColor.value?.value || "#f85149";
        const maxMarkerColor = settings.markerSettingsCard.maxMarkerColor.value?.value || "#ffd700";

        // F11: anomalies
        const showAnomalies = settings.anomalySettingsCard.showAnomalies.value ?? false;
        const anomalyThreshold = settings.anomalySettingsCard.anomalyThreshold.value ?? 2;
        const anomalyColor = settings.anomalySettingsCard.anomalyColor.value?.value || "#f85149";

        // F8/F9/F10: summary, sparkline, streaks
        const showSummary = settings.summarySettingsCard.showSummary.value ?? false;
        const summaryFontSize = settings.summarySettingsCard.summaryFontSize.value ?? 10;
        const summaryFontColor = settings.summarySettingsCard.summaryFontColor.value?.value || "#8b949e";
        const showSparkline = settings.summarySettingsCard.showSparkline.value ?? false;
        const sparklineColor = settings.summarySettingsCard.sparklineColor.value?.value || "#58a6ff";
        const sparklineHeight = settings.summarySettingsCard.sparklineHeight.value ?? 36;
        const showStreaks = settings.summarySettingsCard.showStreaks.value ?? false;

        const colorScale = this.getColorScale();
        const hasMultipleYears = this.allYearLayouts.length > 1;
        const yearLayout = this.allYearLayouts[this.currentYearIndex];
        if (!yearLayout) return;

        // Spacing — adaptive layout with orientation detection
        const navHeight = hasMultipleYears ? 32 : 0;

        // Reserve space for all enabled extras
        const labelW = showDayLabels ? 32 : 0;
        const weekNumW = showWeekNumbers ? 30 : 0;
        const monthLabelSpace = showMonthLabels ? monthLabelSize + 8 : 0;
        const legendH = showLegend ? 28 : 0;
        const summaryH = showSummary ? summaryFontSize + 16 : 0;
        const sparkH = showSparkline ? sparklineHeight + 8 : 0;
        const streakH = showStreaks ? 14 : 0;
        const extrasHeight = legendH + summaryH + sparkH + streakH;

        // Determine orientation: which gives bigger cells?
        // Use tight padding (6) for vertical probe to see max potential
        const hPad = 14;
        const yearLabelH = (!hasMultipleYears && showYearLabel) ? yearLabelSize + 10 : 0;
        const hAvailW = width - hPad * 2 - labelW - weekNumW;
        const hAvailH = height - navHeight - hPad * 2 - monthLabelSpace - yearLabelH - extrasHeight;
        const hCell = Math.min(Math.floor(hAvailW / 53) - gap, Math.floor(hAvailH / 7) - gap);

        // Vertical: compact — smaller padding, shorter day header, compact month labels
        const vPad = 6;
        const vDayHeaderH = showDayLabels ? 14 : 0; // single-letter day labels, compact
        const vMonthLabelW = showMonthLabels ? 28 : 0; // compact 3-letter month labels
        const vAvailW = width - vPad * 2 - vMonthLabelW;
        const vAvailH = height - navHeight - vPad * 2 - vDayHeaderH - yearLabelH - extrasHeight;
        const vCell = Math.min(Math.floor(vAvailW / 7) - gap, Math.floor(vAvailH / 53) - gap);

        const vertical = vCell > hCell && vCell > 3;
        const padding = vertical ? vPad : hPad;
        const gridCols = vertical ? 7 : 53;
        const gridRows = vertical ? 53 : 7;

        // Recompute available space based on chosen orientation
        let availW: number, availH: number;
        if (vertical) {
            availW = width - padding * 2 - vMonthLabelW;
            availH = height - navHeight - padding * 2 - vDayHeaderH - yearLabelH - extrasHeight;
        } else {
            const dayLabelDim = showDayLabels ? 32 : 0;
            const monthLabelDim = showMonthLabels ? monthLabelSize + 8 : 0;
            availW = width - padding * 2 - dayLabelDim - weekNumW;
            availH = height - navHeight - padding * 2 - monthLabelDim - yearLabelH - extrasHeight;
        }

        const cellFromWidth = Math.floor(availW / gridCols) - gap;
        const cellFromHeight = Math.floor(availH / gridRows) - gap;
        const cellSize = Math.max(3, Math.min(cellFromWidth, cellFromHeight));

        // Auto-hide labels only when cells are extremely small
        const effectiveShowDayLabels = showDayLabels && cellSize >= 5;
        const effectiveShowMonthLabels = showMonthLabels && cellSize >= 4;
        const effectiveShowWeekNumbers = showWeekNumbers && cellSize >= 5 && !vertical;
        const effectiveShowDataLabels = showDataLabels && cellSize >= 16;

        // Effective label dimensions depend on orientation
        let effectiveDayLabelWidth: number, effectiveMonthLabelWidth: number;
        let effectiveMonthLabelHeight: number, effectiveDayLabelHeight: number;
        let effectiveWeekNumberWidth: number;

        if (vertical) {
            effectiveDayLabelWidth = 0;
            effectiveMonthLabelWidth = effectiveShowMonthLabels ? vMonthLabelW : 0;
            effectiveMonthLabelHeight = 0;
            effectiveDayLabelHeight = effectiveShowDayLabels ? vDayHeaderH : 0;
            effectiveWeekNumberWidth = 0;
        } else {
            effectiveDayLabelWidth = effectiveShowDayLabels ? 32 : 0;
            effectiveMonthLabelWidth = 0;
            effectiveMonthLabelHeight = effectiveShowMonthLabels ? monthLabelSize + 8 : 0;
            effectiveDayLabelHeight = 0;
            effectiveWeekNumberWidth = effectiveShowWeekNumbers ? 30 : 0;
        }

        const leftLabelsWidth = effectiveDayLabelWidth + effectiveMonthLabelWidth;

        const gridWidth = gridCols * (cellSize + gap);
        const gridHeight = gridRows * (cellSize + gap);
        const totalWidth = gridWidth + leftLabelsWidth + effectiveWeekNumberWidth + padding * 2;

        // Vertical centering
        const totalContentHeight = navHeight + yearLabelH +
            effectiveMonthLabelHeight + effectiveDayLabelHeight +
            gridHeight + extrasHeight + 10;
        const verticalOffset = Math.max(0, (height - totalContentHeight) / 2);

        // Cache for drag selection
        this.cellSizeCached = cellSize;
        this.gapCached = gap;
        this.mondayStartCached = mondayStart;

        // Create or update SVG
        let svg = d3.select(this.svgContainer).select<SVGSVGElement>("svg.calendar-heatmap");
        if (svg.empty()) {
            svg = d3.select(this.svgContainer).append("svg").attr("class", "calendar-heatmap");
        }
        svg.attr("width", width).attr("height", height);
        svg.selectAll("*").remove();

        const offsetX = Math.max(padding, (width - totalWidth) / 2 + padding);
        let cursorY = verticalOffset + padding;

        const self = this;

        // ── Year navigation bar ──
        if (hasMultipleYears) {
            this.renderNavigation(svg, width, cursorY, navHeight, yearLayout.year, yearLabelColor);
            cursorY += navHeight + 4;
        }

        // ── Single-year label ──
        if (!hasMultipleYears && showYearLabel) {
            svg.append("text")
                .attr("class", "year-label")
                .attr("x", offsetX)
                .attr("y", cursorY + yearLabelSize)
                .attr("fill", yearLabelColor)
                .attr("font-size", yearLabelSize + "px")
                .attr("font-weight", "700")
                .attr("font-family", FONT)
                .text(String(yearLayout.year));
            cursorY += yearLabelH;
        }

        if (vertical) {
            // ── VERTICAL: Compact single-letter day labels on top ──
            if (effectiveShowDayLabels) {
                const dayLetters = mondayStart
                    ? ["M", "T", "W", "T", "F", "S", "S"]
                    : ["S", "M", "T", "W", "T", "F", "S"];
                const vLabelSize = Math.min(10, cellSize * 0.85);
                for (let idx = 0; idx < 7; idx++) {
                    svg.append("text")
                        .attr("class", "day-label")
                        .attr("x", offsetX + leftLabelsWidth + idx * (cellSize + gap) + cellSize / 2)
                        .attr("y", cursorY + vLabelSize)
                        .attr("text-anchor", "middle")
                        .attr("fill", dayLabelColor)
                        .attr("font-size", vLabelSize + "px")
                        .attr("font-family", FONT)
                        .text(dayLetters[idx]);
                }
                cursorY += effectiveDayLabelHeight;
            }
        } else {
            // ── HORIZONTAL: Month labels on top ──
            if (effectiveShowMonthLabels) {
                for (let m = 0; m < 12; m++) {
                    const firstOfMonth = new Date(yearLayout.year, m, 1);
                    const pos = this.dateToCellPosition(firstOfMonth, mondayStart);
                    svg.append("text")
                        .attr("class", "month-label")
                        .attr("x", offsetX + leftLabelsWidth + pos.col * (cellSize + gap))
                        .attr("y", cursorY + monthLabelSize)
                        .attr("fill", monthLabelColor)
                        .attr("font-size", monthLabelSize + "px")
                        .attr("font-family", FONT)
                        .text(MONTHS[m]);
                }
                cursorY += effectiveMonthLabelHeight;
            }
        }

        if (!vertical) {
            // ── HORIZONTAL: Day-of-week labels on left ──
            if (effectiveShowDayLabels) {
                const dayNames = mondayStart ? DAYS_MON : DAYS_SUN;
                [1, 3, 5].forEach(idx => {
                    svg.append("text")
                        .attr("class", "day-label")
                        .attr("x", offsetX + leftLabelsWidth - 8)
                        .attr("y", cursorY + idx * (cellSize + gap) + cellSize * 0.8)
                        .attr("fill", dayLabelColor)
                        .attr("font-size", dayLabelSize + "px")
                        .attr("text-anchor", "end")
                        .attr("font-family", FONT)
                        .text(dayNames[idx]);
                });
            }
        }

        // ── Day cells ──
        const cellsX = offsetX + leftLabelsWidth;
        const cellsY = cursorY;
        this.cellsOrigin = { x: cellsX, y: cellsY };

        const cellsG = svg.append("g")
            .attr("class", "cells-group")
            .attr("transform", `translate(${cellsX}, ${cellsY})`);

        // In vertical mode: month labels on left side alongside the grid rows
        if (vertical && effectiveShowMonthLabels) {
            for (let m = 0; m < 12; m++) {
                const firstOfMonth = new Date(yearLayout.year, m, 1);
                const pos = this.dateToCellPosition(firstOfMonth, mondayStart);
                // pos.col is the week number — in vertical mode this is the row
                svg.append("text")
                    .attr("class", "month-label")
                    .attr("x", offsetX + effectiveMonthLabelWidth - 4)
                    .attr("y", cellsY + pos.col * (cellSize + gap) + cellSize * 0.8)
                    .attr("text-anchor", "end")
                    .attr("fill", monthLabelColor)
                    .attr("font-size", Math.min(monthLabelSize, cellSize * 0.9) + "px")
                    .attr("font-family", FONT)
                    .text(MONTHS[m]);
            }
        }

        const todayStr = this.toDateKey(new Date());

        for (const day of yearLayout.days) {
            const pos = this.dateToCellPosition(day.date, mondayStart);
            const x = (vertical ? pos.row : pos.col) * (cellSize + gap);
            const y = (vertical ? pos.col : pos.row) * (cellSize + gap);

            // F7: missing data distinction
            let fillColor: string;
            if (day.hasData) {
                fillColor = day.value === null || day.value === 0
                    ? colorScale(this.minValue)
                    : colorScale(day.value);
            } else {
                fillColor = emptyColor;
            }

            const rect = cellsG.append("rect")
                .attr("class", "day-cell")
                .attr("x", x)
                .attr("y", y)
                .attr("width", cellSize)
                .attr("height", cellSize)
                .attr("rx", cornerRadius)
                .attr("ry", cornerRadius)
                .attr("fill", fillColor)
                .attr("stroke", "rgba(255,255,255,0.04)")
                .attr("stroke-width", 0.5)
                .datum(day);

            if (day.hasData) {
                rect.style("cursor", "pointer");
            }

            // F11: anomaly styling
            if (showAnomalies && day.isAnomaly && anomalyThreshold <= 2) {
                rect.attr("stroke", anomalyColor)
                    .attr("stroke-width", 2)
                    .classed("anomaly-cell", true);
            }

            // F4: today marker
            if (showTodayMarker && day.dateStr === todayStr) {
                cellsG.append("rect")
                    .attr("class", "today-marker")
                    .attr("x", x - 1)
                    .attr("y", y - 1)
                    .attr("width", cellSize + 2)
                    .attr("height", cellSize + 2)
                    .attr("rx", cornerRadius + 1)
                    .attr("ry", cornerRadius + 1)
                    .attr("fill", "none")
                    .attr("stroke", todayMarkerColor)
                    .attr("stroke-width", todayMarkerWidth)
                    .style("pointer-events", "none");
            }

            // F6: min/max markers
            if (showMinMaxMarkers && (day.isMin || day.isMax)) {
                const markerColor = day.isMax ? maxMarkerColor : minMarkerColor;
                const cx = x + cellSize - 3;
                const cy = y + 3;
                cellsG.append("circle")
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", Math.min(3, cellSize / 4))
                    .attr("fill", markerColor)
                    .style("pointer-events", "none");
            }

            // F2: annotation icon
            if (day.annotation) {
                const ax = x + 2;
                const ay = y + cellSize - 2;
                cellsG.append("circle")
                    .attr("cx", ax)
                    .attr("cy", ay)
                    .attr("r", Math.min(2, cellSize / 5))
                    .attr("fill", "#58a6ff")
                    .style("pointer-events", "none");
            }

            // F3: data labels
            if (effectiveShowDataLabels && day.hasData && day.value !== null) {
                cellsG.append("text")
                    .attr("class", "data-label")
                    .attr("x", x + cellSize / 2)
                    .attr("y", y + cellSize / 2 + dataLabelSize * 0.35)
                    .attr("text-anchor", "middle")
                    .attr("fill", dataLabelColor)
                    .attr("font-size", Math.min(dataLabelSize, cellSize * 0.6) + "px")
                    .attr("font-family", FONT)
                    .attr("font-weight", "600")
                    .style("pointer-events", "none")
                    .text(this.formatCompact(day.value));
            }

            // Events
            rect.on("mouseover", function (event: MouseEvent, d: DayData) {
                d3.select(this)
                    .attr("stroke", "rgba(255,255,255,0.6)")
                    .attr("stroke-width", "2");
                self.showTooltip(event, d, fillColor);
            })
            .on("mousemove", function (event: MouseEvent) {
                self.positionTooltip(event);
            })
            .on("mouseout", function () {
                const isAnom = showAnomalies && day.isAnomaly;
                d3.select(this)
                    .attr("stroke", isAnom ? anomalyColor : "rgba(255,255,255,0.04)")
                    .attr("stroke-width", isAnom ? 2 : 0.5);
                self.hideTooltip();
            })
            .on("click", function (event: MouseEvent, d: DayData) {
                event.stopPropagation();
                if (d.selectionId) {
                    self.selectionManager.select(d.selectionId, event.ctrlKey || event.metaKey)
                        .then(() => self.applySelection());
                }
            })
            .on("contextmenu", function (event: MouseEvent, d: DayData) {
                event.preventDefault();
                event.stopPropagation();
                self.selectionManager.showContextMenu(
                    d.selectionId || {} as ISelectionId,
                    { x: event.clientX, y: event.clientY }
                );
            });
        }

        // F5: week numbers (positioned along the week axis)
        if (effectiveShowWeekNumbers) {
            const weeksDrawn = new Set<number>();
            for (let wk = 0; wk < 53; wk++) {
                const dayIndex = wk * 7;
                if (dayIndex >= yearLayout.days.length) break;
                const day = yearLayout.days[Math.min(dayIndex, yearLayout.days.length - 1)];
                const weekNum = this.getISOWeekNumber(day.date);
                if (weeksDrawn.has(weekNum)) continue;
                weeksDrawn.add(weekNum);

                if (vertical) {
                    // Week numbers to the right of the grid, along rows
                    svg.append("text")
                        .attr("class", "week-number")
                        .attr("x", cellsX + gridWidth + 6)
                        .attr("y", cellsY + wk * (cellSize + gap) + cellSize * 0.8)
                        .attr("fill", weekNumberColor)
                        .attr("font-size", Math.min(weekNumberSize, cellSize * 0.8) + "px")
                        .attr("font-family", FONT)
                        .text(`W${weekNum}`);
                } else {
                    // Week numbers below the grid or to the right, along columns
                    svg.append("text")
                        .attr("class", "week-number")
                        .attr("x", cellsX + gridWidth + 6)
                        .attr("y", cellsY + cellSize * 0.8)
                        .attr("fill", weekNumberColor)
                        .attr("font-size", weekNumberSize + "px")
                        .attr("font-family", FONT)
                        .attr("transform", `translate(0, ${wk * (cellSize + gap)})`)
                        .text(`W${weekNum}`);
                }
            }
        }

        // ── Legend ──
        const gridBottomY = cursorY + gridHeight;
        const extrasLeftX = offsetX + leftLabelsWidth;

        if (showLegend && this.maxValue > this.minValue) {
            this.renderLegend(svg, colorScale, emptyColor, cellSize, gap,
                gridBottomY + 12, extrasLeftX, width, padding, navHeight,
                legendPos, legendLabelColor);
        }

        // ── Summary text (basic count) + F8 stats ──
        let bottomY = gridBottomY + (showLegend ? 28 : 10);

        if (showSummary && yearLayout.stats) {
            const st = yearLayout.stats;
            const statsText = `Total: ${this.formatNumber(st.total)}  |  Avg: ${this.formatNumber(st.average)}  |  Min: ${this.formatNumber(st.min)}  |  Max: ${this.formatNumber(st.max)}  |  ${st.count} days`;
            svg.append("text")
                .attr("class", "summary-stats")
                .attr("x", extrasLeftX)
                .attr("y", bottomY + summaryFontSize)
                .attr("fill", summaryFontColor)
                .attr("font-size", summaryFontSize + "px")
                .attr("font-family", FONT)
                .text(statsText);
            bottomY += summaryFontSize + 12;
        } else {
            const dataCount = yearLayout.days.filter(d => d.value !== null && d.hasData).length;
            if (dataCount > 0) {
                svg.append("text")
                    .attr("class", "summary-text")
                    .attr("x", extrasLeftX)
                    .attr("y", bottomY)
                    .attr("fill", "rgba(139,148,158,0.4)")
                    .attr("font-size", "10px")
                    .attr("font-family", FONT)
                    .text(`${dataCount} days with data in ${yearLayout.year}`);
                bottomY += 14;
            }
        }

        // F9: sparkline
        if (showSparkline) {
            this.renderSparkline(svg, yearLayout.days,
                extrasLeftX, bottomY,
                gridWidth, sparklineHeight, sparklineColor);
            bottomY += sparklineHeight + 8;
        }

        // F10: streak info
        if (showStreaks && yearLayout.stats) {
            let streakText = "";
            if (yearLayout.longestStreakAbove) {
                streakText += `Longest streak above avg: ${yearLayout.longestStreakAbove.length} days`;
            }
            if (yearLayout.longestStreakBelow) {
                if (streakText) streakText += "  |  ";
                streakText += `Below avg: ${yearLayout.longestStreakBelow.length} days`;
            }
            if (streakText) {
                svg.append("text")
                    .attr("class", "streak-text")
                    .attr("x", extrasLeftX)
                    .attr("y", bottomY + 10)
                    .attr("fill", summaryFontColor)
                    .attr("font-size", "10px")
                    .attr("font-family", FONT)
                    .text(streakText);
            }
        }

        // F12: drag selection overlay
        this.setupDragSelection(cellsG, yearLayout, mondayStart, cellSize, gap, vertical);

        this.applySelection();
    }

    // ══════════════════════════════════════════════════════════════════
    // ── NAVIGATION ───────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private renderNavigation(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        width: number, cursorY: number, navHeight: number,
        year: number, yearLabelColor: string
    ) {
        const self = this;
        const navG = svg.append("g")
            .attr("class", "nav-group")
            .attr("transform", `translate(${width / 2}, ${cursorY + navHeight / 2})`);

        navG.append("text")
            .attr("class", "nav-year")
            .attr("x", 0).attr("y", 5)
            .attr("text-anchor", "middle")
            .attr("fill", yearLabelColor)
            .attr("font-size", "16px")
            .attr("font-weight", "700")
            .attr("font-family", FONT)
            .text(String(year));

        navG.append("text")
            .attr("class", "nav-counter")
            .attr("x", 0).attr("y", 18)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(139,148,158,0.5)")
            .attr("font-size", "9px")
            .attr("font-family", FONT)
            .text(`${this.currentYearIndex + 1} of ${this.allYearLayouts.length}`);

        if (this.currentYearIndex > 0) {
            const leftBtn = navG.append("g").attr("class", "nav-btn")
                .attr("transform", "translate(-60, 0)").style("cursor", "pointer");
            leftBtn.append("rect").attr("x", -14).attr("y", -12)
                .attr("width", 28).attr("height", 24).attr("rx", 6)
                .attr("fill", "rgba(255,255,255,0.04)")
                .attr("stroke", "rgba(255,255,255,0.08)").attr("stroke-width", 1);
            leftBtn.append("text").attr("x", 0).attr("y", 5)
                .attr("text-anchor", "middle").attr("fill", "#8b949e")
                .attr("font-size", "14px").text("\u25C0");
            leftBtn.on("click", () => {
                self.currentYearIndex = Math.max(0, self.currentYearIndex - 1);
                self.render();
            });
        }

        if (this.currentYearIndex < this.allYearLayouts.length - 1) {
            const rightBtn = navG.append("g").attr("class", "nav-btn")
                .attr("transform", "translate(60, 0)").style("cursor", "pointer");
            rightBtn.append("rect").attr("x", -14).attr("y", -12)
                .attr("width", 28).attr("height", 24).attr("rx", 6)
                .attr("fill", "rgba(255,255,255,0.04)")
                .attr("stroke", "rgba(255,255,255,0.08)").attr("stroke-width", 1);
            rightBtn.append("text").attr("x", 0).attr("y", 5)
                .attr("text-anchor", "middle").attr("fill", "#8b949e")
                .attr("font-size", "14px").text("\u25B6");
            rightBtn.on("click", () => {
                self.currentYearIndex = Math.min(self.allYearLayouts.length - 1, self.currentYearIndex + 1);
                self.render();
            });
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // ── LEGEND ───────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private renderLegend(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        colorScale: (v: number) => string,
        emptyColor: string,
        cellSize: number, gap: number,
        bottomY: number, leftX: number, width: number, padding: number,
        navHeight: number, legendPos: string, legendLabelColor: string
    ) {
        const colorSteps = this.formattingSettings.colorSettingsCard.colorSteps.value ?? 5;
        const legendCellSize = Math.min(12, cellSize + 2);
        const legendGap = 3;
        const legendTotalW = (colorSteps + 1) * (legendCellSize + legendGap) + 70;

        let lx: number, ly: number;
        switch (legendPos) {
            case "bottomLeft": lx = leftX; ly = bottomY; break;
            case "topRight": lx = width - legendTotalW - padding; ly = padding + navHeight; break;
            case "topLeft": lx = leftX; ly = padding + navHeight; break;
            default: lx = width - legendTotalW - padding; ly = bottomY; break;
        }

        const legendG = svg.append("g")
            .attr("class", "legend-group")
            .attr("transform", `translate(${lx}, ${ly})`);

        legendG.append("text")
            .attr("x", 0).attr("y", legendCellSize * 0.85)
            .attr("fill", legendLabelColor)
            .attr("font-size", "10px").attr("font-family", FONT)
            .text("Less");

        legendG.append("rect")
            .attr("x", 30).attr("y", 0)
            .attr("width", legendCellSize).attr("height", legendCellSize)
            .attr("rx", 2).attr("fill", emptyColor)
            .attr("stroke", "rgba(255,255,255,0.08)").attr("stroke-width", 0.5);

        for (let i = 0; i < colorSteps; i++) {
            const t = this.minValue + (i / (colorSteps - 1)) * (this.maxValue - this.minValue);
            legendG.append("rect")
                .attr("x", 30 + (i + 1) * (legendCellSize + legendGap))
                .attr("y", 0)
                .attr("width", legendCellSize).attr("height", legendCellSize)
                .attr("rx", 2).attr("fill", colorScale(t));
        }

        legendG.append("text")
            .attr("x", 30 + (colorSteps + 1) * (legendCellSize + legendGap) + 4)
            .attr("y", legendCellSize * 0.85)
            .attr("fill", legendLabelColor)
            .attr("font-size", "10px").attr("font-family", FONT)
            .text("More");
    }

    // ══════════════════════════════════════════════════════════════════
    // ── SPARKLINE (F9) ───────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private renderSparkline(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        days: DayData[], x: number, y: number,
        width: number, height: number, color: string
    ) {
        const dataDays = days.filter(d => d.hasData && d.value !== null);
        if (dataDays.length < 2) return;

        const xScale = d3.scaleLinear()
            .domain([0, days.length - 1])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([height - 2, 2]);

        const sparkG = svg.append("g")
            .attr("class", "sparkline-group")
            .attr("transform", `translate(${x}, ${y})`);

        // Background
        sparkG.append("rect")
            .attr("width", width).attr("height", height)
            .attr("rx", 4).attr("fill", "rgba(255,255,255,0.02)");

        // Average line
        const avg = dataDays.reduce((s, d) => s + (d.value || 0), 0) / dataDays.length;
        sparkG.append("line")
            .attr("x1", 0).attr("x2", width)
            .attr("y1", yScale(avg)).attr("y2", yScale(avg))
            .attr("stroke", "rgba(139,148,158,0.2)")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

        // Line path
        const lineGen = d3.line<DayData>()
            .defined(d => d.hasData && d.value !== null)
            .x(d => xScale(days.indexOf(d)))
            .y(d => yScale(d.value || 0))
            .curve(d3.curveMonotoneX);

        sparkG.append("path")
            .datum(dataDays)
            .attr("d", lineGen as unknown as string)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.8);
    }

    // ══════════════════════════════════════════════════════════════════
    // ── DRAG SELECTION (F12) ─────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private setupDragSelection(
        cellsG: d3.Selection<SVGGElement, unknown, null, undefined>,
        yearLayout: YearLayout, mondayStart: boolean,
        cellSize: number, gap: number, vertical: boolean = false
    ) {
        const self = this;
        let selectionRect: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;
        let startX = 0, startY = 0;
        let hasMoved = false;

        cellsG.on("mousedown", function (event: MouseEvent) {
            if (event.button !== 0) return;
            const ctm = (this as SVGGElement).getScreenCTM();
            if (!ctm) return;
            startX = event.clientX - ctm.e;
            startY = event.clientY - ctm.f;
            self.dragStartPos = { x: event.clientX, y: event.clientY };
            hasMoved = false;
        });

        d3.select(this.svgContainer).on("mousemove.drag", (event: MouseEvent) => {
            if (!self.dragStartPos) return;

            const dx = event.clientX - self.dragStartPos.x;
            const dy = event.clientY - self.dragStartPos.y;
            if (Math.sqrt(dx * dx + dy * dy) < 5) return;

            hasMoved = true;

            const ctm = (cellsG.node() as SVGGElement).getScreenCTM();
            if (!ctm) return;
            const curX = event.clientX - ctm.e;
            const curY = event.clientY - ctm.f;

            const rx = Math.min(startX, curX);
            const ry = Math.min(startY, curY);
            const rw = Math.abs(curX - startX);
            const rh = Math.abs(curY - startY);

            if (!selectionRect) {
                selectionRect = cellsG.append("rect")
                    .attr("class", "selection-overlay")
                    .attr("fill", "rgba(88,166,255,0.15)")
                    .attr("stroke", "#58a6ff")
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "4,2")
                    .style("pointer-events", "none");
            }

            selectionRect
                .attr("x", rx).attr("y", ry)
                .attr("width", rw).attr("height", rh);
        });

        d3.select(this.svgContainer).on("mouseup.drag", (event: MouseEvent) => {
            if (!self.dragStartPos) return;

            if (hasMoved && selectionRect) {
                const ctm = (cellsG.node() as SVGGElement).getScreenCTM();
                if (ctm) {
                    const curX = event.clientX - ctm.e;
                    const curY = event.clientY - ctm.f;

                    const x1 = Math.min(startX, curX);
                    const y1 = Math.min(startY, curY);
                    const x2 = Math.max(startX, curX);
                    const y2 = Math.max(startY, curY);

                    // Find all cells in the selection rectangle
                    const ids: ISelectionId[] = [];
                    for (const day of yearLayout.days) {
                        if (!day.selectionId || !day.hasData) continue;
                        const pos = self.dateToCellPosition(day.date, mondayStart);
                        const cx = (vertical ? pos.row : pos.col) * (cellSize + gap) + cellSize / 2;
                        const cy = (vertical ? pos.col : pos.row) * (cellSize + gap) + cellSize / 2;
                        if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
                            ids.push(day.selectionId);
                        }
                    }

                    if (ids.length > 0) {
                        self.selectionManager.select(ids, event.ctrlKey || event.metaKey)
                            .then(() => self.applySelection());
                    }
                }

                selectionRect.remove();
                selectionRect = null;
            }

            self.dragStartPos = null;
            hasMoved = false;
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // ── AGGREGATED VIEW (F14) ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private renderAggregatedView(width: number, height: number, mode: string) {
        const settings = this.formattingSettings;
        const cornerRadius = settings.cellSettingsCard.cornerRadius.value ?? 2;
        const emptyColor = settings.cellSettingsCard.emptyColor.value?.value || "#161b22";
        const yearLabelColor = settings.labelSettingsCard.yearLabelColor.value?.value || "#c9d1d9";
        const colorScale = this.getColorScale();
        const yearLayout = this.allYearLayouts[this.currentYearIndex];
        if (!yearLayout) return;

        // Read all relevant settings
        const showLegend = settings.legendSettingsCard.showLegend.value ?? true;
        const legendPos = settings.legendSettingsCard.legendPosition.value?.value as string || "bottomRight";
        const legendLabelColor = settings.legendSettingsCard.legendLabelColor.value?.value || "#8b949e";
        const showSummary = settings.summarySettingsCard.showSummary.value ?? false;
        const summaryFontSize = settings.summarySettingsCard.summaryFontSize.value ?? 10;
        const summaryFontColor = settings.summarySettingsCard.summaryFontColor.value?.value || "#8b949e";
        const showTodayMarker = settings.todayMarkerCard.showTodayMarker.value ?? false;
        const todayMarkerColor = settings.todayMarkerCard.todayMarkerColor.value?.value || "#58a6ff";
        const todayMarkerWidth = settings.todayMarkerCard.todayMarkerWidth.value ?? 2;
        const showMinMaxMarkers = settings.markerSettingsCard.showMinMaxMarkers.value ?? false;
        const minMarkerColor = settings.markerSettingsCard.minMarkerColor.value?.value || "#f85149";
        const maxMarkerColor = settings.markerSettingsCard.maxMarkerColor.value?.value || "#ffd700";
        const enableThresholds = settings.thresholdSettingsCard.enableThresholds.value ?? false;
        const threshold1 = settings.thresholdSettingsCard.threshold1Value.value ?? 0;
        const threshold1Color = settings.thresholdSettingsCard.threshold1Color.value?.value || "#f85149";
        const threshold2 = settings.thresholdSettingsCard.threshold2Value.value ?? 0;
        const threshold2Color = settings.thresholdSettingsCard.threshold2Color.value?.value || "#d29922";
        const threshold3Color = settings.thresholdSettingsCard.threshold3Color.value?.value || "#3fb950";

        let svg = d3.select(this.svgContainer).select<SVGSVGElement>("svg.calendar-heatmap");
        if (svg.empty()) {
            svg = d3.select(this.svgContainer).append("svg").attr("class", "calendar-heatmap");
        }
        svg.attr("width", width).attr("height", height);
        svg.selectAll("*").remove();

        const padding = 14;
        const hasMultipleYears = this.allYearLayouts.length > 1;
        const navHeight = hasMultipleYears ? 32 : 0;

        // Reserve extras height
        const legendH = showLegend ? 28 : 0;
        const summaryH = showSummary ? summaryFontSize + 16 : 0;

        let cursorY = padding;

        if (hasMultipleYears) {
            this.renderNavigation(svg, width, cursorY, navHeight, yearLayout.year, yearLabelColor);
            cursorY += navHeight + 4;
        }

        // Title
        svg.append("text")
            .attr("x", padding).attr("y", cursorY + 16)
            .attr("fill", yearLabelColor)
            .attr("font-size", "14px").attr("font-weight", "700").attr("font-family", FONT)
            .text(`${yearLayout.year} — ${mode === "weekly" ? "Weekly" : "Monthly"} View`);
        cursorY += 28;

        const cells = this.computeAggregatedCells(yearLayout, mode);
        if (cells.length === 0) return;

        const self = this;

        // Find min/max cells for markers
        let minCell: typeof cells[0] | null = null;
        let maxCell: typeof cells[0] | null = null;
        if (showMinMaxMarkers) {
            for (const c of cells) {
                if (c.count === 0) continue;
                const avg = c.value / c.count;
                if (!minCell || avg < minCell.value / minCell.count) minCell = c;
                if (!maxCell || avg > maxCell.value / maxCell.count) maxCell = c;
            }
        }

        // Today detection for marker
        const today = new Date();
        const todayMonth = today.getMonth();
        const todayYear = today.getFullYear();
        const todayWeek = this.getISOWeekNumber(today);

        // Helper: get fill color for a cell (with threshold support)
        const getCellFill = (cell: typeof cells[0]): string => {
            if (cell.count === 0) return emptyColor;
            const avg = cell.value / cell.count;
            if (enableThresholds && threshold1 > 0) {
                if (avg <= threshold1) return threshold1Color;
                if (threshold2 > 0 && avg <= threshold2) return threshold2Color;
                return threshold3Color;
            }
            return colorScale(avg);
        };

        if (mode === "weekly") {
            // 53 columns x 1 row
            const availW = width - padding * 2;
            const cellW = Math.max(4, Math.floor(availW / 53) - 2);
            const cellH = Math.min(40, height - cursorY - padding - legendH - summaryH - 40);

            const g = svg.append("g").attr("transform", `translate(${padding}, ${cursorY})`);

            for (const cell of cells) {
                const x = cell.col * (cellW + 2);
                const fill = getCellFill(cell);

                const rect = g.append("rect")
                    .attr("class", "agg-cell")
                    .attr("x", x).attr("y", 0)
                    .attr("width", cellW).attr("height", cellH)
                    .attr("rx", cornerRadius).attr("fill", fill)
                    .attr("stroke", "rgba(255,255,255,0.04)").attr("stroke-width", 0.5)
                    .datum({ selectionIds: cell.selectionIds })
                    .style("cursor", cell.count > 0 ? "pointer" : "default")
                    .on("mouseover", function (event: MouseEvent) {
                        d3.select(this).attr("stroke", "rgba(255,255,255,0.6)").attr("stroke-width", 2);
                        self.showAggTooltip(event, cell);
                    })
                    .on("mousemove", (event: MouseEvent) => self.positionTooltip(event))
                    .on("mouseout", function () {
                        d3.select(this).attr("stroke", "rgba(255,255,255,0.04)").attr("stroke-width", 0.5);
                        self.hideTooltip();
                    })
                    .on("click", (event: MouseEvent) => {
                        if (cell.selectionIds.length > 0) {
                            self.selectionManager.select(cell.selectionIds, event.ctrlKey || event.metaKey)
                                .then(() => self.applySelection());
                        }
                    })
                    .on("contextmenu", (event: MouseEvent) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const id = cell.selectionIds.length > 0 ? cell.selectionIds[0] : {} as ISelectionId;
                        self.selectionManager.showContextMenu(id, { x: event.clientX, y: event.clientY });
                    });

                // Today marker
                const weekLabel = cell.label.replace("W", "");
                if (showTodayMarker && yearLayout.year === todayYear && parseInt(weekLabel) === todayWeek) {
                    g.append("rect")
                        .attr("class", "today-marker")
                        .attr("x", x - 1).attr("y", -1)
                        .attr("width", cellW + 2).attr("height", cellH + 2)
                        .attr("rx", cornerRadius + 1)
                        .attr("fill", "none").attr("stroke", todayMarkerColor)
                        .attr("stroke-width", todayMarkerWidth)
                        .style("pointer-events", "none");
                }

                // Min/Max marker
                if (showMinMaxMarkers && cell === maxCell) {
                    g.append("circle").attr("cx", x + cellW - 3).attr("cy", 3)
                        .attr("r", Math.min(3, cellW / 4))
                        .attr("fill", maxMarkerColor).style("pointer-events", "none");
                }
                if (showMinMaxMarkers && cell === minCell) {
                    g.append("circle").attr("cx", x + cellW - 3).attr("cy", 3)
                        .attr("r", Math.min(3, cellW / 4))
                        .attr("fill", minMarkerColor).style("pointer-events", "none");
                }

                // Week label
                if (cellW >= 10) {
                    g.append("text")
                        .attr("x", x + cellW / 2).attr("y", cellH + 12)
                        .attr("text-anchor", "middle").attr("fill", "rgba(139,148,158,0.5)")
                        .attr("font-size", "8px").attr("font-family", FONT)
                        .text(cell.label);
                }
            }

            cursorY += cellH + 20;
        } else {
            // Monthly: 4x3 grid
            const availW = width - padding * 2;
            const availH = height - cursorY - padding - legendH - summaryH - 10;
            const cellW = Math.floor(availW / 4) - 8;
            const cellH = Math.floor(availH / 3) - 8;

            const g = svg.append("g").attr("transform", `translate(${padding}, ${cursorY})`);

            for (const cell of cells) {
                const x = cell.col * (cellW + 8);
                const y = cell.row * (cellH + 8);
                const fill = getCellFill(cell);
                const avg = cell.count > 0 ? cell.value / cell.count : 0;

                g.append("rect")
                    .attr("class", "agg-cell")
                    .attr("x", x).attr("y", y)
                    .attr("width", cellW).attr("height", cellH)
                    .attr("rx", cornerRadius + 2).attr("fill", fill)
                    .attr("stroke", "rgba(255,255,255,0.06)").attr("stroke-width", 1)
                    .datum({ selectionIds: cell.selectionIds })
                    .style("cursor", cell.count > 0 ? "pointer" : "default")
                    .on("mouseover", function (event: MouseEvent) {
                        d3.select(this).attr("stroke", "rgba(255,255,255,0.6)").attr("stroke-width", 2);
                        self.showAggTooltip(event, cell);
                    })
                    .on("mousemove", (event: MouseEvent) => self.positionTooltip(event))
                    .on("mouseout", function () {
                        d3.select(this).attr("stroke", "rgba(255,255,255,0.06)").attr("stroke-width", 1);
                        self.hideTooltip();
                    })
                    .on("click", (event: MouseEvent) => {
                        if (cell.selectionIds.length > 0) {
                            self.selectionManager.select(cell.selectionIds, event.ctrlKey || event.metaKey)
                                .then(() => self.applySelection());
                        }
                    })
                    .on("contextmenu", (event: MouseEvent) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const id = cell.selectionIds.length > 0 ? cell.selectionIds[0] : {} as ISelectionId;
                        self.selectionManager.showContextMenu(id, { x: event.clientX, y: event.clientY });
                    });

                // Today marker on current month
                if (showTodayMarker && yearLayout.year === todayYear && cell.row * 4 + cell.col === todayMonth) {
                    g.append("rect")
                        .attr("class", "today-marker")
                        .attr("x", x - 1).attr("y", y - 1)
                        .attr("width", cellW + 2).attr("height", cellH + 2)
                        .attr("rx", cornerRadius + 3)
                        .attr("fill", "none").attr("stroke", todayMarkerColor)
                        .attr("stroke-width", todayMarkerWidth)
                        .style("pointer-events", "none");
                }

                // Min/Max marker
                if (showMinMaxMarkers && cell === maxCell) {
                    g.append("circle").attr("cx", x + cellW - 6).attr("cy", y + 6)
                        .attr("r", 4).attr("fill", maxMarkerColor).style("pointer-events", "none");
                }
                if (showMinMaxMarkers && cell === minCell) {
                    g.append("circle").attr("cx", x + cellW - 6).attr("cy", y + 6)
                        .attr("r", 4).attr("fill", minMarkerColor).style("pointer-events", "none");
                }

                // Month label
                g.append("text")
                    .attr("x", x + cellW / 2).attr("y", y + cellH / 2 + 5)
                    .attr("text-anchor", "middle").attr("fill", "rgba(255,255,255,0.8)")
                    .attr("font-size", "13px").attr("font-weight", "600").attr("font-family", FONT)
                    .style("pointer-events", "none")
                    .text(cell.label);

                if (cell.count > 0) {
                    g.append("text")
                        .attr("x", x + cellW / 2).attr("y", y + cellH / 2 + 20)
                        .attr("text-anchor", "middle").attr("fill", "rgba(255,255,255,0.5)")
                        .attr("font-size", "11px").attr("font-family", FONT)
                        .style("pointer-events", "none")
                        .text(this.formatNumber(avg));
                }
            }

            cursorY += 3 * (cellH + 8) + 10;
        }

        // Legend
        if (showLegend && this.maxValue > this.minValue) {
            const gap = settings.cellSettingsCard.cellGap.value ?? 2;
            this.renderLegend(svg, colorScale, emptyColor, 10, gap,
                cursorY, padding, width, padding, navHeight,
                legendPos, legendLabelColor);
            cursorY += legendH;
        }

        // Summary stats
        if (showSummary && yearLayout.stats) {
            const st = yearLayout.stats;
            const statsText = `Total: ${this.formatNumber(st.total)}  |  Avg: ${this.formatNumber(st.average)}  |  Min: ${this.formatNumber(st.min)}  |  Max: ${this.formatNumber(st.max)}  |  ${st.count} days`;
            svg.append("text")
                .attr("class", "summary-stats")
                .attr("x", padding)
                .attr("y", cursorY + summaryFontSize)
                .attr("fill", summaryFontColor)
                .attr("font-size", summaryFontSize + "px")
                .attr("font-family", FONT)
                .text(statsText);
        }

        this.applySelection();
    }

    private computeAggregatedCells(yearLayout: YearLayout, mode: string): AggregatedCell[] {
        const cells: AggregatedCell[] = [];

        if (mode === "weekly") {
            // Group by ISO week
            const weekMap = new Map<number, DayData[]>();
            for (const day of yearLayout.days) {
                const wk = this.getISOWeekNumber(day.date);
                if (!weekMap.has(wk)) weekMap.set(wk, []);
                weekMap.get(wk)!.push(day);
            }
            for (let w = 1; w <= 53; w++) {
                const days = weekMap.get(w) || [];
                const dataDays = days.filter(d => d.hasData && d.value !== null);
                cells.push({
                    label: `W${w}`,
                    startDate: days.length > 0 ? days[0].date : new Date(yearLayout.year, 0, 1),
                    endDate: days.length > 0 ? days[days.length - 1].date : new Date(yearLayout.year, 0, 1),
                    value: dataDays.reduce((s, d) => s + (d.value || 0), 0),
                    count: dataDays.length,
                    days,
                    col: w - 1, row: 0,
                    selectionIds: dataDays.map(d => d.selectionId).filter((id): id is ISelectionId => id !== null)
                });
            }
        } else {
            // Monthly: 4 columns x 3 rows
            for (let m = 0; m < 12; m++) {
                const days = yearLayout.days.filter(d => d.date.getMonth() === m);
                const dataDays = days.filter(d => d.hasData && d.value !== null);
                cells.push({
                    label: MONTHS[m],
                    startDate: new Date(yearLayout.year, m, 1),
                    endDate: new Date(yearLayout.year, m + 1, 0),
                    value: dataDays.reduce((s, d) => s + (d.value || 0), 0),
                    count: dataDays.length,
                    days,
                    col: m % 4, row: Math.floor(m / 4),
                    selectionIds: dataDays.map(d => d.selectionId).filter((id): id is ISelectionId => id !== null)
                });
            }
        }

        return cells;
    }

    // ══════════════════════════════════════════════════════════════════
    // ── COMPARISON VIEW (F15) ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private renderComparisonView(width: number, height: number) {
        const settings = this.formattingSettings;
        const gap = settings.cellSettingsCard.cellGap.value ?? 2;
        const cornerRadius = settings.cellSettingsCard.cornerRadius.value ?? 2;
        const emptyColor = settings.cellSettingsCard.emptyColor.value?.value || "#161b22";
        const mondayStart = settings.cellSettingsCard.weekStartsOnMonday.value ?? false;
        const yearLabelColor = settings.labelSettingsCard.yearLabelColor.value?.value || "#c9d1d9";
        const monthLabelSize = settings.labelSettingsCard.monthLabelSize.value ?? 10;
        const monthLabelColor = settings.labelSettingsCard.monthLabelColor.value?.value || "#8b949e";
        const colorScale = this.getColorScale();

        // Pick last two years
        const idx2 = this.allYearLayouts.length - 1;
        const idx1 = idx2 - 1;
        const yearA = this.allYearLayouts[idx1];
        const yearB = this.allYearLayouts[idx2];

        let svg = d3.select(this.svgContainer).select<SVGSVGElement>("svg.calendar-heatmap");
        if (svg.empty()) {
            svg = d3.select(this.svgContainer).append("svg").attr("class", "calendar-heatmap");
        }
        svg.attr("width", width).attr("height", height);
        svg.selectAll("*").remove();

        const padding = 14;
        const halfWidth = (width - padding * 3) / 2;

        // Compute cell size for half-width
        const cellSize = Math.max(3, Math.floor(halfWidth / 53) - gap);

        const self = this;

        [yearA, yearB].forEach((yearLayout, sideIdx) => {
            const ox = padding + sideIdx * (halfWidth + padding);
            let cy = padding;

            // Year label
            svg.append("text")
                .attr("x", ox + halfWidth / 2).attr("y", cy + 14)
                .attr("text-anchor", "middle")
                .attr("fill", yearLabelColor)
                .attr("font-size", "14px").attr("font-weight", "700").attr("font-family", FONT)
                .text(String(yearLayout.year));
            cy += 24;

            // Month labels
            for (let m = 0; m < 12; m++) {
                const firstOfMonth = new Date(yearLayout.year, m, 1);
                const pos = self.dateToCellPosition(firstOfMonth, mondayStart);
                svg.append("text")
                    .attr("x", ox + pos.col * (cellSize + gap))
                    .attr("y", cy + monthLabelSize)
                    .attr("fill", monthLabelColor)
                    .attr("font-size", Math.min(monthLabelSize, 9) + "px")
                    .attr("font-family", FONT)
                    .text(MONTHS[m]);
            }
            cy += monthLabelSize + 6;

            // Cells
            const g = svg.append("g").attr("transform", `translate(${ox}, ${cy})`);

            for (const day of yearLayout.days) {
                const pos = self.dateToCellPosition(day.date, mondayStart);
                const x = pos.col * (cellSize + gap);
                const y = pos.row * (cellSize + gap);

                let fillColor: string;
                if (day.hasData) {
                    fillColor = day.value === null || day.value === 0
                        ? colorScale(self.minValue)
                        : colorScale(day.value);
                } else {
                    fillColor = emptyColor;
                }

                g.append("rect")
                    .attr("class", "day-cell")
                    .attr("x", x).attr("y", y)
                    .attr("width", cellSize).attr("height", cellSize)
                    .attr("rx", cornerRadius).attr("ry", cornerRadius)
                    .attr("fill", fillColor)
                    .attr("stroke", "rgba(255,255,255,0.04)")
                    .attr("stroke-width", 0.5)
                    .datum(day)
                    .style("cursor", day.hasData ? "pointer" : "default")
                    .on("mouseover", function (event: MouseEvent, d: DayData) {
                        d3.select(this).attr("stroke", "rgba(255,255,255,0.6)").attr("stroke-width", 2);
                        self.showTooltip(event, d, fillColor);
                    })
                    .on("mousemove", (event: MouseEvent) => self.positionTooltip(event))
                    .on("mouseout", function () {
                        d3.select(this).attr("stroke", "rgba(255,255,255,0.04)").attr("stroke-width", 0.5);
                        self.hideTooltip();
                    })
                    .on("click", (event: MouseEvent, d: DayData) => {
                        event.stopPropagation();
                        if (d.selectionId) {
                            self.selectionManager.select(d.selectionId, event.ctrlKey || event.metaKey)
                                .then(() => self.applySelection());
                        }
                    });
            }

            // Stats
            if (yearLayout.stats) {
                const statsY = cy + 7 * (cellSize + gap) + 12;
                svg.append("text")
                    .attr("x", ox).attr("y", statsY)
                    .attr("fill", "rgba(139,148,158,0.5)")
                    .attr("font-size", "9px").attr("font-family", FONT)
                    .text(`Total: ${self.formatNumber(yearLayout.stats.total)}  Avg: ${self.formatNumber(yearLayout.stats.average)}`);
            }
        });

        this.applySelection();
    }

    // ══════════════════════════════════════════════════════════════════
    // ── SELECTION ────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private applySelection() {
        const hasSelection = this.selectionManager.hasSelection();
        const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];

        // Daily + comparison view cells
        d3.select(this.svgContainer)
            .selectAll<SVGRectElement, DayData>("rect.day-cell")
            .style("opacity", (d: DayData) => {
                if (this.hasHighlights) {
                    return d.isHighlighted ? 1 : 0.15;
                }
                if (!hasSelection) return 1;
                if (!d.selectionId) return 0.15;
                return selectedIds.some(id => id.equals(d.selectionId!)) ? 1 : 0.15;
            });

        // Aggregated view cells (weekly/monthly)
        d3.select(this.svgContainer)
            .selectAll<SVGRectElement, { selectionIds: ISelectionId[] }>("rect.agg-cell")
            .style("opacity", (d: { selectionIds: ISelectionId[] }) => {
                if (!hasSelection) return 1;
                if (!d.selectionIds || d.selectionIds.length === 0) return 0.15;
                const hasMatch = d.selectionIds.some(sid =>
                    selectedIds.some(id => id.equals(sid))
                );
                return hasMatch ? 1 : 0.3;
            });
    }

    // ══════════════════════════════════════════════════════════════════
    // ── TOOLTIP ──────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private formatNumber(val: number): string {
        if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + "B";
        if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + "M";
        if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + "K";
        if (Number.isInteger(val)) return val.toLocaleString();
        return val.toFixed(2);
    }

    private formatCompact(val: number): string {
        if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(0) + "M";
        if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(0) + "K";
        if (Number.isInteger(val)) return String(val);
        return val.toFixed(1);
    }

    private showTooltip(e: MouseEvent, d: DayData, cellColor: string) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const day = dayNames[d.date.getDay()];
        const dateStr = d.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        while (this.tooltipEl.firstChild) this.tooltipEl.removeChild(this.tooltipEl.firstChild);

        // Header
        const headerRow = document.createElement("div");
        headerRow.className = "ch-tooltip-header";

        const swatch = document.createElement("span");
        swatch.className = "ch-tooltip-swatch";
        swatch.style.backgroundColor = cellColor;
        headerRow.appendChild(swatch);

        const dateEl = document.createElement("span");
        dateEl.className = "ch-tooltip-date";
        dateEl.textContent = `${day}, ${dateStr}`;
        headerRow.appendChild(dateEl);

        this.tooltipEl.appendChild(headerRow);

        // F2: annotation
        if (d.annotation) {
            const annoDiv = document.createElement("div");
            annoDiv.className = "ch-tooltip-annotation";
            annoDiv.textContent = d.annotation;
            this.tooltipEl.appendChild(annoDiv);
        }

        if (d.value !== null) {
            const divider = document.createElement("div");
            divider.className = "ch-tooltip-divider";
            this.tooltipEl.appendChild(divider);

            // Main value
            this.appendTooltipRow(this.measureName, this.formatNumber(d.value));

            // F1: extra tooltip values
            for (const tv of d.tooltipValues) {
                this.appendTooltipRow(tv.name, this.formatNumber(tv.value));
            }
        }

        // F11: anomaly indicator
        if (d.isAnomaly) {
            const anomDiv = document.createElement("div");
            anomDiv.className = "ch-tooltip-anomaly";
            anomDiv.textContent = "Anomaly detected";
            this.tooltipEl.appendChild(anomDiv);
        }

        // F6: min/max indicator
        if (d.isMin || d.isMax) {
            const markerDiv = document.createElement("div");
            markerDiv.className = "ch-tooltip-marker";
            markerDiv.textContent = d.isMax ? "Highest value this year" : "Lowest value this year";
            this.tooltipEl.appendChild(markerDiv);
        }

        this.tooltipEl.style.display = "block";
        this.positionTooltip(e);
    }

    private appendTooltipRow(label: string, value: string) {
        const valRow = document.createElement("div");
        valRow.className = "ch-tooltip-row";

        const labelEl = document.createElement("span");
        labelEl.className = "ch-tooltip-label";
        labelEl.textContent = label;
        valRow.appendChild(labelEl);

        const valEl = document.createElement("span");
        valEl.className = "ch-tooltip-value";
        valEl.textContent = value;
        valRow.appendChild(valEl);

        this.tooltipEl.appendChild(valRow);
    }

    private showAggTooltip(e: MouseEvent, cell: AggregatedCell) {
        while (this.tooltipEl.firstChild) this.tooltipEl.removeChild(this.tooltipEl.firstChild);

        const headerRow = document.createElement("div");
        headerRow.className = "ch-tooltip-header";

        const dateEl = document.createElement("span");
        dateEl.className = "ch-tooltip-date";
        dateEl.textContent = cell.label;
        headerRow.appendChild(dateEl);

        this.tooltipEl.appendChild(headerRow);

        if (cell.count > 0) {
            const divider = document.createElement("div");
            divider.className = "ch-tooltip-divider";
            this.tooltipEl.appendChild(divider);

            this.appendTooltipRow("Total", this.formatNumber(cell.value));
            this.appendTooltipRow("Average", this.formatNumber(cell.value / cell.count));
            this.appendTooltipRow("Days", String(cell.count));
        }

        this.tooltipEl.style.display = "block";
        this.positionTooltip(e);
    }

    private positionTooltip(e: MouseEvent) {
        const rect = this.target.getBoundingClientRect();
        let x = e.clientX - rect.left + 14;
        let y = e.clientY - rect.top - 10;

        const tw = this.tooltipEl.offsetWidth;
        const th = this.tooltipEl.offsetHeight;

        if (x + tw > rect.width) x = e.clientX - rect.left - tw - 14;
        if (y + th > rect.height) y = rect.height - th - 8;
        if (y < 0) y = 8;

        this.tooltipEl.style.left = x + "px";
        this.tooltipEl.style.top = y + "px";
    }

    private hideTooltip() {
        this.tooltipEl.style.display = "none";
    }

    // ══════════════════════════════════════════════════════════════════
    // ── LANDING PAGE ─────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════

    private buildLandingPage() {
        const content = document.createElement("div");
        content.className = "landing-content";

        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("width", "72");
        svg.setAttribute("height", "72");
        svg.setAttribute("viewBox", "0 0 72 72");

        const defs = document.createElementNS(NS, "defs");
        const grad = document.createElementNS(NS, "linearGradient");
        grad.setAttribute("id", "calGrad");
        grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%");
        grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "100%");
        const s1 = document.createElementNS(NS, "stop");
        s1.setAttribute("offset", "0%"); s1.setAttribute("style", "stop-color:#9be9a8");
        const s2 = document.createElementNS(NS, "stop");
        s2.setAttribute("offset", "100%"); s2.setAttribute("style", "stop-color:#216e39");
        grad.appendChild(s1); grad.appendChild(s2);
        defs.appendChild(grad);
        svg.appendChild(defs);

        const opacities = [
            [0.08, 0.15, 0.08, 0.35, 0.65, 0.15, 0.08],
            [0.20, 0.08, 0.50, 0.25, 0.08, 0.40, 0.15],
            [0.08, 0.60, 0.85, 0.35, 0.15, 0.08, 0.55],
            [0.30, 0.40, 0.08, 0.70, 0.50, 0.20, 0.08],
            [0.08, 0.15, 0.35, 0.08, 0.90, 0.60, 0.30],
            [0.50, 0.08, 0.25, 0.45, 0.08, 0.15, 0.75],
            [0.08, 0.35, 0.15, 0.08, 0.25, 0.08, 0.08]
        ];

        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 7; col++) {
                const r = document.createElementNS(NS, "rect");
                r.setAttribute("x", String(6 + col * 9));
                r.setAttribute("y", String(6 + row * 9));
                r.setAttribute("width", "7");
                r.setAttribute("height", "7");
                r.setAttribute("rx", "1.5");
                r.setAttribute("fill", "url(#calGrad)");
                r.setAttribute("opacity", String(opacities[row][col]));
                svg.appendChild(r);
            }
        }

        const iconDiv = document.createElement("div");
        iconDiv.className = "landing-icon";
        iconDiv.appendChild(svg);
        content.appendChild(iconDiv);

        const title = document.createElement("div");
        title.className = "landing-title";
        title.textContent = "Calendar Heatmap";
        content.appendChild(title);

        const subtitle = document.createElement("div");
        subtitle.className = "landing-subtitle";
        subtitle.textContent = "by Datayaga";
        content.appendChild(subtitle);

        const steps = document.createElement("div");
        steps.className = "landing-steps";

        ["Drag a Date field to the Date bucket",
         "Add a measure to Values (count, sum, etc.)",
         "Add extra measures to Tooltip Fields",
         "Customize colors in Format \u2192 Color Settings"
        ].forEach((text, idx) => {
            const step = document.createElement("div");
            step.className = "landing-step";
            const num = document.createElement("span");
            num.className = "step-num";
            num.textContent = String(idx + 1);
            step.appendChild(num);
            step.appendChild(document.createTextNode(" " + text));
            steps.appendChild(step);
        });

        content.appendChild(steps);

        const tip = document.createElement("div");
        tip.className = "landing-tip";
        tip.textContent = "Tip: If dates look wrong, click the Date field dropdown and select \"Date\" instead of \"Date Hierarchy\"";
        content.appendChild(tip);

        this.landingPage.appendChild(content);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
