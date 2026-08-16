import { useEffect, useRef, useState } from 'react';

import { getLogs } from '../api.js';

// 5초로 정한 근거는 실측이다. 부팅 중 6분에 7.4KB가 쌓였고 한 줄 평균이 93바이트라,
// 가장 바쁠 때가 4.4초에 한 줄꼴이었다. 5초면 제일 바쁜 순간에도 대략 한 줄만
// 뒤처진다. 더 짧게 잡아봐야 같은 내용을 다시 받을 뿐이다 — 한가할 때는 15분 동안
// 한 줄도 안 늘어난 적이 있다.
const POLL_INTERVAL_MS = 5000;

// 맨 아래에서 이만큼 안쪽까지는 "아래에 있다"로 친다. 스크롤 값은 브라우저에 따라
// 소수점이 붙어서 정확히 0으로 떨어지지 않는 경우가 있고, 몇 픽셀 올린 것을
// "옛 로그를 읽는 중"으로 판정하면 자동 스크롤이 너무 쉽게 풀린다.
const BOTTOM_THRESHOLD_PX = 20;

export default function Logs() {
  // null이 아니라 ''로 시작한다. Console은 "아직 안 보냄"과 "빈 응답"을 갈라야 했지만
  // 여기는 화면이 열리자마자 자동으로 부르므로 "아직 안 보냄" 상태가 없다.
  // 빈 파일이면 그냥 빈 문자열이고, 그것도 정상적인 결과다.
  const [logText, setLogText] = useState('');

  // isLoading이 아니라 첫 번째만 가리키는 이름을 쓴다. 폴링마다 이 값을 세우면
  // 5초에 한 번씩 화면이 "Loading…"으로 갈아끼워져 읽던 로그가 사라진다.
  // 기다림을 알려야 하는 건 보여줄 게 아직 아무것도 없는 첫 순간뿐이다.
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // 폴링 실패는 사용자가 한 일이 아니다. 그래서 화면을 대체하지 않고 로그 위에
  // 한 줄로만 붙인다 — 읽고 있던 내용을 뺏지 않으면서 지금 값이 멈춰 있다는 것은
  // 알려야 한다.
  const [errorMsg, setErrorMsg] = useState(null);

  // useRef는 "화면에 그려지지는 않지만 렌더링을 건너서 계속 남아 있는 값"을 담는
  // 상자다. .current에 값이 들어 있고, 이걸 바꿔도 다시 그려지지 않는다.
  //
  // 여기서는 실제 <pre> DOM 엘리먼트를 붙잡는 데 쓴다. 스크롤은 React가 관리하는
  // 값이 아니라 브라우저가 들고 있는 것이라, 엘리먼트를 직접 만져야 한다.
  const logBoxRef = useRef(null);

  // 사용자가 지금 맨 아래를 보고 있는지. state가 아니라 ref인 이유는 이 값이 화면을
  // 바꾸지 않기 때문이다. state로 두면 스크롤을 굴리는 내내 리렌더가 쏟아진다.
  const isPinnedToBottom = useRef(true);

  function handleScroll(event) {
    const box = event.currentTarget;
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;

    // 사용자가 위로 올리면 여기서 false가 되고, 다시 바닥까지 내리면 true로 돌아온다.
    // 자동 스크롤을 껐다 켜는 스위치를 사용자의 스크롤 동작 자체가 대신한다.
    isPinnedToBottom.current = distanceFromBottom < BOTTOM_THRESHOLD_PX;
  }

  // 새 로그가 화면에 그려진 뒤에 실행돼야 하므로 logText를 의존성으로 둔다.
  // 폴링이 돌아도 내용이 그대로면(새 줄이 없으면) 다시 실행되지 않는다.
  useEffect(() => {
    const box = logBoxRef.current;

    // 첫 요청 전에는 <pre>가 아직 화면에 없어서 ref가 비어 있다.
    if (!box) {
      return;
    }

    // 위로 올려 옛 로그를 읽는 중이면 건드리지 않는다. 이 조건이 없으면 5초마다
    // 화면이 아래로 끌려가서 읽고 있던 자리를 잃는다.
    if (isPinnedToBottom.current) {
      box.scrollTop = box.scrollHeight;
    }
  }, [logText]);

  useEffect(() => {
    // Whitelist와 같은 이유로 콜백을 직접 async로 만들지 않는다. useEffect의 반환값은
    // 정리(cleanup) 함수로 취급되는데 async 함수는 Promise를 반환한다.
    // 여기서는 그 반환값 자리에 진짜 정리 함수가 들어가야 해서 더욱 그렇다.
    async function loadLogs() {
      try {
        const data = await getLogs();
        setLogText(data.logText);

        // 성공했으면 지난 실패 문구를 지운다. 백엔드가 잠깐 죽었다 살아난 경우
        // 지우지 않으면 최신 로그 위에 옛날 에러가 계속 붙어 있게 된다.
        setErrorMsg(null);
      } catch (error) {
        // logText는 건드리지 않는다. 마지막으로 성공한 내용이 그대로 남는다.
        setErrorMsg(error.message);
      } finally {
        setIsFirstLoad(false);
      }
    }

    // 먼저 한 번 부른다. setInterval은 등록 즉시 실행하지 않고 5초를 기다리므로,
    // 이 줄이 없으면 화면을 연 뒤 5초 동안 빈 화면을 본다.
    loadLogs();

    const timerId = setInterval(loadLogs, POLL_INTERVAL_MS);

    // 이 반환값이 cleanup 함수다. 다른 탭으로 옮겨가면 React가 이걸 부른다.
    // 없으면 사라진 화면의 타이머가 계속 돌면서 요청을 보내고, 이미 없어진
    // 컴포넌트에 결과를 넣으려 한다. 화면을 여닫을 때마다 타이머가 하나씩 쌓인다.
    return () => clearInterval(timerId);

    // 빈 배열이라 타이머는 마운트에 한 번 걸리고 언마운트에 한 번 걷힌다.
  }, []);

  // 첫 요청이 끝나기 전에는 보여줄 것도 없고, 빈 상자가 "로그가 없다"고 거짓말한다.
  if (isFirstLoad) {
    return <p>Loading the log…</p>;
  }

  return (
    <section>
      <h1>Logs</h1>

      {/* 이 문구가 떠 있는 동안에도 폴링은 계속 돌고 있다. 서버가 돌아오면 다음
          5초에 저절로 사라진다. */}
      {errorMsg && <p>{errorMsg}</p>}

      {/* Console과 같은 상자를 쓴다. 색 코드는 파싱하지 않는다 —
          latest.log에는 §가 들어가지 않는다. */}
      <pre className="terminal-output" ref={logBoxRef} onScroll={handleScroll}>
        {logText}
      </pre>
    </section>
  );
}
