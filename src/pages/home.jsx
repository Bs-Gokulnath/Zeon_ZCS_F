import React, { useState } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' || 
        file.type === 'application/vnd.ms-excel' || 
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/zip' ||
        file.type === 'application/x-zip-compressed')) {
      setSelectedFile(file);
      setResult(null);
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
    } else {
      alert('Please upload a valid Excel, CSV, or ZIP file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:5001/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        alert('File processed successfully!');
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-12 max-w-2xl w-full shadow-2xl animate-[slideUp_0.5s_ease-out]">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 text-center">Charger Health Report</h1>
        <p className="text-base text-gray-600 text-center mb-8">Upload your Excel, CSV, or ZIP file to generate the report</p>
        
        <div 
          className={`border-3 border-dashed rounded-2xl py-12 px-6 text-center transition-all duration-300 cursor-pointer relative ${
            isDragging 
              ? 'border-indigo-500 bg-teal-50 scale-105' 
              : 'border-gray-300 bg-gray-50 hover:border-indigo-500 hover:bg-gray-100'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!selectedFile ? (
            <>
              <div className="text-indigo-500 mx-auto mb-4 flex justify-center">
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
                className="inline-block bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 px-8 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(102,126,234,0.4)] active:translate-y-0"
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
              <div className="text-indigo-500 flex-shrink-0">
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

        {selectedFile && (
          <button 
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none py-4 rounded-xl text-lg font-semibold cursor-pointer mt-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(102,126,234,0.4)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Processing...' : 'Generate Report'}
          </button>
        )}

        {result && (
          <div className="mt-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
            <h3 className="text-lg font-semibold text-green-800 mb-2">✓ Success!</h3>
            <p className="text-green-700 mb-2">{result.message}</p>
            <p className="text-sm text-green-600">Files processed: {result.filesProcessed}</p>
            <p className="text-sm text-green-600">Total records: {result.data?.totalRecords || 0}</p>
          </div>
        )}
      </div>
    </div>
  );
}