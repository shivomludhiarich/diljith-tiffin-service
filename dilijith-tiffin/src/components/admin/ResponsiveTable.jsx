/**
 * A real <table> from the md breakpoint up (scrolls sideways if it must), and stacked cards on phones.
 * columns: [{ key, label, render(row), primary?, actions?, className? }]
 */
export default function ResponsiveTable({ columns, rows, rowKey, minWidth = 'min-w-[900px]', caption }) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const actions = columns.find((c) => c.actions);
  const details = columns.filter((c) => c !== primary && c !== actions);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
        <table className={`w-full text-left text-sm ${minWidth}`}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-line bg-bg2 text-xs font-bold text-muted">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className="whitespace-nowrap px-4 py-3">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-middle hover:bg-bg/60">
                {columns.map((c) => <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border border-line bg-white p-4">
            <div className="font-semibold">{primary.render(row)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {details.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-xs font-semibold text-muted">{c.label}</dt>
                  <dd className="break-words">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-4 flex flex-wrap gap-2">{actions.render(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
