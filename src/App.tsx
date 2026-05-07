import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import TransactionsPage from "./pages/TransactionsPage";
import OnboardingPage from "./pages/OnboardingPage";
import ReviewPage from "./pages/ReviewPage";
import TalkToDataPage from "./pages/TalkToDataPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import RulesPage from "./pages/RulesPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import HealthPage from "./pages/HealthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/transactions" replace />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/talk-to-data" element={<TalkToDataPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/health" element={<HealthPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
