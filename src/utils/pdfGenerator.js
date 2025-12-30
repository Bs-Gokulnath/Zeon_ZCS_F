import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to count Precharging Failures from raw connector data
const countPrechargingFailures = (connectorArray) => {
  if (!Array.isArray(connectorArray)) return 0;
  return connectorArray.filter(row => 
    row.vendorErrorCode === 'Precharging Failure' && row.is_Charging === 0
  ).length;
};

export const generateChargerHealthPDF = (data) => {
  console.log('PDF Generator - Full data received:', data);
  
  // Use LANDSCAPE orientation for single page
  const doc = new jsPDF('landscape');
  
  // Set colors - Dark theme
  const darkBg = [45, 45, 45];
  const textColor = [30, 30, 30];
  const whiteText = [255, 255, 255];

  // Check if report_1 and report_2 exist
  if (!data.report_1 && !data.report_2) {
    console.error('No report_1 or report_2 found in data');
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.text('Error: No report data available', 150, 100, { align: 'center' });
    doc.save('Charger_Health_Report.pdf');
    return;
  }

  // Compact title at the top
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Charger Health Report', 150, 8, { align: 'center' });
  
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
  
  console.log('=== PRECHARGING FAILURE COUNT ===');
  console.log('Connector1 Precharging Failures:', connector1PrechargingFailure);
  console.log('Connector2 Precharging Failures:', connector2PrechargingFailure);
  console.log('Combined Precharging Failure:', combinedPrechargingFailure);
  
  // Combine error summaries from new structure
  const combinedErrors = {};
  const errors1Successful = report1['Successful Error Summary'] || {};
  const errors1Failed = report1['Failed / Error Error Summary'] || {};
  const errors2Successful = report2['Successful Error Summary'] || {};
  const errors2Failed = report2['Failed / Error Error Summary'] || {};
  
  // Merge all error summaries (excluding Precharging Failure as it's counted separately)
  [errors1Successful, errors1Failed, errors2Successful, errors2Failed].forEach(errorObj => {
    Object.entries(errorObj).forEach(([key, val]) => {
      if (key && key.trim() && key !== 'Precharging Failure') {
        combinedErrors[key] = (combinedErrors[key] || 0) + val;
      }
    });
  });

  const combinedRemoteStart = (report1['Remote Start'] || 0) + (report2['Remote Start'] || 0);
  const combinedAutoStart = (report1['Auto Start'] || 0) + (report2['Auto Start'] || 0);
  const combinedRfidStart = (report1['RFID Start'] || 0) + (report2['RFID Start'] || 0);

  // Power metrics
  const peak1 = report1['Peak Power Delivered (kW)'] || 0;
  const peak2 = report2['Peak Power Delivered (kW)'] || 0;
  const combinedPeakPower = Math.max(peak1, peak2);

  const avg1 = report1['Avg Power per Session (kW)'] || 0;
  const avg2 = report2['Avg Power per Session (kW)'] || 0;
  const sessions1 = report1['Charging Sessions'] || 0;
  const sessions2 = report2['Charging Sessions'] || 0;
  const totalSessions = sessions1 + sessions2;
  const combinedAvgPower = totalSessions > 0 
    ? ((avg1 * sessions1) + (avg2 * sessions2)) / totalSessions 
    : 0;

  // Helper function to create section header - COMPACT
  const createSectionHeader = (text, x, y, width) => {
    doc.setFillColor(...darkBg);
    doc.rect(x, y, width, 5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...whiteText);
    doc.text(text, x + 2, y + 3.5);
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
  yPos += 6;

  // Section 1 - Usage & Readiness (Combined)
  createSectionHeader('1. Charger Usage & Readiness', col1X, yPos, colWidth);
  yPos += 6;

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
    headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
    bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
    margin: { left: col1X, right: 10 },
    tableWidth: colWidth,
  });

  yPos = doc.lastAutoTable.finalY + 2;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(`Success Rate: ${combinedSuccessRate}`, col1X + 2, yPos);
  yPos += 5;

  // Section 2 - Error Summary (Combined) - Show separately
  createSectionHeader('2. Error Summary', col1X, yPos, colWidth);
  yPos += 6;
  yPos += 2; // Extra space before labels

  // Combine successful errors
  const combinedSuccessfulErrors = {};
  [errors1Successful, errors2Successful].forEach(errorObj => {
    Object.entries(errorObj).forEach(([key, val]) => {
      if (key && key.trim() && key !== 'Precharging Failure') {
        combinedSuccessfulErrors[key] = (combinedSuccessfulErrors[key] || 0) + val;
      }
    });
  });

  // Combine failed errors
  const combinedFailedErrors = {};
  [errors1Failed, errors2Failed].forEach(errorObj => {
    Object.entries(errorObj).forEach(([key, val]) => {
      if (key && key.trim() && key !== 'Precharging Failure') {
        combinedFailedErrors[key] = (combinedFailedErrors[key] || 0) + val;
      }
    });
  });

  // Display Successful Errors
  if (Object.keys(combinedSuccessfulErrors).length > 0) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Successful Errors:', col1X + 2, yPos);
    yPos += 2;

    const successfulErrorBody = Object.entries(combinedSuccessfulErrors)
      .map(([errorType, count]) => [errorType, count]);

    autoTable(doc, {
      startY: yPos,
      head: [['Error Type', 'Count']],
      body: successfulErrorBody,
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
      bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: col1X },
      tableWidth: colWidth,
    });
    yPos = doc.lastAutoTable.finalY + 3;
  }

  // Display Failed Errors
  if (Object.keys(combinedFailedErrors).length > 0) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Failed Errors:', col1X + 2, yPos);
    yPos += 2;

    const failedErrorBody = Object.entries(combinedFailedErrors)
      .map(([errorType, count]) => [errorType, count]);

    autoTable(doc, {
      startY: yPos,
      head: [['Error Type', 'Count']],
      body: failedErrorBody,
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
      bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: col1X },
      tableWidth: colWidth,
    });
    yPos = doc.lastAutoTable.finalY + 3;
  }


  // Section 3 - Authentication (Combined)
  createSectionHeader('3. Authentication Method', col1X, yPos, colWidth);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [['Start Type', 'Accepted']],
    body: [
      ['Remote Start', combinedRemoteStart],
      ['Auto Charge', combinedAutoStart],
      ['RFID', combinedRfidStart],
    ],
    theme: 'grid',
    headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
    bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
    margin: { left: col1X },
    tableWidth: colWidth,
  });

  yPos = doc.lastAutoTable.finalY + 3;

  // Section 4 - Power (Combined)
  createSectionHeader('4. Power & Charging Quality', col1X, yPos, colWidth);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Peak Power (kW)', combinedPeakPower.toFixed(2)],
      ['Avg Power (kW)', combinedAvgPower.toFixed(2)],
    ],
    theme: 'grid',
    headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
    bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
    margin: { left: col1X },
    tableWidth: colWidth,
  });

  // ========================================
  // COLUMNS 2 & 3: INDIVIDUAL CONNECTORS
  // ========================================

  const reports = [
    { key: 'report_1', name: 'CONNECTOR 1', data: data.report_1, colX: col2X },
    { key: 'report_2', name: 'CONNECTOR 2', data: data.report_2, colX: col3X }
  ];

  reports.forEach((report) => {
    if (!report.data) return;

    let connectorY = currentY;

    // Connector header
    createSectionHeader(report.name, report.colX, connectorY, colWidth);
    connectorY += 6;

    // Calculate success rate
    const successful = report.data['Successful Sessions'] || 0;
    const total = report.data['Charging Sessions'] || 0;
    const successRate = total > 0 ? `${Math.round((successful / total) * 100)}% (${successful} / ${total})` : '0%';

    // Count precharging failures from raw connector data
    const connectorKey = report.key === 'report_1' ? 'Connector1' : 'Connector2';
    const prechargingFailure = countPrechargingFailures(data[connectorKey]);
    
    console.log(`${report.name} - Precharging Failure:`, prechargingFailure);

    // Section 1 - Usage
    createSectionHeader('1. Charger Usage & Readiness', report.colX, connectorY, colWidth);
    connectorY += 6;

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
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
      bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
    });

    connectorY = doc.lastAutoTable.finalY + 2;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(`Success Rate: ${successRate}`, report.colX + 2, connectorY);
    connectorY += 5;

    // Section 2 - Error Summary - Show separately
    const successfulErrorSummary = report.data['Successful Error Summary'] || {};
    const failedErrorSummary = report.data['Failed / Error Error Summary'] || {};
    
    // Filter successful errors
    const successfulErrorBody = Object.entries(successfulErrorSummary)
      .filter(([key]) => key && key.trim() && key !== 'Precharging Failure')
      .map(([errorType, count]) => [errorType, count]);
    
    // Filter failed errors
    const failedErrorBody = Object.entries(failedErrorSummary)
      .filter(([key]) => key && key.trim() && key !== 'Precharging Failure')
      .map(([errorType, count]) => [errorType, count]);

    if (successfulErrorBody.length > 0 || failedErrorBody.length > 0) {
      createSectionHeader('2. Error Summary', report.colX, connectorY, colWidth);
      connectorY += 6;
      connectorY += 2; // Extra space before labels

      // Display Successful Errors
      if (successfulErrorBody.length > 0) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Successful Errors:', report.colX + 2, connectorY);
        connectorY += 2;

        autoTable(doc, {
          startY: connectorY,
          head: [['Error Type', 'Count']],
          body: successfulErrorBody,
          theme: 'grid',
          headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
          bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
          columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
          margin: { left: report.colX },
          tableWidth: colWidth,
        });

        connectorY = doc.lastAutoTable.finalY + 3;
      }

      // Display Failed Errors
      if (failedErrorBody.length > 0) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Failed Errors:', report.colX + 2, connectorY);
        connectorY += 2;

        autoTable(doc, {
          startY: connectorY,
          head: [['Error Type', 'Count']],
          body: failedErrorBody,
          theme: 'grid',
          headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
          bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
          columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
          margin: { left: report.colX },
          tableWidth: colWidth,
        });

        connectorY = doc.lastAutoTable.finalY + 3;
      }
    }

    // Section 3 - Authentication
    createSectionHeader('3. Authentication Method', report.colX, connectorY, colWidth);
    connectorY += 6;

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
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
      bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
    });

    connectorY = doc.lastAutoTable.finalY + 3;

    // Section 4 - Power
    createSectionHeader('4. Power & Charging Quality', report.colX, connectorY, colWidth);
    connectorY += 6;

    const peakPower = report.data['Peak Power Delivered (kW)'];
    const avgPower = report.data['Avg Power per Session (kW)'];

    autoTable(doc, {
      startY: connectorY,
      head: [['Metric', 'Value']],
      body: [
        ['Peak Power (kW)', peakPower !== undefined && peakPower !== null ? peakPower : '—'],
        ['Avg Power (kW)', avgPower !== undefined && avgPower !== null ? avgPower : '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: darkBg, textColor: whiteText, fontSize: 6, fontStyle: 'bold', halign: 'left', cellPadding: 1 },
      bodyStyles: { fontSize: 6, textColor: textColor, cellPadding: 1 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'left' } },
      margin: { left: report.colX },
      tableWidth: colWidth,
    });
  });

  // Download the PDF
  doc.save('Charger_Health_Report.pdf');
  console.log('PDF generated successfully - Single page compact layout');
};
