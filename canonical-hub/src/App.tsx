import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { DoctrinePage } from "./pages/DoctrinePage";
import { PeoplePage } from "./pages/PeoplePage";
import { ToolsPage } from "./pages/ToolsPage";
import { InboxPage } from "./pages/InboxPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="doctrine" element={<DoctrinePage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="inbox" element={<InboxPage />} />
      </Route>
    </Routes>
  );
}
