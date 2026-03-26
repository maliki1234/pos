"use client";

import React, { ReactNode, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { registerServiceWorker } from "@/lib/serviceWorkerRegistration";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSyncStore } from "@/stores/useSyncStore";
import { ThemeProvider } from "@/components/ThemeProvider";
import "react-toastify/dist/ReactToastify.css";

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const initializeSync = useSyncStore((state) => state.initializeSync);

  useEffect(() => {
    // Register service worker for offline support
    registerServiceWorker();

    // Restore auth session
    restoreSession();

    // Initialize sync
    initializeSync();
  }, []);

  return (
    <ThemeProvider>
      <>
        {children}
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </>
    </ThemeProvider>
  );
};
