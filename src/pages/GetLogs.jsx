import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Download, X } from 'lucide-react';
import zeonLogo from '../assets/zeon_charging.webp';

const GetLogs = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cpid, setCpid] = useState(''); // New state for CPID filter
  const [stationName, setStationName] = useState(''); // New state for station filter
  const [stationSearchInput, setStationSearchInput] = useState(''); // Search input for filtering stations
  const [showStationDropdown, setShowStationDropdown] = useState(false); // Show/hide dropdown
  const [stations, setStations] = useState([]); // List of all stations
  const [loadingStations, setLoadingStations] = useState(false);
  const [stationCpids, setStationCpids] = useState([]); // CPIDs available at selected station
  const [selectedStationCpids, setSelectedStationCpids] = useState([]); // Selected CPIDs from station (array)
  const [loadingStationCpids, setLoadingStationCpids] = useState(false);
  const stationDropdownRef = useRef(null); // Ref for the station dropdown container

  const daysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isInRange = (dateToCheck, start, end) => {
    if (!start || !end || !dateToCheck) return false;
    return dateToCheck >= start && dateToCheck <= end;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleQuickDateRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setSelectedDate(start);
    setSelectedEndDate(end);
    setError('');
  };

  // Fetch station names on component mount
  React.useEffect(() => {
    const fetchStations = async () => {
      setLoadingStations(true);
      try {
        const response = await fetch('/api/stations');
        if (response.ok) {
          const data = await response.json();
          setStations(data.stations || []);
        }
      } catch (err) {
        console.error('Failed to fetch stations:', err);
      } finally {
        setLoadingStations(false);
      }
    };
    fetchStations();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stationDropdownRef.current && !stationDropdownRef.current.contains(event.target)) {
        setShowStationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter stations based on search input
  const filteredStations = stations.filter(station =>
    stationSearchInput 
      ? station.toLowerCase().includes(stationSearchInput.toLowerCase())
      : true // Show all stations when input is empty
  );

  const handleStationSelect = async (station) => {
    setStationName(station);
    setStationSearchInput(station);
    setShowStationDropdown(false);
    if (station) {
      setCpid(''); // Clear manual CPID if station is selected
      setSelectedStationCpids([]); // Clear selected station CPIDs
      
      // Fetch CPIDs for this station
      setLoadingStationCpids(true);
      try {
        const response = await fetch(`/api/stations/${encodeURIComponent(station)}/cpids`);
        if (response.ok) {
          const data = await response.json();
          setStationCpids(data.cpids || []);
        } else {
          setStationCpids([]);
        }
      } catch (err) {
        console.error('Failed to fetch station CPIDs:', err);
        setStationCpids([]);
      } finally {
        setLoadingStationCpids(false);
      }
    } else {
      setStationCpids([]);
      setSelectedStationCpids([]);
    }
  };

  const handleCpidCheckboxChange = (cpid) => {
    setSelectedStationCpids(prev => {
      if (prev.includes(cpid)) {
        return prev.filter(c => c !== cpid);
      } else {
        return [...prev, cpid];
      }
    });
  };

  const handleSelectAllCpids = () => {
    setSelectedStationCpids(stationCpids.map(cpidInfo => cpidInfo.cpid));
  };

  const handleDeselectAllCpids = () => {
    setSelectedStationCpids([]);
  };

  const handleFetchData = async () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const startDate = selectedDate;
      const endDate = selectedEndDate || selectedDate;
      
      // Format dates for API call
      const formatForServer = (date) => ({
        year: date.getFullYear(),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        day: String(date.getDate()).padStart(2, '0')
      });

      const start = formatForServer(startDate);
      const end = formatForServer(endDate);

      // Call backend API to fetch and zip logs
      const response = await fetch('/api/logs/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          cpid: cpid.trim() || null, // Manual CPID entry
          cpids: selectedStationCpids.length > 0 ? selectedStationCpids : null, // Array of selected CPIDs
          stationName: (selectedStationCpids.length === 0 && !cpid.trim() && stationName) ? stationName : null // Send station name only if no CPIDs selected
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Failed to fetch logs: ${response.status}`);
      }

      // Download the zip file
      const blob = await response.blob();
      console.log('Blob size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('No log files found for the selected date(s)');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Create user-friendly filename
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = monthNames[parseInt(start.month) - 1];
      const endMonth = monthNames[parseInt(end.month) - 1];
      
      let filename;
      const filterPrefix = stationName ? stationName.replace(/[^a-zA-Z0-9]/g, '_') : cpid;
      if (start.year === end.year && start.month === end.month && start.day === end.day) {
        // Single date
        filename = filterPrefix ? `${filterPrefix}_${start.day}th_${startMonth}_${start.year}.zip` : `${start.day}th ${startMonth} ${start.year}.zip`;
      } else {
        // Date range
        filename = filterPrefix 
          ? `${filterPrefix}_${start.day}th_${startMonth}_to_${end.day}th_${endMonth}_${end.year}.zip`
          : `${start.day}th ${startMonth} to ${end.day}th ${endMonth} ${end.year}.zip`;
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      console.log('Download triggered successfully');
      setShowCalendar(false);
    } catch (err) {
      setError(err.message || 'Failed to download logs');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCalendarForMonth = (monthDate) => {
    const days = daysInMonth(monthDate);
    const firstDay = firstDayOfMonth(monthDate);
    const weeks = [];
    let week = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      week.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Add days of the month
    for (let day = 1; day <= days; day++) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const isSelected = isSameDay(date, selectedDate) || isSameDay(date, selectedEndDate);
      const inRange = selectedDate && selectedEndDate && isInRange(date, selectedDate, selectedEndDate);

      week.push(
        <button
          key={day}
          onClick={() => {
            const clickedDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
            
            if (!selectedDate || (selectedDate && selectedEndDate)) {
              // Start new selection
              setSelectedDate(clickedDate);
              setSelectedEndDate(null);
            } else {
              // Complete range selection
              if (clickedDate >= selectedDate) {
                setSelectedEndDate(clickedDate);
              } else {
                setSelectedEndDate(selectedDate);
                setSelectedDate(clickedDate);
              }
            }
          }}
          className={`
            p-2 text-center rounded hover:bg-gray-100 transition-colors
            ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
            ${inRange && !isSelected ? 'bg-blue-100' : ''}
          `}
        >
          {day}
        </button>
      );

      if (week.length === 7) {
        weeks.push(
          <div key={`week-${weeks.length}`} className="grid grid-cols-7 gap-1">
            {week}
          </div>
        );
        week = [];
      }
    }

    if (week.length > 0) {
      weeks.push(
        <div key={`week-${weeks.length}`} className="grid grid-cols-7 gap-1">
          {week}
        </div>
      );
    }

    return weeks;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={zeonLogo} alt="Zeon Logo" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Log Management</h1>
            </div>
            <a
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Download Server Logs</h2>
          
          <div className="space-y-4">
            {/* Station Name Filter Dropdown */}
            <div className="relative" ref={stationDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Station Name (Optional)
              </label>
              <input
                type="text"
                value={stationSearchInput}
                onChange={(e) => {
                  setStationSearchInput(e.target.value);
                  setShowStationDropdown(true);
                  if (!e.target.value) {
                    setStationName('');
                  }
                }}
                onFocus={() => setShowStationDropdown(true)}
                placeholder="Click to see all stations or type to search... (408 available)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loadingStations}
              />
              
              {/* Dropdown with filtered stations */}
              {showStationDropdown && loadingStations && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm text-gray-500 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading stations...
                  </div>
                </div>
              )}
              
              {showStationDropdown && !loadingStations && filteredStations.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                  <div className="sticky top-0 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 border-b-2 border-blue-200 z-10">
                    Showing {Math.min(100, filteredStations.length)} of {filteredStations.length} stations
                  </div>
                  {filteredStations.slice(0, 100).map((station, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStationSelect(station)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 active:bg-blue-100 border-b border-gray-100 last:border-b-0 text-sm transition-colors"
                    >
                      <span className="block truncate">{station}</span>
                    </button>
                  ))}
                  {filteredStations.length > 100 && (
                    <div className="sticky bottom-0 px-4 py-2 text-xs font-medium text-gray-600 bg-yellow-50 border-t-2 border-yellow-200 z-10">
                      ⚠️ {filteredStations.length - 100} more stations available. Type to filter results.
                    </div>
                  )}
                </div>
              )}
              
              {/* Show message if no stations loaded */}
              {showStationDropdown && !loadingStations && filteredStations.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm text-gray-500 text-center">
                  {stationSearchInput ? 'No stations match your search' : 'No stations available'}
                </div>
              )}
              
              {/* Clear button */}
              {stationSearchInput && (
                <button
                  onClick={() => {
                    setStationSearchInput('');
                    setStationName('');
                    setShowStationDropdown(false);
                  }}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              <p className="mt-1 text-xs text-gray-500">
                {loadingStations 
                  ? 'Loading stations...' 
                  : stationName 
                  ? `✓ Selected: ${stationName}` 
                  : `Click to view all ${stations.length} stations or type to filter`}
              </p>
            </div>

            {/* Station CPIDs Filter - Shows when station is selected */}
            {stationName && stationCpids.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Charge Points from Station (Optional)
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                  {/* Select All / Deselect All buttons */}
                  <div className="flex gap-2 mb-3 pb-3 border-b border-gray-300">
                    <button
                      type="button"
                      onClick={handleSelectAllCpids}
                      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium"
                    >
                      Select All ({stationCpids.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllCpids}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                  
                  {/* Checkboxes for each CPID */}
                  <div className="space-y-2">
                    {stationCpids.map((cpidInfo, idx) => (
                      <label
                        key={idx}
                        className="flex items-center space-x-3 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStationCpids.includes(cpidInfo.cpid)}
                          onChange={() => handleCpidCheckboxChange(cpidInfo.cpid)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{cpidInfo.displayName}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {loadingStationCpids 
                    ? 'Loading charge points...' 
                    : selectedStationCpids.length > 0
                    ? `✓ Selected ${selectedStationCpids.length} CPID${selectedStationCpids.length > 1 ? 's' : ''}: ${selectedStationCpids.join(', ')}` 
                    : `Select specific charge point(s) or leave empty to download all ${stationCpids.length} CPIDs from this station`}
                </p>
              </div>
            )}

            {stationName && stationCpids.length === 0 && !loadingStationCpids && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                ⚠️ No charge points found for this station.
              </div>
            )}

            {/* CPID Filter Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OR Filter by Charge Point ID (Optional)
              </label>
              <input
                type="text"
                value={cpid}
                onChange={(e) => {
                  setCpid(e.target.value);
                  if (e.target.value) {
                    setStationName(''); // Clear station if CPID is entered
                    setStationSearchInput('');
                    setShowStationDropdown(false);
                    setStationCpids([]);
                    setSelectedStationCpids([]);
                  }
                }}
                placeholder="e.g., 100028 or ocpp_100028"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!!stationName}
              />
              <p className="mt-1 text-xs text-gray-500">Enter a specific CPID (disabled when station is selected)</p>
            </div>

            {/* Quick Date Range Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Date Range
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickDateRange(7)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => handleQuickDateRange(15)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Last 15 Days
                </button>
                <button
                  onClick={() => handleQuickDateRange(30)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => handleQuickDateRange(60)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Last 60 Days
                </button>
              </div>
            </div>

            {/* Date Selection Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date or Date Range (Custom)
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={
                    selectedDate && selectedEndDate
                      ? `${formatDate(selectedDate)} - ${formatDate(selectedEndDate)}`
                      : selectedDate
                      ? formatDate(selectedDate)
                      : ''
                  }
                  placeholder="Click to select date"
                  onClick={() => setShowCalendar(true)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                />
                <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Fetch Button */}
            <div className="flex gap-3">
              <button
                onClick={handleFetchData}
                disabled={!selectedDate || isLoading}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-medium
                  ${!selectedDate || isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                <Download className="h-4 w-4" />
                {isLoading ? 'Downloading...' : 'Fetch Data'}
              </button>
              
              {selectedDate && (
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedEndDate(null);
                    setCpid('');
                    setStationName('');
                    setStationSearchInput('');
                    setShowStationDropdown(false);
                    setStationCpids([]);
                    setSelectedStationCpids([]);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Station Filter:</strong> Select a station name to see all charge points at that location</li>
            <li><strong>Station CPID Checkboxes:</strong> After selecting a station, check specific charge point(s) you want to download (or leave all unchecked for all CPIDs)</li>
            <li><strong>Manual CPID Filter:</strong> Or enter a specific Charge Point ID directly (bypasses station selection)</li>
            <li><strong>Date Range:</strong> Use quick buttons (Last 7, 15, 30, 60 days) or click the date input for custom selection</li>
            <li>Click a single date for logs from that day, or select start and end dates for a range</li>
            <li>Leave all filters empty to download all logs for the selected date range</li>
            <li>Logs are downloaded as a zip file containing CSV files in format: ocpp_[CPID]_[DATE].csv</li>
          </ul>
        </div>
      </main>

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Please choose a date or date range to view data
              </h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded"
              >
                ←
              </button>
              <div className="flex gap-8">
                <h4 className="text-lg font-semibold">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h4>
                <h4 className="text-lg font-semibold">
                  {new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h4>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded"
              >
                →
              </button>
            </div>

            {/* Two Month View */}
            <div className="grid grid-cols-2 gap-8">
              {/* First Month */}
              <div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-600 p-2">
                      {day}
                    </div>
                  ))}
                </div>
                {renderCalendarForMonth(currentMonth)}
              </div>

              {/* Second Month */}
              <div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={`next-${day}`} className="text-center text-sm font-semibold text-gray-600 p-2">
                      {day}
                    </div>
                  ))}
                </div>
                {renderCalendarForMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCalendar(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCalendar(false);
                  handleFetchData();
                }}
                disabled={!selectedDate || isLoading}
                className={`
                  px-6 py-2 rounded-lg font-medium
                  ${!selectedDate || isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                Fetch Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GetLogs;
