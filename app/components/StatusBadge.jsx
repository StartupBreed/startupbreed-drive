const styles = {
  active:   'bg-green-100 text-green-700 border-green-200',
  paused:   'bg-amber-100 text-amber-700 border-amber-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  closed:   'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const labels = { active: 'Active', paused: 'Paused', inactive: 'Inactive', closed: 'Closed' };

export default function StatusBadge({ status = 'inactive' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'active' ? 'bg-green-500' :
        status === 'paused' ? 'bg-amber-500' :
        status === 'closed' ? 'bg-indigo-500' : 'bg-gray-400'
      }`} />
      {labels[status]}
    </span>
  );
}
