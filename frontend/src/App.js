import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Extractions from "@/pages/Extractions";
import JobDetail from "@/pages/JobDetail";
import History from "@/pages/History";
import Schedules from "@/pages/Schedules";
import Users from "@/pages/Users";

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Extractions />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/history" element={<History />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/users" element={<Users />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
