interface QuickReportsBarProps {
  onSelectPeriod: (period: string) => void;
}

const QuickReportsBar = ({ onSelectPeriod }: QuickReportsBarProps) => {
  const quickReports = [
    { label: 'This Week', value: 'thisWeek' },
    { label: 'Last Week', value: 'lastWeek' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'This Quarter', value: 'thisQuarter' },
    { label: 'Last Quarter', value: 'lastQuarter' },
    { label: 'This Year', value: 'thisYear' },
    { label: 'Last Year', value: 'lastYear' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {quickReports.map((report) => (
        <button
          key={report.value}
          onClick={() => onSelectPeriod(report.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {report.label}
        </button>
      ))}
    </div>
  );
};

export default QuickReportsBar;

