import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-50 h-8"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        <Outlet />
      </main>
    </div>
  );
}
