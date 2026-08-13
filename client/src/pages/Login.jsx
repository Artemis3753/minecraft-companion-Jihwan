import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { requestToken, saveToken } from '../api.js';

export default function Login() {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    // form은 제출되면 페이지를 통째로 다시 불러온다. 그러면 React가 들고 있던
    // 상태가 전부 사라지므로 기본 동작을 막고 우리가 직접 처리한다.
    event.preventDefault();

    // 이전 시도의 실패 문구가 남아 있으면 새 요청의 결과와 헷갈린다.
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const { accessToken } = await requestToken(password);
      saveToken(accessToken);

      // replace를 쓰는 이유: 로그인 화면을 히스토리에서 지운다. 남겨두면 로그인
      // 직후 뒤로가기를 눌렀을 때 이미 통과한 로그인 화면으로 되돌아간다.
      navigate('/dashboard', { replace: true });
    } catch (error) {
      // api.js가 백엔드의 error 문구를 그대로 실어 던진다. 비밀번호가 틀렸다는
      // 판단은 백엔드가 하므로 여기서 문구를 새로 짓지 않는다.
      setErrorMessage(error.message);
    } finally {
      // 성공하면 화면을 떠나지만 실패하면 다시 시도할 수 있어야 한다.
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>

      {/* value와 onChange를 함께 두면 입력값의 주인이 React가 된다. 하나만 두면
          화면에 보이는 값과 password 변수가 어긋난다. */}
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Dashboard password"
        required
      />

      {/* 응답을 기다리는 동안 잠근다. 연타하면 같은 요청이 여러 번 나간다. */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Log in'}
      </button>

      {/* 앞이 참일 때만 뒤를 그린다. errorMessage가 빈 문자열이면 아무것도 안 나온다. */}
      {errorMessage && <p>{errorMessage}</p>}
    </form>
  );
}
