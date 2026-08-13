import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      {/* 막다른 화면에 빠져나갈 길은 남겨둔다. 뒤로가기 말고는 방법이 없으면
          주소를 잘못 친 사용자가 갇힌다. */}
      <Link to="/login">Go to login</Link>
    </>
  );
}
