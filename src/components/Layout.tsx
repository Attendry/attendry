"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Navigation/Sidebar";
import { MobileNavigation, MobileMenuButton } from "@/components/Navigation/MobileNavigation";
import { SkipLinks } from "@/components/Navigation/SkipLinks";
import { TopBar } from "@/components/TopBar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bypass app chrome for design preview routes
  if (pathname.startsWith("/designs")) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SkipLinks />
      
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          />
        </div>

        {/* Mobile Navigation */}
        <MobileNavigation 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
          <TopBar 
            onMenuClick={() => setIsMobileMenuOpen(true)}
            mobileMenuButton={<MobileMenuButton onClick={() => setIsMobileMenuOpen(true)} />}
          />
          <main 
            id="main-content"
            className="flex-1 p-4 lg:p-6 overflow-auto focus:outline-none"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
