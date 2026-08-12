import { open } from 'node:fs/promises';

// 파일 끝에서 이만큼만 읽고 그 안에서 줄을 센다.
// 500줄 x 평균 93바이트 = 약 45KB라 넉넉하고, 스택트레이스처럼 긴 줄이 섞여
// 요청한 줄 수가 이 범위를 넘으면 들어온 만큼만 나간다.
// 파일 전체를 읽지 않는 이유는 latest.log가 끝없이 자라기 때문이다.
const MAX_TAIL_BYTES = 128 * 1024;

/**
 * 파일을 열지 못한 이유를 HTTP 계층이 쓸 수 있는 에러로 바꾼다.
 *
 * 둘 다 500이다. 클라이언트가 다르게 요청해도 해결되지 않고, 운영자가 설정이나
 * 권한을 고치고 백엔드를 재시작해야 풀린다. 503은 "잠시 후 다시"라는 뜻을 담는데
 * 여기엔 그럴 근거가 없다.
 *
 * 경로 값은 publicMessage에 넣지 않는다. 브라우저로 나가면 서버 디렉터리 구조가
 * 그대로 노출된다. 전체 경로는 에러 핸들러가 서버 콘솔에 찍는다.
 *
 * @param {NodeJS.ErrnoException} cause
 * @returns {Error}
 */
function unreadableLogFile(cause) {
  const error = new Error(`Cannot read log file: ${cause.code}`, { cause });
  error.status = 500;

  if (cause.code === 'ENOENT') {
    error.publicMessage =
      "Cannot find the Minecraft log file. Check MINECRAFT_LOG_PATH in the back end's .env.";
  } else if (cause.code === 'EACCES') {
    error.publicMessage =
      'Cannot read the Minecraft log file. The back end does not have permission to open it.';
  }
  // 그 밖의 이유는 우리가 예상하지 못한 것이므로 publicMessage를 붙이지 않는다.
  // 에러 핸들러의 기본 문구가 나가고, 원인은 서버 콘솔에만 남는다.

  return error;
}

/**
 * 로그 파일의 마지막 몇 줄을 파일에 쓰인 순서 그대로 이어 붙여 돌려준다.
 *
 * 파일이 요청한 줄 수보다 짧으면 있는 만큼 돌려준다. 비어 있으면 빈 문자열이고,
 * 그것도 정상적인 결과다 - 읽을 게 없었을 뿐 요청이 실패한 것은 아니다.
 *
 * 몇 줄을 읽을지는 인자로 받는다. "파일 끝에서 N줄"은 이 함수가 하는 일이고,
 * N이 얼마인지는 API가 정하는 정책이라 라우트가 들고 있는 게 맞다.
 *
 * @param {number} lineCount
 * @returns {Promise<string>}
 */
export async function readLogTail(lineCount) {
  let file;
  try {
    file = await open(process.env.MINECRAFT_LOG_PATH, 'r');
  } catch (cause) {
    throw unreadableLogFile(cause);
  }

  try {
    const { size } = await file.stat();
    const start = Math.max(0, size - MAX_TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    await file.read(buffer, 0, buffer.length, start);

    let text = buffer.toString('utf8');

    // 파일 중간부터 읽었다면 첫 줄이 잘려 있다. 반쪽짜리 줄을 화면에 보내지 않으려고
    // 첫 개행까지를 버린다. 처음부터 읽었을 때는 잘린 줄이 없으므로 그대로 둔다.
    if (start > 0) {
      const firstBreak = text.indexOf('\n');
      text = firstBreak === -1 ? '' : text.slice(firstBreak + 1);
    }

    // 로그 파일은 개행으로 끝나므로 split 결과의 마지막이 빈 문자열이 된다.
    // 그대로 두면 마지막 한 줄이 빈 줄에 밀려 잘려나간다.
    const lines = text.split('\n');
    if (lines.at(-1) === '') {
      lines.pop();
    }

    return lines.slice(-lineCount).join('\n');
  } finally {
    // 읽다가 실패하더라도 파일 핸들은 반드시 닫는다. 폴링으로 반복 호출되는
    // 창구라, 닫지 않으면 열린 핸들이 쌓여 결국 파일을 못 여는 상태가 된다.
    await file.close();
  }
}
