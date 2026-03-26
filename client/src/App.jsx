import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Room from "./Room";
import Home from "./Home";
import GlobalRoom from "./GlobalRoom";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/global" element={<GlobalRoom />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </Router>
  );
}