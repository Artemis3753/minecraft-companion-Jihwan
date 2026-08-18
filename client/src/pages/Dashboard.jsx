import { useEffect, useState } from 'react';

import { getPlayers, stopServer } from '../api.js';

// Logs도 같은 이름의 상수를 쓰지만 근거가 다르므로 공유하지 않는다. 로그의 5초는
// 줄이 쌓이는 실측 속도에서 나온 값이고, 여기서 재는 것은 "사람이 접속한 걸 얼마나
// 늦게 알아도 괜찮은가"다. 10초면 접속 뒤 평균 5초 안에 목록에 뜬다.
//
// list는 가벼운 명령인 데다 RCON 연결도 재사용하므로, 이 간격은 성능 문제가 아니라
// 순전히 기다림의 문제다.
const POLL_INTERVAL_MS = 10000;

// 상태값 하나를 화면 표현으로 옮기는 표. JSX 안에서 삼항 연산자를 두 번 겹치는 대신
// 표를 두면 "상태가 셋"이라는 사실이 한눈에 보이고, 넷째가 생겨도 여기만 늘면 된다.
// 컴포넌트 밖에 둔 이유는 값이 바뀌지 않아서다 — 렌더마다 다시 만들 필요가 없다.
const STATUS_DISPLAY = {
  online: { color: 'green', label: 'Online' },
  offline: { color: 'red', label: 'Minecraft server is not responding' },
  unknown: { color: 'grey', label: 'Cannot reach the back end' },
};

export default function Dashboard() {
  // 백엔드가 한 응답으로 주는 두 값이라 하나로 묶어 담는다. 따로 두면 둘 중
  // 하나만 갱신하는 실수가 가능해진다.
  const [serverInfo, setServerInfo] = useState(null);

  // 에러 객체가 아니라 판정 결과를 담는다. 화면이 503 같은 HTTP 지식을 알게 되면
  // api.js로 백엔드 계약을 가둔 의미가 없어진다.
  const [serverStatus, setServerStatus] = useState('unknown');

  // 컴포넌트가 만들어진 순간 조회는 이미 예정돼 있으므로 true로 시작한다.
  // false로 시작하면 첫 렌더에 "조회하지 않는 중"이라는 거짓이 한 번 지나간다.
  const [isChecking, setIsChecking] = useState(true);

  // 버튼이 1단계(Stop server)냐 2단계(정말?)냐. 한 번의 클릭으로 서버가 꺼지지
  // 않게 하는 것이 목적이라, 위치가 다른 버튼을 새로 눌러야 실행된다.
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);

  // 요청이 나가 있는 동안 버튼을 잠근다. 실패하는 경로는 성공하는 경로보다
  // 느려서, 그 사이 사용자가 눌렀는지 확신하지 못하고 연타하게 된다.
  const [isStopping, setIsStopping] = useState(false);

  // Stop만의 실패 문구. 서버 상태와 따로 두는 이유는 401 같은 실패가 마인크래프트가
  // 죽었다는 뜻이 아니어서다. 빨강으로 칠하면 로그인 문제를 서버 장애로 보고하게 된다.
  const [stopErrorMsg, setStopErrorMsg] = useState(null);

  useEffect(() => {
    // useEffect의 반환값은 정리(cleanup) 함수로 취급되는데 async 함수는 Promise를
    // 반환하므로, 콜백을 직접 async로 만들지 않고 안에서 만들어 부른다.
    async function loadServerInfo() {
      try {
        const info = await getPlayers();
        setServerInfo(info);
        setServerStatus('online');
      } catch (error) {
        // 두 실패를 가르는 근거는 api.js가 붙여준 status의 유무다.
        // 값이 있으면 백엔드가 503으로 답한 것 — 백엔드는 살아 있고 RCON만 거부됐다.
        // 없으면 fetch 자체가 실패한 것 — 백엔드에 닿지도 못했다.
        setServerStatus(error.status ? 'offline' : 'unknown');
      } finally {
        // 성공 쪽에만 두면 실패했을 때 화면이 "확인중"에 영영 갇힌다.
        setIsChecking(false);
      }
    }

    // setInterval은 등록 즉시 실행하지 않고 첫 간격을 기다린다. 이 줄이 없으면
    // 화면을 연 뒤 10초 동안 "Checking server status…"에 머문다.
    loadServerInfo();

    const timerId = setInterval(loadServerInfo, POLL_INTERVAL_MS);

    // 이 반환값이 cleanup 함수다. 다른 탭으로 옮겨가면 React가 부른다. 없으면 사라진
    // 화면의 타이머가 계속 요청을 보내고, 탭을 오갈 때마다 타이머가 하나씩 쌓인다.
    return () => clearInterval(timerId);

    // 빈 배열은 "다시 실행할 조건이 없다"는 뜻이라 마운트 시 한 번만 돈다.
    // 배열 자체를 빼면 렌더마다 실행돼 무한 루프가 된다.
  }, []);

  async function handleConfirmStop() {
    setIsStopping(true);
    // 이전 시도의 문구가 남아 있으면 방금 누른 결과로 오해된다.
    setStopErrorMsg(null);

    try {
      await stopServer();
      // 202는 "명령을 접수했다"지 "종료가 끝났다"가 아니다. 그래도 여기서 빨강으로
      // 넘기는 이유는 누른 즉시 반응을 보여주기 위해서다. 폴링이 도는 화면이라 이
      // 추측이 틀렸더라도 다음 주기가 실제 상태로 바로잡는다 — 폴링을 넣기 전에는
      // 조회가 한 번뿐이라 이 값이 끝까지 남았고, 그게 이 주석의 원래 이유였다.
      setServerStatus('offline');
      setServerInfo(null);
    } catch (error) {
      if (error.status === 503) {
        // 이미 꺼져 있던 서버에 stop을 보낸 경우. 요청은 실패했지만 그 실패가
        // 알려주는 사실은 "서버가 꺼져 있다"이므로 조회 실패와 똑같이 다룬다.
        setServerStatus('offline');
        setServerInfo(null);
      } else if (error.status) {
        // 401처럼 마인크래프트와 무관한 실패. 상태를 건드리지 않고 문구만 띄운다.
        setStopErrorMsg(error.message);
      } else {
        // status가 없다는 건 fetch 자체가 실패했다는 뜻 — 백엔드에 닿지 못했다.
        setServerStatus('unknown');
      }
    } finally {
      setIsStopping(false);
      // 실패해서 버튼이 화면에 남는 경우, 2단계로 열어둔 채 두지 않는다.
      // 다시 끄려면 확인을 한 번 더 거치게 하는 편이 안전하다.
      setIsConfirmingStop(false);
    }
  }

  if (isChecking) {
    return <p>Checking server status…</p>;
  }

  const { color, label } = STATUS_DISPLAY[serverStatus];

  return (
    <section>
      <h1>Dashboard</h1>

      <p>
        {/* 색만으로 상태를 알리면 색각 이상 사용자에게는 아무 정보도 아니다.
            점 옆의 문구가 실제 정보고, 색은 거드는 역할이다. */}
        <span style={{ color }}>●</span> {label}
      </p>

      {/* 초록일 때만 목록을 그린다. 나머지 두 상태에서는 serverInfo가 null이다. */}
      {serverStatus === 'online' && (
        <>
          <h2>
            Players ({serverInfo.playerNames.length} / {serverInfo.maxPlayerCount})
          </h2>

          {/* 빈 배열이면 ul이 껍데기만 남아 아무 말도 하지 않는다.
              "아무도 없다"는 것도 알려줘야 할 정보라 문구로 대신한다. */}
          {serverInfo.playerNames.length === 0 ? (
            <p>No one is online.</p>
          ) : (
            <ul>
              {/* key는 React가 목록의 항목을 재사용할 때 쓰는 식별자다. 배열 인덱스
                  대신 이름을 쓰는 이유는, 사람이 나가면 인덱스가 밀려 엉뚱한 항목에
                  붙기 때문이다. Minecraft 이름은 서버 안에서 중복되지 않는다. */}
              {serverInfo.playerNames.map((playerName) => (
                <li key={playerName}>{playerName}</li>
              ))}
            </ul>
          )}

          {/* 빨강·회색일 때는 이 블록 전체가 안 그려진다. 이미 꺼진 서버에
              끄기 버튼을 남겨둘 이유가 없다. */}
          <div>
            {isConfirmingStop ? (
              <>
                <p>Stop the Minecraft server? Everyone online will be disconnected.</p>
                {/* 확인 버튼을 1단계와 다른 자리에 두는 것이 실수 방지의 핵심이다.
                    같은 자리면 더블클릭 한 번으로 두 단계가 다 지나간다. */}
                <button type="button" onClick={handleConfirmStop} disabled={isStopping}>
                  Yes, stop it
                </button>
                {/* 문구까지 같이 지우는 이유: 이 문구는 "토큰이 유효하지 않다"가 아니라
                    "방금 누른 시도가 실패했다"는 뜻이다. 물러난 시도의 결과를 남겨두면
                    1단계 버튼 옆에 지난 실패가 붙어 있게 된다. finally에서 같이 지우면
                    방금 설정한 문구를 스스로 지우게 되므로 여기에만 둔다. */}
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingStop(false);
                    setStopErrorMsg(null);
                  }}
                  disabled={isStopping}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setIsConfirmingStop(true)}>
                Stop server
              </button>
            )}

            {/* 서버 상태와 별개로, 이번 Stop 시도만의 실패를 알린다. */}
            {stopErrorMsg && <p>{stopErrorMsg}</p>}
          </div>
        </>
      )}
    </section>
  );
}
