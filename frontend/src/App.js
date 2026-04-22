import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTasks from "./pages/AdminTasks";
import AdminCreateTask from "./pages/AdminCreateTask";
import AdminUsers from "./pages/AdminUsers";
import AdminCalendar from "./pages/AdminCalendar";
import Leaderboard from "./pages/Leaderboard";
import EditorDashboard from "./pages/EditorDashboard";
import EditorAvailable from "./pages/EditorAvailable";
import EditorProjects from "./pages/EditorProjects";
import EditorPerformance from "./pages/EditorPerformance";
import ClientDashboard from "./pages/ClientDashboard";
import ChatPage from "./pages/ChatPage";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center bg-zinc-950"><div className="text-zinc-500 text-sm font-mono">loading…</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/tasks" element={<AdminTasks />} />
            <Route path="/admin/create" element={<AdminCreateTask />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/calendar" element={<AdminCalendar />} />
            <Route path="/admin/leaderboard" element={<Leaderboard allowed={["admin"]} />} />
            <Route path="/admin/chat" element={<ChatPage mode="admin" />} />

            <Route path="/editor" element={<EditorDashboard />} />
            <Route path="/editor/available" element={<EditorAvailable />} />
            <Route path="/editor/projects" element={<EditorProjects />} />
            <Route path="/editor/performance" element={<EditorPerformance />} />
            <Route path="/editor/leaderboard" element={<Leaderboard allowed={["editor"]} />} />
            <Route path="/editor/chat" element={<ChatPage mode="editor" />} />

            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/client/projects" element={<ClientDashboard />} />
            <Route path="/client/chat" element={<ChatPage mode="client" />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
