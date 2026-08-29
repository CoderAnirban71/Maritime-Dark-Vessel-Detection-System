import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopHeader } from './TopHeader';
import { SidebarNav } from './SidebarNav';
import { motion, AnimatePresence } from 'motion/react';

export function Layout() {
  const location = useLocation();
  const [globalSearch, setGlobalSearch] = useState('');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0B0F0E] text-[#E8EFEC] font-sans">
      {/* 1. Operational Top Console Header */}
      <TopHeader searchQuery={globalSearch} onSearchChange={setGlobalSearch} />

      {/* 2. Main Body with Sidebar + Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />

        <main className="flex-1 overflow-hidden relative bg-[#080C0B]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="h-full w-full overflow-hidden"
            >
              <Outlet context={{ globalSearch }} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
