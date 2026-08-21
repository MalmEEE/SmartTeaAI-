export function NotAvailable({ title, message }: { title?: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--cream-d)] flex items-center justify-center mb-4">
        <span className="text-2xl">📊</span>
      </div>
      <p className="font-semibold text-[var(--text)]">{title ?? 'Data not available'}</p>
      <p className="text-sm text-[var(--muted)] mt-1 max-w-xs">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <p className="font-semibold text-[#C0392B]">Something went wrong</p>
      <p className="text-sm text-[var(--muted)] mt-1 max-w-sm">{message}</p>
    </div>
  );
}
