export function NotAvailable({ title, message }: { title?: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4">
        <span className="text-2xl">📊</span>
      </div>
      <p className="font-semibold text-white">{title ?? 'Data not available'}</p>
      <p className="text-sm text-white/50 mt-1 max-w-xs">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <p className="font-semibold text-red-300">Something went wrong</p>
      <p className="text-sm text-white/50 mt-1 max-w-sm">{message}</p>
    </div>
  );
}
