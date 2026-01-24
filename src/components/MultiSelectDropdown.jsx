import React, { useState, useRef, useEffect } from 'react';

export default function MultiSelectDropdown({
    options = [],
    selectedValues = [],
    onChange,
    label = "Select",
    placeholder = "Search...",
    allLabel = "All Files"
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter options based on search
    const filteredOptions = options.filter(opt => {
        const label = String(opt.label || "").toLowerCase();
        const search = String(searchTerm || "").toLowerCase();
        return label.includes(search);
    });

    // Handle individual checkbox toggle
    const handleToggle = (value) => {
        if (value === 'All Files') {
            // If "All Files" is clicked, clear all selections
            onChange(['All Files']);
        } else {
            let newSelection;
            if (selectedValues.includes(value)) {
                // Remove the value
                newSelection = selectedValues.filter(v => v !== value);
                // If nothing selected, default to "All Files"
                if (newSelection.length === 0) {
                    newSelection = ['All Files'];
                }
            } else {
                // Add the value and remove "All Files" if it was there
                newSelection = [...selectedValues.filter(v => v !== 'All Files'), value];
            }
            onChange(newSelection);
        }
    };

    // Handle "Select All" / "Clear All"
    const handleSelectAll = () => {
        if (selectedValues.length === options.length - 1) {
            // All are selected, clear to "All Files"
            onChange(['All Files']);
        } else {
            // Select all except "All Files"
            onChange(options.filter(opt => opt.value !== 'All Files').map(opt => opt.value));
        }
    };

    // Display text
    const getDisplayText = () => {
        if (selectedValues.includes('All Files') || selectedValues.length === 0) {
            return allLabel;
        }
        if (selectedValues.length === 1) {
            const selected = options.find(opt => opt.value === selectedValues[0]);
            return selected ? selected.label : '';
        }
        return `${selectedValues.length} selected`;
    };

    const isAllSelected = selectedValues.length === options.filter(opt => opt.value !== 'All Files').length;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white text-black border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-red-600 outline-none min-w-[250px] flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <span className="truncate">{getDisplayText()}</span>
                <svg
                    className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-[400px] flex flex-col">
                    {/* Search Box */}
                    <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={placeholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none pr-8"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <svg
                                className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Select All / Clear All */}
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <button
                            onClick={handleSelectAll}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold"
                        >
                            {isAllSelected ? 'Clear All' : 'Select All'}
                        </button>
                        {!selectedValues.includes('All Files') && selectedValues.length > 0 && (
                            <button
                                onClick={() => onChange(['All Files'])}
                                className="text-xs text-gray-600 hover:text-gray-800 font-semibold"
                            >
                                ✕ Reset to All
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1 p-2">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => {
                                const isSelected = selectedValues.includes(option.value);
                                const isAllFilesOption = option.value === 'All Files';

                                return (
                                    <label
                                        key={option.value}
                                        className={`flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors ${isSelected ? 'bg-red-50' : ''
                                            }`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation(); // Stop event bubbling
                                                handleToggle(option.value);
                                            }}
                                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                        />
                                        <span className={`ml-2 text-sm ${isSelected ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
                                            {option.label}
                                        </span>
                                    </label>
                                );
                            })
                        ) : (
                            <div className="text-center py-4 text-sm text-gray-400">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
