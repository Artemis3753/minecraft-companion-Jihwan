import { sendCommand } from './rconClient.js';

/**
 * RCON 명령을 보내고 응답을 해석하지 않은 채 그대로 돌려준다.
 * 실패하면 HTTP 계층이 알아들을 수 있는 에러로 바꿔서 던진다.
 *
 * 소켓 에러(ECONNREFUSED 등)를 그대로 올려보내면 index.js의 에러 핸들러가
 * 그걸 503으로 옮기기 위해 RCON을 알아야 한다. 여기서 의미를 붙여 보내면
 * HTTP 계층은 status와 publicMessage만 읽으면 된다.
 *
 * 이 파일의 다른 함수들이 전부 이걸 거치고, 각자 응답을 해석한다.
 * 콘솔만 해석 없이 이 함수를 직접 쓰므로 밖으로 열어둔다 — 그 덕에 503 문구가
 * RCON을 타는 여섯 창구에서 한 곳에만 존재한다.
 *
 * @param {string} command
 * @returns {Promise<string>}
 */
export async function sendRaw(command) {
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
 * Mojang에 그런 이름의 계정이 없을 때 던질 에러.
 * add와 remove가 같은 문구를 받으므로 만드는 곳도 하나로 둔다.
 *
 * @returns {Error}
 */
function mojangNameNotFound() {
  const error = new Error('No such Mojang account');
  error.status = 404;
  error.publicMessage = 'That player does not exist in Mojang account.';
  return error;
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
  const reply = await sendRaw('list');

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
 * 화이트리스트에 등재된 이름 목록.
 *
 * 실측 응답: "There are no whitelisted players"
 *            "There are 2 whitelisted player(s): Artemis3753, chan_jjang"
 *
 * 비어 있을 때와 아닐 때 문장 형태가 아예 다르다. 그 차이를 여기서 흡수해서
 * 라우트에는 항상 배열만 넘긴다.
 *
 * @returns {Promise<string[]>}
 */
export async function getWhitelist() {
  const reply = await sendRaw('whitelist list');

  if (reply === 'There are no whitelisted players') {
    return [];
  }

  const match = reply.match(/whitelisted player\(s\): (.+)$/);
  if (!match) {
    throw unexpectedReply('whitelist list', reply);
  }

  return match[1].split(',').map((name) => name.trim());
}

/**
 * 화이트리스트에 한 명을 추가하고, 추가가 끝난 뒤의 전체 목록을 돌려준다.
 *
 * 목록을 다시 읽느라 RCON 명령이 두 번 나가지만, 그 대가로 두 가지를 얻는다.
 * 클라이언트가 조회든 추가든 같은 배열을 받아 한 가지 코드로 그릴 수 있고,
 * `whitelist list`가 Mojang의 정식 표기를 돌려주므로 대소문자가 자동으로 교정된다.
 *
 * @param {string} targetMojangName
 * @returns {Promise<string[]>}
 */
export async function addToWhitelist(targetMojangName) {
  const reply = await sendRaw(`whitelist add ${targetMojangName}`);

  if (reply === 'That player does not exist') {
    throw mojangNameNotFound();
  }

  if (reply === 'Player is already whitelisted') {
    const error = new Error(`Already whitelisted: ${targetMojangName}`);
    error.status = 409;
    error.publicMessage = `${targetMojangName} is already whitelisted.`;
    throw error;
  }

  // 성공 문구까지 확인하고 넘어간다. 모르는 응답을 성공으로 넘기면
  // 추가되지 않았는데 성공한 것처럼 보이는 상태가 생긴다.
  if (!reply.startsWith('Added ')) {
    throw unexpectedReply(`whitelist add ${targetMojangName}`, reply);
  }

  return getWhitelist();
}

/**
 * 화이트리스트에서 한 명을 제거하고, 제거가 끝난 뒤의 전체 목록을 돌려준다.
 *
 * 원래 목록에 없던 사람이어도 성공으로 친다. 요청의 목적은 "그 사람이 명단에
 * 없는 상태"를 만드는 것이고 이미 그 상태이므로, 몇 번을 불러도 결과가 같아야
 * 한다는 DELETE의 관례와도 맞는다.
 *
 * @param {string} playerName
 * @returns {Promise<string[]>}
 */
export async function removeFromWhitelist(playerName) {
  const reply = await sendRaw(`whitelist remove ${playerName}`);

  // 존재하지 않는 계정은 다르다. "이미 없다"가 아니라 "누구도 가리키지 않는
  // 이름을 줬다"는 뜻이라 요청 자체가 잘못된 경우다.
  if (reply === 'That player does not exist') {
    throw mojangNameNotFound();
  }

  const removed = reply.startsWith('Removed ');
  const wasNotThere = reply === 'Player is not whitelisted';

  if (!removed && !wasNotThere) {
    throw unexpectedReply(`whitelist remove ${playerName}`, reply);
  }

  return getWhitelist();
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
  await sendRaw('stop');
}
