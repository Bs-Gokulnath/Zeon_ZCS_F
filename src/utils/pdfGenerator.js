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

  const getErrorList = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { general: [], precharging: [] };
    
    const general = [];
    const precharging = [];

    rows.forEach(row => {
      const status = getVal(row, 'STOP', 'Stop', 'Status', 'Session Status');
      const vendorCode = getVal(row, 'VendorErrorCode', 'VENDORERRORCODE', 'vendorErrorCode');
      const isFailed = status && (status.toString().toLowerCase().includes('failed') || status.toString().toLowerCase().includes('error'));
      const isPrecharge = vendorCode === 'Precharging Failure';

      if (isFailed || isPrecharge) {
        // Get Session ID
        const sessionId = getVal(row, 'Session ID', 'SessionId', 'Transaction Id', 'TransactionId', 'Id') || 'Unknown';

        // Get sorting time
        const timeVal = getVal(row, 'Session Start Time', 'Start Time', 'Date', 'Started', 'Created', 'Time', 'Timestamp', 'timestamp');
        let rawTime = 0;
        let formattedTime = '—';
        if (timeVal) {
          try {
            const d = new Date(timeVal);
            if (!isNaN(d.getTime())) {
              rawTime = d.getTime();
              formattedTime = d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
            } else {
              formattedTime = String(timeVal).substring(0, 20);
            }
          } catch (e) { formattedTime = String(timeVal); }
        }
        
        // Extract relevant keys for grouping
        const info = getVal(row, 'info', 'Info');
        const reason = getVal(row, 'Stop Reason', 'STOPREASON', 'StopReason', 'reason', 'Reason');

        // 1. Try to find the "All Errors JSON" field
        let errorJson = "";
        let foundRaw = false;

        for (const key in row) {
          const val = row[key];
          if (val && typeof val === 'object') {
            const str = JSON.stringify(val);
            if (str.includes('"info"') || str.includes('"timestamp"') || str.includes('"reason"')) {
              errorJson = JSON.stringify(val, null, 2);
              foundRaw = true;
              break;
            }
          }
        }

        if (!foundRaw) {
          const cleanError = {};
          if (formattedTime !== '—') cleanError.timestamp = formattedTime;
          if (info && info !== 0) cleanError.info = String(info);
          if (vendorCode && vendorCode !== 0) cleanError.vendorErrorCode = String(vendorCode);
          if (reason && reason !== 0) cleanError.reason = String(reason);

          if (Object.keys(cleanError).length === 0) {
            cleanError.reason = 'Unknown Error';
          }
          errorJson = JSON.stringify(cleanError, null, 2);
        }

        const errorObj = { sessionId, json: errorJson, rawTime };
        if (isPrecharge) {
          precharging.push(errorObj);
        } else {
          general.push(errorObj);
        }
      }
    });
    
    return {
      general: general.sort((a, b) => a.rawTime - b.rawTime),
      precharging: precharging.sort((a, b) => a.rawTime - b.rawTime)
    };
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
      combinedAvgPower = (metrics1.avg + metrics2.avg) / ((hasRecalc1?1:0) + (hasRecalc2?1:0));
  } else {
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

  // Track parallel column context
  const sectionStartPage = doc.internal.getNumberOfPages();
  const sectionStartY = currentY;
  const originalAddPage = doc.addPage.bind(doc);
  let maxPageReached = sectionStartPage;

  // Helper to enter parallel mode for a specific column
  const enterParallelColumn = () => {
    let currentPage = sectionStartPage;
    doc.addPage = function() {
      currentPage++;
      if (currentPage <= doc.internal.getNumberOfPages()) {
        doc.setPage(currentPage);
      } else {
        originalAddPage();
      }
      if (currentPage > maxPageReached) maxPageReached = currentPage;
      return this;
    };
    doc.setPage(sectionStartPage);
    return sectionStartY;
  };

  let yPos = enterParallelColumn();

  // ========================================
  // COLUMN 1: COMBINED CHARGER METRICS
  // ========================================
  
   createSectionHeader('COMBINED CHARGER', col1X, yPos, colWidth);
   yPos += 5;
 
   // PROMINENT SUCCESS RATE DISPLAY
   const combinedSuccessRateVal = combinedCharging > 0 ? Math.round((combinedSuccessful / combinedCharging) * 100) : 0;
   doc.setFillColor(combinedSuccessRateVal > 60 ? 240 : 255, combinedSuccessRateVal > 60 ? 255 : 240, combinedSuccessRateVal > 60 ? 240 : 240);
   doc.rect(col1X, yPos, colWidth, 8, 'F');
   doc.setDrawColor(...darkBg);
   doc.rect(col1X, yPos, colWidth, 8, 'S');
   
   doc.setFontSize(8);
   doc.setFont('helvetica', 'bold');
   doc.setTextColor(combinedSuccessRateVal > 60 ? 0 : 220, combinedSuccessRateVal > 60 ? 128 : 38, combinedSuccessRateVal > 60 ? 0 : 38);
   doc.text(`Success Rate: ${combinedSuccessRate}`, col1X + colWidth/2, yPos + 5.5, { align: 'center' });
   
   doc.setTextColor(...textColor); // Reset
   yPos += 10;
 
   // Section 1 - Usage & Readiness (Combined)
   createSectionHeader('1. Charger Usage & Readiness', col1X, yPos, colWidth);
   yPos += 5;
 
   autoTable(doc, {
     startY: yPos,
     head: [['Metric', 'Count']],
     body: [
       ['Preparing', combinedPreparing],
       ['Precharging Failure', combinedPrechargingFailure],
       ['Negative Stops (Errors)', combinedFailed],
     ],
     theme: 'grid',
     headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
     bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
     columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
     margin: { left: col1X, right: 10 },
     tableWidth: colWidth,
   });
 
   yPos = doc.lastAutoTable.finalY + 3;

  // Section 2 - Authentication (Combined)
  createSectionHeader('2. Authentication Method', col1X, yPos, colWidth);
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

  // Section 3 - Power (Combined)
  createSectionHeader('3. Power & Charging Quality', col1X, yPos, colWidth);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Peak Power (kW)', (peak1 + peak2) > 0 ? combinedPeakPower.toFixed(2) : '0.00'],
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

  // Sections 4 & 5 (Error logs) moved to Page 2 for connectors

  // ========================================
  // COLUMNS 2 & 3: INDIVIDUAL CONNECTORS
  // ========================================

  const reports = [
    { key: 'report_1', name: 'CONNECTOR 1', data: data.report_1, colX: col2X, metrics: metrics1 },
    { key: 'report_2', name: 'CONNECTOR 2', data: data.report_2, colX: col3X, metrics: metrics2 }
  ];

  reports.forEach((report) => {
    if (!report.data) return;

    let connectorY = enterParallelColumn();

    // Connector header
    createSectionHeader(report.name, report.colX, connectorY, colWidth);
    connectorY += 5;

    // Calculate success rate
    const successful = report.data['Successful Sessions'] || 0;
    const total = report.data['Charging Sessions'] || 0;
    const successRateVal = total > 0 ? Math.round((successful / total) * 100) : 0;
    const successRate = total > 0 ? `${successRateVal}% (${successful} / ${total})` : '0%';

    // PROMINENT SUCCESS RATE DISPLAY (INDIVIDUAL)
    doc.setFillColor(successRateVal > 60 ? 240 : 255, successRateVal > 60 ? 255 : 240, successRateVal > 60 ? 240 : 240);
    doc.rect(report.colX, connectorY, colWidth, 8, 'F');
    doc.setDrawColor(...darkBg);
    doc.rect(report.colX, connectorY, colWidth, 8, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(successRateVal > 60 ? 0 : 220, successRateVal > 60 ? 128 : 38, successRateVal > 60 ? 0 : 38);
    doc.text(`Success Rate: ${successRate}`, report.colX + colWidth/2, connectorY + 5.5, { align: 'center' });

    doc.setTextColor(...textColor); // Reset
    connectorY += 10;

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
        ['Precharging Failure', prechargingFailure],
        ['Negative Stops (Errors)', report.data['Failed / Error Stops'] || 0],
      ],
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
      bodyStyles: { fontSize: 5, textColor: textColor, cellPadding: 0.5, minCellHeight: 4 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
    });

    connectorY = doc.lastAutoTable.finalY + 3;

    // Section 2 - Authentication
    createSectionHeader('2. Authentication Method', report.colX, connectorY, colWidth);
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

    connectorY = doc.lastAutoTable.finalY + 3;

    // Section 3 - Power
    createSectionHeader('3. Power & Charging Quality', report.colX, connectorY, colWidth);
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

    // Sections 4 & 5 (Error Logs) moved to Page 2
  });

  // ========================================
  // PAGE 2: DETAILED ERROR LOGS
  // ========================================
  originalAddPage();
  const errorPageStart = doc.internal.getNumberOfPages();
  maxPageReached = errorPageStart;
  const page2Y = 15; // Starting Y for page 2

  // Update parallel column helper to start from Page 2
  const enterParallelColumnP2 = () => {
    let currentPage = errorPageStart;
    doc.addPage = function() {
      currentPage++;
      if (currentPage <= doc.internal.getNumberOfPages()) {
        doc.setPage(currentPage);
      } else {
        originalAddPage();
      }
      if (currentPage > maxPageReached) maxPageReached = currentPage;
      return this;
    };
    doc.setPage(errorPageStart);
    return page2Y;
  };

  reports.forEach((report) => {
    if (!report.data) return;
    
    let connectorY = enterParallelColumnP2();
    const connectorKey = report.key === 'report_1' ? 'Connector1' : 'Connector2';
    const errors = getErrorList(data[connectorKey]);

    // Header repeated for context
    createSectionHeader(report.name + ' - DETAILS', report.colX, connectorY, colWidth);
    connectorY += 10;

    // Section 4 - Precharging Description
    createSectionHeader('4. Precharging Description', report.colX, connectorY, colWidth);
    connectorY += 5;

    if (errors.precharging.length > 0) {
      const preBody = errors.precharging.map(e => [e.json, e.sessionId, "1"]);
      autoTable(doc, {
        startY: connectorY,
        head: [['Error Details', 'Transaction IDs', 'Count']],
        body: preBody,
        theme: 'grid',
        headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
        bodyStyles: { fontSize: 4, textColor: textColor, cellPadding: 0.5, minCellHeight: 4, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 }, 2: { cellWidth: 10, halign: 'center' } },
        margin: { left: report.colX },
        tableWidth: colWidth,
      });
      connectorY = doc.lastAutoTable.finalY + 3;
    } else {
       doc.setFontSize(5);
       doc.text('No precharging failures recorded.', report.colX + 2, connectorY + 2);
       connectorY += 6;
    }

    // Section 5 - Error Description
    createSectionHeader('5. Error Description', report.colX, connectorY, colWidth);
    connectorY += 5;

    if (errors.general.length > 0) {
      const errorBody = errors.general.map(e => [e.json, e.sessionId, "1"]);
      autoTable(doc, {
        startY: connectorY,
        head: [['Error Details', 'Transaction IDs', 'Count']],
        body: errorBody,
        theme: 'grid',
        headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 5, fontStyle: 'bold', halign: 'left', cellPadding: 0.5, minCellHeight: 4 },
        bodyStyles: { fontSize: 4, textColor: textColor, cellPadding: 0.5, minCellHeight: 4, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 }, 2: { cellWidth: 10, halign: 'center' } },
        margin: { left: report.colX },
        tableWidth: colWidth,
      });
    } else {
       doc.setFontSize(5);
       doc.text('No other Failed/Error stops recorded.', report.colX + 2, connectorY + 2);
    }
  });

  // Restore original addPage and jump to the furthest page reached
  doc.addPage = originalAddPage;
  doc.setPage(maxPageReached);
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
