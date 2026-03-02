import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    BarChart, Bar, LabelList
} from 'recharts';
import { X, Filter, BarChart3, Zap, Activity, CircleDot, Plug, Layers, RefreshCw, Download } from 'lucide-react';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { exportDashboardAnalytics } from '../utils/excelExporter';

import zeonLogo from '../assets/zeon_charging.webp';

// Reuseable Card Component
const DashboardCard = ({ title, icon: Icon, borderColorClass = "border-blue-500", children, className = "" }) => (
    <div className={`bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden border-t-4 ${borderColorClass} hover:shadow-xl transition-all duration-300 h-full ${className}`}>
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white flex-none">
            <div className="flex items-center gap-2">
                {Icon && <Icon className={`w-4 h-4 text-gray-600`} />}
                <h3 className="text-sm font-bold text-gray-800 truncate">{title}</h3>
            </div>
        </div>
        <div className="p-2 flex-1 min-h-0 relative">
            {children}
        </div>
    </div>
);

// Custom Tooltip
const CustomTooltip = ({ active, payload, label, total }) => {
    if (active && payload && payload.length) {
        const entry = payload[0];
        // Check if this has P, C, N breakdown data
        const hasBreakdown = entry.payload && (entry.payload.preparing !== undefined || entry.payload.charging !== undefined || entry.payload.negative !== undefined);
        
        return (
            <div className="bg-white/95 backdrop-blur-md p-2 border border-gray-200 shadow-xl rounded-xl text-xs z-50">
                <p className="font-bold text-gray-800 mb-1">{label}</p>
                {payload.map((entry, index) => {
                    // Check if 'percent' is natively provided (Recharts often does for Pie)
                    // If not, calculate using 'total' prop if available.
                    let percentage = null;
                    if (entry.percent !== undefined) {
                        percentage = (entry.percent * 100).toFixed(1);
                    } else if (total) {
                        percentage = ((entry.value / total) * 100).toFixed(1);
                    } else if (entry.payload && entry.payload.percent !== undefined) {
                        percentage = (entry.payload.percent * 100).toFixed(1);
                    }

                    return (
                        <p key={index} className="font-medium flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill || entry.stroke }}></span>
                            <span style={{ color: '#374151' }}>
                                {entry.name}: {percentage ? `${percentage}% (${entry.value})` : entry.value}
                            </span>
                        </p>
                    );
                })}
                {hasBreakdown && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                        <div className="flex gap-3 justify-between">
                            <span>P: <strong className="text-blue-600">{entry.payload.preparing || 0}</strong></span>
                            <span>C: <strong className="text-green-600">{entry.payload.charging || 0}</strong></span>
                            <span>N: <strong className="text-red-600">{entry.payload.negative || 0}</strong></span>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

// Colors
const COLORS = {
    blue: '#3B82F6',
    green: '#10B981',
    orange: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6'
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.orange];

// Tree Chart (replacing Funnel Chart)
const TreeSection = ({ preparing, charging, negative, successful }) => {
    // PDF Logic: Success Rate = Successful Sessions / Charging Sessions
    const totalForRate = charging;
    const rate = totalForRate > 0 ? Math.round((successful / totalForRate) * 100) : 0;
    const isGood = rate >= 70;
    
    // Calculate preCharging (sessions that didn't reach charging)
    const preCharging = preparing - charging;

    // Percentage calculations based on hierarchy
    // Level 1: Preparing is always 100%
    const preparingPercent = 100;
    
    // Level 2: Charging and Pre Charging as percentage of Preparing (should add to 100%)
    const chargingPercent = preparing > 0 ? Math.round((charging / preparing) * 100) : 0;
    const preChargingPercent = preparing > 0 ? Math.round((Math.max(preCharging, 0) / preparing) * 100) : 0;
    
    // Level 3: Negative Stops and Positives as percentage of Charging (should add to 100%)
    const negativePercent = charging > 0 ? Math.round((negative / charging) * 100) : 0;
    const positivePercent = charging > 0 ? Math.round((successful / charging) * 100) : 0;

    return (
        <div className="flex flex-col h-full justify-evenly py-1">
            {/* Level 1: Preparing */}
            <div className="flex justify-center mb-1">
                <div className="bg-blue-500 text-white rounded-xl px-4 py-1.5 text-center shadow-md min-w-[100px]">
                    <div className="text-[10px] font-semibold">Preparing</div>
                    <div className="text-base font-bold">{preparing}</div>
                    <div className="text-xs font-medium">({preparingPercent}%)</div>
                </div>
            </div>

            {/* Connecting Lines */}
            <div className="flex justify-center mb-0.5">
                <svg width="140" height="18" className="overflow-visible">
                    <line x1="70" y1="0" x2="35" y2="18" stroke="#9CA3AF" strokeWidth="1.5"/>
                    <line x1="70" y1="0" x2="105" y2="18" stroke="#9CA3AF" strokeWidth="1.5"/>
                </svg>
            </div>

            {/* Level 2: Charging and Pre Charging */}
            <div className="flex justify-center gap-4 mb-1">
                <div className="bg-green-500 text-white rounded-lg px-3 py-1 text-center shadow-sm min-w-[85px]">
                    <div className="text-[9px] font-semibold">Charging</div>
                    <div className="text-sm font-bold">{charging}</div>
                    <div className="text-[10px] font-medium">({chargingPercent}%)</div>
                </div>
                <div className="bg-purple-500 text-white rounded-lg px-3 py-1 text-center shadow-sm min-w-[85px]">
                    <div className="text-[9px] font-semibold">Pre Charging</div>
                    <div className="text-sm font-bold">{preCharging >= 0 ? preCharging : 0}</div>
                    <div className="text-[10px] font-medium">({preChargingPercent}%)</div>
                </div>
            </div>

            {/* Connecting Lines for Charging branches */}
            <div className="flex justify-start ml-[20%] mb-0.5">
                <svg width="80" height="15" className="overflow-visible">
                    <line x1="40" y1="0" x2="15" y2="15" stroke="#9CA3AF" strokeWidth="1.5"/>
                    <line x1="40" y1="0" x2="65" y2="15" stroke="#9CA3AF" strokeWidth="1.5"/>
                </svg>
            </div>

            {/* Level 3: Negative Stops and Positives (under Charging only) */}
            <div className="flex justify-start ml-[8%] gap-3 mb-1">
                <div className="bg-red-500 text-white rounded-md px-3 py-1 text-center shadow-sm min-w-[75px]">
                    <div className="text-[8px] font-semibold">NegativeStops</div>
                    <div className="text-xs font-bold">{negative}</div>
                    <div className="text-[9px] font-medium">({negativePercent}%)</div>
                </div>
                <div className="bg-teal-500 text-white rounded-md px-3 py-1 text-center shadow-sm min-w-[75px]">
                    <div className="text-[8px] font-semibold">Positives</div>
                    <div className="text-xs font-bold">{successful}</div>
                    <div className="text-[9px] font-medium">({positivePercent}%)</div>
                </div>
            </div>

            {/* Success Rate at bottom */}
            <div className={`text-[10px] font-bold text-center mt-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                Success Rate: {rate}% ({successful} / {totalForRate})
            </div>
        </div>
    );
};

// Helper to safely get value with aggressive fuzzy matching
const getVal = (row, ...keys) => {
    // 1. Exact match
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    // 2. Fuzzy match (alphanumeric only)
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        // Only match if key has reasonable length to avoid false positives with short keys like 'id'
        if (cleanKey.length < 3) continue;

        const found = rowKeys.find(k => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanKey);
        if (found && row[found] !== undefined && row[found] !== null) return row[found];
    }
    return null;
};

// Process Session Trend (All Data Points)
const processSessionTrend = (result) => {
    if (!result) return [];

    // 1. Gather all rows with valid dates
    const allRows = [];
    if (result && typeof result === 'object') {
        Object.entries(result).forEach(([key, val]) => {
            // Only take arrays that aren't meta-info
            if (Array.isArray(val) && !key.startsWith('report_') && key !== 'info' && key !== 'date') {
                allRows.push(...val);
            }
        });
    }

    if (allRows.length === 0) return [];

    const rowsWithDate = allRows.map(row => {
        const dateStr = getVal(row, 'Session Start Time', 'Start Time', 'Date', 'Started', 'Created', 'Time');
        if (!dateStr) return null;
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return null;

        // Try multiple variations for Power
        const peak = parseFloat(getVal(row,
            'Peak Power Delivered (kW)', 'Peak Power', 'Max Power', 'Power (kW)', 'Power',
            'Max. Power', 'Metervalue Power', 'PeakPower', 'MaxPowerKW',
            'SESSION PEAK POWER KW', 'SESSION_PEAK_POWER_KW'
        ) || 0);

        // Try multiple variations for Energy
        const energy = parseFloat(getVal(row,
            'Session Energy Delivered (kWh)', 'Energy Mode (kWh)', 'Energy (kWh)',
            'Total Energy', 'Energy', 'Consumed Energy',
            'SESSION ENERGY DELIVERED KWH', 'SESSION_ENERGY_DELIVERED_KWH'
        ) || 0);

        // Calculate Avg Power
        let avg = 0;
        let durationRaw = getVal(row,
            'Session Duration', 'Duration', 'Charging Time', 'Time Spent',
            'SESSION DURATION MINUTES', 'SESSION_DURATION_MINUTES'
        );
        let hours = 0;
        if (durationRaw) {
            if (typeof durationRaw === 'number') hours = durationRaw / 60; // Assume min usually
            else if (typeof durationRaw === 'string') {
                const p = durationRaw.split(':').map(Number);
                if (p.length === 3) hours = p[0] + p[1] / 60 + p[2] / 3600;
                else if (p.length === 2) hours = p[0] / 60 + p[1] / 3600;
            }
        }

        // If calculated duration failed, fallback to direct Avg Power if available
        if (hours > 0) {
            avg = energy / hours;
        } else {
            // Fallback columns
            avg = parseFloat(getVal(row, 'Avg Power', 'Average Power', 'Avg Power (kW)') || 0);
        }

        return { row, dateObj, peak, avg };
    }).filter(Boolean);

    if (rowsWithDate.length === 0) return [];

    // 3. Aggregate by Day
    const aggregated = {};
    rowsWithDate.forEach(({ dateObj, peak, avg }) => {
        // Create a key for the day: e.g., "Jan 13"
        const dayKey = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!aggregated[dayKey]) {
            aggregated[dayKey] = {
                label: dayKey,
                peaks: [],
                avgs: [],
                count: 0,
                sortKey: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime()
            };
        }
        aggregated[dayKey].peaks.push(peak);
        aggregated[dayKey].avgs.push(avg);
        aggregated[dayKey].count++;
    });

    return Object.values(aggregated)
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(day => ({
            label: day.label,
            sortKey: day.sortKey,
            peak: parseFloat((day.peaks.length > 0 ? Math.max(...day.peaks) : 0).toFixed(2)),
            avg: parseFloat((day.avgs.length > 0 ? day.avgs.reduce((sum, v) => sum + v, 0) / day.count : 0).toFixed(2))
        }));
};

// Process Error Breakdown
const processErrorBreakdown = (result) => {
    if (!result) return [];

    const allRows = [];
    Object.values(result).forEach(val => {
        if (Array.isArray(val)) allRows.push(...val);
    });

    const breakdown = {};
    allRows.forEach(row => {
        // Check for Failure/Error status
        const status = getVal(row, 'STOP', 'Stop', 'Status', 'Session Status');
        if (status && (String(status).toLowerCase().includes('failed') || String(status).toLowerCase().includes('error'))) {
            const reasonKeys = ['STOPREASON', 'Stop Reason', 'StopReason', 'REASON', 'Reason', 'VENDORERRORCODE', 'VendorErrorCode', 'ERRORCODE', 'ErrorCode'];
            let reason = 'Unknown';
            for (const key of reasonKeys) {
                const val = getVal(row, key);
                if (val && val !== 0 && String(val).trim() !== '' && String(val).toLowerCase() !== 'null' && String(val).toLowerCase() !== 'noerror') {
                    reason = val;
                    break;
                }
            }
            reason = String(reason).trim();
            breakdown[reason] = (breakdown[reason] || 0) + 1;
        }
    });

    return Object.entries(breakdown)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5 reasons
};

// Process Top CPIDs by Negative Stops for an OEM
const getTopCPIDsByNegativeStops = (allResults, oemName) => {
    if (!allResults || !oemName) return [];
    
    const cpidStats = [];
    
    Object.entries(allResults).forEach(([key, data]) => {
        if (key === 'All Files') return;
        
        // Check if this file belongs to the selected OEM
        let oem = 'Unknown';
        try {
            if (data.info) {
                let info = data.info;
                if (typeof info === 'string') info = JSON.parse(info);
                if (Array.isArray(info) && info.length > 0) {
                    oem = info[0]['OEM Name'] || 
                          info[0]['OEM'] || 
                          info[0]['Make'] || 
                          info[0]['Manufacturer'] ||
                          info[0]['oem_name'] ||
                          'Unknown';
                }
            }
        } catch (e) { }
        
        oem = String(oem).trim();
        if (!oem || oem === 'Unknown' || oem === '') {
            oem = 'UNKNOWN';
        }
        
        // Only process if this matches the selected OEM
        if (oem !== oemName) return;
        
        // Get CPID and Station Name
        const cpid = getChargePointID(data);
        const stationName = getStationName(data);
        const displayName = stationName && cpid && cpid !== 'Unknown' 
            ? `${stationName} - ${cpid}` 
            : (cpid && cpid !== 'Unknown' ? cpid : stationName || key);
        
        // Calculate negative stops
        const negativeStops = (data.report_1?.['Failed / Error Stops'] || 0) + 
                             (data.report_2?.['Failed / Error Stops'] || 0);
        const chargingSessions = (data.report_1?.['Charging Sessions'] || 0) + 
                                (data.report_2?.['Charging Sessions'] || 0);
        const negativeStopPercent = chargingSessions > 0 
            ? Math.round((negativeStops / chargingSessions) * 100) 
            : 0;
        
        cpidStats.push({
            cpid,
            displayName,
            negativeStops,
            chargingSessions,
            negativeStopPercent,
            fileName: key
        });
    });
    
    // Filter out CPIDs with 0 sessions or 0 negative stops
    const filteredStats = cpidStats.filter(item => 
        item.chargingSessions > 0 && item.negativeStops > 0
    );
    
    // Sort by negative stops (highest first)
    return filteredStats.sort((a, b) => b.negativeStops - a.negativeStops);
};

// Process Negative Stops (Negative Stop %)
const processNetworkPerformance = (allResults) => {
    if (!allResults || Object.keys(allResults).length === 0) return { chartData: [], oemMapping: {} };

    const stats = {};
    const oemMapping = {}; // Maps OEM name to file keys
    let grandTotal = 0;
    let grandNegative = 0;

    // Iterate over all files in allResults
    Object.entries(allResults).forEach(([key, data]) => {
        // Skip if key is 'All Files'
        if (key === 'All Files') return;

        // 1. Extract OEM (Make) with better field checking
        let oem = 'Unknown';
        try {
            if (data.info) {
                let info = data.info;
                if (typeof info === 'string') info = JSON.parse(info);
                if (Array.isArray(info) && info.length > 0) {
                    // Try multiple field names for OEM
                    oem = info[0]['OEM Name'] || 
                          info[0]['OEM'] || 
                          info[0]['Make'] || 
                          info[0]['Manufacturer'] ||
                          info[0]['oem_name'] ||
                          'Unknown';
                }
            }
        } catch (e) { 
            console.error('Error extracting OEM:', e);
        }
        
        // Clean and normalize OEM name
        oem = String(oem).trim();
        if (!oem || oem === 'Unknown' || oem === '') {
            oem = 'UNKNOWN';
        }

        // 2. Extract Counts
        const t1 = (data.report_1?.['Charging Sessions'] || 0);
        const n1 = (data.report_1?.['Failed / Error Stops'] || 0);
        const t2 = (data.report_2?.['Charging Sessions'] || 0);
        const n2 = (data.report_2?.['Failed / Error Stops'] || 0);
        const p1 = (data.report_1?.['Preparing Sessions'] || 0);
        const p2 = (data.report_2?.['Preparing Sessions'] || 0);

        if (!stats[oem]) {
            stats[oem] = { total: 0, negative: 0, preparing: 0, charging: 0 };
            oemMapping[oem] = [];
        }
        stats[oem].total += t1 + t2;
        stats[oem].negative += n1 + n2;
        stats[oem].preparing += p1 + p2;
        stats[oem].charging += t1 + t2;
        oemMapping[oem].push(key); // Store file key for this OEM

        grandTotal += t1 + t2;
        grandNegative += n1 + n2;
    });

    // Create chart data from OEM stats
    const chartData = Object.entries(stats).map(([name, { total, negative, preparing, charging }]) => ({
        name,
        value: total > 0 ? Math.round((negative / total) * 100) : 0,
        fill: '#C2410C', // Orange-700
        preparing,
        charging,
        negative
    }));

    // Sort by value (highest negative stop % first)
    chartData.sort((a, b) => b.value - a.value);

    // Add Overall at the end
    const overallVal = grandTotal > 0 ? Math.round((grandNegative / grandTotal) * 100) : 0;
    chartData.push({ name: 'OVERALL', value: overallVal, fill: '#9A3412' }); // Darker Orange/Brown

    return { chartData, oemMapping };
};

// Process Negative Stops by Station (Negative Stop %)
const processNetworkPerformanceByStation = (allResults, selectedOEM = null) => {
    if (!allResults || Object.keys(allResults).length === 0) return [];

    const stationStats = {};

    Object.entries(allResults).forEach(([key, data]) => {
        if (key === 'All Files') return;

        // Filter by OEM if selected
        if (selectedOEM && selectedOEM !== 'OVERALL') {
            let oem = 'Unknown';
            try {
                if (data.info) {
                    let info = data.info;
                    if (typeof info === 'string') info = JSON.parse(info);
                    if (Array.isArray(info) && info.length > 0) {
                        oem = info[0]['OEM Name'] || 
                              info[0]['OEM'] || 
                              info[0]['Make'] || 
                              info[0]['Manufacturer'] ||
                              info[0]['oem_name'] ||
                              'Unknown';
                    }
                }
            } catch (e) { }
            oem = String(oem).trim();
            if (!oem || oem === 'Unknown' || oem === '') oem = 'UNKNOWN';
            if (oem !== selectedOEM) return;
        }

        // Get Station Name
        const stationName = getStationName(data) || 'Unknown Station';

        // Get counts
        const t1 = (data.report_1?.['Charging Sessions'] || 0);
        const n1 = (data.report_1?.['Failed / Error Stops'] || 0);
        const t2 = (data.report_2?.['Charging Sessions'] || 0);
        const n2 = (data.report_2?.['Failed / Error Stops'] || 0);
        const p1 = (data.report_1?.['Preparing Sessions'] || 0);
        const p2 = (data.report_2?.['Preparing Sessions'] || 0);

        if (!stationStats[stationName]) {
            stationStats[stationName] = { total: 0, negative: 0, preparing: 0, charging: 0 };
        }
        stationStats[stationName].total += t1 + t2;
        stationStats[stationName].negative += n1 + n2;
        stationStats[stationName].preparing += p1 + p2;
        stationStats[stationName].charging += t1 + t2;
    });

    // Create chart data
    const chartData = Object.entries(stationStats).map(([name, { total, negative, preparing, charging }]) => ({
        name,
        value: total > 0 ? Math.round((negative / total) * 100) : 0,
        fill: '#DC2626', // Red-600
        preparing,
        charging,
        negative
    }));

    // Sort by value (highest negative stop % first)
    return chartData.sort((a, b) => b.value - a.value);
};

// Process Negative Stops by CPID (Negative Stop %)
const processNetworkPerformanceByCPID = (allResults, selectedOEM = null) => {
    if (!allResults || Object.keys(allResults).length === 0) return [];

    const stats = {};

    // Iterate over all files in allResults
    Object.entries(allResults).forEach(([key, data]) => {
        // Skip if key is 'All Files'
        if (key === 'All Files') return;

        // Filter by OEM if selected
        if (selectedOEM && selectedOEM !== 'OVERALL') {
            let oem = 'Unknown';
            try {
                if (data.info) {
                    let info = data.info;
                    if (typeof info === 'string') info = JSON.parse(info);
                    if (Array.isArray(info) && info.length > 0) {
                        oem = info[0]['OEM Name'] || 
                              info[0]['OEM'] || 
                              info[0]['Make'] || 
                              info[0]['Manufacturer'] ||
                              info[0]['oem_name'] ||
                              'Unknown';
                    }
                }
            } catch (e) { }
            oem = String(oem).trim();
            if (!oem || oem === 'Unknown' || oem === '') oem = 'UNKNOWN';
            if (oem !== selectedOEM) return;
        }

        // Extract CPID with better field checking
        let cpid = 'Unknown';
        let stationName = 'Unknown Station';
        try {
            if (data.info) {
                let info = data.info;
                if (typeof info === 'string') info = JSON.parse(info);
                if (Array.isArray(info) && info.length > 0) {
                    // Try multiple field names for CPID (using exact field names from data)
                    cpid = info[0]['Charge Point id'] || 
                           info[0]['Charge Point Id'] || 
                           info[0]['chargePointId'] || 
                           info[0]['CPID'] || 
                           info[0]['CP ID'] ||
                           'Unknown';
                    
                    // Extract Station Name
                    stationName = info[0]['Station Name'] || 
                                 info[0]['Station Alias Name'] || 
                                 info[0]['Station Identity'] || 
                                 info[0]['station_name'] ||
                                 info[0]['StationName'] ||
                                 info[0]['Station'] ||
                                 'Unknown Station';
                }
            }
        } catch (e) { 
            console.error('Error extracting CPID:', e);
        }
        
        // Clean and normalize CPID
        cpid = String(cpid).trim();
        if (!cpid || cpid === 'Unknown' || cpid === '') {
            cpid = 'UNKNOWN';
        }
        
        // Create display name with Station - CPID
        const displayName = stationName !== 'Unknown Station' 
            ? `${stationName} - ${cpid}` 
            : cpid;

        // Extract Counts
        const t1 = (data.report_1?.['Charging Sessions'] || 0);
        const n1 = (data.report_1?.['Failed / Error Stops'] || 0);
        const t2 = (data.report_2?.['Charging Sessions'] || 0);
        const n2 = (data.report_2?.['Failed / Error Stops'] || 0);

        if (!stats[displayName]) {
            stats[displayName] = { total: 0, negative: 0 };
        }
        stats[displayName].total += t1 + t2;
        stats[displayName].negative += n1 + n2;
    });

    // Create chart data from CPID stats
    const chartData = Object.entries(stats).map(([name, { total, negative }]) => ({
        name,
        value: total > 0 ? Math.round((negative / total) * 100) : 0,
        fill: '#7C3AED' // Purple-600
    }));

    // Sort by value (highest negative stop % first)
    return chartData.sort((a, b) => b.value - a.value);
};

// Process Precharging Failure by OEM
const processPrechargingFailureByOEM = (allResults, selectedOEM = null) => {
    if (!allResults || Object.keys(allResults).length === 0) return [];

    const oemStats = {};

    Object.entries(allResults).forEach(([key, data]) => {
        if (key === 'All Files') return;

        // Filter by OEM if selected
        if (selectedOEM && selectedOEM !== 'OVERALL') {
            let oem = 'Unknown';
            try {
                if (data.info) {
                    let info = data.info;
                    if (typeof info === 'string') info = JSON.parse(info);
                    if (Array.isArray(info) && info.length > 0) {
                        oem = info[0]['OEM Name'] || 
                              info[0]['OEM'] || 
                              info[0]['Make'] || 
                              info[0]['Manufacturer'] ||
                              info[0]['oem_name'] ||
                              'Unknown';
                    }
                }
            } catch (e) { }
            oem = String(oem).trim();
            if (!oem || oem === 'Unknown' || oem === '') oem = 'UNKNOWN';
            if (oem !== selectedOEM) return;
        }

        // Extract OEM
        let oem = 'Unknown';
        try {
            if (data.info) {
                let info = data.info;
                if (typeof info === 'string') info = JSON.parse(info);
                if (Array.isArray(info) && info.length > 0) {
                    oem = info[0]['OEM Name'] || 
                          info[0]['OEM'] || 
                          info[0]['Make'] || 
                          info[0]['Manufacturer'] ||
                          info[0]['oem_name'] ||
                          'Unknown';
                }
            }
        } catch (e) { }
        
        oem = String(oem).trim();
        if (!oem || oem === 'Unknown' || oem === '') {
            oem = 'UNKNOWN';
        }

        // Count precharging failures from raw data
        let prechargingFailures = 0;
        
        // Check Connector1
        if (Array.isArray(data.Connector1)) {
            prechargingFailures += data.Connector1.filter(row => {
                const errorCode = getVal(row, 'vendorErrorCode', 'VendorErrorCode', 'VENDORERRORCODE', 'ErrorCode');
                const isCharging = getVal(row, 'is_Charging', 'isCharging', 'IS_CHARGING');
                return String(errorCode).toLowerCase().includes('precharging') && isCharging === 0;
            }).length;
        }
        
        // Check Connector2
        if (Array.isArray(data.Connector2)) {
            prechargingFailures += data.Connector2.filter(row => {
                const errorCode = getVal(row, 'vendorErrorCode', 'VendorErrorCode', 'VENDORERRORCODE', 'ErrorCode');
                const isCharging = getVal(row, 'is_Charging', 'isCharging', 'IS_CHARGING');
                return String(errorCode).toLowerCase().includes('precharging') && isCharging === 0;
            }).length;
        }

        if (!oemStats[oem]) {
            oemStats[oem] = 0;
        }
        oemStats[oem] += prechargingFailures;
    });

    // Create chart data
    const chartData = Object.entries(oemStats)
        .map(([name, value]) => ({
            name,
            value,
            fill: '#F59E0B' // Amber-500
        }))
        .filter(item => item.value > 0); // Only show OEMs with failures

    // Sort by value (highest first)
    return chartData.sort((a, b) => b.value - a.value);
};

// Process Precharging Failure by Station
const processPrechargingFailureByStation = (allResults, selectedOEM = null) => {
    if (!allResults || Object.keys(allResults).length === 0) return [];

    const stationStats = {};

    Object.entries(allResults).forEach(([key, data]) => {
        if (key === 'All Files') return;

        // Filter by OEM if selected
        if (selectedOEM && selectedOEM !== 'OVERALL') {
            let oem = 'Unknown';
            try {
                if (data.info) {
                    let info = data.info;
                    if (typeof info === 'string') info = JSON.parse(info);
                    if (Array.isArray(info) && info.length > 0) {
                        oem = info[0]['OEM Name'] || 
                              info[0]['OEM'] || 
                              info[0]['Make'] || 
                              info[0]['Manufacturer'] ||
                              info[0]['oem_name'] ||
                              'Unknown';
                    }
                }
            } catch (e) { }
            oem = String(oem).trim();
            if (!oem || oem === 'Unknown' || oem === '') oem = 'UNKNOWN';
            if (oem !== selectedOEM) return;
        }

        // Get Station Name
        const stationName = getStationName(data) || 'Unknown Station';

        // Count precharging failures from raw data
        let prechargingFailures = 0;
        
        // Check Connector1
        if (Array.isArray(data.Connector1)) {
            prechargingFailures += data.Connector1.filter(row => {
                const errorCode = getVal(row, 'vendorErrorCode', 'VendorErrorCode', 'VENDORERRORCODE', 'ErrorCode');
                const isCharging = getVal(row, 'is_Charging', 'isCharging', 'IS_CHARGING');
                return String(errorCode).toLowerCase().includes('precharging') && isCharging === 0;
            }).length;
        }
        
        // Check Connector2
        if (Array.isArray(data.Connector2)) {
            prechargingFailures += data.Connector2.filter(row => {
                const errorCode = getVal(row, 'vendorErrorCode', 'VendorErrorCode', 'VENDORERRORCODE', 'ErrorCode');
                const isCharging = getVal(row, 'is_Charging', 'isCharging', 'IS_CHARGING');
                return String(errorCode).toLowerCase().includes('precharging') && isCharging === 0;
            }).length;
        }

        if (!stationStats[stationName]) {
            stationStats[stationName] = 0;
        }
        stationStats[stationName] += prechargingFailures;
    });

    // Create chart data
    const chartData = Object.entries(stationStats)
        .map(([name, value]) => ({
            name,
            value,
            fill: '#8B5CF6' // Purple-500
        }))
        .filter(item => item.value > 0); // Only show Stations with failures

    // Sort by value (highest first)
    return chartData.sort((a, b) => b.value - a.value);
};

// Process Precharging Failure by CPID
const processPrechargingFailureByCPID = (allResults, selectedOEM = null) => {
    if (!allResults || Object.keys(allResults).length === 0) return [];

    const cpidStats = {};

    Object.entries(allResults).forEach(([key, data]) => {
        if (key === 'All Files') return;

        // Filter by OEM if selected
        if (selectedOEM && selectedOEM !== 'OVERALL') {
            let oem = 'Unknown';
            try {
                if (data.info) {
                    let info = data.info;
                    if (typeof info === 'string') info = JSON.parse(info);
                    if (Array.isArray(info) && info.length > 0) {
                        oem = info[0]['OEM Name'] || 
                              info[0]['OEM'] || 
                              info[0]['Make'] || 
                              info[0]['Manufacturer'] ||
                              info[0]['oem_name'] ||
                              'Unknown';
                    }
                }
            } catch (e) { }
            oem = String(oem).trim();
            if (!oem || oem === 'Unknown' || oem === '') oem = 'UNKNOWN';
            if (oem !== selectedOEM) return;
        }

        // Get CPID and Station Name
        const cpid = getChargePointID(data) || 'Unknown CPID';
        const stationName = getStationName(data) || 'Unknown Station';
        
        // Create display name with Station - CPID
        const displayName = stationName !== 'Unknown Station' && stationName
            ? `${stationName} - ${cpid}` 
            : cpid;

        // Count precharging failures from raw data
        let prechargingFailures = 0;
        
        // Check Connector1
        if (Array.isArray(data.Connector1)) {
            prechargingFailures += data.Connector1.filter(row => {
                const errorCode = getVal(row, 'vendorErrorCode', 'VendorErrorCode', 'VENDORERRORCODE', 'ErrorCode');
                const isCharging = getVal(row, 'is_Charging', 'isCharging', 'IS_CHARGING');
                return String(errorCode).toLowerCase().includes('precharging') && isCharging === 0;
            }).length;
        }
        
        // Check Connector2
        if (Array.isArray(data.Connector2)) {
            prechargingFailures += data.Connector2.filter(row => {
                const errorCode = getVal(row, 'vendorErrorCode', 'VendorErrorCode', 'VENDORERRORCODE', 'ErrorCode');
                const isCharging = getVal(row, 'is_Charging', 'isCharging', 'IS_CHARGING');
                return String(errorCode).toLowerCase().includes('precharging') && isCharging === 0;
            }).length;
        }

        if (!cpidStats[displayName]) {
            cpidStats[displayName] = 0;
        }
        cpidStats[displayName] += prechargingFailures;
    });

    // Create chart data
    const chartData = Object.entries(cpidStats)
        .map(([name, value]) => ({
            name,
            value,
            fill: '#F59E0B' // Amber-500
        }))
        .filter(item => item.value > 0); // Only show CPIDs with failures

    // Sort by value (highest first)
    return chartData.sort((a, b) => b.value - a.value);
};


// Searchable Select Component
const SearchableSelect = ({ options, value, onChange, label, icon: Icon, prefix }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);
    const displayValue = selectedOption ? selectedOption.label : 'Select...';

    const filteredOptions = options.filter(o =>
        String(o.label).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => { setIsOpen(!isOpen); setSearchTerm(''); }}
                className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors w-full min-w-[150px] justify-between"
            >
                <div className="flex items-center gap-2 truncate">
                    {Icon && <Icon className="w-3.5 h-3.5 text-gray-500 flex-none" />}
                    {prefix && <span className="text-xs font-bold text-gray-400 flex-none">{prefix}</span>}
                    <span className="text-xs font-semibold text-gray-700 truncate block max-w-[120px] text-left">
                        {value === 'All' || value === 'All Files' ? (prefix ? 'All' : displayValue) : displayValue}
                    </span>
                </div>
                <div className="opacity-50 text-[10px]">▼</div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-[200px] max-h-[300px] bg-white border border-gray-200 shadow-xl rounded-lg z-[100] flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded bg-white outline-none focus:border-blue-500"
                        />
                    </div>
                    {/* Clear Filter Option */}
                    {value !== 'All' && value !== 'All Files' && (
                        <div className="px-2 py-1 border-b border-gray-200 bg-gray-50">
                            <button
                                onClick={() => { onChange('All'); setIsOpen(false); }}
                                className="w-full text-left px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded font-semibold transition-colors"
                            >
                                ✕ Clear Filter
                            </button>
                        </div>
                    )}
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-blue-50 hover:text-blue-600 truncate transition-colors ${value === opt.value ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`}
                                title={opt.label}
                            >
                                {opt.label}
                            </button>
                        )) : (
                            <div className="text-xs text-gray-400 p-2 text-center">No results</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper: Get Charge Point ID
const getChargePointID = (data) => {
    try {
        if (data && data.info) {
            let info = data.info;
            if (typeof info === 'string') info = JSON.parse(info);

            // Check array entries until we find a valid ID
            if (Array.isArray(info) && info.length > 0) {
                for (const item of info) {
                    const id = item['Charge Point id'] || item['Charge Point Id'] || item['chargePointId'] || item['Charge Point ID'];
                    if (id) return id;
                }
            }
        }
    } catch (e) { }
    return 'Unknown';
};

// Helper: Get Station Name
const getStationName = (data) => {
    try {
        if (data && data.info) {
            let info = data.info;
            if (typeof info === 'string') info = JSON.parse(info);
            if (Array.isArray(info) && info.length > 0) {
                return info[0]['Station Name'] || 
                       info[0]['Station Alias Name'] || 
                       info[0]['Station Identity'] || 
                       info[0]['station_name'] ||
                       info[0]['StationName'] ||
                       info[0]['Station'] ||
                       null;
            }
        }
    } catch (e) { 
        console.error('Error getting station name:', e);
    }
    return null;
};

// Helper: Get Display Label (Station Name - CPID)
const getDisplayLabel = (data, fileName) => {
    const cpId = getChargePointID(data);
    const stationName = getStationName(data);
    
    // Debug log
    console.log('Dashboard Display Label:', { fileName, cpId, stationName, info: data?.info });
    
    if (stationName && cpId && cpId !== 'Unknown') {
        return `${stationName} - ${cpId}`;
    } else if (cpId && cpId !== 'Unknown') {
        return cpId;
    } else if (stationName) {
        return stationName;
    }
    return fileName;
};

// Helper: Get Connector Type (AC/DC)
const getConnectorType = (data) => {
    try {
        if (data && data.info) {
            let info = data.info;
            if (typeof info === 'string') info = JSON.parse(info);
            if (Array.isArray(info) && info.length > 0) {
                const connectorStandard = info[0]['Connector Standard(AC/DC)'] || 
                                         info[0]['Connector Standard'] || 
                                         info[0]['ConnectorStandard'] ||
                                         info[0]['Type'] ||
                                         null;
                if (connectorStandard) {
                    return String(connectorStandard).toUpperCase().trim();
                }
            }
        }
    } catch (e) { 
        console.error('Error getting connector type:', e);
    }
    return null;
};

// Helper: Aggregate Results
const aggregateData = (resultsList) => {
    if (!resultsList || !Array.isArray(resultsList) || resultsList.length === 0) return {};
    if (resultsList.length === 1) return resultsList[0] || {};

    const aggregated = {
        report_1: {},
        report_2: {}
    };

    const firstValidInfo = resultsList.find(r => r && r.info)?.info;
    const sumKeys = ['Preparing Sessions', 'Charging Sessions', 'Successful Sessions', 'Failed / Error Stops', 'Remote Start', 'Auto Start', 'RFID Start'];

    resultsList.forEach(result => {
        if (!result || typeof result !== 'object') return;
        Object.keys(result).forEach(key => {
            if (key.startsWith('report_')) {
                if (!aggregated[key]) aggregated[key] = {};
                if (!result[key] || typeof result[key] !== 'object') return;

                // Sum numeric metrics
                sumKeys.forEach(metric => {
                    const val = result[key][metric] || 0;
                    aggregated[key][metric] = (aggregated[key][metric] || 0) + val;
                });

                // Aggregate Error Summaries if they exist
                const errorSummaryKeys = ['Successful Error Summary', 'Failed / Error Error Summary'];
                errorSummaryKeys.forEach(sKey => {
                    if (result[key][sKey] && typeof result[key][sKey] === 'object') {
                        if (!aggregated[key][sKey]) aggregated[key][sKey] = {};
                        Object.entries(result[key][sKey]).forEach(([err, count]) => {
                            if (typeof count === 'number') {
                                aggregated[key][sKey][err] = (aggregated[key][sKey][err] || 0) + count;
                            }
                        });
                    }
                });
            } else if (Array.isArray(result[key])) {
                if (!aggregated[key]) aggregated[key] = [];
                aggregated[key] = [...aggregated[key], ...result[key]];
            } else if (key === 'info' || key === 'date') {
                if (!aggregated[key]) aggregated[key] = result[key];
            }
        });
    });

    if (firstValidInfo && !aggregated.info) aggregated.info = firstValidInfo;
    return aggregated;
};

export default function DashboardView({ result, onClose, selectedFiles, setSelectedFiles, allResults }) {

    // Data Preparation
    const filters = allResults && Object.keys(allResults).length > 1 ? Object.keys(allResults).filter(k => k !== 'All Files').sort() : [];

    // State
    const [selectedCpId, setSelectedCpId] = useState('All');
    const [selectedStation, setSelectedStation] = useState('All');
    const [selectedOEM, setSelectedOEM] = useState(null); // For OEM filtering from Negative Stops chart
    const [showCPIDModal, setShowCPIDModal] = useState(false);
    const [cpidModalData, setCpidModalData] = useState({ oemName: '', topCPIDs: [] });
    const [connectorType, setConnectorType] = useState('DC'); // AC, Combined, DC - default to DC

    // Grouping Logic
    const groupedResults = useMemo(() => {
        if (!allResults) return { byId: {}, byStation: {}, stationToCpids: {} };
        const byId = {};
        const byStation = {};
        const stationToCpids = {}; // Maps station name to array of CPIDs

        Object.entries(allResults).forEach(([filename, data]) => {
            if (filename === 'All Files') return;

            // Filter by connector type
            const connectorStandard = getConnectorType(data);
            if (connectorType !== 'Combined') {
                // Skip if doesn't match selected connector type
                if (!connectorStandard || connectorStandard !== connectorType) {
                    return;
                }
            }

            // By CPID
            const cpid = getChargePointID(data);
            if (!byId[cpid]) byId[cpid] = [];
            byId[cpid].push(data);

            // By Station
            const station = getStationName(data);
            if (!byStation[station]) byStation[station] = [];
            byStation[station].push(data);

            // Map Station to CPIDs
            if (!stationToCpids[station]) stationToCpids[station] = new Set();
            stationToCpids[station].add(cpid);
        });

        // Convert Sets to sorted Arrays
        Object.keys(stationToCpids).forEach(station => {
            stationToCpids[station] = Array.from(stationToCpids[station]).sort();
        });

        return { byId, byStation, stationToCpids };
    }, [allResults, connectorType]);

    const cpIds = Object.keys(groupedResults.byId).sort();
    const stations = Object.keys(groupedResults.byStation).sort();

    // Auto-reset CPID if it's not valid for the selected station
    useEffect(() => {
        if (selectedStation !== 'All' && selectedCpId !== 'All') {
            const stationCpids = groupedResults.stationToCpids[selectedStation] || [];
            if (!stationCpids.includes(selectedCpId)) {
                setSelectedCpId('All');
            }
        }
    }, [selectedStation, groupedResults.stationToCpids, selectedCpId]);

    // Determine Active Result
    const activeResult = useMemo(() => {
        // Create filtered allResults based on connector type
        const filteredAllResults = {};
        if (allResults) {
            Object.entries(allResults).forEach(([key, data]) => {
                if (key === 'All Files') {
                    filteredAllResults[key] = data;
                    return;
                }
                const connectorStandard = getConnectorType(data);
                if (connectorType === 'Combined' || connectorStandard === connectorType) {
                    filteredAllResults[key] = data;
                }
            });
        }

        // 0. OEM Filter (Highest priority - from Negative Stops chart)
        if (selectedOEM && selectedOEM !== 'OVERALL') {
            const networkPerf = processNetworkPerformance(filteredAllResults);
            const filesForOEM = networkPerf.oemMapping[selectedOEM] || [];
            if (filesForOEM.length === 1) {
                return filteredAllResults[filesForOEM[0]] || result;
            } else if (filesForOEM.length > 1) {
                return aggregateData(filesForOEM.map(f => filteredAllResults[f]).filter(Boolean));
            }
        }

        // 1. Specific Files (Takes priority if selected)
        if (selectedFiles && selectedFiles.length > 0 && !selectedFiles.includes('All Files')) {
            if (selectedFiles.length === 1) {
                return filteredAllResults[selectedFiles[0]] || result;
            }
            return aggregateData(selectedFiles.map(f => filteredAllResults[f]).filter(Boolean));
        }
        // 2. CP ID
        if (selectedCpId !== 'All' && groupedResults.byId[selectedCpId]) {
            return aggregateData(groupedResults.byId[selectedCpId]);
        }
        // 3. Station
        if (selectedStation !== 'All' && groupedResults.byStation[selectedStation]) {
            return aggregateData(groupedResults.byStation[selectedStation]);
        }
        // 4. Default - aggregate filtered results
        if (connectorType !== 'Combined') {
            const filteredData = Object.values(filteredAllResults).filter(d => d !== filteredAllResults['All Files']);
            if (filteredData.length > 0) {
                return aggregateData(filteredData);
            }
        }
        return result;
    }, [selectedFiles, selectedCpId, selectedStation, selectedOEM, groupedResults, result, allResults, connectorType]);

    // Handlers
    const handleFileFilterChange = (vals) => {
        setSelectedFiles(vals);
        setSelectedCpId('All');
        setSelectedStation('All');
        setSelectedOEM(null);
    };

    const handleCpIdChange = (val) => {
        setSelectedCpId(val);
        setSelectedFiles(['All Files']);
        setSelectedStation('All');
        setSelectedOEM(null);
    };

    const handleStationChange = (val) => {
        setSelectedStation(val);
        setSelectedCpId('All');
        setSelectedFiles(['All Files']);
        setSelectedOEM(null);
    };

    const handleOEMClick = (oemName) => {
        if (oemName === 'OVERALL') {
            return; // Don't process OVERALL
        }
        
        // Get top CPIDs for this OEM
        const topCPIDs = getTopCPIDsByNegativeStops(allResults, oemName);
        
        // Show modal with results
        setCpidModalData({
            oemName: oemName,
            topCPIDs: topCPIDs
        });
        setShowCPIDModal(true);
        
        // Also apply the OEM filter
        if (oemName === selectedOEM) {
            setSelectedOEM(null);
        } else {
            setSelectedOEM(oemName);
            // Clear other filters when OEM is selected
            setSelectedFiles(['All Files']);
            setSelectedCpId('All');
            setSelectedStation('All');
        }
    };

    // Options for Filters
    const stationOptions = [
        { value: 'All', label: 'All Stations' },
        ...stations.map(s => ({ value: s, label: s }))
    ];
    
    // Filter CPIDs based on selected station
    const availableCpIds = useMemo(() => {
        if (selectedStation === 'All') {
            return cpIds;
        }
        // Return only CPIDs that belong to the selected station
        return groupedResults.stationToCpids[selectedStation] || [];
    }, [selectedStation, cpIds, groupedResults.stationToCpids]);
    
    const cpidOptions = [
        { value: 'All', label: selectedStation === 'All' ? 'All CPIDs' : `All CPIDs in ${selectedStation}` },
        ...availableCpIds.map(c => ({ value: c, label: c }))
    ];
    const fileOptions = [
        { value: 'All Files', label: 'All Files' },
        ...filters.map(f => {
            const data = allResults[f];
            const displayLabel = getDisplayLabel(data, f);
            return { value: f, label: displayLabel };
        })
    ];

    const funnelData = {
        combined: {
            preparing: (activeResult?.report_1?.['Preparing Sessions'] || 0) + (activeResult?.report_2?.['Preparing Sessions'] || 0),
            charging: (activeResult?.report_1?.['Charging Sessions'] || 0) + (activeResult?.report_2?.['Charging Sessions'] || 0),
            negative: (activeResult?.report_1?.['Failed / Error Stops'] || 0) + (activeResult?.report_2?.['Failed / Error Stops'] || 0),
            successful: (activeResult?.report_1?.['Successful Sessions'] || 0) + (activeResult?.report_2?.['Successful Sessions'] || 0)
        },
        c1: {
            preparing: activeResult?.report_1?.['Preparing Sessions'] || 0,
            charging: activeResult?.report_1?.['Charging Sessions'] || 0,
            negative: activeResult?.report_1?.['Failed / Error Stops'] || 0,
            successful: activeResult?.report_1?.['Successful Sessions'] || 0
        },
        c2: {
            preparing: activeResult?.report_2?.['Preparing Sessions'] || 0,
            charging: activeResult?.report_2?.['Charging Sessions'] || 0,
            negative: activeResult?.report_2?.['Failed / Error Stops'] || 0,
            successful: activeResult?.report_2?.['Successful Sessions'] || 0
        }
    };

    const pieDataRaw = [
        { name: 'Remote', value: (activeResult?.report_1?.['Remote Start'] || 0) + (activeResult?.report_2?.['Remote Start'] || 0) },
        { name: 'Auto', value: (activeResult?.report_1?.['Auto Start'] || 0) + (activeResult?.report_2?.['Auto Start'] || 0) },
        { name: 'RFID', value: (activeResult?.report_1?.['RFID Start'] || 0) + (activeResult?.report_2?.['RFID Start'] || 0) }
    ].filter(d => d.value > 0);
    const pieTotal = pieDataRaw.reduce((acc, curr) => acc + curr.value, 0);
    const pieData = pieDataRaw.map(d => ({
        ...d,
        percentage: pieTotal > 0 ? Math.round((d.value / pieTotal) * 100) : 0
    }));

    // Error Data
    const errorDataRaw = processErrorBreakdown(activeResult);
    const errorTotal = errorDataRaw.reduce((acc, curr) => acc + curr.value, 0);
    const errorData = errorDataRaw.map(d => ({
        ...d,
        percentage: errorTotal > 0 ? Math.round((d.value / errorTotal) * 100) : 0
    }));
    const ERROR_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1'];

    // Pre-Charging Failure Breakdown Data
    const preChargingFailure = funnelData.combined.preparing - funnelData.combined.charging; // Sessions that didn't make it to charging
    const negativeStops = funnelData.combined.negative;
    const positiveStops = funnelData.combined.successful;
    
    const preChargingDataRaw = [
        { name: 'Pre-Charging Failure', value: preChargingFailure > 0 ? preChargingFailure : 0 },
        { name: 'Negative Stops', value: negativeStops },
        { name: 'Positive Stops', value: positiveStops }
    ].filter(d => d.value > 0);
    const preChargingTotal = preChargingDataRaw.reduce((acc, curr) => acc + curr.value, 0);
    const preChargingData = preChargingDataRaw.map(d => ({
        ...d,
        percentage: preChargingTotal > 0 ? Math.round((d.value / preChargingTotal) * 100) : 0
    }));
    const PRECHARGING_COLORS = ['#EF4444', '#F59E0B', '#10B981']; // Red, Orange, Green

    // Dynamic Daily Line Data
    const lineData = processSessionTrend(activeResult);

    // Create filtered allResults based on connector type for global charts
    const filteredAllResultsForCharts = useMemo(() => {
        const filtered = {};
        if (allResults) {
            Object.entries(allResults).forEach(([key, data]) => {
                if (key === 'All Files') {
                    filtered[key] = data;
                    return;
                }
                const connectorStandard = getConnectorType(data);
                if (connectorType === 'Combined' || connectorStandard === connectorType) {
                    filtered[key] = data;
                }
            });
        }
        return filtered;
    }, [allResults, connectorType]);

    // Negative Stops Data (Global) - using filtered data
    const networkPerformance = processNetworkPerformance(filteredAllResultsForCharts);
    const networkData = networkPerformance.chartData.map(item => ({
        ...item,
        fill: selectedOEM === item.name ? '#DC2626' : (selectedOEM ? '#D1D5DB' : item.fill), // Bright red for selected, gray for others when filtered
        opacity: selectedOEM === item.name ? 1 : (selectedOEM ? 0.4 : 1)
    }));

    // Negative Stops by Station Data - filtered by OEM if selected
    const stationPerformanceData = processNetworkPerformanceByStation(filteredAllResultsForCharts, selectedOEM);
    
    // Negative Stops by CPID Data - filtered by OEM if selected
    const cpidPerformanceData = processNetworkPerformanceByCPID(filteredAllResultsForCharts, selectedOEM);
    
    // Precharging Failure by OEM Data - filtered by OEM if selected
    const prechargingFailureData = processPrechargingFailureByOEM(filteredAllResultsForCharts, selectedOEM);
    
    // Precharging Failure by Station Data - filtered by OEM if selected
    const prechargingFailureByStationData = processPrechargingFailureByStation(filteredAllResultsForCharts, selectedOEM);
    
    // Precharging Failure by CPID Data - filtered by OEM if selected
    const prechargingFailureByCPIDData = processPrechargingFailureByCPID(filteredAllResultsForCharts, selectedOEM);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-gray-100 z-50 flex flex-col h-screen w-screen overflow-hidden"
        >
            {/* Header - Fixed Height */}
            <div className="bg-white px-4 py-2 border-b border-gray-200 shadow-sm flex justify-between items-center flex-none h-[60px]">
                <div className="flex items-center gap-3">
                    <img src={zeonLogo} alt="Zeon" className="h-8 w-auto" />
                    <div className="h-6 w-[1px] bg-gray-300"></div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Analytics Dashboard
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    {/* Connector Type Toggle */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                        <button
                            onClick={() => setConnectorType('AC')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                                connectorType === 'AC'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            AC
                        </button>
                        <button
                            onClick={() => setConnectorType('Combined')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                                connectorType === 'Combined'
                                    ? 'bg-gray-700 text-white shadow-sm'
                                    : 'bg-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            Combined
                        </button>
                        <button
                            onClick={() => setConnectorType('DC')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                                connectorType === 'DC'
                                    ? 'bg-green-600 text-white shadow-sm'
                                    : 'bg-transparent text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            DC
                        </button>
                    </div>

                    {/* Filter 1: Station Name */}
                    {stations.length > 1 && (
                        <SearchableSelect
                            options={stationOptions}
                            value={selectedStation}
                            onChange={handleStationChange}
                            prefix="Station:"
                        />
                    )}

                    {/* Filter 2: CP ID */}
                    {cpIds.length > 1 && (
                        <SearchableSelect
                            options={cpidOptions}
                            value={selectedCpId}
                            onChange={handleCpIdChange}
                            prefix="CPID:"
                        />
                    )}

                    {/* Filter 3: File Name */}
                    {filters.length > 0 && (
                        <MultiSelectDropdown
                            options={fileOptions}
                            selectedValues={selectedFiles}
                            onChange={handleFileFilterChange}
                            placeholder="Search Station or CPID..."
                        />
                    )}

                    {/* Clear All Filters Button */}
                    {(!selectedFiles.includes('All Files') || selectedStation !== 'All' || selectedCpId !== 'All' || selectedOEM) && (
                        <button
                            onClick={() => {
                                setSelectedFiles(['All Files']);
                                setSelectedStation('All');
                                setSelectedCpId('All');
                                setSelectedOEM(null);
                            }}
                            className="bg-gray-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-gray-700 transition-colors"
                            title="Clear all filters and show all data"
                        >
                            Clear All Filters {selectedOEM && `(OEM: ${selectedOEM})`}
                        </button>
                    )}

                    <button
                        onClick={() => window.location.reload()}
                        className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-full transition-colors"
                        title="Reload"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => {
                            exportDashboardAnalytics({
                                networkByOEM: networkData,
                                networkByStation: stationPerformanceData,
                                networkByCPID: cpidPerformanceData,
                                prechargingByOEM: prechargingFailureData,
                                prechargingByStation: prechargingFailureByStationData,
                                prechargingByCPID: prechargingFailureByCPIDData
                            });
                        }}
                        className="p-1.5 hover:bg-green-50 text-gray-500 hover:text-green-600 rounded-full transition-colors"
                        title="Export Analytics to Excel"
                    >
                        <Download className="w-5 h-5" />
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content - Scrollable Layout */}
            <div className="flex-1 p-3 overflow-y-auto bg-gray-100">
                <div className="flex flex-col gap-3">
                    {/* Row 1: Charger Usage (3 cols) + Charging Shares (1 col) */}
                    <div className="grid grid-cols-4 gap-3 h-[380px]">
                        <DashboardCard title="Charger Usage & Readiness" borderColorClass="border-blue-600" icon={Zap} className="col-span-3">
                            <div className="grid grid-cols-3 gap-0 h-full">
                                <div className="h-full px-2 border-r border-gray-200 flex flex-col pt-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase text-center mb-1">Combined Charger</h4>
                                    <div className="flex-1 min-h-0"><TreeSection {...funnelData.combined} /></div>
                                </div>
                                <div className="h-full px-2 border-r border-gray-200 flex flex-col pt-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase text-center mb-1">Connector 1</h4>
                                    <div className="flex-1 min-h-0"><TreeSection {...funnelData.c1} /></div>
                                </div>
                                <div className="h-full px-2 flex flex-col pt-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase text-center mb-1">Connector 2</h4>
                                    <div className="flex-1 min-h-0"><TreeSection {...funnelData.c2} /></div>
                                </div>
                            </div>
                        </DashboardCard>

                        <DashboardCard title="Charging Shares" borderColorClass="border-red-600" icon={Activity} className="col-span-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={preChargingData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={(entry) => `${entry.percentage}%`}
                                        labelLine={false}
                                    >
                                        {preChargingData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PRECHARGING_COLORS[index % PRECHARGING_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip total={preChargingTotal} />} />
                                    <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </DashboardCard>
                    </div>

                    {/* Row 2: Negative Stops by OEM (3 cols) + Error Summary (1 col) */}
                    <div className="grid grid-cols-4 gap-3 h-[280px]">
                        <DashboardCard 
                            title={selectedOEM ? `🔍 Negative Stops by OEM - ${selectedOEM}` : "1. Negative Stops by OEM (Neg Stop%)"} 
                            borderColorClass={selectedOEM ? "border-red-600" : "border-amber-700"} 
                            icon={Layers}
                            className="col-span-3"
                        >
                            {selectedOEM && (
                                <div className="absolute top-12 right-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg z-10 animate-pulse">
                                    Filtered by OEM
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={networkData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                                    <defs>
                                        <style>
                                            {`
                                                .recharts-bar-rectangle {
                                                    stroke: none !important;
                                                }
                                                .recharts-rectangle {
                                                    stroke: none !important;
                                                }
                                            `}
                                        </style>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 9, fontWeight: 'bold' }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis hide />
                                    <Tooltip cursor={{ fill: '#FEE2E2', stroke: 'none' }} content={<CustomTooltip />} />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[6, 6, 0, 0]} 
                                        cursor="pointer"
                                        isAnimationActive={false}
                                        onClick={(data) => {
                                            if (data && data.name) {
                                                handleOEMClick(data.name);
                                            }
                                        }}
                                    >
                                        <LabelList 
                                            dataKey="value" 
                                            position="top" 
                                            fill="#000" 
                                            fontSize={10} 
                                            fontWeight="bold" 
                                            formatter={(val) => `${val}%`}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </DashboardCard>

                        <DashboardCard title="Error Summary" borderColorClass="border-red-600" icon={Activity} className="col-span-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={errorData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={(entry) => `${entry.percentage}%`}
                                        labelLine={false}
                                    >
                                        {errorData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={ERROR_COLORS[index % ERROR_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip total={errorTotal} />} />
                                    <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </DashboardCard>
                    </div>

                    {/* Row 3: Negative Stops by Station (Full Width) */}
                    <div className="grid grid-cols-1 gap-3 h-[280px]">
                        <DashboardCard 
                            title={selectedOEM ? `🔍 Negative Stops by Station - ${selectedOEM}` : "2. Negative Stops by Station (Neg Stop%)"} 
                            borderColorClass={selectedOEM ? "border-red-600" : "border-red-600"} 
                            icon={Layers}
                        >
                            {selectedOEM && (
                                <div className="absolute top-12 right-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg z-10 animate-pulse">
                                    Filtered by OEM
                                </div>
                            )}
                            <div className={stationPerformanceData.length > 15 ? "overflow-x-auto h-full" : "h-full"}>
                                <div style={{ minWidth: stationPerformanceData.length > 15 ? `${stationPerformanceData.length * 60}px` : '100%', height: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stationPerformanceData} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 9, fontWeight: 'bold' }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                                interval={0}
                                                angle={-45}
                                                textAnchor="end"
                                            />
                                            <YAxis hide />
                                            <Tooltip cursor={{ fill: '#FEE2E2', stroke: 'none' }} content={<CustomTooltip />} />
                                            <Bar 
                                                dataKey="value" 
                                                radius={[6, 6, 0, 0]}
                                                isAnimationActive={false}
                                            >
                                                <LabelList 
                                                    dataKey="value" 
                                                    position="top" 
                                                    fill="#000" 
                                                    fontSize={10} 
                                                    fontWeight="bold" 
                                                    formatter={(val) => `${val}%`}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </DashboardCard>
                    </div>

                    {/* Row 4: Negative Stops by CPID (Full Width) */}
                    <div className="grid grid-cols-1 gap-3 h-[280px]">
                        <DashboardCard 
                            title={selectedOEM ? `🔍 Negative Stops by CPID - ${selectedOEM}` : "3. Negative Stops by CPID (Neg Stop%)"} 
                            borderColorClass={selectedOEM ? "border-purple-600" : "border-purple-600"} 
                            icon={Layers}
                        >
                            {selectedOEM && (
                                <div className="absolute top-12 right-4 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg z-10 animate-pulse">
                                    Filtered by OEM
                                </div>
                            )}
                            <div className={cpidPerformanceData.length > 10 ? "overflow-x-auto h-full" : "h-full"}>
                                <div style={{ minWidth: cpidPerformanceData.length > 10 ? `${cpidPerformanceData.length * 120}px` : '100%', height: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={cpidPerformanceData} margin={{ top: 20, right: 10, left: 0, bottom: 80 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 8, fontWeight: 'bold' }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                                interval={0}
                                                angle={-45}
                                                textAnchor="end"
                                            />
                                            <YAxis hide />
                                            <Tooltip cursor={{ fill: '#F3E8FF', stroke: 'none' }} content={<CustomTooltip />} />
                                            <Bar 
                                                dataKey="value" 
                                                radius={[6, 6, 0, 0]}
                                                isAnimationActive={false}
                                            >
                                                <LabelList 
                                                    dataKey="value" 
                                                    position="top" 
                                                    fill="#000" 
                                                    fontSize={10} 
                                                    fontWeight="bold" 
                                                    formatter={(val) => `${val}%`}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </DashboardCard>
                    </div>

                    {/* Row 5: Precharging Failure by OEM (Full Width) */}
                    <div className="grid grid-cols-1 gap-3 h-[280px]">
                        <DashboardCard 
                            title={selectedOEM ? `🔍 Precharging Failure by OEM - ${selectedOEM}` : "4. Precharging Failure by OEM"} 
                            borderColorClass={selectedOEM ? "border-orange-500" : "border-orange-500"} 
                            icon={Layers}
                        >
                            {selectedOEM && (
                                <div className="absolute top-12 right-4 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg z-10 animate-pulse">
                                    Filtered by OEM
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={prechargingFailureData} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 9, fontWeight: 'bold' }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis hide />
                                    <Tooltip cursor={{ fill: '#FEF3C7', stroke: 'none' }} content={<CustomTooltip />} />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[6, 6, 0, 0]}
                                        isAnimationActive={false}
                                    >
                                        <LabelList 
                                            dataKey="value" 
                                            position="top" 
                                            fill="#000" 
                                            fontSize={10} 
                                            fontWeight="bold"
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </DashboardCard>
                    </div>

                    {/* Row 5: Precharging Failure by Station (Full Width) */}
                    <div className="grid grid-cols-1 gap-3 h-[280px]">
                        <DashboardCard 
                            title={selectedOEM ? `🔍 Precharging Failure by Station - ${selectedOEM}` : "5. Precharging Failure by Station"} 
                            borderColorClass={selectedOEM ? "border-purple-500" : "border-purple-500"} 
                            icon={Layers}
                        >
                            {selectedOEM && (
                                <div className="absolute top-12 right-4 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg z-10 animate-pulse">
                                    Filtered by OEM
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={prechargingFailureByStationData} margin={{ top: 20, right: 10, left: 0, bottom: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 9, fontWeight: 'bold' }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={20}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis hide />
                                    <Tooltip cursor={{ fill: '#EDE9FE', stroke: 'none' }} content={<CustomTooltip />} />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[6, 6, 0, 0]}
                                        isAnimationActive={false}
                                    >
                                        <LabelList 
                                            dataKey="value" 
                                            position="top" 
                                            fill="#000" 
                                            fontSize={10} 
                                            fontWeight="bold"
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </DashboardCard>
                    </div>

                    {/* Row 6: Precharging Failure by CPID (Full Width) */}
                    <div className="grid grid-cols-1 gap-3 h-[280px]">
                        <DashboardCard 
                            title={selectedOEM ? `🔍 Precharging Failure by CPID - ${selectedOEM}` : "6. Precharging Failure by CPID"} 
                            borderColorClass={selectedOEM ? "border-amber-500" : "border-amber-500"} 
                            icon={Layers}
                        >
                            {selectedOEM && (
                                <div className="absolute top-12 right-4 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg z-10 animate-pulse">
                                    Filtered by OEM
                                </div>
                            )}  
                            <div className={prechargingFailureByCPIDData.length > 10 ? "overflow-x-auto h-full" : "h-full"}>
                                <div style={{ minWidth: prechargingFailureByCPIDData.length > 10 ? `${prechargingFailureByCPIDData.length * 120}px` : '100%', height: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={prechargingFailureByCPIDData} margin={{ top: 20, right: 10, left: 0, bottom: 80 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 8, fontWeight: 'bold' }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                                interval={0}
                                                angle={-45}
                                                textAnchor="end"
                                            />
                                            <YAxis hide />
                                            <Tooltip cursor={{ fill: '#FEF3C7', stroke: 'none' }} content={<CustomTooltip />} />
                                            <Bar 
                                                dataKey="value" 
                                                radius={[6, 6, 0, 0]}
                                                isAnimationActive={false}
                                            >
                                                <LabelList 
                                                    dataKey="value" 
                                                    position="top" 
                                                    fill="#000" 
                                                    fontSize={10} 
                                                    fontWeight="bold"
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </DashboardCard>
                    </div>

                    {/* Row 7: Power Quality (3 cols) + Auth Methods (1 col) */}
                    <div className="grid grid-cols-4 gap-3 h-[280px]">
                        <DashboardCard title="7. Power Quality" borderColorClass="border-green-500" icon={Activity} className="col-span-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineData} margin={{ top: 10, right: 60, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="label"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6B7280', fontSize: 10 }}
                                        dy={10}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#F59E0B', fontSize: 9 }}
                                        width={40}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#10B981', fontSize: 9 }}
                                        width={50}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="top" 
                                        align="right" 
                                        height={30} 
                                        iconSize={8} 
                                        wrapperStyle={{ fontSize: '10px' }}
                                        content={(props) => {
                                            const { payload } = props;
                                            return (
                                                <div className="flex gap-4 justify-end text-xs">
                                                    {payload.map((entry, index) => (
                                                        <div key={`legend-${index}`} className="flex items-center gap-1">
                                                            <div 
                                                                className="w-3 h-0.5" 
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            <span style={{ color: entry.color, fontWeight: 'bold' }}>
                                                                {entry.value === 'Peak Power' ? 'Peak (L)' : 'Avg (R)'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }}
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="peak"
                                        name="Peak Power"
                                        stroke={COLORS.orange}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="avg"
                                        name="Avg Power"
                                        stroke={COLORS.green}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </DashboardCard>

                        <div className="col-span-1 flex flex-col gap-3">
                            {/* Auth Methods */}
                            <DashboardCard title="Auth Methods" borderColorClass="border-blue-500" icon={CircleDot} className="h-[135px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={30}
                                            outerRadius={50}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={(entry) => `${entry.percentage}%`}
                                            labelLine={false}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip total={pieTotal} />} />
                                        <Legend verticalAlign="bottom" height={20} iconSize={6} wrapperStyle={{ fontSize: '9px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </DashboardCard>
                        </div>
                    </div>
                </div>
            </div>

            {/* CPID Ranking Modal */}
            <AnimatePresence>
                {showCPIDModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                        onClick={() => setShowCPIDModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b-4 border-red-500">
                                <div className="flex items-center gap-3">
                                    <Plug className="w-6 h-6 text-white" />
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Top CPIDs by Negative Stops</h3>
                                        <p className="text-sm text-gray-300 mt-1">OEM: {cpidModalData.oemName}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCPIDModal(false)}
                                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-4 overflow-y-auto max-h-[calc(80vh-100px)]">
                                {cpidModalData.topCPIDs.length > 0 ? (
                                    <div className="space-y-2">
                                        {cpidModalData.topCPIDs.map((item, index) => {
                                            const isHighPriority = item.negativeStops > 10;
                                            const isMediumPriority = item.negativeStops > 5 && item.negativeStops <= 10;
                                            
                                            return (
                                                <motion.div
                                                    key={item.cpid + index}
                                                    initial={{ x: -20, opacity: 0 }}
                                                    animate={{ x: 0, opacity: 1 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className={`border rounded-lg p-3 hover:shadow-md transition-all duration-200 ${
                                                        isHighPriority 
                                                            ? 'border-red-300 bg-red-50' 
                                                            : isMediumPriority 
                                                            ? 'border-orange-300 bg-orange-50'
                                                            : 'border-gray-200 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        {/* Rank Badge */}
                                                        <div className={`flex-none w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 ${
                                                            index === 0 
                                                                ? 'bg-yellow-500 text-white border-yellow-600' 
                                                                : index === 1
                                                                ? 'bg-gray-400 text-white border-gray-500'
                                                                : index === 2
                                                                ? 'bg-orange-500 text-white border-orange-600'
                                                                : 'bg-white text-gray-700 border-gray-300'
                                                        }`}>
                                                            #{index + 1}
                                                        </div>

                                                        {/* CPID Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-gray-800 text-sm truncate" title={item.displayName}>
                                                                {item.displayName}
                                                            </h4>
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                CPID: <span className="font-mono">{item.cpid}</span> • Sessions: <strong>{item.chargingSessions}</strong>
                                                            </p>
                                                        </div>

                                                        {/* Stats */}
                                                        <div className="flex-none flex items-center gap-3">
                                                            <div className="text-right">
                                                                <div className={`text-2xl font-bold ${
                                                                    isHighPriority 
                                                                        ? 'text-red-600' 
                                                                        : isMediumPriority 
                                                                        ? 'text-orange-600'
                                                                        : 'text-gray-600'
                                                                }`}>
                                                                    {item.negativeStops}
                                                                </div>
                                                                <p className="text-xs text-gray-500">Errors</p>
                                                            </div>
                                                            <div className="px-2.5 py-1 rounded text-xs font-bold" style={{
                                                                backgroundColor: item.negativeStopPercent > 50 ? '#FEE2E2' : item.negativeStopPercent > 25 ? '#FEF3C7' : '#DCFCE7',
                                                                color: item.negativeStopPercent > 50 ? '#991B1B' : item.negativeStopPercent > 25 ? '#92400E' : '#166534'
                                                            }}>
                                                                {item.negativeStopPercent}%
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="mt-2 bg-gray-200 rounded h-1.5 overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-500 ${
                                                                isHighPriority 
                                                                    ? 'bg-red-500' 
                                                                    : isMediumPriority 
                                                                    ? 'bg-orange-500'
                                                                    : 'bg-blue-500'
                                                            }`}
                                                            style={{ 
                                                                width: `${Math.min(item.negativeStopPercent, 100)}%` 
                                                            }}
                                                        />
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="text-gray-400 mb-3">
                                            <Plug className="w-12 h-12 mx-auto" />
                                        </div>
                                        <p className="text-gray-600 font-semibold">No data found for {cpidModalData.oemName}</p>
                                        <p className="text-sm text-gray-500 mt-1">No CPIDs with negative stops detected</p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    <strong>{cpidModalData.topCPIDs.length}</strong> CPID(s) • {cpidModalData.oemName}
                                </div>
                                <button
                                    onClick={() => setShowCPIDModal(false)}
                                    className="px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white text-sm rounded-lg font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
