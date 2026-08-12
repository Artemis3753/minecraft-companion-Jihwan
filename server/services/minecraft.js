import { sendCommand } from './rconClient.js';

/**
 * RCON 명령을 보내고, 실패하면 HTTP 계층이 알아들을 수 있는 에러로 바꿔서 던진다.
 *
 * 소켓 에러(ECONNREFUSED 등)를 그대로 올려보내면 index.js의 에러 핸들러가
 * 그걸 503으로 옮기기 위해 RCON을 알아야 한다. 여기서 의미를 붙여 보내면
 * HTTP 계층은 status와 publicMessage만 읽으면 된다.
 *
 * @param {string} command
 * @returns {Promise<string>}
 */
async function send(command) {
  try {
    return await sendCommand(command);
  } catch (cause) {
    // cause에 원본을 담아둔다 — 감싸더라도 서버 콘솔에서는 원인을 볼 수 있어야 한다.
    const error = new Error(`RCON command failed: ${command}`, { cause });
    error.status = 503;
    error.publicMessage = 'Cannot reach the Minecraft server. It may not be running.';
    throw error;
  }
}

/**
 * 응답이 예상한 형태가 아닐 때 던질 에러를 만든다.
 * 조용히 빈 값을 돌려주면 화면에 "접속자 0명"처럼 사실이 아닌 상태가 표시된다.
 * 마인크래프트 버전이 올라 문장이 바뀌는 경우가 여기 걸린다.
 *
 * @param {string} command
 * @param {string} reply
 * @returns {Error}
 */
function unexpectedReply(command, reply) {
  // publicMessage를 붙이지 않는다 — 우리가 예상 못 한 상황이라 밖으로 설명할 말이 없고,
  // 에러 핸들러의 기본 문구(500)가 그대로 나가는 게 맞다.
  return new Error(`Unexpected reply to "${command}": ${JSON.stringify(reply)}`);
}

/**
 * 접속자 목록과 서버 정원을 함께 돌려준다.
 * RCON `list` 한 번이 둘 다 답하므로 창구도 하나다.
 *
 * 실측 응답: "There are 0 of a max of 20 players online: "
 *            "There are 2 of a max of 20 players online: Steve, Alex"
 *
 * @returns {Promise<{ playerNames: string[], maxPlayerCount: number }>}
 */
export async function getPlayers() {
  const reply = await send('list');

  const match = reply.match(/of a max of (\d+) players online:(.*)$/);
  if (!match) {
    throw unexpectedReply('list', reply);
  }

  const [, maxPlayerCount, nameList] = match;

  // 아무도 없으면 콜론 뒤가 공백뿐이라 trim 후 빈 문자열이 된다.
  // 그대로 split하면 [''] 이 나와서 "이름 없는 플레이어 한 명"이 되어버린다.
  const trimmed = nameList.trim();

  return {
    playerNames: trimmed === '' ? [] : trimmed.split(',').map((name) => name.trim()),
    maxPlayerCount: Number(maxPlayerCount),
  };
}

/**
 * 마인크래프트 서버를 종료한다.
 *
 * 응답을 확인하지도 돌려주지도 않는다. RCON은 "Stopping the server"라고 답하지만
 * 그건 데이터가 아니라 Mojang의 문구고, 종료가 실제로 끝났다는 보장도 아니다.
 * 명령이 전달됐다는 사실만 가지고 라우트가 202를 준다.
 *
 * @returns {Promise<void>}
 */
export async function stopServer() {
  await send('stop');
}
