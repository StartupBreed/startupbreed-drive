const styles = {
  active:   'bg-green-100 text-green-700 border-green-200',
  'on-hold': 'bg-amber-100 text-amber-700 border-amber-200',
  closed:   'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const labels = { active: 'Active', 'on-hold': 'On Hold', closed: 'Closed' };

export default function StatusBadge({ status = 'active' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles['on-hold']}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'active' ? 'bg-green-500' :
        status === 'closed' ? 'bg-indigo-500' : 'bg-amber-500'
      }`} />
      {labels[status] || status}
    </span>
  );
}
