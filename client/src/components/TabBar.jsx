import { NavLink } from 'react-router-dom';

import styles from './TabBar.module.css';

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
    <nav className={styles.bar}>
      {TABS.map((tab) => (
        // key는 React가 목록의 각 항목을 구별하는 데 쓴다. 경로는 서로 겹치지 않으니
        // 그대로 쓸 수 있다.
        //
        // className에 함수를 넘기면 NavLink가 "지금 이 링크가 현재 주소인지"를
        // isActive로 알려준다. 넷 중 어느 탭에 있는지를 TabBar가 따로 계산하지 않아도
        // 되는 이유가 이것이다.
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.active}` : styles.tab
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
