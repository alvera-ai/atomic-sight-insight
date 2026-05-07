import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import TransactionsPage from "./pages/TransactionsPage";
import DashboardPage from "./pages/DashboardPage";
import CasesPage from "./pages/CasesPage";
import OnboardingPage from "./pages/OnboardingPage";
import ReviewPage from "./pages/ReviewPage";
import TalkToDataPage from "./pages/TalkToDataPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import RulesPage from "./pages/RulesPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import HealthPage from "./pages/HealthPage";
import NotFound from "./pages/NotFound";
import { RouteGuard } from "@/components/auth/route-guard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route element={<RouteGuard />}>
              <Route path="/" element={<RoleHome />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/talk-to-data" element={<TalkToDataPage />} />
              <Route path="/recommendations" element={<RecommendationsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/health" element={<HealthPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
