import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardMotionProvider from "./components/DashboardMotionProvider";
import ModeratorRoleOptionPatch from "./components/ModeratorRoleOptionPatch";
import AdminFinanceAccessApprovalWidget from "./components/AdminFinanceAccessApprovalWidget";
import AdminModeratorEscalationNotes from "./components/AdminModeratorEscalationNotes";
import LoadingScreen from "./components/LoadingScreen";

// Route-level code splitting: each page is fetched only when its route is
// first visited, so the initial load no longer bundles every dashboard.
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const ShowcasePage = lazy(() => import("./pages/ShowcasePage"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminTasks = lazy(() => import("./pages/AdminTasks"));
const AdminCreateTask = lazy(() => import("./pages/AdminCreateTask"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminCalendar = lazy(() => import("./pages/AdminCalendar"));
const AdminApprovals = lazy(() => import("./pages/AdminApprovals"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));

const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const WorkflowSuite = lazy(() => import("./pages/WorkflowSuiteSecure"));

const EditorDashboard = lazy(() => import("./pages/EditorDashboard"));
const EditorAvailable = lazy(() => import("./pages/EditorAvailable"));
const EditorProjects = lazy(() => import("./pages/EditorProjects"));
const EditorPerformance = lazy(() => import("./pages/EditorPerformance"));
const EditorProfile = lazy(() => import("./pages/EditorProfile"));

const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const ClientPanel = lazy(() => import("./pages/ClientPanel"));
const ClientCreateProject = lazy(() => import("./pages/ClientCreateProject"));

const ModeratorCommandOverview = lazy(() => import("./pages/moderator/ModeratorCommandOverview"));
const ModeratorTasks = lazy(() => import("./pages/moderator/ModeratorTasks"));
const ModeratorCreateTask = lazy(() => import("./pages/moderator/ModeratorCreateTask"));
const ModeratorCalendar = lazy(() => import("./pages/moderator/ModeratorCalendar"));
const ModeratorEscalations = lazy(() => import("./pages/moderator/ModeratorEscalations"));
const ModeratorProjects = lazy(() => import("./pages/moderator/ModeratorPages").then((m) => ({ default: m.ModeratorProjects })));
const ModeratorTeamWorkload = lazy(() => import("./pages/moderator/ModeratorPages").then((m) => ({ default: m.ModeratorTeamWorkload })));
const ModeratorClientMessages = lazy(() => import("./pages/moderator/ModeratorPages").then((m) => ({ default: m.ModeratorClientMessages })));
const ModeratorReviews = lazy(() => import("./pages/moderator/ModeratorPages").then((m) => ({ default: m.ModeratorReviews })));
const ModeratorProfile = lazy(() => import("./pages/moderator/ModeratorPages").then((m) => ({ default: m.ModeratorProfile })));
const ChatPage = lazy(() => import("./pages/ChatPage"));

function PermanentDarkMode() {
  useEffect(() => {
    document.documentElement.setAttribute("data-mh-theme", "dark");
    try {
      localStorage.setItem("motionholic_os_theme", "dark");
    } catch {
      // Dark mode remains the permanent UI default.
    }
  }, []);
  return null;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || !user.role) return <Navigate to="/login" replace />;
  const validRoles = ["admin", "editor", "client", "moderator"];
  if (!validRoles.includes(user.role)) return <Navigate to="/login" replace />;
  if (user.role === "moderator") return <Navigate to="/moderator/overview" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || !user.role) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ModRoute({ children }) {
  return <ProtectedRoute allowedRoles={["moderator"]}>{children}</ProtectedRoute>;
}

function AdminOverviewRoute() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboard />
      <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-6 lg:ml-[228px] lg:px-7">
        <AdminFinanceAccessApprovalWidget embedded />
        <AdminModeratorEscalationNotes />
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <div className="App">
      <PermanentDarkMode />
      <ModeratorRoleOptionPatch />
      <AuthProvider>
        <BrowserRouter>
          <DashboardMotionProvider />
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/showcase" element={<ShowcasePage />} />
              <Route path="/admin" element={<AdminOverviewRoute />} />
              <Route path="/admin/workflow" element={<ProtectedRoute allowedRoles={["admin"]}><WorkflowSuite /></ProtectedRoute>} />
              <Route path="/admin/tasks" element={<ProtectedRoute allowedRoles={["admin"]}><AdminTasks /></ProtectedRoute>} />
              <Route path="/admin/create" element={<ProtectedRoute allowedRoles={["admin"]}><AdminCreateTask /></ProtectedRoute>} />
              <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={["admin"]}><AdminApprovals /></ProtectedRoute>} />
              <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPayments /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/calendar" element={<ProtectedRoute allowedRoles={["admin"]}><AdminCalendar /></ProtectedRoute>} />
              <Route path="/admin/leaderboard" element={<ProtectedRoute allowedRoles={["admin"]}><Leaderboard allowed={["admin"]} /></ProtectedRoute>} />
              <Route path="/admin/chat" element={<ProtectedRoute allowedRoles={["admin"]}><ChatPage mode="admin" /></ProtectedRoute>} />

              <Route path="/moderator" element={<Navigate to="/moderator/overview" replace />} />
              <Route path="/moderator/overview" element={<ModRoute><ModeratorCommandOverview /></ModRoute>} />
              <Route path="/moderator/workflow" element={<ModRoute><WorkflowSuite /></ModRoute>} />
              <Route path="/moderator/projects" element={<ModRoute><ModeratorProjects /></ModRoute>} />
              <Route path="/moderator/tasks" element={<ModRoute><ModeratorTasks /></ModRoute>} />
              <Route path="/moderator/create" element={<ModRoute><ModeratorCreateTask /></ModRoute>} />
              <Route path="/moderator/team-workload" element={<ModRoute><ModeratorTeamWorkload /></ModRoute>} />
              <Route path="/moderator/client-messages" element={<ModRoute><ModeratorClientMessages /></ModRoute>} />
              <Route path="/moderator/reviews" element={<ModRoute><ModeratorReviews /></ModRoute>} />
              <Route path="/moderator/escalations" element={<ModRoute><ModeratorEscalations /></ModRoute>} />
              <Route path="/moderator/calendar" element={<ModRoute><ModeratorCalendar /></ModRoute>} />
              <Route path="/moderator/chat" element={<ModRoute><ChatPage mode="moderator" /></ModRoute>} />
              <Route path="/moderator/profile" element={<ModRoute><ModeratorProfile /></ModRoute>} />

              <Route path="/editor" element={<ProtectedRoute allowedRoles={["editor"]}><EditorDashboard /></ProtectedRoute>} />
              <Route path="/editor/workflow" element={<ProtectedRoute allowedRoles={["editor"]}><WorkflowSuite /></ProtectedRoute>} />
              <Route path="/editor/profile" element={<ProtectedRoute allowedRoles={["editor"]}><EditorProfile /></ProtectedRoute>} />
              <Route path="/editor/available" element={<ProtectedRoute allowedRoles={["editor"]}><EditorAvailable /></ProtectedRoute>} />
              <Route path="/editor/projects" element={<ProtectedRoute allowedRoles={["editor"]}><EditorProjects /></ProtectedRoute>} />
              <Route path="/editor/performance" element={<ProtectedRoute allowedRoles={["editor"]}><EditorPerformance /></ProtectedRoute>} />
              <Route path="/editor/leaderboard" element={<ProtectedRoute allowedRoles={["editor"]}><Leaderboard allowed={["editor"]} /></ProtectedRoute>} />
              <Route path="/editor/chat" element={<ProtectedRoute allowedRoles={["editor"]}><ChatPage mode="editor" /></ProtectedRoute>} />
              <Route path="/client" element={<ProtectedRoute allowedRoles={["client"]}><ClientDashboard /></ProtectedRoute>} />
              <Route path="/client/workflow" element={<ProtectedRoute allowedRoles={["client"]}><WorkflowSuite /></ProtectedRoute>} />
              <Route path="/client/projects" element={<ProtectedRoute allowedRoles={["client"]}><ClientDashboard /></ProtectedRoute>} />
              <Route path="/client/panel" element={<ProtectedRoute allowedRoles={["client"]}><ClientPanel /></ProtectedRoute>} />
              <Route path="/client/create" element={<ProtectedRoute allowedRoles={["client"]}><ClientCreateProject /></ProtectedRoute>} />
              <Route path="/client/chat" element={<ProtectedRoute allowedRoles={["client"]}><ChatPage mode="client" /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
