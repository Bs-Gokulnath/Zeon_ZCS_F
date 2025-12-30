import React, { useState } from 'react';
import { generateChargerHealthPDF } from '../utils/pdfGenerator';
import zeonLogo from '../assets/zeon_charging.webp';
import { AuthenticationPieChart, UsageReadinessFunnelChart, PowerQualityLineChart } from './report_graphs';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed')) {
      setSelectedFile(file);
      setResult(null);
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
      setResult(null);
      // Auto-upload the file
      handleUpload(file);
    } else {
      alert('Please upload a valid Excel, CSV, or ZIP file');
    }
  };

  const handleUpload = async (file) => {
    const fileToUpload = file || selectedFile;
    if (!fileToUpload) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const response = await fetch('/api/process-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      setResult(data);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Error: ${error.message}`);
      setResult(null);
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setResult(null);
  };

  return (
    <div className="h-screen overflow-hidden">
      <div className={`bg-white w-full h-full flex flex-col ${result ? 'p-0' : 'flex items-center justify-center p-5'}`}>
        {!result && (
          <div className="max-w-2xl w-full bg-white rounded-2xl p-12 shadow-[0_0_50px_rgba(0,0,0,0.1)] border-2 border-black animate-[slideUp_0.5s_ease-out]">
            {/* Zeon Logo */}
            <div className="flex justify-center mb-6">
              <img src={zeonLogo} alt="Zeon Charging" className="h-16 w-auto" />
            </div>

            <h1 className="text-4xl font-bold text-black mb-2 text-center">Charger Health Report</h1>
            <p className="text-base text-gray-700 text-center mb-8">Upload your Excel, CSV, or ZIP file to generate the report</p>

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
            <div className="flex items-center justify-between px-4 py-2 bg-black sticky top-0 z-20">
              {/* Logo */}
              <img src={zeonLogo} alt="Zeon Charging" className="h-8 w-auto" />

              {/* Success Message */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white">Processing Complete!</h3>
              </div>

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
                    const headers = Array.from(allKeys);

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
                  } else if (typeof connectorData === 'object' && connectorData !== null) {
                    // If it's a single object, display as key-value pairs
                    return (
                      <div key={connectorKey} className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-indigo-200">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                          <h4 className="text-xl font-bold text-white uppercase tracking-wide">{connectorKey}</h4>
                        </div>
                        <div className="p-6">
                          <table className="w-full">
                            <tbody className="divide-y divide-gray-200">
                              {Object.entries(connectorData).map(([key, value]) => (
                                <tr key={key} className="hover:bg-indigo-50">
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 w-1/3">
                                    {key.replace(/_/g, ' ')}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {typeof value === 'object' ? (
                                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                        {JSON.stringify(value, null, 2)}
                                      </pre>
                                    ) : (
                                      <span className="font-medium">{String(value)}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
            </div>

            <div className="sticky bottom-0 flex gap-2 px-4 py-2 bg-gray-100 border-t-2 border-gray-300 z-10">
              <button
                onClick={() => generateChargerHealthPDF(result)}
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
                  setResult(null);
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
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          {/* Dashboard Header */}
          <div className="bg-white border-b-2 border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img src={zeonLogo} alt="Zeon" className="h-12 w-auto" />
                <h2 className="text-3xl font-bold text-black flex items-center gap-2">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                  </svg>
                  Analytics Dashboard
                </h2>
              </div>
              <button
                onClick={() => setShowDashboard(false)}
                className="flex items-center gap-2 bg-gray-100 hover:bg-red-600 text-gray-700 hover:text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Results
              </button>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="max-w-7xl mx-auto p-8">
            {/* Section 1: Charger Usage & Readiness - Funnel Charts */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                1. Charger Usage & Readiness
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Combined Charger Funnel */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-red-500 hover:shadow-2xl transition-all duration-300">
                  <h3 className="text-2xl font-bold mb-4 text-center text-gray-800 border-b-4 border-red-500 pb-3">
                    Combined Charger
                  </h3>
                  <div className="flex justify-center">
                    <UsageReadinessFunnelChart
                      preparing={(result.report_1?.['Preparing Sessions'] || 0) + (result.report_2?.['Preparing Sessions'] || 0)}
                      charging={(result.report_1?.['Charging Sessions'] || 0) + (result.report_2?.['Charging Sessions'] || 0)}
                      positiveStops={(result.report_1?.['Successful Sessions'] || 0) + (result.report_2?.['Successful Sessions'] || 0)}
                      width={300}
                      height={280}
                    />
                  </div>
                </div>

                {/* Connector 1 Funnel */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-blue-500 hover:shadow-2xl transition-all duration-300">
                  <h3 className="text-2xl font-bold mb-4 text-center text-gray-800 border-b-4 border-blue-500 pb-3">
                    Connector 1
                  </h3>
                  <div className="flex justify-center">
                    <UsageReadinessFunnelChart
                      preparing={result.report_1?.['Preparing Sessions'] || 0}
                      charging={result.report_1?.['Charging Sessions'] || 0}
                      positiveStops={result.report_1?.['Successful Sessions'] || 0}
                      width={300}
                      height={280}
                    />
                  </div>
                </div>

                {/* Connector 2 Funnel */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-green-500 hover:shadow-2xl transition-all duration-300">
                  <h3 className="text-2xl font-bold mb-4 text-center text-gray-800 border-b-4 border-green-500 pb-3">
                    Connector 2
                  </h3>
                  <div className="flex justify-center">
                    <UsageReadinessFunnelChart
                      preparing={result.report_2?.['Preparing Sessions'] || 0}
                      charging={result.report_2?.['Charging Sessions'] || 0}
                      positiveStops={result.report_2?.['Successful Sessions'] || 0}
                      width={300}
                      height={280}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Authentication Methods - Combined Pie Chart */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6m0 6v6" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                2. Authentication Methods
              </h2>
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-300 hover:shadow-2xl transition-all duration-300 max-w-xl">
                  <h3 className="text-2xl font-bold mb-6 text-center text-gray-800 border-b-4 border-blue-500 pb-3">
                    Combined Connectors
                  </h3>
                  <div className="flex justify-center">
                    <AuthenticationPieChart
                      remoteStart={(result.report_1?.['Remote Start'] || 0) + (result.report_2?.['Remote Start'] || 0)}
                      autoCharge={(result.report_1?.['Auto Start'] || 0) + (result.report_2?.['Auto Start'] || 0)}
                      rfid={(result.report_1?.['RFID Start'] || 0) + (result.report_2?.['RFID Start'] || 0)}
                      width={350}
                      height={350}
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm font-semibold text-gray-700">Authentication Method Distribution</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Power & Charging Quality - Line Chart */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                3. Power & Charging Quality
              </h2>
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-300 hover:shadow-2xl transition-all duration-300">
                  <PowerQualityLineChart
                    peakPowerData={[
                      { monthIndex: 0, value: result.report_1?.['Peak Power Delivered (kW)'] || 0 },
                      { monthIndex: 11, value: result.report_2?.['Peak Power Delivered (kW)'] || 0 }
                    ]}
                    avgPowerData={[
                      { monthIndex: 0, value: result.report_1?.['Avg Power per Session (kW)'] || 0 },
                      { monthIndex: 11, value: result.report_2?.['Avg Power per Session (kW)'] || 0 }
                    ]}
                    width={700}
                    height={400}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowDashboard(false)}
                className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}