import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/App";
import { Toaster } from "@/components/sodium/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";
import { queryClient } from "@/lib/query";
import { SodiumPortalProvider } from "@/lib/sodium/portal";
import "./index.css";
import "@/components/sodium/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SodiumPortalProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster />
        </SodiumPortalProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
