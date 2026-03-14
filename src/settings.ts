"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// ── Cell Settings ────────────────────────────────────────────────────

class CellSettingsCard extends FormattingSettingsCard {
    cellGap = new formattingSettings.NumUpDown({
        name: "cellGap",
        displayName: "Cell Gap",
        value: 2,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 5 }
        }
    });

    cornerRadius = new formattingSettings.NumUpDown({
        name: "cornerRadius",
        displayName: "Corner Radius",
        value: 1,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 6 }
        }
    });

    emptyColor = new formattingSettings.ColorPicker({
        name: "emptyColor",
        displayName: "Empty Day Color",
        value: { value: "#161b22" }
    });

    weekStartsOnMonday = new formattingSettings.ToggleSwitch({
        name: "weekStartsOnMonday",
        displayName: "Week Starts on Monday",
        value: false
    });

    showDataLabels = new formattingSettings.ToggleSwitch({
        name: "showDataLabels",
        displayName: "Show Data Labels",
        value: false
    });

    dataLabelSize = new formattingSettings.NumUpDown({
        name: "dataLabelSize",
        displayName: "Data Label Size",
        value: 9,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 6 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 14 }
        }
    });

    dataLabelColor = new formattingSettings.ColorPicker({
        name: "dataLabelColor",
        displayName: "Data Label Color",
        value: { value: "#ffffff" }
    });

    name: string = "cellSettings";
    displayName: string = "Cell Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.cellGap, this.cornerRadius, this.emptyColor, this.weekStartsOnMonday,
        this.showDataLabels, this.dataLabelSize, this.dataLabelColor
    ];
}

// ── Color Settings ───────────────────────────────────────────────────

class ColorSettingsCard extends FormattingSettingsCard {
    colorPalette = new formattingSettings.ItemDropdown({
        name: "colorPalette",
        displayName: "Color Palette",
        items: [
            { value: "greens", displayName: "Green" },
            { value: "blues", displayName: "Blue" },
            { value: "oranges", displayName: "Orange" },
            { value: "purples", displayName: "Purple" },
            { value: "reds", displayName: "Red" },
            { value: "viridis", displayName: "Viridis" },
            { value: "plasma", displayName: "Plasma" },
            { value: "warm", displayName: "Warm" },
            { value: "cool", displayName: "Cool" },
            { value: "custom", displayName: "Custom" }
        ],
        value: { value: "greens", displayName: "Green" }
    });

    customColorStart = new formattingSettings.ColorPicker({
        name: "customColorStart",
        displayName: "Custom Start Color",
        value: { value: "#9be9a8" }
    });

    customColorEnd = new formattingSettings.ColorPicker({
        name: "customColorEnd",
        displayName: "Custom End Color",
        value: { value: "#216e39" }
    });

    colorSteps = new formattingSettings.NumUpDown({
        name: "colorSteps",
        displayName: "Color Steps",
        value: 5,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 3 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 9 }
        }
    });

    name: string = "colorSettings";
    displayName: string = "Color Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.colorPalette, this.customColorStart, this.customColorEnd, this.colorSteps
    ];
}

// ── Label Settings ───────────────────────────────────────────────────

class LabelSettingsCard extends FormattingSettingsCard {
    showMonthLabels = new formattingSettings.ToggleSwitch({
        name: "showMonthLabels",
        displayName: "Show Month Labels",
        value: true
    });

    monthLabelSize = new formattingSettings.NumUpDown({
        name: "monthLabelSize",
        displayName: "Month Label Size",
        value: 10,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 16 }
        }
    });

    monthLabelColor = new formattingSettings.ColorPicker({
        name: "monthLabelColor",
        displayName: "Month Label Color",
        value: { value: "#8b949e" }
    });

    showDayLabels = new formattingSettings.ToggleSwitch({
        name: "showDayLabels",
        displayName: "Show Day Labels",
        value: true
    });

    dayLabelSize = new formattingSettings.NumUpDown({
        name: "dayLabelSize",
        displayName: "Day Label Size",
        value: 9,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 14 }
        }
    });

    dayLabelColor = new formattingSettings.ColorPicker({
        name: "dayLabelColor",
        displayName: "Day Label Color",
        value: { value: "#8b949e" }
    });

    showYearLabel = new formattingSettings.ToggleSwitch({
        name: "showYearLabel",
        displayName: "Show Year Label",
        value: true
    });

    yearLabelSize = new formattingSettings.NumUpDown({
        name: "yearLabelSize",
        displayName: "Year Label Size",
        value: 14,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 12 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 24 }
        }
    });

    yearLabelColor = new formattingSettings.ColorPicker({
        name: "yearLabelColor",
        displayName: "Year Label Color",
        value: { value: "#c9d1d9" }
    });

    showWeekNumbers = new formattingSettings.ToggleSwitch({
        name: "showWeekNumbers",
        displayName: "Show Week Numbers",
        value: false
    });

    weekNumberSize = new formattingSettings.NumUpDown({
        name: "weekNumberSize",
        displayName: "Week Number Size",
        value: 9,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 12 }
        }
    });

    weekNumberColor = new formattingSettings.ColorPicker({
        name: "weekNumberColor",
        displayName: "Week Number Color",
        value: { value: "#8b949e" }
    });

    name: string = "labelSettings";
    displayName: string = "Label Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.showMonthLabels, this.monthLabelSize, this.monthLabelColor,
        this.showDayLabels, this.dayLabelSize, this.dayLabelColor,
        this.showYearLabel, this.yearLabelSize, this.yearLabelColor,
        this.showWeekNumbers, this.weekNumberSize, this.weekNumberColor
    ];
}

// ── Legend Settings ──────────────────────────────────────────────────

class LegendSettingsCard extends FormattingSettingsCard {
    showLegend = new formattingSettings.ToggleSwitch({
        name: "showLegend",
        displayName: "Show Legend",
        value: true
    });

    legendPosition = new formattingSettings.ItemDropdown({
        name: "legendPosition",
        displayName: "Legend Position",
        items: [
            { value: "bottomRight", displayName: "Bottom Right" },
            { value: "bottomLeft", displayName: "Bottom Left" },
            { value: "topRight", displayName: "Top Right" },
            { value: "topLeft", displayName: "Top Left" }
        ],
        value: { value: "bottomRight", displayName: "Bottom Right" }
    });

    legendLabelColor = new formattingSettings.ColorPicker({
        name: "legendLabelColor",
        displayName: "Legend Label Color",
        value: { value: "#8b949e" }
    });

    name: string = "legendSettings";
    displayName: string = "Legend Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.showLegend, this.legendPosition, this.legendLabelColor
    ];
}

// ── Today Marker ─────────────────────────────────────────────────────

class TodayMarkerCard extends FormattingSettingsCard {
    showTodayMarker = new formattingSettings.ToggleSwitch({
        name: "showTodayMarker",
        displayName: "Show Today Marker",
        value: true
    });

    todayMarkerColor = new formattingSettings.ColorPicker({
        name: "todayMarkerColor",
        displayName: "Marker Color",
        value: { value: "#58a6ff" }
    });

    todayMarkerWidth = new formattingSettings.NumUpDown({
        name: "todayMarkerWidth",
        displayName: "Marker Width",
        value: 2,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 4 }
        }
    });

    name: string = "todayMarker";
    displayName: string = "Today Marker";
    slices: Array<FormattingSettingsSlice> = [
        this.showTodayMarker, this.todayMarkerColor, this.todayMarkerWidth
    ];
}

// ── Markers (Min/Max) ────────────────────────────────────────────────

class MarkerSettingsCard extends FormattingSettingsCard {
    showMinMaxMarkers = new formattingSettings.ToggleSwitch({
        name: "showMinMaxMarkers",
        displayName: "Show Min/Max Markers",
        value: false
    });

    minMarkerColor = new formattingSettings.ColorPicker({
        name: "minMarkerColor",
        displayName: "Min Marker Color",
        value: { value: "#f85149" }
    });

    maxMarkerColor = new formattingSettings.ColorPicker({
        name: "maxMarkerColor",
        displayName: "Max Marker Color",
        value: { value: "#ffd700" }
    });

    name: string = "markerSettings";
    displayName: string = "Markers";
    slices: Array<FormattingSettingsSlice> = [
        this.showMinMaxMarkers, this.minMarkerColor, this.maxMarkerColor
    ];
}

// ── Summary & Analytics ──────────────────────────────────────────────

class SummarySettingsCard extends FormattingSettingsCard {
    showSummary = new formattingSettings.ToggleSwitch({
        name: "showSummary",
        displayName: "Show Summary Stats",
        value: false
    });

    summaryFontSize = new formattingSettings.NumUpDown({
        name: "summaryFontSize",
        displayName: "Summary Font Size",
        value: 10,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 9 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 14 }
        }
    });

    summaryFontColor = new formattingSettings.ColorPicker({
        name: "summaryFontColor",
        displayName: "Summary Font Color",
        value: { value: "#8b949e" }
    });

    showSparkline = new formattingSettings.ToggleSwitch({
        name: "showSparkline",
        displayName: "Show Sparkline",
        value: false
    });

    sparklineColor = new formattingSettings.ColorPicker({
        name: "sparklineColor",
        displayName: "Sparkline Color",
        value: { value: "#58a6ff" }
    });

    sparklineHeight = new formattingSettings.NumUpDown({
        name: "sparklineHeight",
        displayName: "Sparkline Height",
        value: 36,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 20 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 60 }
        }
    });

    showStreaks = new formattingSettings.ToggleSwitch({
        name: "showStreaks",
        displayName: "Show Streaks",
        value: false
    });

    name: string = "summarySettings";
    displayName: string = "Summary & Analytics";
    slices: Array<FormattingSettingsSlice> = [
        this.showSummary, this.summaryFontSize, this.summaryFontColor,
        this.showSparkline, this.sparklineColor, this.sparklineHeight,
        this.showStreaks
    ];
}

// ── Anomaly Detection ────────────────────────────────────────────────

class AnomalySettingsCard extends FormattingSettingsCard {
    showAnomalies = new formattingSettings.ToggleSwitch({
        name: "showAnomalies",
        displayName: "Show Anomalies",
        value: false
    });

    anomalyThreshold = new formattingSettings.NumUpDown({
        name: "anomalyThreshold",
        displayName: "Threshold (Std Deviations)",
        value: 2,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 4 }
        }
    });

    anomalyColor = new formattingSettings.ColorPicker({
        name: "anomalyColor",
        displayName: "Anomaly Color",
        value: { value: "#f85149" }
    });

    name: string = "anomalySettings";
    displayName: string = "Anomaly Detection";
    slices: Array<FormattingSettingsSlice> = [
        this.showAnomalies, this.anomalyThreshold, this.anomalyColor
    ];
}

// ── Aggregation & Comparison ─────────────────────────────────────────

class AggregationSettingsCard extends FormattingSettingsCard {
    aggregationMode = new formattingSettings.ItemDropdown({
        name: "aggregationMode",
        displayName: "Aggregation Mode",
        items: [
            { value: "daily", displayName: "Daily" },
            { value: "weekly", displayName: "Weekly" },
            { value: "monthly", displayName: "Monthly" }
        ],
        value: { value: "daily", displayName: "Daily" }
    });

    showComparison = new formattingSettings.ToggleSwitch({
        name: "showComparison",
        displayName: "Year-over-Year Comparison",
        value: false
    });

    name: string = "aggregationSettings";
    displayName: string = "Aggregation & Comparison";
    slices: Array<FormattingSettingsSlice> = [
        this.aggregationMode, this.showComparison
    ];
}

// ── Conditional Formatting ───────────────────────────────────────────

class ThresholdSettingsCard extends FormattingSettingsCard {
    enableThresholds = new formattingSettings.ToggleSwitch({
        name: "enableThresholds",
        displayName: "Enable Thresholds",
        value: false
    });

    threshold1Value = new formattingSettings.NumUpDown({
        name: "threshold1Value",
        displayName: "Low Threshold",
        value: 0,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: -999999999 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 999999999 }
        }
    });

    threshold1Color = new formattingSettings.ColorPicker({
        name: "threshold1Color",
        displayName: "Low Color",
        value: { value: "#f85149" }
    });

    threshold2Value = new formattingSettings.NumUpDown({
        name: "threshold2Value",
        displayName: "Mid Threshold",
        value: 50,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: -999999999 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 999999999 }
        }
    });

    threshold2Color = new formattingSettings.ColorPicker({
        name: "threshold2Color",
        displayName: "Mid Color",
        value: { value: "#d29922" }
    });

    threshold3Color = new formattingSettings.ColorPicker({
        name: "threshold3Color",
        displayName: "High Color",
        value: { value: "#3fb950" }
    });

    name: string = "thresholdSettings";
    displayName: string = "Conditional Formatting";
    slices: Array<FormattingSettingsSlice> = [
        this.enableThresholds,
        this.threshold1Value, this.threshold1Color,
        this.threshold2Value, this.threshold2Color,
        this.threshold3Color
    ];
}

// ── Model ────────────────────────────────────────────────────────────

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    cellSettingsCard = new CellSettingsCard();
    colorSettingsCard = new ColorSettingsCard();
    labelSettingsCard = new LabelSettingsCard();
    legendSettingsCard = new LegendSettingsCard();
    todayMarkerCard = new TodayMarkerCard();
    markerSettingsCard = new MarkerSettingsCard();
    summarySettingsCard = new SummarySettingsCard();
    anomalySettingsCard = new AnomalySettingsCard();
    aggregationSettingsCard = new AggregationSettingsCard();
    thresholdSettingsCard = new ThresholdSettingsCard();

    cards = [
        this.cellSettingsCard, this.colorSettingsCard, this.labelSettingsCard,
        this.legendSettingsCard, this.todayMarkerCard, this.markerSettingsCard,
        this.summarySettingsCard, this.anomalySettingsCard,
        this.aggregationSettingsCard, this.thresholdSettingsCard
    ];
}
