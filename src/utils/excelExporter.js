import * as XLSX from 'xlsx';

/**
 * Export both Connector1 and Connector2 data to Excel file
 * @param {Object} data - The result object containing Connector1 and Connector2 arrays
 * @param {String} filename - The filename for the exported Excel file
 */
export const exportConnectorsToExcel = (data, filename = 'Connectors_Data') => {
  if (!data) {
    console.error('No data provided for Excel export');
    alert('No data available to export');
    return;
  }

  try {
    console.log('=== EXCEL EXPORT DEBUG ===');
    console.log('Full data structure:', data);
    console.log('Data keys:', Object.keys(data));
    
    // Extract CPID from parent data.info (not from individual rows)
    const getCPIDFromData = (dataObj) => {
      try {
        if (!dataObj || !dataObj.info) return null;
        let info = dataObj.info;
        if (typeof info === 'string') info = JSON.parse(info);
        if (Array.isArray(info) && info.length > 0) {
          return info[0]['Charge Point id'] || info[0]['Charge Point Id'] || info[0]['chargePointId'] || null;
        }
      } catch (e) {
        console.error('Error extracting CPID from data.info:', e);
        return null;
      }
      return null;
    };
    
    const parentCPID = getCPIDFromData(data);
    console.log('Extracted parent CPID:', parentCPID);
    
    // Helper function to extract CPID from a row's info field (for aggregated data)
    const getCPIDFromRowInfo = (rowInfo) => {
      try {
        if (!rowInfo) return null;
        let info = rowInfo;
        if (typeof info === 'string') info = JSON.parse(info);
        if (Array.isArray(info) && info.length > 0) {
          return info[0]['Charge Point id'] || info[0]['Charge Point Id'] || info[0]['chargePointId'] || info[0]['CPID'] || info[0]['cpid'] || null;
        }
      } catch (e) {
        return null;
      }
      return null;
    };
    
    // Helper function to extract CPID from a row object (checks multiple possible locations)
    const getCPIDFromRow = (row) => {
      try {
        // First check if CPID is directly in the row object
        if (row['cpid']) return row['cpid'];
        if (row['CPID']) return row['CPID'];
        if (row['Charge Point id']) return row['Charge Point id'];
        if (row['Charge Point Id']) return row['Charge Point Id'];
        if (row['chargePointId']) return row['chargePointId'];
        if (row['charge_point_id']) return row['charge_point_id'];
        
        // Then check row.info field
        if (row.info) {
          return getCPIDFromRowInfo(row.info);
        }
        
        return null;
      } catch (e) {
        console.error('Error extracting CPID from row:', e);
        return null;
      }
    };
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Get connector data - handle any connector keys dynamically
    const connectorKeys = Object.keys(data).filter(key => {
      const isArray = Array.isArray(data[key]);
      const isNotExcluded = !key.startsWith('report_') && key !== 'date' && key !== 'info' && key !== 'All Files';
      const hasData = data[key]?.length > 0;
      console.log(`Checking key "${key}":`, { 
        isArray, 
        isNotExcluded, 
        length: data[key]?.length,
        hasData,
        willInclude: isArray && isNotExcluded && hasData
      });
      return isArray && isNotExcluded && hasData;
    });

    console.log('Connector keys that will be exported:', connectorKeys);
    console.log('Number of connectors found:', connectorKeys.length);

    if (connectorKeys.length === 0) {
      console.error('No connector data found in the provided data');
      alert('No connector data found to export. Please ensure you have processed the file and data is loaded.');
      return;
    }

    // Helper function to get all unique column names from array of objects
    const getAllColumns = (dataArray) => {
      const allKeys = new Set();
      dataArray.forEach(item => {
        if (typeof item === 'object') {
          Object.keys(item).forEach(key => {
            // Exclude IS_PREPARING column
            if (key.toUpperCase() !== 'IS_PREPARING') {
              allKeys.add(key);
            }
          });
        }
      });
      return Array.from(allKeys);
    };

    // Helper function to order columns (SESSION_START_TIME first, SESSION_END_TIME second)
    const orderColumns = (columns) => {
      const startKey = columns.find(h => h.toUpperCase() === 'SESSION_START_TIME');
      const endKey = columns.find(h => h.toUpperCase() === 'SESSION_END_TIME');
      
      const orderedColumns = [];
      if (startKey) orderedColumns.push(startKey);
      if (endKey) orderedColumns.push(endKey);
      
      const remainingColumns = columns.filter(h => h !== startKey && h !== endKey);
      return [...orderedColumns, ...remainingColumns];
    };

    // Helper function to format connector data for Excel
    const formatConnectorData = (connectorArray, connectorName, cpid, includeConnectorColumn = false) => {
      if (!connectorArray || connectorArray.length === 0) {
        return [{ Message: `No data available for ${connectorName}` }];
      }

      // Get all columns dynamically
      let columns = getAllColumns(connectorArray);
      columns = orderColumns(columns);
      
      console.log(`=== Processing ${connectorName} with ${connectorArray.length} rows ===`);
      console.log('Using CPID:', cpid);

      // Map the data preserving all original columns
      return connectorArray.map((row, index) => {
        const formattedRow = { '#': index + 1 };
        
        // Check if CPID already exists as a column in the data
        const hasCPIDColumn = columns.some(col => 
          col.toLowerCase() === 'cpid' || 
          col.toLowerCase() === 'charge point id' ||
          col.toLowerCase() === 'chargepointid'
        );
        
        // Only extract CPID manually if it's NOT already in the columns
        if (!hasCPIDColumn) {
          // Try to extract CPID from the row
          let rowCpid = null;
          
          // Check all possible CPID field variations in the row
          const cpidFieldNames = [
            'cpid', 'CPID', 'Cpid',
            'Charge Point id', 'Charge Point Id', 'charge point id',
            'chargePointId', 'charge_point_id', 'ChargePointId',
            'CP ID', 'cp_id', 'cp id'
          ];
          
          for (const fieldName of cpidFieldNames) {
            if (row[fieldName]) {
              rowCpid = row[fieldName];
              break;
            }
          }
          
          // If not found in direct fields, try info field
          if (!rowCpid && row.info) {
            rowCpid = getCPIDFromRowInfo(row.info);
          }
          
          // Last resort: use parent CPID
          if (!rowCpid) {
            rowCpid = cpid;
          }
          
          formattedRow['cpid'] = rowCpid || '';
        }
        
        if (includeConnectorColumn) {
          formattedRow['Connector'] = connectorName;
        }
        
        // Add all columns from the original data
        columns.forEach(column => {
          // Format column name for display (replace underscores with spaces)
          const displayName = column.replace(/_/g, ' ');
          formattedRow[displayName] = row[column] !== null && row[column] !== undefined ? row[column] : '';
        });
        
        // Debug first few rows
        if (index < 3) {
          console.log(`Row ${index} - CPID value in Excel:`, formattedRow['cpid'] || formattedRow['Charge Point id'] || 'NOT FOUND');
        }
        
        return formattedRow;
      });
    };

    // Helper function to auto-size columns
    const getColumnWidths = (data) => {
      if (!data || data.length === 0) return [];
      
      const keys = Object.keys(data[0]);
      return keys.map(key => {
        const maxLength = Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
    };

    // Create a single combined sheet with all connector data appended
    let sheetsCreated = 0;
    const allCombinedData = [];
    
    // Combine all connector data into one array
    connectorKeys.forEach((connectorKey) => {
      const connectorData = data[connectorKey];
      if (connectorData && connectorData.length > 0) {
        console.log(`Adding ${connectorKey} data: ${connectorData.length} rows`);
        
        const formattedData = formatConnectorData(connectorData, connectorKey, parentCPID, true);
        
        // Add each row to the combined data with continuous numbering
        formattedData.forEach((row) => {
          row['#'] = allCombinedData.length + 1;
          allCombinedData.push(row);
        });
        
        console.log(`Total rows after adding ${connectorKey}: ${allCombinedData.length}`);
      }
    });

    // Create the single combined sheet
    if (allCombinedData.length > 0) {
      console.log(`Creating single Excel sheet with ${allCombinedData.length} total rows from all connectors`);
      const ws = XLSX.utils.json_to_sheet(allCombinedData);
      ws['!cols'] = getColumnWidths(allCombinedData);
      XLSX.utils.book_append_sheet(workbook, ws, 'All Connectors Data');
      sheetsCreated++;
      console.log('Single combined sheet created successfully with all connector data');
    }

    // Verify sheets were created
    if (sheetsCreated === 0) {
      console.error('No sheets were created');
      alert('Failed to create Excel sheets. Please check the data format.');
      return;
    }

    console.log(`Total sheets created: ${sheetsCreated}`);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    // Write the file
    XLSX.writeFile(workbook, finalFilename);

    console.log(`Excel file exported successfully: ${finalFilename}`);
    // alert(`Excel file downloaded successfully: ${finalFilename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert(`Failed to export Excel file: ${error.message}`);
  }
};

/**
 * Export dashboard analytics data to Excel with multiple sheets
 * @param {Object} dashboardData - Object containing all chart data
 * @param {String} filename - The filename for the exported Excel file
 */
export const exportDashboardAnalytics = (dashboardData, filename = 'Dashboard_Analytics') => {
  try {
    console.log('=== DASHBOARD ANALYTICS EXPORT ===');
    
    const {
      networkByOEM = [],
      networkByStation = [],
      networkByCPID = [],
      prechargingByOEM = [],
      prechargingByStation = []
    } = dashboardData;

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Network Performance by OEM
    if (networkByOEM.length > 0) {
      const oemData = networkByOEM.map(item => ({
        'OEM Name': item.name,
        'Negative Stop %': item.value
      }));
      const oemSheet = XLSX.utils.json_to_sheet(oemData);
      XLSX.utils.book_append_sheet(workbook, oemSheet, 'Network Perf by OEM');
      console.log('Added Network Performance by OEM sheet');
    }

    // Sheet 2: Network Performance by Station
    if (networkByStation.length > 0) {
      const stationData = networkByStation.map(item => ({
        'Station Name': item.name,
        'Negative Stop %': item.value
      }));
      const stationSheet = XLSX.utils.json_to_sheet(stationData);
      XLSX.utils.book_append_sheet(workbook, stationSheet, 'Network Perf by Station');
      console.log('Added Network Performance by Station sheet');
    }

    // Sheet 3: Network Performance by CPID
    if (networkByCPID.length > 0) {
      const cpidData = networkByCPID.map(item => ({
        'CPID': item.name,
        'Negative Stop %': item.value
      }));
      const cpidSheet = XLSX.utils.json_to_sheet(cpidData);
      XLSX.utils.book_append_sheet(workbook, cpidSheet, 'Network Perf by CPID');
      console.log('Added Network Performance by CPID sheet');
    }

    // Sheet 4: Precharging Failure by OEM
    if (prechargingByOEM.length > 0) {
      const prechargingOEMData = prechargingByOEM.map(item => ({
        'OEM Name': item.name,
        'Precharging Failures': item.value
      }));
      const prechargingOEMSheet = XLSX.utils.json_to_sheet(prechargingOEMData);
      XLSX.utils.book_append_sheet(workbook, prechargingOEMSheet, 'Precharging by OEM');
      console.log('Added Precharging Failure by OEM sheet');
    }

    // Sheet 5: Precharging Failure by Station
    if (prechargingByStation.length > 0) {
      const prechargingStationData = prechargingByStation.map(item => ({
        'Station Name': item.name,
        'Precharging Failures': item.value
      }));
      const prechargingStationSheet = XLSX.utils.json_to_sheet(prechargingStationData);
      XLSX.utils.book_append_sheet(workbook, prechargingStationSheet, 'Precharging by Station');
      console.log('Added Precharging Failure by Station sheet');
    }

    // Check if any sheets were created
    if (workbook.SheetNames.length === 0) {
      console.error('No data available for export');
      alert('No data available to export');
      return;
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    // Write the file
    XLSX.writeFile(workbook, finalFilename);

    console.log(`Dashboard analytics exported successfully: ${finalFilename}`);
    // alert(`Dashboard analytics downloaded: ${finalFilename}`);
  } catch (error) {
    console.error('Error exporting dashboard analytics:', error);
    alert(`Failed to export dashboard analytics: ${error.message}`);
  }
};
