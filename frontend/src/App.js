import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardMotionProvider from "./components/DashboardMotionProvider";
import ModeratorRoleOptionPatch from "./components/ModeratorRoleOptionPatch";
import AdminFinanceAccessApprovalWidget from "./components/AdminFinanceAccessApprovalWidget";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import ShowcasePage from "./pages/ShowcasePage";

import AdminDashboard from "./pages/AdminDashboard";
import AdminTasks from "./pages/AdminTasks";
import AdminCreateTask from "./pages/AdminCreateTask";
import AdminUsers from "./pages/AdminUsers";
import AdminCalendar from "./pages/AdminCalendar";
import AdminApprovals from "./pages/AdminApprovals";
import AdminPayments from "./pages/AdminPayments";

import Leaderboard from "./pages/Leaderboard";
import WorkflowSuite from "./pages/WorkflowSuiteSecure";

import EditorDashboard from "./pages/EditorDashboard";
import EditorAvailable from "./pages/EditorAvailable";
import EditorProjects from "./pages/EditorProjects";
import EditorPerformance from "./pages/EditorPerformance";
import EditorProfile from "./pages/EditorProfile";

import ClientDashboard from "./pages/ClientDashboard";
import ClientPanel from "./pages/ClientPanel";
import ClientCreateProject from "./pages/ClientCreateProject";

import ModeratorCommandOverview from "./pages/moderator/ModeratorCommandOverview";
import ModeratorTasks from "./pages/moderator/ModeratorTasks";
import ModeratorCreateTask from "./pages/moderator/ModeratorCreateTask";
import ModeratorCalendar from "./pages/moderator/ModeratorCalendar";
import {
  ModeratorProjects,
  ModeratorTeamWorkload,
  ModeratorClientMessages,
  ModeratorReviews,
  ModeratorEscalations,
  ModeratorProfile,
} from "./pages/moderator/ModeratorPages";
import ChatPage from "./pages/ChatPage";

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

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-zinc-950">
      <div className="text-zinc-500 text-sm font-mono">loading…</div>
    </div>
  );
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
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
