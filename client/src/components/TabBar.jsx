import { NavLink } from 'react-router-dom';

// 경로와 라벨을 배열로 둔 이유: 탭이 늘거나 이름이 바뀔 때 고칠 곳이 한 군데다.
// 같은 마크업을 네 번 복사해두면 넷을 따로 고쳐야 한다.
const TABS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/console', label: 'Console' },
  { path: '/whitelist', label: 'Whitelist' },
  { path: '/logs', label: 'Logs' },
];

export default function TabBar() {
  return (
    <nav>
      {TABS.map((tab) => (
        // key는 React가 목록의 각 항목을 구별하는 데 쓴다. 경로는 서로 겹치지 않으니
        // 그대로 쓸 수 있다.
        <NavLink key={tab.path} to={tab.path}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
