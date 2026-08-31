import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { ErrorBoundary } from "./ErrorBoundary";
import { BootSequence } from "./BootSequence";
const Overview = lazy(() => import("../features/overview/OverviewPage"));
const Incidents = lazy(() => import("../features/incidents/IncidentsPage"));
const IncidentDetail = lazy(
  () => import("../features/incidents/IncidentDetailPage"),
);
const Analysis = lazy(() => import("../features/imagery/AnalysisPage"));
const Vessels = lazy(() => import("../features/ais/VesselsPage"));
const Cases = lazy(() => import("../features/cases/CasesPage"));
const DataModels = lazy(() => import("../features/data-models/DataModelsPage"));
const Settings = lazy(() => import("../features/settings/SettingsPage"));
const Loading = () => (
  <div className="page-loading" role="status">
    <span className="spinner" />
    Loading operational view…
  </div>
);
export function App() {
  return (
    <ErrorBoundary>
      <BootSequence />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route
            path="overview"
            element={
              <Suspense fallback={<Loading />}>
                <Overview />
              </Suspense>
            }
          />
          <Route
            path="incidents"
            element={
              <Suspense fallback={<Loading />}>
                <Incidents />
              </Suspense>
            }
          />
          <Route
            path="incidents/:incidentId"
            element={
              <Suspense fallback={<Loading />}>
                <IncidentDetail />
              </Suspense>
            }
          />
          <Route
            path="analysis/:incidentId?"
            element={
              <Suspense fallback={<Loading />}>
                <Analysis />
              </Suspense>
            }
          />
          <Route
            path="vessels"
            element={
              <Suspense fallback={<Loading />}>
                <Vessels />
              </Suspense>
            }
          />
          <Route
            path="cases"
            element={
              <Suspense fallback={<Loading />}>
                <Cases />
              </Suspense>
            }
          />
          <Route
            path="data-models"
            element={
              <Suspense fallback={<Loading />}>
                <DataModels />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<Loading />}>
                <Settings />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
