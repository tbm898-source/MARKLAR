import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthGate } from "./components/AdminAuthGate.js";
import { AdminPage } from "./pages/AdminPage.js";
import { AdminLoginPage } from "./pages/AdminLoginPage.js";
import { ConfirmScreen } from "./pages/ConfirmScreen.js";
import { WorkerForm } from "./pages/WorkerForm.js";
import { SetupPage } from "./pages/SetupPage.js";
import { WorkerHome } from "./pages/WorkerHome.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/worker" replace />} />
      <Route path="/worker" element={<WorkerHome />} />
      <Route path="/worker/form/:action" element={<WorkerForm />} />
      <Route path="/worker/confirm" element={<ConfirmScreen />} />
      <Route
        path="/admin"
        element={
          <AdminAuthGate>
            <AdminPage />
          </AdminAuthGate>
        }
      />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
    </Routes>
  );
}
