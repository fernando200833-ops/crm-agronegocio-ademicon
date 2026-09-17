import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import { trpc } from "./lib/trpc";
import { Loader2 } from "lucide-react";

function ProtectedApp() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B4D3E]" />
        <p className="text-xs font-medium text-[#5C727D]">Carregando ambiente seguro...</p>
      </div>
    );
  }

  if (!meQuery.data) {
    return <AuthPage onAuthenticated={() => meQuery.refetch()} />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ProtectedApp />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
