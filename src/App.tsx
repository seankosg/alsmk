import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import MyDashboard from "./pages/MyDashboard";
import Workspace from "./pages/Workspace";
import Organization from "./pages/Organization";
import Admin from "./pages/Admin";
import TaskImport from "./pages/TaskImport";
import Messages from "./pages/Messages";
import Calendar from "./pages/Calendar";
import CpmScheduler from "./pages/CpmScheduler";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public route – outside AppLayout */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes – inside AppLayout (auth guard) */}
          <Route
            path="/*"
            element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/my" element={<MyDashboard />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/organization" element={<Organization />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/tasks/import" element={<TaskImport />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/cpm" element={<div />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
