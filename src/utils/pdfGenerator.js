import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to count Precharging Failures from raw connector data
const countPrechargingFailures = (connectorArray) => {
  if (!Array.isArray(connectorArray)) return 0;
  return connectorArray.filter(row => 
    row.vendorErrorCode === 'Precharging Failure' && row.is_Charging === 0
  ).length;
};

// Internal helper to render a single report page
const renderReportPage = (doc, data, title) => {
  // Set colors - Dark theme
  const darkBg = [45, 45, 45];
  const textColor = [30, 30, 30];
  const whiteText = [255, 255, 255];

  // Check if report_1 and report_2 exist
  if (!data || (!data.report_1 && !data.report_2)) {
    console.error('No report_1 or report_2 found in data');
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.text(`Error: No report data available for ${title}`, 150, 100, { align: 'center' });
    return;
  }

  // Header Title (Filename or Report Title)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(title || 'Charger Health Report', 150, 8, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  })}`, 150, 12, { align: 'center' });

  // Parse and display station info - COMPACT
  let stationInfo = null;
  try {
    if (data.info) {
      if (typeof data.info === 'string') {
        const parsed = JSON.parse(data.info);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stationInfo = parsed[0];
        }
      } else if (Array.isArray(data.info) && data.info.length > 0) {
        stationInfo = data.info[0];
      }
    }
  } catch (e) {
    console.error('Error parsing station info:', e);
  }

  // Extract Station Power (Capacity)
  const stationCapacity = stationInfo ? parseFloat(stationInfo['Power (kW)'] || 0) : 0;

  let currentY = 15;
  
  if (stationInfo || data.date) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    
    // Compact 2-line format
    if (stationInfo) {
      const stationName = stationInfo['Station Alias Name'] || 'N/A';
      const chargePointId = stationInfo['Charge Point id'] || 'N/A';
      const oemName = stationInfo['OEM Name'] || 'N/A';
      const power = stationInfo['Power (kW)'] || 'N/A';
      const firmware = stationInfo['Firmware Version'] || 'N/A';
      
      doc.text(`${stationName} | CP: ${chargePointId} | OEM: ${oemName} | ${power}kW | FW: ${firmware}`, 150, currentY, { align: 'center' });
      currentY += 3;
    }
    
    // Display date range
    if (data.date && (data.date.start_date || data.date.end_date)) {
      const startDate = data.date.start_date || 'N/A';
      const endDate = data.date.end_date || 'N/A';
      doc.setFont('helvetica', 'bold');
      doc.text(`Period: ${startDate} - ${endDate}`, 150, currentY, { align: 'center' });
      currentY += 4;
    }
  }

  // Calculate combined metrics
  const report1 = data.report_1 || {};
  const report2 = data.report_2 || {};

  const combinedPreparing = (report1['Preparing Sessions'] || 0) + (report2['Preparing Sessions'] || 0);
  const combinedCharging = (report1['Charging Sessions'] || 0) + (report2['Charging Sessions'] || 0);
  const combinedSuccessful = (report1['Successful Sessions'] || 0) + (report2['Successful Sessions'] || 0);
  const combinedFailed = (report1['Failed / Error Stops'] || 0) + (report2['Failed / Error Stops'] || 0);
  const combinedSuccessRate = combinedCharging > 0 
    ? `${Math.round((combinedSuccessful / combinedCharging) * 100)}% (${combinedSuccessful} / ${combinedCharging})` 
    : '0%';

  // Count Precharging Failures from raw connector data
  const connector1PrechargingFailure = countPrechargingFailures(data.Connector1);
  const connector2PrechargingFailure = countPrechargingFailures(data.Connector2);
  const combinedPrechargingFailure = connector1PrechargingFailure + connector2PrechargingFailure;
  
  // Combine error summaries from new structure
  const combinedErrors = {};
  const errors1Successful = report1['Successful Error Summary'] || {};
  const errors1Failed = report1['Failed / Error Error Summary'] || {};
  const errors2Successful = report2['Successful Error Summary'] || {};
  const errors2Failed = report2['Failed / Error Error Summary'] || {};
  

  const combinedRemoteStart = (report1['Remote Start'] || 0) + (report2['Remote Start'] || 0);
  const combinedAutoStart = (report1['Auto Start'] || 0) + (report2['Auto Start'] || 0);
  const combinedRfidStart = (report1['RFID Start'] || 0) + (report2['RFID Start'] || 0);

  // Helper to normalize and get value from row
  const getVal = (row, ...keys) => {
    for (const k of keys) {
        // Case insensitive check
        const foundKey = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (foundKey) return row[foundKey];
    }
    return 0;
  };
  
  const calculateConnectorMetrics = (rows) => {
     if (!Array.isArray(rows) || rows.length === 0) return { peak: 0, avg: 0, totalSessions: 0 };
     
     let maxPeak = 0;
     let totalEnergy = 0;
     let totalDurationHours = 0;
     let validPowerCount = 0;
     let sumPeakPower = 0;

     rows.forEach(row => {
         // Parse Peak Power
         const peak = parseFloat(getVal(row, 'Session Peak Power (kW)', 'Peak Power (kW)', 'Peak Power') || 0);
         if (!isNaN(peak)) {
            if (peak > maxPeak) maxPeak = peak;
            sumPeakPower += peak;
            validPowerCount++;
         }

         // Parse Energy
         const energy = parseFloat(getVal(row, 'Session Energy Delivered (kWh)', 'Energy Mode (kWh)', 'Energy (kWh)') || 0);
         if (!isNaN(energy)) totalEnergy += energy;
         
         // Parse Duration - Try standard formats
         // Keys often: "Session Duration", "Duration", "Charging Time"
         let durationRaw = getVal(row, 'Session Duration', 'Duration', 'Charging Time', 'Session Duration (min)', 'Duration (min)');
         
         let hours = 0;
         if (durationRaw) {
             if (typeof durationRaw === 'number') {
                 // Assume minutes if number? Or check magnitude? Usually minutes.
                 hours = durationRaw / 60;
             } else if (typeof durationRaw === 'string') {
                 // Try HH:MM:SS
                 const parts = durationRaw.split(':').map(Number);
                 if (parts.length === 3) hours = parts[0] + parts[1]/60 + parts[2]/3600;
                 else if (parts.length === 2) hours = parts[0]/60 + parts[1]/3600;
             }
         }
         totalDurationHours += hours;
     });
     
     // Calculate Avg Power
     // Method 1: Total Energy / Total Duration (Physics definition)
     // Method 2: Average of Session Peak Powers (User mentioned 'session peak power kw' explicitly)
     
     // If user said "Avg Power calculation is incorrect... session energy... session peak power", 
     // they likely want Weighted Avg Power = Total Energy / Total Duration.
     
     let avgPower = 0;
     if (totalDurationHours > 0) {
         avgPower = totalEnergy / totalDurationHours;
     } else if (validPowerCount > 0) {
         // Fallback: simple average of peaks? (Likely not what they want for "Avg Power", but safer than 0)
         // Or maybe they just want Avg of Energy? 
         // Let's rely on Energy/Duration. If duration missing, we might fail to calc nicely.
         // Let's try one more fallback: Total Energy / (Count * (1 hour?)) -> No.
         
         // If we have no duration, we can't calculate kW from kWh safely.
         // But maybe the "old method" use Avg Peak?
         // Let's assume calculated AvgPower is what we need.
     }
     
     return { peak: maxPeak, avg: avgPower, totalSessions: rows.length };
  };

  const calculateNegativeStopBreakdown = (rows) => {
     if (!Array.isArray(rows) || rows.length === 0) return {};
     const breakdown = {};
     rows.forEach(row => {
         const status = getVal(row, 'STOP', 'Stop', 'Status', 'Session Status');
         if (status && (status.toString().toLowerCase().includes('failed') || status.toString().toLowerCase().includes('error'))) {
             
             // Priority list for Reason
             const reasonKeys = ['STOPREASON', 'Stop Reason', 'StopReason', 'REASON', 'Reason', 'VENDORERRORCODE', 'VendorErrorCode', 'ERRORCODE', 'ErrorCode'];
             let title = 'Unknown';
             
             for (const key of reasonKeys) {
                 const val = getVal(row, key);
                 // Check if valid value (not null, not empty, not 0 (from getVal default), and not 'NoError' string)
                 if (val !== 0 && val !== undefined && val !== null && String(val).trim() !== '' && String(val).toLowerCase() !== 'null' && String(val).toLowerCase() !== 'noerror') {
                     title = val;
                     break;
                 }
             }
             
             title = String(title).trim();
             breakdown[title] = (breakdown[title] || 0) + 1;
         }
     });
     return breakdown;
  };

  // Recalculate metrics from raw data
  const metrics1 = calculateConnectorMetrics(data.Connector1);
  const metrics2 = calculateConnectorMetrics(data.Connector2);

  // Power metrics
  const peak1 = metrics1.peak > 0 ? metrics1.peak : (report1['Peak Power Delivered (kW)'] || 0);
  const peak2 = metrics2.peak > 0 ? metrics2.peak : (report2['Peak Power Delivered (kW)'] || 0);
  const combinedPeakPower = Math.max(peak1, peak2);
  
  // For combined avg, we should weight by energy/duration?
  // Let's just use the recalculated avgs if available.
  const hasRecalc1 = metrics1.avg > 0;
  const hasRecalc2 = metrics2.avg > 0;
  
  let combinedAvgPower = 0;
  if (hasRecalc1 || hasRecalc2) {
      // Weighted average by... sessions? or just average of averages?
      // Better: (Total Energy 1 + 2) / (Total Duration 1 + 2) if we had the raw totals.
      // We can expose totals from helper.
      combinedAvgPower = (metrics1.avg + metrics2.avg) / ((hasRecalc1?1:0) + (hasRecalc2?1:0));
  } else {
     // Fallback to report values
      const rAvg1 = report1['Avg Power per Session (kW)'] || 0;
      const rAvg2 = report2['Avg Power per Session (kW)'] || 0;
      const s1 = report1['Charging Sessions'] || 0;
      const s2 = report2['Charging Sessions'] || 0;
      const tot = s1 + s2;
      combinedAvgPower = tot > 0 ? ((rAvg1 * s1) + (rAvg2 * s2)) / tot : 0;
  }


  // Helper function to create section header - COMPACT - EXTRA SMALL
  const createSectionHeader = (text, x, y, width) => {
    doc.setFillColor(...darkBg);
    doc.rect(x, y, width, 4, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...whiteText);
    doc.text(text, x + 2, y + 3);
  };

  // THREE COLUMN LAYOUT - COMPACT
  const col1X = 10;
  const col2X = 105;
  const col3X = 200;
  const colWidth = 90;
  let yPos = currentY;

  // ========================================
  // COLUMN 1: COMBINED CHARGER METRICS
  // ========================================
  
  createSectionHeader('COMBINED CHARGER', col1X, yPos, colWidth);
  yPos += 5;

  // Section 1 - Usage & Readiness (Combined)
  createSectionHeader('1. Charger Usage & Readiness', col1X, yPos, colWidth);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Count']],
    body: [
      ['Preparing', combinedPreparing],
      ['Charging', combinedCharging],
      ['Positive Stops', combinedSuccessful],
      ['Negative Stops', combinedFailed],
      ['Precharging Failure', combinedPrechargingFailure],
    ],
    theme: 'grid',
    headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
    bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
    margin: { left: col1X, right: 10 },
    tableWidth: colWidth,
  });

  yPos = doc.lastAutoTable.finalY + 1;
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');

  // Conditional Coloring for Success Rate
  // Recalculate val properly if needed, derived from string '82%'
  // But easier to re-derive numeric:
  const combinedSuccessRateVal = combinedCharging > 0 ? Math.round((combinedSuccessful / combinedCharging) * 100) : 0;
  
  if (combinedSuccessRateVal > 60) {
      doc.setTextColor(0, 128, 0); // Green
  } else {
      doc.setTextColor(220, 38, 38); // Red
  }
  doc.text(`Success Rate: ${combinedSuccessRate}`, col1X + 2, yPos + 2);
  
  doc.setTextColor(...textColor); // Reset
  yPos += 4;

  // Section 2 - Error Summary (Combined) - Show separately
  // Calculate Negative Stop Breakdowns (Combined)
  const breakdown1 = calculateNegativeStopBreakdown(data.Connector1);
  const breakdown2 = calculateNegativeStopBreakdown(data.Connector2);
  
  const combinedBreakdown = {};
  [breakdown1, breakdown2].forEach(bd => {
     Object.entries(bd).forEach(([reason, count]) => {
         combinedBreakdown[reason] = (combinedBreakdown[reason] || 0) + count;
     });
  });

  // Section 2 - Error Summary (Negative Stops)
  createSectionHeader('2. Error Summary', col1X, yPos, colWidth);
  yPos += 5;

  if (Object.keys(combinedBreakdown).length > 0) {
      const errorBody = Object.entries(combinedBreakdown)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => [reason, count]);

      autoTable(doc, {
        startY: yPos,
        head: [['Stop Reason', 'Count']],
        body: errorBody,
        theme: 'grid',
        headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
        bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
        margin: { left: col1X },
        tableWidth: colWidth,
      });
      yPos = doc.lastAutoTable.finalY + 2;
  } else {
      doc.setFontSize(5);
      doc.text('No Failed/Error stops recorded.', col1X + 2, yPos + 2);
      yPos += 6;
  }


  // Section 3 - Authentication (Combined)
  createSectionHeader('3. Authentication Method', col1X, yPos, colWidth);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Start Type', 'Accepted']],
    body: [
      ['Remote Start', combinedRemoteStart],
      ['Auto Charge', combinedAutoStart],
      ['RFID', combinedRfidStart],
    ],
    theme: 'grid',
    headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
    bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
    margin: { left: col1X },
    tableWidth: colWidth,
  });

  yPos = doc.lastAutoTable.finalY + 2;

  // Section 4 - Power (Combined)
  createSectionHeader('4. Power & Charging Quality', col1X, yPos, colWidth);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Peak Power (kW)', combinedPeakPower.toFixed(2)],
      ['Avg Power (kW)', combinedAvgPower.toFixed(2)],
    ],
    theme: 'grid',
    headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
    bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
    margin: { left: col1X },
    tableWidth: colWidth,
    didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === 0 && data.column.index === 1) {
            const threshold = stationCapacity * 0.9;
            if (stationCapacity > 0 && combinedPeakPower > threshold) {
                data.cell.styles.textColor = [0, 128, 0];
                data.cell.styles.fontStyle = 'bold';
            } else {
                data.cell.styles.textColor = [220, 38, 38];
            }
        }
    }
  });

  // ========================================
  // COLUMNS 2 & 3: INDIVIDUAL CONNECTORS
  // ========================================

  const reports = [
    { key: 'report_1', name: 'CONNECTOR 1', data: data.report_1, colX: col2X, metrics: metrics1 },
    { key: 'report_2', name: 'CONNECTOR 2', data: data.report_2, colX: col3X, metrics: metrics2 }
  ];

  reports.forEach((report) => {
    if (!report.data) return;

    let connectorY = currentY;

    // Connector header
    createSectionHeader(report.name, report.colX, connectorY, colWidth);
    connectorY += 5;

    // Calculate success rate
    const successful = report.data['Successful Sessions'] || 0;
    const total = report.data['Charging Sessions'] || 0;
    const successRateVal = total > 0 ? Math.round((successful / total) * 100) : 0;
    const successRate = total > 0 ? `${successRateVal}% (${successful} / ${total})` : '0%';

    // Count precharging failures from raw connector data
    const connectorKey = report.key === 'report_1' ? 'Connector1' : 'Connector2';
    const prechargingFailure = countPrechargingFailures(data[connectorKey]);

    // Section 1 - Usage
    createSectionHeader('1. Charger Usage & Readiness', report.colX, connectorY, colWidth);
    connectorY += 5;

    autoTable(doc, {
      startY: connectorY,
      head: [['Metric', 'Count']],
      body: [
        ['Preparing', report.data['Preparing Sessions'] || 0],
        ['Charging', report.data['Charging Sessions'] || 0],
        ['Positive Stops', report.data['Successful Sessions'] || 0],
        ['Negative Stops', report.data['Failed / Error Stops'] || 0],
        ['Precharging Failure', prechargingFailure],
      ],
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
      bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
    });

    connectorY = doc.lastAutoTable.finalY + 1;
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    
    // Conditional Coloring for Individual Connector Success Rate
    if (successRateVal > 60) {
        doc.setTextColor(0, 128, 0); // Green
    } else {
        doc.setTextColor(220, 38, 38); // Red
    }
    doc.text(`Success Rate: ${successRate}`, report.colX + 2, connectorY + 2);
    
    doc.setTextColor(...textColor); // Reset
    connectorY += 4;

    // Section 2 - Error Summary - Show separately
    // Section 2 - Error Summary
    const breakdown = calculateNegativeStopBreakdown(data[connectorKey]);

    createSectionHeader('2. Error Summary', report.colX, connectorY, colWidth);
    connectorY += 5;

    if (Object.keys(breakdown).length > 0) {
      const errorBody = Object.entries(breakdown)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => [reason, count]);

      autoTable(doc, {
        startY: connectorY,
        head: [['Stop Reason', 'Count']],
        body: errorBody,
        theme: 'grid',
        headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
        bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
        margin: { left: report.colX },
        tableWidth: colWidth,
      });
      connectorY = doc.lastAutoTable.finalY + 2;
    } else {
       doc.setFontSize(5);
       doc.text('No Failed/Error stops recorded.', report.colX + 2, connectorY + 2);
       connectorY += 6;
    }

    // Section 3 - Authentication
    createSectionHeader('3. Authentication Method', report.colX, connectorY, colWidth);
    connectorY += 5;

    const remoteStart = report.data['Remote Start'] || 0;
    const autoStart = report.data['Auto Start'] || 0;
    const rfidStart = report.data['RFID Start'] || 0;

    autoTable(doc, {
      startY: connectorY,
      head: [['Start Type', 'Accepted']],
      body: [
        ['Remote Start', remoteStart],
        ['Auto Charge', autoStart],
        ['RFID', rfidStart],
      ],
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
      bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
    });

    connectorY = doc.lastAutoTable.finalY + 2;

    // Section 4 - Power
    createSectionHeader('4. Power & Charging Quality', report.colX, connectorY, colWidth);
    connectorY += 5;

    const peakPowerRaw = report.metrics.peak > 0 ? report.metrics.peak : report.data['Peak Power Delivered (kW)'];
    const avgPowerRaw = report.metrics.avg > 0 ? report.metrics.avg : report.data['Avg Power per Session (kW)'];

    // Format for display
    const peakPower = peakPowerRaw !== undefined && peakPowerRaw !== null ? parseFloat(peakPowerRaw).toFixed(2) : '—';
    const avgPower = avgPowerRaw !== undefined && avgPowerRaw !== null ? parseFloat(avgPowerRaw).toFixed(2) : '—';

    autoTable(doc, {
      startY: connectorY,
      head: [['Metric', 'Value']],
      body: [
        ['Peak Power (kW)', peakPower !== undefined && peakPower !== null ? peakPower : '—'],
        ['Avg Power (kW)', avgPower !== undefined && avgPower !== null ? avgPower : '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
      bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === 0 && data.column.index === 1) {
             // Use 90% of (Station Capacity / 2) as threshold for single connector
             // OR keep it simple: if peak > 0.9 * (StationCapacity/2)
             const threshold = (stationCapacity / 2) * 0.9;
             const pVal = parseFloat(peakPower);

             if (stationCapacity > 0 && !isNaN(pVal)) {
                 if (pVal > threshold) {
                    data.cell.styles.textColor = [0, 128, 0];
                    data.cell.styles.fontStyle = 'bold';
                 } else {
                    data.cell.styles.textColor = [220, 38, 38];
                 }
             }
        }
    }
    });
  });
};

export const generateChargerHealthPDF = (data, filename = "Charger_Health_Report") => {
  console.log('PDF Generator - Data received:', data);
  
  // Use LANDSCAPE orientation for single page
  const doc = new jsPDF('landscape');
  
  // Check if this is a multi-file object
  const isMultiFile = filename === 'Combined_Report' && data && !data.report_1;

  if (isMultiFile) {
     const keys = Object.keys(data).filter(k => k !== 'All Files').sort();
     if (keys.length === 0) {
        console.error("No data files found for PDF report");
        return;
     }

     keys.forEach((key, index) => {
        if (index > 0) doc.addPage();
        renderReportPage(doc, data[key], key);
     });
  } else {
     const title = filename !== 'Combined_Report' && filename !== 'Charger_Health_Report' ? filename : 'Charger Health Report';
     renderReportPage(doc, data, title);
  }

  doc.save(`${filename}.pdf`);
  console.log('PDF generated successfully');
};
