import React, { useState, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import { generateChargerHealthPDF } from '../utils/pdfGenerator';
import zeonLogo from '../assets/zeon_charging.webp';
import DashboardView from './DashboardView';
import { AuthenticationPieChart, UsageReadinessFunnelChart, PowerQualityLineChart } from './report_graphs';

export default function Home() {
  // Initialize state from localStorage if available
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMode, setSelectedMode] = useState('CMS'); // Default to CMS

  const [allResults, setAllResults] = useState(() => {
    try {
      const saved = localStorage.getItem('zeon_allResults');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load results from storage", e);
      return null;
    }
  });

  const [currentFilter, setCurrentFilter] = useState(() => {
    return localStorage.getItem('zeon_currentFilter') || 'All Files';
  });

  const [showDashboard, setShowDashboard] = useState(() => {
    return localStorage.getItem('zeon_showDashboard') === 'true';
  });

  // Persistence Effects
  useEffect(() => {
    if (allResults) {
      try {
        localStorage.setItem('zeon_allResults', JSON.stringify(allResults));
      } catch (e) {
        console.error("Storage full or error", e);
      }
    } else {
      localStorage.removeItem('zeon_allResults');
    }
  }, [allResults]);

  useEffect(() => {
    localStorage.setItem('zeon_currentFilter', currentFilter);
  }, [currentFilter]);

  useEffect(() => {
    localStorage.setItem('zeon_showDashboard', showDashboard);
  }, [showDashboard]);

  // Session Timeout (5 minutes inactivity)
  useEffect(() => {
    let timeoutId;
    const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Clear all persistent data
        localStorage.removeItem('zeon_allResults');
        localStorage.removeItem('zeon_currentFilter');
        localStorage.removeItem('zeon_showDashboard');
        // Reload page to "start from first"
        window.location.reload();
      }, TIMEOUT_DURATION);
    };

    // Tracking user activity
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, resetTimer));

    // Initial start
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, []);

  // Derived result based on filter
  const result = useMemo(() => {
    if (!allResults) return null;
    return allResults[currentFilter];
  }, [allResults, currentFilter]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed')) {
      setSelectedFile(file);
      setAllResults(null);
      // Auto-upload the file
      handleUpload(file);
    } else {
      alert('Please upload a valid Excel, CSV, or ZIP file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed')) {
      setSelectedFile(file);
      setAllResults(null);
      // Auto-upload the file
      handleUpload(file);
    } else {
      alert('Please upload a valid Excel, CSV, or ZIP file');
    }
  };

  const processFileAPI = async (file, mode) => {
    console.log('🔍 Processing file with mode:', mode);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_source', mode.toLowerCase()); // Send 'cms' or 's3' to backend

    // Debug: Log all FormData entries
    console.log('📤 Sending data_source to backend:', mode.toLowerCase());
    console.log('📦 FormData contents:');
    for (let [key, value] of formData.entries()) {
      if (key === 'file') {
        console.log(`  ${key}:`, value.name, `(${value.size} bytes)`);
      } else {
        console.log(`  ${key}:`, value);
      }
    }

    const response = await fetch('/api/process-file', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return await response.json();
  };

  const aggregateResults = (resultsList) => {
    if (resultsList.length === 0) return {};
    if (resultsList.length === 1) return resultsList[0];

    const aggregated = {};

    resultsList.forEach(result => {
      Object.keys(result).forEach(key => {
        // Handle Report Summary Objects (report_1, report_2)
        if (key.startsWith('report_')) {
          if (!aggregated[key]) aggregated[key] = {};

          Object.entries(result[key]).forEach(([metric, value]) => {
            if (typeof value === 'number') {
              aggregated[key][metric] = (aggregated[key][metric] || 0) + value;
            } else {
              // Keep the last seen non-number value or string
              aggregated[key][metric] = value;
            }
          });
        }
        // Handle Connector Data Arrays (e.g. 115324)
        else if (Array.isArray(result[key])) {
          if (!aggregated[key]) aggregated[key] = [];
          aggregated[key] = [...aggregated[key], ...result[key]];
        }
        // Handle other objects (like 'date', 'info') - just take the latest
        else {
          aggregated[key] = result[key];
        }
      });
    });

    return aggregated;
  };

  const handleUpload = async (file) => {
    const fileToUpload = file || selectedFile;
    if (!fileToUpload) return;

    setUploading(true);
    setAllResults(null);
    setCurrentFilter('All Files');

    try {
      const newResults = {};

      if (fileToUpload.name.toLowerCase().endsWith('.zip') || fileToUpload.type === 'application/zip' || fileToUpload.type === 'application/x-zip-compressed') {
        console.log("Processing ZIP file:", fileToUpload.name);
        const zip = await JSZip.loadAsync(fileToUpload);
        const promises = [];

        zip.forEach((relativePath, zipEntry) => {
          console.log("Found entry:", relativePath, "Dir:", zipEntry.dir);
          const lowerName = zipEntry.name.toLowerCase();
          const fileName = zipEntry.name.split('/').pop(); // Extract filename only

          // Filter out folders, Mac metadata, and hidden files
          if (!zipEntry.dir &&
            !zipEntry.name.includes('__MACOSX') &&
            !fileName.startsWith('.') &&
            (lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls'))) {

            console.log("Processing extracted file:", fileName);
            promises.push(
              zipEntry.async('blob').then(async (blob) => {
                const extractedFile = new File([blob], fileName, { type: 'application/octet-stream' });
                try {
                  const data = await processFileAPI(extractedFile, selectedMode);
                  newResults[fileName] = data; // use clean filename
                } catch (e) {
                  console.error(`Failed to process ${fileName}`, e);
                }
              })
            );
          }
        });

        await Promise.all(promises);
        console.log("Finished processing ZIP. Results keys:", Object.keys(newResults));
      } else {
        // Single file processing
        const data = await processFileAPI(fileToUpload, selectedMode);
        newResults[fileToUpload.name] = data;
      }

      const keys = Object.keys(newResults);
      if (keys.length === 0) {
        throw new Error("No valid files processed.");
      }

      // Create aggregation
      newResults['All Files'] = aggregateResults(Object.values(newResults));

      setAllResults(newResults);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Error: ${error.message}`);
      setAllResults(null);
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setAllResults(null);
  };

  return (
    <div className="h-screen overflow-hidden">
      <div className={`bg-white w-full h-full flex flex-col ${result ? 'p-0' : 'flex items-center justify-center p-5'}`}>
        {!result && (
          <div className="max-w-2xl w-full bg-white rounded-2xl p-12 shadow-[0_0_50px_rgba(0,0,0,0.1)] border-2 border-black animate-[slideUp_0.5s_ease-out] relative">

            {/* Zeon Logo */}
            <div className="flex justify-center mb-6">
              <img src={zeonLogo} alt="Zeon Charging" className="h-16 w-auto" />
            </div>

            <h1 className="text-4xl font-bold text-black mb-2 text-center">Charger Health Report</h1>
            <p className="text-base text-gray-700 text-center mb-4">Upload your Excel, CSV, or ZIP file to generate the report</p>

            {/* Source Selection Switch */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <span className={`text-sm font-semibold transition-colors ${selectedMode === 'CMS' ? 'text-orange-600' : 'text-gray-400'}`}>
                CMS
              </span>
              <button
                onClick={() => {
                  const newMode = selectedMode === 'CMS' ? 'S3' : 'CMS';
                  console.log('🔄 Switching mode from', selectedMode, 'to', newMode);
                  setSelectedMode(newMode);
                }}
                className={`relative w-16 h-8 rounded-full transition-all duration-300 ${selectedMode === 'S3' ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${selectedMode === 'S3' ? 'translate-x-8' : 'translate-x-0'
                    }`}
                />
              </button>
              <span className={`text-sm font-semibold transition-colors ${selectedMode === 'S3' ? 'text-orange-600' : 'text-gray-400'}`}>
                S3
              </span>
            </div>

            {/* Mode Selection Indicator */}
            <p className="text-sm text-center mb-6 text-orange-600 font-semibold">
              Data Source: {selectedMode}
            </p>

            <div
              className={`border-3 border-dashed rounded-2xl py-12 px-6 text-center transition-all duration-300 cursor-pointer relative ${isDragging
                ? 'border-red-600 bg-red-50 scale-105'
                : 'border-gray-400 bg-gray-50 hover:border-red-600 hover:bg-gray-100'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {!selectedFile ? (
                <>
                  <div className="text-red-600 mx-auto mb-4 flex justify-center">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">Drag & Drop your file here</h3>
                  <p className="text-gray-400 text-sm my-4 font-medium">or</p>
                  <label
                    htmlFor="file-input"
                    className="inline-block bg-black text-white py-3 px-8 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-red-600 hover:shadow-[0_10px_25px_rgba(220,38,38,0.4)] active:translate-y-0"
                  >
                    Browse Files
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls,.zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-gray-400 text-sm mt-4">Supported formats: CSV, XLSX, XLS, ZIP</p>
                </>
              ) : (
                <div className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-gray-200">
                  <div className="text-red-600 flex-shrink-0">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-800 mb-1 break-all">{selectedFile.name}</h3>
                    <p className="text-sm text-gray-600 m-0">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    className="bg-red-100 border-none rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer transition-all duration-200 text-red-600 flex-shrink-0 hover:bg-red-400 hover:text-white hover:rotate-90 disabled:opacity-50"
                    onClick={handleRemove}
                    disabled={uploading}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {uploading && (
          <div className="flex items-center justify-center gap-3 p-4 bg-gray-100 border-2 border-black rounded-xl m-5">
            <svg className="animate-spin h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-semibold text-black">Processing your file...</span>
          </div>
        )}


        {result && (
          <div className="flex-1 overflow-auto flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 sticky top-0 z-20">
              {/* Logo */}
              <img src={zeonLogo} alt="Zeon Charging" className="h-8 w-auto" />

              {/* Success Message */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-black">Processing Complete!</h3>
              </div>

              {/* File Filter Dropdown */}
              {allResults && Object.keys(allResults).length > 1 && (
                <div className="ml-6 flex items-center gap-2 flex-1">
                  <label className="text-gray-700 text-sm font-semibold whitespace-nowrap">Filter by OEM:</label>
                  <select
                    value={currentFilter}
                    onChange={(e) => setCurrentFilter(e.target.value)}
                    className="bg-white text-black border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-red-600 outline-none max-w-[400px] truncate"
                  >
                    <option value="All Files">All Files (Aggregated)</option>
                    {Object.keys(allResults)
                      .filter(k => k !== 'All Files')
                      .sort()
                      .map(fileName => {
                        const data = allResults[fileName];
                        let oemName = 'Unknown';
                        try {
                          if (data && data.info) {
                            let info = data.info;
                            if (typeof info === 'string') info = JSON.parse(info);
                            if (Array.isArray(info) && info.length > 0) oemName = info[0]['OEM Name'] || 'Unknown';
                          }
                        } catch (e) { }

                        // Display 'OEM Name (Filename)' to ensure uniqueness and clarity
                        const label = oemName !== 'Unknown' ? `${oemName} (${fileName})` : fileName;

                        return (
                          <option key={fileName} value={fileName}>{label}</option>
                        );
                      })}
                  </select>
                </div>
              )}

              {/* Spacer for balance */}
              <div className="h-8 w-auto opacity-0">
                <img src={zeonLogo} alt="" className="h-8 w-auto" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 flex-1 overflow-auto">
              {/* Render tables for each connector - skip report_1, report_2, date, info */}
              {Object.entries(result)
                .filter(([key]) => !key.startsWith('report_') && key !== 'date' && key !== 'info') // Skip report_1, report_2, date, info
                .map(([connectorKey, connectorData]) => {
                  // Check if connectorData is an array of records
                  if (Array.isArray(connectorData) && connectorData.length > 0) {
                    // Get all unique keys from all objects in the array
                    const allKeys = new Set();
                    connectorData.forEach(item => {
                      if (typeof item === 'object') {
                        Object.keys(item).forEach(key => allKeys.add(key));
                      }
                    });
                    let headers = Array.from(allKeys);

                    // Custom column ordering and filtering
                    const startKey = headers.find(h => h.toUpperCase() === 'SESSION_START_TIME');
                    const endKey = headers.find(h => h.toUpperCase() === 'SESSION_END_TIME');

                    // specific columns to remove
                    const excludedKeys = ['IS_PREPARING'];
                    headers = headers.filter(h => !excludedKeys.includes(h.toUpperCase()) && h.toUpperCase() !== 'IS_PREPARING');

                    const orderedHeaders = [];
                    // Add Start Time first
                    if (startKey && headers.includes(startKey)) {
                      orderedHeaders.push(startKey);
                    }
                    // Add End Time second
                    if (endKey && headers.includes(endKey)) {
                      orderedHeaders.push(endKey);
                    }

                    // Add remaining columns
                    const remainingHeaders = headers.filter(h => h !== startKey && h !== endKey);
                    headers = [...orderedHeaders, ...remainingHeaders];

                    return (
                      <div key={connectorKey} className="bg-white border border-gray-300 overflow-hidden flex flex-col">
                        {/* Data Table */}
                        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)]">
                          <table className="w-full border-collapse">
                            <thead className="bg-black sticky top-0 z-10">
                              <tr>
                                <th className="px-2 py-1 text-left text-[10px] font-bold text-white uppercase border-r border-gray-700">
                                  #
                                </th>
                                {headers.map((header) => (
                                  <th key={header} className="px-2 py-1 text-left text-[10px] font-bold text-white uppercase border-r border-gray-700 last:border-r-0">
                                    {header.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {connectorData.map((record, idx) => (
                                <tr key={idx} className={`hover:bg-red-50 transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                  <td className="px-2 py-1 text-[10px] font-bold text-red-600 border-r border-gray-200">
                                    {idx + 1}
                                  </td>
                                  {headers.map((header) => {
                                    const value = record[header];
                                    return (
                                      <td key={header} className="px-2 py-1 text-[10px] text-gray-700 border-r border-gray-200 last:border-r-0">
                                        {value === null || value === undefined ? (
                                          <span className="text-gray-400 italic">null</span>
                                        ) : typeof value === 'object' ? (
                                          <pre className="text-[9px] bg-gray-100 p-1 rounded overflow-x-auto max-w-[100px]">
                                            {JSON.stringify(value, null, 2)}
                                          </pre>
                                        ) : typeof value === 'boolean' ? (
                                          <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {String(value)}
                                          </span>
                                        ) : typeof value === 'number' ? (
                                          <span className="font-mono font-semibold text-black">{value}</span>
                                        ) : (
                                          <span className="font-medium">{String(value)}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                  return null;
                  return null;
                })}
            </div>

            <div className="sticky bottom-0 flex gap-2 px-4 py-2 bg-gray-100 border-t-2 border-gray-300 z-10">
              <button
                onClick={() => {
                  const dataToPrint = currentFilter === 'All Files' ? allResults : result;
                  // Pass the filename if it's a single file
                  const filename = currentFilter === 'All Files' ? 'Combined_Report' : currentFilter;
                  generateChargerHealthPDF(dataToPrint, filename);
                }}
                className="flex-1 bg-red-600 text-white border-none py-3 px-6 rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 hover:bg-red-700 hover:shadow-[0_10px_25px_rgba(220,38,38,0.4)] active:translate-y-0 flex items-center justify-center gap-2 min-w-[200px]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Download PDF Report
              </button>

              <button
                onClick={() => setShowDashboard(true)}
                className="flex-1 bg-blue-600 text-white border-none py-3 px-6 rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:shadow-[0_10px_25px_rgba(37,99,235,0.4)] active:translate-y-0 flex items-center justify-center gap-2 min-w-[200px]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
                Analytics Dashboard
              </button>

              <button
                onClick={() => {
                  setAllResults(null);
                  setSelectedFile(null);
                }}
                className="flex-1 bg-white text-black border-2 border-black py-3 px-6 rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 hover:bg-black hover:text-white hover:shadow-[0_10px_25px_rgba(0,0,0,0.4)] active:translate-y-0 flex items-center justify-center gap-2 min-w-[200px]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Process Another File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Dashboard - Full Page */}
      {showDashboard && result && (
        <DashboardView
          result={result}
          onClose={() => setShowDashboard(false)}
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          allResults={allResults}
        />
      )}
    </div>
  );
}