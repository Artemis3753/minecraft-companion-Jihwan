import { Rcon } from 'rcon-client';

// 연결 객체가 아니라 "연결하는 중"이라는 Promise를 캐싱한다.
// 객체를 캐싱하면, 첫 호출이 await으로 멈춰 있는 사이 들어온 두 번째 호출이
// 캐시를 비어있다고 보고 소켓을 하나 더 연다. Promise는 await 없이 즉시
// 대입되므로 그 틈 자체가 생기지 않는다.
let connectionPromise = null;

/**
 * RCON에 실제로 접속하고 끊김 감지 리스너를 달아 완성된 연결을 반환한다.
 * 캐시는 건드리지 않는다 — 캐시 관리는 getConnection()의 몫이다.
 *
 * @returns {Promise<Rcon>}
 */
async function connect() {
  const rcon = await Rcon.connect({
    host: process.env.RCON_HOST,
    port: parseInt(process.env.RCON_PORT, 10),
    password: process.env.RCON_PASSWORD,
  });

  // 끊기면 캐시를 비워서 다음 호출이 재연결하게 한다.
  // 'error'까지 받는 이유: 리스너가 없으면 Node가 예외를 던져 프로세스가 죽고,
  // 살아남더라도 캐시에 죽은 연결이 남아 이후 모든 명령이 실패한다.
  rcon.on('end', () => {
    connectionPromise = null;
  });
  rcon.on('error', () => {
    connectionPromise = null;
  });

  return rcon;
}

/**
 * 캐시된 연결(또는 진행 중인 연결 시도)을 반환한다.
 * await이 하나도 없어서 async가 아니다 — 그게 이 함수의 핵심이다.
 * 검사와 대입 사이에 실행이 멈추는 지점이 없어야 소켓이 중복으로 열리지 않는다.
 *
 * @returns {Promise<Rcon>}
 */
function getConnection() {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = connect();

  // 실패한 Promise가 캐시에 남으면, 꺼져 있던 미크래프트 서버를 나중에 켜도
  // 계속 같은 실패를 돌려준다. catch 결과를 다시 대입하지 않는 이유는
  // 그러면 에러를 삼켜서 호출한 쪽이 실패를 모르게 되기 때문.
  connectionPromise.catch(() => {
    connectionPromise = null;
  });

  return connectionPromise;
}

/**
 * RCON 명령 하나를 보내고 응답 문자열을 반환한다.
 * list / whitelist list|add|remove / stop 전부 이 함수를 통해 나간다.
 *
 * @param {string} command
 * @returns {Promise<string>}
 */
export async function sendCommand(command) {
  const rcon = await getConnection();
  return rcon.send(command);
}
