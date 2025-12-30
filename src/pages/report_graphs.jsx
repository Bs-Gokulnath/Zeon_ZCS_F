import React, { useEffect, useRef } from 'react';

/**
 * Generates a pie chart for Authentication Method data
 * @param {Object} props
 * @param {number} props.remoteStart - Count of Remote Start
 * @param {number} props.autoCharge - Count of Auto Charge
 * @param {number} props.rfid - Count of RFID
 * @param {number} props.width - Canvas width (default: 200)
 * @param {number} props.height - Canvas height (default: 200)
 * @param {string} props.title - Chart title
 */
export const AuthenticationPieChart = ({
    remoteStart = 0,
    autoCharge = 0,
    rfid = 0,
    width = 200,
    height = 200,
    title = 'Authentication Methods'
}) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate total
        const total = remoteStart + autoCharge + rfid;
        if (total === 0) {
            // Draw "No Data" message
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No Data', width / 2, height / 2);
            return;
        }

        // Calculate percentages
        const remotePercent = (remoteStart / total) * 100;
        const autoPercent = (autoCharge / total) * 100;
        const rfidPercent = (rfid / total) * 100;

        // Chart settings
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 40; // Leave space for labels

        // Colors for each segment
        const colors = {
            remote: '#3B82F6',  // Blue
            auto: '#10B981',    // Green
            rfid: '#F59E0B'     // Orange
        };

        // Draw pie chart
        let currentAngle = -Math.PI / 2; // Start at top

        // Draw Remote Start segment
        if (remoteStart > 0) {
            const sliceAngle = (remoteStart / total) * 2 * Math.PI;
            ctx.fillStyle = colors.remote;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            // Draw border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            currentAngle += sliceAngle;
        }

        // Draw Auto Charge segment
        if (autoCharge > 0) {
            const sliceAngle = (autoCharge / total) * 2 * Math.PI;
            ctx.fillStyle = colors.auto;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            currentAngle += sliceAngle;
        }

        // Draw RFID segment
        if (rfid > 0) {
            const sliceAngle = (rfid / total) * 2 * Math.PI;
            ctx.fillStyle = colors.rfid;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw legend
        const legendY = height - 30;
        const legendSpacing = width / 3;
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        // Remote Start legend
        ctx.fillStyle = colors.remote;
        ctx.fillRect(10, legendY, 15, 15);
        ctx.fillStyle = '#000';
        ctx.fillText(`Remote (${remotePercent.toFixed(0)}%)`, legendSpacing / 2, legendY + 25);

        // Auto Charge legend
        ctx.fillStyle = colors.auto;
        ctx.fillRect(width / 3 - 7.5, legendY, 15, 15);
        ctx.fillStyle = '#000';
        ctx.fillText(`Auto (${autoPercent.toFixed(0)}%)`, width / 2, legendY + 25);

        // RFID legend
        ctx.fillStyle = colors.rfid;
        ctx.fillRect(2 * width / 3 - 7.5, legendY, 15, 15);
        ctx.fillStyle = '#000';
        ctx.fillText(`RFID (${rfidPercent.toFixed(0)}%)`, 2.5 * legendSpacing, legendY + 25);

    }, [remoteStart, autoCharge, rfid, width, height]);

    return (
        <div style={{ textAlign: 'center' }}>
            {title && <h3 style={{ marginBottom: '10px', fontSize: '14px' }}>{title}</h3>}
            <canvas ref={canvasRef} width={width} height={height} />
        </div>
    );
};

/**
 * Generates pie chart as a data URL for PDF embedding
 * @param {Object} data
 * @param {number} data.remoteStart
 * @param {number} data.autoCharge
 * @param {number} data.rfid
 * @param {number} width
 * @param {number} height
 * @returns {string} Data URL of the chart
 */
export const generateAuthPieChartDataURL = (data, width = 200, height = 200) => {
    // Render at 4x resolution for crisp quality
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d', { alpha: true });

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const { remoteStart = 0, autoCharge = 0, rfid = 0 } = data;

    // Calculate total
    const total = remoteStart + autoCharge + rfid;
    if (total === 0) {
        ctx.fillStyle = '#666';
        ctx.font = `bold ${14 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Data', (width * scale) / 2, (height * scale) / 2);
        return canvas.toDataURL('image/png');
    }

    // Calculate percentages
    const remotePercent = (remoteStart / total) * 100;
    const autoPercent = (autoCharge / total) * 100;
    const rfidPercent = (rfid / total) * 100;

    // Chart settings - all scaled up
    const centerX = (width * scale) / 2;
    const centerY = ((height * scale) / 2) - (10 * scale);
    const radius = (Math.min(width, height) / 2 - 40) * scale;

    // Professional colors - vibrant and clear
    const colors = {
        remote: '#2563EB',    // Stronger blue
        auto: '#059669',      // Stronger green
        rfid: '#DC2626'       // Strong red instead of orange for better contrast
    };

    // Draw shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 2 * scale;
    ctx.shadowOffsetY = 2 * scale;

    // Draw pie chart
    let currentAngle = -Math.PI / 2;

    // Remote Start
    if (remoteStart > 0) {
        const sliceAngle = (remoteStart / total) * 2 * Math.PI;
        ctx.fillStyle = colors.remote;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        // White border
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * scale;
        ctx.stroke();

        currentAngle += sliceAngle;
    }

    // Auto Charge
    if (autoCharge > 0) {
        const sliceAngle = (autoCharge / total) * 2 * Math.PI;
        ctx.fillStyle = colors.auto;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * scale;
        ctx.stroke();

        currentAngle += sliceAngle;
    }

    // RFID
    if (rfid > 0) {
        const sliceAngle = (rfid / total) * 2 * Math.PI;
        ctx.fillStyle = colors.rfid;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * scale;
        ctx.stroke();
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Draw legend with better spacing
    const legendY = (height * scale) - (30 * scale);
    const legendSpacing = (width * scale) / 3;

    // Use better font
    ctx.font = `bold ${9 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Remote Start legend
    ctx.fillStyle = colors.remote;
    const box1X = 10 * scale;
    const boxSize = 12 * scale;
    ctx.fillRect(box1X, legendY, boxSize, boxSize);

    // Add border to legend box
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(box1X, legendY, boxSize, boxSize);

    ctx.fillStyle = '#000000';
    ctx.fillText(`Remote: ${remotePercent.toFixed(0)}%`, legendSpacing / 2, legendY + (boxSize * 1.8));

    // Auto Charge legend
    ctx.fillStyle = colors.auto;
    const box2X = (width * scale / 3) - (boxSize / 2);
    ctx.fillRect(box2X, legendY, boxSize, boxSize);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(box2X, legendY, boxSize, boxSize);
    ctx.fillStyle = '#000000';
    ctx.fillText(`Auto: ${autoPercent.toFixed(0)}%`, (width * scale) / 2, legendY + (boxSize * 1.8));

    // RFID legend
    ctx.fillStyle = colors.rfid;
    const box3X = (2 * width * scale / 3) - (boxSize / 2);
    ctx.fillRect(box3X, legendY, boxSize, boxSize);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(box3X, legendY, boxSize, boxSize);
    ctx.fillStyle = '#000000';
    ctx.fillText(`RFID: ${rfidPercent.toFixed(0)}%`, 2.5 * legendSpacing, legendY + (boxSize * 1.8));

    // Scale down the canvas for final output while maintaining quality
    return canvas.toDataURL('image/png', 1.0);
};

export default AuthenticationPieChart;

/**
 * Generates a funnel chart for Charger Usage & Readiness data
 * @param {Object} props
 * @param {number} props.preparing - Count of Preparing
 * @param {number} props.charging - Count of Charging
 * @param {number} props.positiveStops - Count of Positive Stops
 * @param {number} props.negativeStops - Count of Negative Stops (optional, for reference)
 * @param {number} props.width - Canvas width (default: 350)
 * @param {number} props.height - Canvas height (default: 300)
 */
export const UsageReadinessFunnelChart = ({
    preparing = 0,
    charging = 0,
    positiveStops = 0,
    negativeStops = 0,
    width = 350,
    height = 300
}) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Render at 4x resolution for crisp quality
        const scale = 4;
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Funnel data
        const stages = [
            { label: 'Preparing', value: preparing, color: '#3B82F6' },
            { label: 'Charging', value: charging, color: '#10B981' },
            { label: 'Positive Stops', value: positiveStops, color: '#F59E0B' }
        ];

        // Find max value for width calculation
        const maxValue = Math.max(...stages.map(s => s.value), 1);

        // Funnel dimensions
        const funnelStartY = 40 * scale;
        const funnelHeight = (height - 80) * scale;
        const stageHeight = funnelHeight / stages.length;
        const maxWidth = (width - 120) * scale;
        const funnelCenterX = (width * scale) / 2;

        stages.forEach((stage, index) => {
            const yPos = funnelStartY + (index * stageHeight);
            const stageWidth = (stage.value / maxValue) * maxWidth;
            const nextStageWidth = index < stages.length - 1
                ? (stages[index + 1].value / maxValue) * maxWidth
                : stageWidth * 0.8;

            // Draw trapezoid
            ctx.fillStyle = stage.color;
            ctx.beginPath();
            ctx.moveTo(funnelCenterX - stageWidth / 2, yPos);
            ctx.lineTo(funnelCenterX + stageWidth / 2, yPos);
            ctx.lineTo(funnelCenterX + nextStageWidth / 2, yPos + stageHeight);
            ctx.lineTo(funnelCenterX - nextStageWidth / 2, yPos + stageHeight);
            ctx.closePath();
            ctx.fill();

            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3 * scale;
            ctx.stroke();

            // Calculate percentage (relative to preparing)
            const percentage = preparing > 0 ? ((stage.value / preparing) * 100).toFixed(0) : 0;

            // Draw label and value
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textY = yPos + (stageHeight / 2);
            ctx.fillText(`${stage.label}`, funnelCenterX, textY - (8 * scale));

            ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
            ctx.fillText(`${stage.value}`, funnelCenterX, textY + (10 * scale));

            // Draw percentage on the right
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(`${percentage}%`, funnelCenterX + (stageWidth / 2) + (10 * scale), textY);
        });

        // Draw title
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Charger Usage & Readiness', funnelCenterX, 20 * scale);

    }, [preparing, charging, positiveStops, negativeStops, width, height]);

    return (
        <div style={{ textAlign: 'center' }}>
            <canvas ref={canvasRef} />
        </div>
    );
};

/**
 * Generates a line chart for Power & Charging Quality data
 * @param {Object} props
 * @param {Array} props.peakPowerData - Array of {month, value} for peak power
 * @param {Array} props.avgPowerData - Array of {month, value} for average power
 * @param {number} props.width - Canvas width (default: 700)
 * @param {number} props.height - Canvas height (default: 400)
 */
export const PowerQualityLineChart = ({
    peakPowerData = [],
    avgPowerData = [],
    width = 700,
    height = 400
}) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Render at 4x resolution for crisp quality
        const scale = 4;
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Chart dimensions
        const padding = 60 * scale;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        const chartX = padding;
        const chartY = padding;

        // Combine all data to find min/max
        const allValues = [...peakPowerData, ...avgPowerData].map(d => d.value);
        const maxValue = Math.max(...allValues, 1);
        const minValue = Math.min(...allValues, 0);
        const valueRange = maxValue - minValue || 1;

        // Y-axis settings
        const ySteps = 6;
        const yStepValue = Math.ceil(maxValue / ySteps / 30) * 30; // Round to nearest 30
        const yMax = yStepValue * ySteps;

        // Draw title
        ctx.fillStyle = '#4B5563';
        ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Power & Charging Quality', canvas.width / 2, 30 * scale);

        // Draw grid lines and Y-axis labels
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1 * scale;
        ctx.fillStyle = '#6B7280';
        ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= ySteps; i++) {
            const y = chartY + chartHeight - (i / ySteps) * chartHeight;
            const value = (i / ySteps) * yMax;

            // Grid line
            ctx.beginPath();
            ctx.moveTo(chartX, y);
            ctx.lineTo(chartX + chartWidth, y);
            ctx.stroke();

            // Y-axis label
            ctx.fillText(Math.round(value).toString(), chartX - 10 * scale, y);
        }

        // Draw X-axis labels (months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        months.forEach((month, index) => {
            const x = chartX + (index / (months.length - 1)) * chartWidth;
            ctx.fillText(month, x, chartY + chartHeight + 10 * scale);
        });

        // Function to draw a line
        const drawLine = (data, color, label) => {
            if (data.length === 0) return;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 3 * scale;

            // Draw line
            ctx.beginPath();
            data.forEach((point, index) => {
                const x = chartX + (point.monthIndex / 11) * chartWidth;
                const y = chartY + chartHeight - ((point.value / yMax) * chartHeight);

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw points
            data.forEach(point => {
                const x = chartX + (point.monthIndex / 11) * chartWidth;
                const y = chartY + chartHeight - ((point.value / yMax) * chartHeight);

                ctx.beginPath();
                ctx.arc(x, y, 5 * scale, 0, Math.PI * 2);
                ctx.fill();
            });
        };

        // Draw Peak Power line (Orange)
        drawLine(peakPowerData, '#F97316', 'Peak Power');

        // Draw Average Power line (Green)
        drawLine(avgPowerData, '#10B981', 'Avg Power');

        // Draw legend
        const legendY = chartY + chartHeight + 40 * scale;
        const legendCenterX = canvas.width / 2;

        ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';

        // Peak Power legend
        ctx.fillStyle = '#F97316';
        ctx.fillRect(legendCenterX - 120 * scale, legendY, 20 * scale, 3 * scale);
        ctx.beginPath();
        ctx.arc(legendCenterX - 110 * scale, legendY + 1.5 * scale, 5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4B5563';
        ctx.fillText('Peak Power (kW)', legendCenterX - 60 * scale, legendY + 2 * scale);

        // Avg Power legend
        ctx.fillStyle = '#10B981';
        ctx.fillRect(legendCenterX + 20 * scale, legendY, 20 * scale, 3 * scale);
        ctx.beginPath();
        ctx.arc(legendCenterX + 30 * scale, legendY + 1.5 * scale, 5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4B5563';
        ctx.fillText('Avg Power (kW)', legendCenterX + 80 * scale, legendY + 2 * scale);

    }, [peakPowerData, avgPowerData, width, height]);

    return (
        <div style={{ textAlign: 'center' }}>
            <canvas ref={canvasRef} />
        </div>
    );
};
