import { BrowserRouter, Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.tsx";
import SpaceList from "./pages/SpaceList.tsx";
import SpacePage from "./pages/SpacePage.tsx";
import AdminCreateSpace from "./pages/AdminCreateSpace.tsx";
import EditProfile from "./pages/EditProfile.tsx";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="page-shell">
        <Routes>
          <Route path="/" element={<SpaceList />} />
          <Route path="/space/:slug" element={<SpacePage />} />
          <Route path="/space/:slug/edit" element={<EditProfile />} />
          <Route path="/admin/create" element={<AdminCreateSpace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
