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
    const formatConnectorData = (connectorArray, connectorName, includeConnectorColumn = false) => {
      if (!connectorArray || connectorArray.length === 0) {
        return [{ Message: `No data available for ${connectorName}` }];
      }

      // Get all columns dynamically
      let columns = getAllColumns(connectorArray);
      columns = orderColumns(columns);

      // Map the data preserving all original columns
      return connectorArray.map((row, index) => {
        const formattedRow = { '#': index + 1 };
        
        if (includeConnectorColumn) {
          formattedRow['Connector'] = connectorName;
        }
        
        columns.forEach(column => {
          // Format column name for display (replace underscores with spaces)
          const displayName = column.replace(/_/g, ' ');
          formattedRow[displayName] = row[column] !== null && row[column] !== undefined ? row[column] : '';
        });
        
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
        
        const formattedData = formatConnectorData(connectorData, connectorKey, true);
        
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
    alert(`Excel file downloaded successfully: ${finalFilename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert(`Failed to export Excel file: ${error.message}`);
  }
};
