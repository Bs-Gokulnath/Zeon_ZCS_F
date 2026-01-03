import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    FunnelChart, Funnel, LabelList
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
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-md p-2 border border-gray-200 shadow-xl rounded-xl text-xs z-50">
                <p className="font-bold text-gray-800 mb-1">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill || entry.stroke }}></span>
                        <span style={{ color: '#374151' }}>{entry.name}: {entry.value}</span>
                    </p>
                ))}
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
const FunnelSection = ({ preparing, charging, negative }) => {
    const data = [
        { name: 'Preparing', value: preparing, fill: COLORS.blue },
        { name: 'Charging', value: charging, fill: COLORS.green },
        { name: 'Negative Stops', value: negative, fill: COLORS.red },
    ].sort((a, b) => b.value - a.value);

    return (
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
    );
};

// Helper to safely get value
const getVal = (row, ...keys) => {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
        const found = Object.keys(row).find(k => k.normalize().toLowerCase().replace(/_/g, ' ') === key.normalize().toLowerCase());
        if (found && row[found] !== undefined && row[found] !== null) return row[found];
    }
    return null;
};

// Process Metrics (Daily or Hourly)
const processDailyMetrics = (result) => {
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
        const dateStr = getVal(row, 'Session Start Time', 'Start Time', 'Date', 'Started');
        if (!dateStr) return null;
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return null;
        return { row, dateObj };
    }).filter(Boolean);

    if (rowsWithDate.length === 0) return [];

    // 2. Check Date Range
    // Sort to find min/max
    rowsWithDate.sort((a, b) => a.dateObj - b.dateObj);
    const firstDate = rowsWithDate[0].dateObj;
    const lastDate = rowsWithDate[rowsWithDate.length - 1].dateObj;

    // Check if same day
    const isSameDay = firstDate.getFullYear() === lastDate.getFullYear() &&
        firstDate.getMonth() === lastDate.getMonth() &&
        firstDate.getDate() === lastDate.getDate();

    // 3. Group Data
    const groups = {};

    rowsWithDate.forEach(({ row, dateObj }) => {
        let key;
        let label;
        let sortKey;

        if (isSameDay) {
            // Group by Hour (0-23)
            const hour = dateObj.getHours();
            key = `${hour}`; // Simple key
            label = `${hour}:00`;
            sortKey = hour;
        } else {
            // Group by Day (YYYY-MM-DD)
            key = dateObj.toISOString().split('T')[0];
            label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            sortKey = dateObj.getTime();
        }

        if (!groups[key]) {
            groups[key] = { peakPowers: [], totalEnergy: 0, totalDuration: 0, count: 0, label, sortKey };
        }

        // Peak Power
        const peak = parseFloat(getVal(row, 'Peak Power Delivered (kW)', 'Peak Power', 'Max Power', 'Power (kW)') || 0);
        if (peak > 0) groups[key].peakPowers.push(peak);

        // Energy
        const energy = parseFloat(getVal(row, 'Session Energy Delivered (kWh)', 'Energy Mode (kWh)', 'Energy (kWh)') || 0);
        if (energy > 0) groups[key].totalEnergy += energy;

        // Duration (re-parse)
        let durationRaw = getVal(row, 'Session Duration', 'Duration', 'Charging Time');
        let hours = 0;
        if (durationRaw) {
            if (typeof durationRaw === 'number') hours = durationRaw / 60;
            else if (typeof durationRaw === 'string') {
                const p = durationRaw.split(':').map(Number);
                if (p.length === 3) hours = p[0] + p[1] / 60 + p[2] / 3600;
                else if (p.length === 2) hours = p[0] / 60 + p[1] / 3600;
            }
        }
        if (hours > 0) groups[key].totalDuration += hours;

        groups[key].count++;
    });

    // 4. Calculate Metrics & Format
    const chartData = Object.values(groups).map(stats => {
        const maxPeak = stats.peakPowers.length > 0 ? Math.max(...stats.peakPowers) : 0;

        let avgPower = 0;
        if (stats.totalDuration > 0) {
            avgPower = stats.totalEnergy / stats.totalDuration;
        }

        return {
            label: stats.label, // HH:00 or MMM DD
            sortKey: stats.sortKey,
            peak: parseFloat(maxPeak.toFixed(2)),
            avg: parseFloat(avgPower.toFixed(2))
        };
    }).sort((a, b) => a.sortKey - b.sortKey);

    return chartData;
};

export default function DashboardView({ result, onClose, currentFilter, setCurrentFilter, allResults }) {

    // Data Preparation
    const filters = allResults && Object.keys(allResults).length > 1 ? Object.keys(allResults).sort() : [];

    const funnelData = {
        combined: {
            preparing: (result.report_1?.['Preparing Sessions'] || 0) + (result.report_2?.['Preparing Sessions'] || 0),
            charging: (result.report_1?.['Charging Sessions'] || 0) + (result.report_2?.['Charging Sessions'] || 0),
            negative: (result.report_1?.['Failed / Error Stops'] || 0) + (result.report_2?.['Failed / Error Stops'] || 0)
        },
        c1: {
            preparing: result.report_1?.['Preparing Sessions'] || 0,
            charging: result.report_1?.['Charging Sessions'] || 0,
            negative: result.report_1?.['Failed / Error Stops'] || 0
        },
        c2: {
            preparing: result.report_2?.['Preparing Sessions'] || 0,
            charging: result.report_2?.['Charging Sessions'] || 0,
            negative: result.report_2?.['Failed / Error Stops'] || 0
        }
    };

    const pieData = [
        { name: 'Remote', value: (result.report_1?.['Remote Start'] || 0) + (result.report_2?.['Remote Start'] || 0) },
        { name: 'Auto', value: (result.report_1?.['Auto Start'] || 0) + (result.report_2?.['Auto Start'] || 0) },
        { name: 'RFID', value: (result.report_1?.['RFID Start'] || 0) + (result.report_2?.['RFID Start'] || 0) }
    ].filter(d => d.value > 0);

    // Dynamic Daily Line Data
    const lineData = processDailyMetrics(result);

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
                    {filters.length > 0 && (
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                            <Filter className="w-3.5 h-3.5 text-gray-500" />
                            <select
                                value={currentFilter}
                                onChange={(e) => setCurrentFilter(e.target.value)}
                                className="bg-transparent outline-none text-xs font-semibold text-gray-700 w-[150px]"
                            >
                                <option value="All Files">All Files</option>
                                {filters.filter(f => f !== 'All Files').map(f => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>
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

            {/* Main Content - Grid Layout */}
            <div className="flex-1 p-3 grid grid-rows-[42%_56%] gap-3 min-h-0 bg-gray-100">

                {/* Row 1: Charger Usage & Readiness (3 cols) */}
                <div className="grid grid-cols-3 gap-3 min-h-0">
                    <DashboardCard title="Combined Charger" borderColorClass="border-red-500" icon={Zap}>
                        <FunnelSection {...funnelData.combined} />
                    </DashboardCard>
                    <DashboardCard title="Connector 1" borderColorClass="border-blue-500" icon={Plug}>
                        <FunnelSection {...funnelData.c1} />
                    </DashboardCard>
                    <DashboardCard title="Connector 2" borderColorClass="border-green-500" icon={Plug}>
                        <FunnelSection {...funnelData.c2} />
                    </DashboardCard>
                </div>

                {/* Row 2: Auth and Power (2 cols) */}
                <div className="grid grid-cols-3 gap-3 min-h-0">
                    {/* Pie Chart - 1 col */}
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
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </DashboardCard>

                    {/* Line Chart - 2 cols */}
                    <DashboardCard title="Power Quality" borderColorClass="border-orange-500" icon={Activity} className="col-span-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" align="right" height={30} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                <Line
                                    type="monotone"
                                    dataKey="peak"
                                    name="Peak Power"
                                    stroke={COLORS.orange}
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="avg"
                                    name="Avg Power"
                                    stroke={COLORS.green}
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </DashboardCard>
                </div>

            </div>
        </motion.div>
    );
}
