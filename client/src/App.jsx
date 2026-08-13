import { Routes, Route, Outlet, Navigate } from 'react-router-dom';

import TabBar from './components/TabBar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Console from './pages/Console.jsx';
import Whitelist from './pages/Whitelist.jsx';
import Logs from './pages/Logs.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* replace를 붙이는 이유: 이 리다이렉트를 히스토리에 쌓지 않는다. 쌓이면
          /login에서 뒤로가기를 눌렀을 때 /로 갔다가 다시 /login으로 튕겨서 갇힌다. */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Login만 탭바 바깥에 있다. 아직 로그인하지 않은 화면에 다른 탭을 띄울 이유가 없다. */}
      <Route path="/login" element={<Login />} />

      {/* path 없는 Route는 주소를 갖지 않고 감싸는 역할만 한다. 안쪽 네 화면은
          공통으로 TabBar를 얹고, Outlet 자리에 현재 경로의 화면이 들어간다. */}
      <Route
        element={
          <>
            <TabBar />
            <Outlet />
          </>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/console" element={<Console />} />
        <Route path="/whitelist" element={<Whitelist />} />
        <Route path="/logs" element={<Logs />} />
      </Route>

      {/* 위에서 아무것도 안 맞았을 때. 탭바 바깥에 두는 이유는 로그인 전에도
          잘못된 주소가 열릴 수 있어서다. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
