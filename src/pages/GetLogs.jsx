import React, { useState } from 'react';
import { Calendar, Download, X } from 'lucide-react';
import zeonLogo from '../assets/zeon_charging.webp';

const GetLogs = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      const response = await fetch('http://localhost:3001/api/logs/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      // Download the zip file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${start.year}-${start.month}-${start.day}_to_${end.year}-${end.month}-${end.day}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

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
            {/* Date Selection Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date or Date Range
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
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Click on the date input to open the calendar</li>
            <li>Click a single date for logs from that day</li>
            <li>Click a start date, then an end date to select a range</li>
            <li>Logs will be downloaded as a zip file to your computer</li>
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
