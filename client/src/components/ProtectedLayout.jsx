import { Navigate, Outlet } from 'react-router-dom';

import TabBar from './TabBar.jsx';
import { hasToken } from '../api.js';

/**
 * 탭 안쪽 네 화면(/dashboard, /console, /whitelist, /logs)의 공통 부모.
 *
 * 네 화면은 서로 형제라서 주소를 직접 치면 하나씩 따로 열린다. 화면마다 검사를
 * 넣는 대신 공통 부모인 여기서 한 번 막는 이유가 그것이다 — 앞으로 탭을 추가해도
 * 이 Route 안에 넣기만 하면 따라온다.
 */
export default function ProtectedLayout() {
  // 여기서 끝내면 아래 <Outlet />에 도달하지 않는다. 안쪽 화면을 그린 뒤 가리는 게
  // 아니라 마운트조차 안 하는 것이라, Dashboard의 useEffect도 API 호출도 안 일어난다.
  if (!hasToken()) {
    // replace를 붙이는 이유는 App.jsx의 / 리다이렉트와 같다. 튕겨낸 기록이 히스토리에
    // 쌓이면 /login에서 뒤로가기를 눌렀을 때 다시 튕겨나와 갇힌다.
    return <Navigate to="/login" replace />;
  }

  // 통과한 뒤에만 공통 틀을 얹는다. 덕분에 안쪽 네 화면은 TabBar를 직접 import하지
  // 않고 자기 내용만 그린다.
  return (
    <>
      <TabBar />
      {/* 폭과 좌우 여백은 index.css의 main 규칙이 갖는다. 틀을 여기 한 번만 두면
          탭을 추가해도 따라오고, 안쪽 화면 넷은 자기 내용만 그리면 된다. */}
      <main>
        <Outlet />
      </main>
    </>
  );
}
