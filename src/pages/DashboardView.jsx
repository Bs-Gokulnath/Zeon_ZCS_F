import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    FunnelChart, Funnel, LabelList,
    BarChart, Bar
} from 'recharts';
import { X, Filter, BarChart3, Zap, Activity, CircleDot, Plug, Layers, RefreshCw } from 'lucide-react';

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

// Funnel Chart
const FunnelSection = ({ preparing, charging, negative, successful }) => {
    // PDF Logic: Success Rate = Successful Sessions / Charging Sessions
    const totalForRate = charging;
    const rate = totalForRate > 0 ? Math.round((successful / totalForRate) * 100) : 0;
    const isGood = rate >= 70;

    const data = [
        { name: 'Preparing', value: preparing, fill: COLORS.blue },
        { name: 'Charging', value: charging, fill: COLORS.green },
        { name: 'Negative Stops', value: negative, fill: COLORS.red },
    ].sort((a, b) => b.value - a.value);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Funnel
                            dataKey="value"
                            data={data}
                            isAnimationActive
                        >
                            <LabelList position="right" fill="#4B5563" stroke="none" dataKey="name" fontSize={10} />
                            <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontSize={12} fontWeight="bold" />
                        </Funnel>
                    </FunnelChart>
                </ResponsiveContainer>
            </div>
            <div className={`text-xs font-bold text-center mt-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
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
    Object.values(result).forEach(val => {
        if (Array.isArray(val)) {
            allRows.push(...val);
        }
    });

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

// Process Network Performance (Negative Stop %)
const processNetworkPerformance = (allResults) => {
    if (!allResults || Object.keys(allResults).length === 0) return [];

    const stats = {};
    let grandTotal = 0;
    let grandNegative = 0;

    // Iterate over all files in allResults, ignoring "All Files" key if it exists as a duplicate aggregate
    // But usually 'allResults' keys are filenames.
    // If 'allResults' is passed from home.jsx, make sure we don't double count.

    Object.entries(allResults).forEach(([key, data]) => {
        // Skip if key is 'All Files' or similar meta-key if present (user logic might vary, but key is usually filename)
        if (key === 'All Files') return;

        // 1. Extract OEM
        let oem = 'Unknown';
        try {
            if (data.info) {
                let info = data.info;
                if (typeof info === 'string') info = JSON.parse(info);
                if (Array.isArray(info) && info.length > 0) {
                    oem = info[0]['OEM Name'] || info[0]['Station Alias Name'] || 'Unknown';
                }
            }
        } catch (e) { }
        oem = String(oem).toUpperCase().trim();
        if (!oem) oem = 'UNKNOWN';

        // 2. Extract Counts
        const t1 = (data.report_1?.['Charging Sessions'] || 0);
        const n1 = (data.report_1?.['Failed / Error Stops'] || 0);
        const t2 = (data.report_2?.['Charging Sessions'] || 0);
        const n2 = (data.report_2?.['Failed / Error Stops'] || 0);

        if (!stats[oem]) stats[oem] = { total: 0, negative: 0 };
        stats[oem].total += t1 + t2;
        stats[oem].negative += n1 + n2;

        grandTotal += t1 + t2;
        grandNegative += n1 + n2;
    });

    const chartData = Object.entries(stats).map(([name, { total, negative }]) => ({
        name,
        value: total > 0 ? Math.round((negative / total) * 100) : 0,
        fill: '#C2410C' // Orange-700
    }));

    // Sort Alphabetically
    chartData.sort((a, b) => a.name.localeCompare(b.name));

    // Add Overall
    const overallVal = grandTotal > 0 ? Math.round((grandNegative / grandTotal) * 100) : 0;
    chartData.push({ name: 'OVERALL', value: overallVal, fill: '#9A3412' }); // Darker Orange/Brown

    return chartData;
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
                return info[0]['Station Name'] || info[0]['Station Alias Name'] || info[0]['Station Identity'] || 'Unknown';
            }
        }
    } catch (e) { }
    return 'Unknown';
};

// Helper: Aggregate Results
const aggregateData = (resultsList) => {
    if (!resultsList || resultsList.length === 0) return {};
    if (resultsList.length === 1) return resultsList[0];

    const combined = {
        report_1: {},
        report_2: {},
        Connector1: [],
        Connector2: [],
        info: resultsList[0].info // Keep first file info for basic metadata
    };

    const sumKeys = ['Preparing Sessions', 'Charging Sessions', 'Successful Sessions', 'Failed / Error Stops', 'Remote Start', 'Auto Start', 'RFID Start'];

    resultsList.forEach(res => {
        // Report 1
        sumKeys.forEach(k => {
            combined.report_1[k] = (combined.report_1[k] || 0) + (res.report_1?.[k] || 0);
        });
        // Report 2
        sumKeys.forEach(k => {
            combined.report_2[k] = (combined.report_2[k] || 0) + (res.report_2?.[k] || 0);
        });

        // Merge Arrays
        if (res.Connector1) combined.Connector1.push(...res.Connector1);
        if (res.Connector2) combined.Connector2.push(...res.Connector2);
    });

    return combined;
};

export default function DashboardView({ result, onClose, currentFilter, setCurrentFilter, allResults }) {

    // Data Preparation
    const filters = allResults && Object.keys(allResults).length > 1 ? Object.keys(allResults).filter(k => k !== 'All Files').sort() : [];

    // State
    const [selectedCpId, setSelectedCpId] = useState('All');
    const [selectedStation, setSelectedStation] = useState('All');

    // Grouping Logic
    const groupedResults = useMemo(() => {
        if (!allResults) return { byId: {}, byStation: {} };
        const byId = {};
        const byStation = {};

        Object.entries(allResults).forEach(([filename, data]) => {
            if (filename === 'All Files') return;

            // By CPID
            const cpid = getChargePointID(data);
            if (!byId[cpid]) byId[cpid] = [];
            byId[cpid].push(data);

            // By Station
            const station = getStationName(data);
            if (!byStation[station]) byStation[station] = [];
            byStation[station].push(data);
        });
        return { byId, byStation };
    }, [allResults]);

    const cpIds = Object.keys(groupedResults.byId).sort();
    const stations = Object.keys(groupedResults.byStation).sort();

    // Determine Active Result
    const activeResult = useMemo(() => {
        // 1. Specific File (Takes priority if selected)
        if (currentFilter !== 'All Files') {
            return allResults[currentFilter] || result;
        }
        // 2. CP ID
        if (selectedCpId !== 'All' && groupedResults.byId[selectedCpId]) {
            return aggregateData(groupedResults.byId[selectedCpId]);
        }
        // 3. Station
        if (selectedStation !== 'All' && groupedResults.byStation[selectedStation]) {
            return aggregateData(groupedResults.byStation[selectedStation]);
        }
        // 4. Default Globals
        return result;
    }, [currentFilter, selectedCpId, selectedStation, groupedResults, result, allResults]);

    // Handlers
    const handleFileFilterChange = (val) => {
        setCurrentFilter(val);
        setSelectedCpId('All');
        setSelectedStation('All');
    };

    const handleCpIdChange = (val) => {
        setSelectedCpId(val);
        setCurrentFilter('All Files');
        setSelectedStation('All'); // Fix potential bug in original code if copy-pasted, making sure logic is consistent
    };

    const handleStationChange = (val) => {
        setSelectedStation(val);
        setSelectedCpId('All');
        setCurrentFilter('All Files');
    };

    // Options for Filters
    const stationOptions = [
        { value: 'All', label: 'All Stations' },
        ...stations.map(s => ({ value: s, label: s }))
    ];
    const cpidOptions = [
        { value: 'All', label: 'All CPIDs' },
        ...cpIds.map(c => ({ value: c, label: c }))
    ];
    const fileOptions = [
        { value: 'All Files', label: 'All Files' },
        ...filters.map(f => {
            const data = allResults[f];
            const cpid = getChargePointID(data);
            const displayLabel = cpid !== 'Unknown' ? cpid : f;
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

    const pieData = [
        { name: 'Remote', value: (activeResult?.report_1?.['Remote Start'] || 0) + (activeResult?.report_2?.['Remote Start'] || 0) },
        { name: 'Auto', value: (activeResult?.report_1?.['Auto Start'] || 0) + (activeResult?.report_2?.['Auto Start'] || 0) },
        { name: 'RFID', value: (activeResult?.report_1?.['RFID Start'] || 0) + (activeResult?.report_2?.['RFID Start'] || 0) }
    ].filter(d => d.value > 0);
    const pieTotal = pieData.reduce((acc, curr) => acc + curr.value, 0);

    // Error Data
    const errorData = processErrorBreakdown(activeResult);
    const errorTotal = errorData.reduce((acc, curr) => acc + curr.value, 0);
    const ERROR_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1'];

    // Dynamic Daily Line Data
    const lineData = processSessionTrend(activeResult);

    // Network Performance Data (Global)
    const networkData = processNetworkPerformance(allResults);

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
                        <SearchableSelect
                            options={fileOptions}
                            value={currentFilter}
                            onChange={handleFileFilterChange}
                            icon={Filter}
                        />
                    )}

                    <button
                        onClick={() => window.location.reload()}
                        className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-full transition-colors"
                        title="Reload"
                    >
                        <RefreshCw className="w-5 h-5" />
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

            {/* Main Content - Fixed Layout */}
            <div className="flex-1 p-3 overflow-hidden min-h-0 bg-gray-100 grid grid-rows-[45%_1fr] gap-3">

                {/* Row 1: Funnels (3 cols) + Network Performance (1 col) */}
                <div className="grid grid-cols-4 gap-3 min-h-0 h-full">
                    <DashboardCard title="Charger Usage & Readiness" borderColorClass="border-blue-600" icon={Zap} className="col-span-3">
                        <div className="grid grid-cols-3 gap-0 h-full">
                            <div className="h-full px-2 border-r border-gray-200 flex flex-col pt-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase text-center mb-1">Combined Charger</h4>
                                <div className="flex-1 min-h-0"><FunnelSection {...funnelData.combined} /></div>
                            </div>
                            <div className="h-full px-2 border-r border-gray-200 flex flex-col pt-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase text-center mb-1">Connector 1</h4>
                                <div className="flex-1 min-h-0"><FunnelSection {...funnelData.c1} /></div>
                            </div>
                            <div className="h-full px-2 flex flex-col pt-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase text-center mb-1">Connector 2</h4>
                                <div className="flex-1 min-h-0"><FunnelSection {...funnelData.c2} /></div>
                            </div>
                        </div>
                    </DashboardCard>

                    {/* Network Performance Bar Chart - Moved to Row 1 Col 4 */}
                    <DashboardCard title="Network Performance (Neg Stop%)" borderColorClass="border-amber-700" icon={Layers} className="col-span-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={networkData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 9, fontWeight: 'bold' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                    interval={0} // Show all labels
                                    angle={-45} // Angle if crowded
                                    textAnchor="end"
                                />
                                <YAxis hide />
                                <Tooltip cursor={{ fill: '#f3f4f6' }} content={<CustomTooltip />} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {/* Inside Top Label */}
                                    <LabelList dataKey="value" position="top" fill="#000" fontSize={10} fontWeight="bold" formatter={(val) => `${val}%`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </DashboardCard>
                </div>

                {/* Row 2: Auth (1 col) + Power (2 cols) + Error (1 col) */}
                <div className="grid grid-cols-4 gap-3 min-h-0 h-full">
                    {/* Auth Pie - 1 col */}
                    <DashboardCard title="Auth Methods" borderColorClass="border-blue-500" icon={CircleDot} className="col-span-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip total={pieTotal} />} />
                                <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </DashboardCard>

                    {/* Line Chart - 2 cols (Reduced from 3) */}
                    <DashboardCard title="Power Quality" borderColorClass="border-orange-500" icon={Activity} className="col-span-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 10 }}
                                    label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: '10px' } }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" align="right" height={30} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                <Line
                                    type="monotone"
                                    dataKey="peak"
                                    name="Peak Power"
                                    stroke={COLORS.orange}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                                <Line
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

                    {/* Error Summary Pie - Moved to Row 2 Col 4 */}
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
            </div>
        </motion.div>
    );
}
