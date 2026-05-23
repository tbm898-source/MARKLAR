import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage.js";
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
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/setup" element={<SetupPage />} />
    </Routes>
  );
}
