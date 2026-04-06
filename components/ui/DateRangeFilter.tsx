import React from 'react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
  return (
    <div className="flex items-center space-x-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200/80">
      <div className="flex-1">
        <label htmlFor="startDate" className="sr-only">Data Início</label>
        <input
          type="date"
          id="startDate"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full p-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      <span className="text-slate-400">-</span>
      <div className="flex-1">
        <label htmlFor="endDate" className="sr-only">Data Fim</label>
        <input
          type="date"
          id="endDate"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full p-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
    </div>
  );
};

export default DateRangeFilter;
