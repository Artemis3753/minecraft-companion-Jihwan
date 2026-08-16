import { useState } from 'react';

import { sendCommand } from '../api.js';

// 마인크래프트의 색 코드 16개. 값은 마인크래프트가 정한 것이라 우리가 고를 여지가
// 없고, 그래서 화면 사정에 따라 바뀌지 않는다. 컴포넌트 밖에 두는 이유가 그것이다 —
// 렌더링마다 같은 객체를 다시 만들 이유가 없다.
const COLOR_BY_CODE = {
  0: '#000000', // black
  1: '#0000aa', // dark blue
  2: '#00aa00', // dark green
  3: '#00aaaa', // dark aqua
  4: '#aa0000', // dark red
  5: '#aa00aa', // dark purple
  6: '#ffaa00', // gold
  7: '#aaaaaa', // gray
  8: '#555555', // dark gray
  9: '#5555ff', // blue
  a: '#55ff55', // green
  b: '#55ffff', // aqua
  c: '#ff5555', // red
  d: '#ff55ff', // light purple
  e: '#ffff55', // yellow
  f: '#ffffff', // white
};

/**
 * `§`가 섞인 RCON 응답을 `{ text, color }` 조각들로 쪼갠다.
 *
 * 서식 코드(`l` `o` `n` `m` `k` — 굵게·기울임·밑줄·취소선·뒤죽박죽)는 색을 건드리지
 * 않고 글자만 떨어져 나간다. 마인크래프트에서 서식은 쌓이고 색이 나오면 초기화되는
 * 별도 규칙이라, 그걸 따르려면 상태를 하나 더 들고 다녀야 한다. 명령 응답에 실제로
 * 나오는 건 거의 색뿐이라 지금은 값을 못 한다고 봤다.
 *
 * 컴포넌트 밖에 있는 것은 이 함수가 state도 props도 보지 않기 때문이다.
 * 입력이 같으면 결과가 같은, 화면과 무관한 문자열 변환이다.
 */
function toColoredChunks(text) {
  // 첫 조각만 성격이 다르다. § 앞에 있던 부분이라 코드가 없다. 나머지는 전부
  // "첫 글자가 코드, 나머지가 텍스트"라 같은 규칙으로 처리된다.
  const [firstPiece, ...restPieces] = text.split('§');

  // §가 하나도 없는 응답(list 같은)은 split이 길이 1짜리 배열을 주고, 그 하나가 곧
  // 이 첫 조각이다. 그래서 "§가 있는지" 먼저 검사할 필요가 없다.
  const chunks = firstPiece ? [{ text: firstPiece, color: null }] : [];

  // 루프 밖에 둔다. 색은 다음 색 코드나 §r을 만날 때까지 이어지므로,
  // 조각 하나가 아니라 훑어가는 동안의 상태다.
  let color = null;

  for (const piece of restPieces) {
    const code = piece[0];
    const rest = piece.slice(1);

    if (code in COLOR_BY_CODE) {
      color = COLOR_BY_CODE[code];
    } else if (code === 'r') {
      // §r은 초기화라 기본 글자색으로 돌아간다.
      color = null;
    }

    // rest가 비는 경우는 코드가 연달아 붙었을 때다(§a§l처럼). 빈 span을 만들지 않고
    // 넘기면 위에서 갱신한 color만 남아 다음 조각에 그대로 적용된다.
    if (rest) {
      chunks.push({ text: rest, color });
    }
  }

  return chunks;
}

export default function Console() {
  // 입력창의 값. Whitelist의 nameToAdd와 같은 이유로 친 그대로 담고,
  // trim은 보내는 자리에서 한다.
  const [command, setCommand] = useState('');

  // 요청이 나가 있는 동안 폼을 잠근다. 여기는 어떤 명령이 갈지 모르는 창구라,
  // 연타가 stop을 두 번 보내는 일도 가능하다.
  const [isSending, setIsSending] = useState(false);

  // ''가 아니라 null로 시작한다. 빈 문자열은 "아직 아무것도 안 보냈다"와
  // "서버가 빈 줄로 답했다"를 구별하지 못하는데, 이 화면은 서버가 실제로 뭐라고
  // 답했는지 보는 곳이라 그 둘이 같아 보이면 안 된다.
  const [output, setOutput] = useState(null);

  // output과 따로 두는 이유: RCON은 실패를 에러가 아니라 평범한 문장으로 답한다.
  // 없는 명령을 쳐도 HTTP는 200이고 그 문장은 서버가 한 말이라 출력 자리에 속한다.
  // 여기 담기는 건 서버까지 닿지 못한 경우(401·503·백엔드 다운)뿐이다.
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleSubmit(event) {
    // 막지 않으면 폼이 페이지를 통째로 새로고침해서 state가 전부 초기값으로 돌아간다.
    event.preventDefault();

    setIsSending(true);
    setErrorMsg(null);

    // 지난 출력도 같이 지운다. 남겨두면 이번 요청이 실패했을 때 에러 문구 아래에
    // 지난 명령의 결과가 붙어 있게 되어, 방금 친 명령이 저 결과를 냈다고 읽힌다.
    // 화면에 동시에 떠 있는 두 문장이 서로 다른 시점의 것이 되는 게 문제다.
    setOutput(null);

    try {
      // 백엔드도 trim한 값으로 검사하므로 같은 값을 보낸다.
      const data = await sendCommand(command.trim());
      setOutput(data.output);

      // 보낸 뒤 비운다. 다음 명령을 치려면 어차피 지워야 하는 값이라, 매번 전체
      // 선택하고 지우는 동작이 남는다.
      //
      // catch가 아니라 여기서만 비우는 이유: RCON은 오타도 200으로 답하므로 이
      // 자리에는 잘못 친 명령도 온다. 그래도 비운다 — 서버가 답을 한 이상 그 명령은
      // 처리가 끝난 것이다. 반면 503이나 백엔드 다운은 명령이 틀린 게 아니라 보낼
      // 수가 없었던 것이라, 그때는 남겨둬야 서버를 켜고 다시 누를 수 있다.
      setCommand('');
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section>
      <h1>Console</h1>

      <form onSubmit={handleSubmit}>
        {/* 라벨을 화면에 두지 않는 대신 aria-label로 이름을 남긴다.
            placeholder는 값을 치기 시작하면 사라지므로 라벨을 대신하지 못한다. */}
        <input
          type="text"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="e.g. list"
          aria-label="Command to send"
          disabled={isSending}
        />

        {/* 공백만 친 경우도 trim 후 빈 문자열이 되므로 같은 검사에 걸린다.
            백엔드도 빈 명령을 400으로 막지만, 막힐 걸 알면서 보낼 이유는 없다. */}
        <button type="submit" disabled={isSending || command.trim() === ''}>
          Send
        </button>
      </form>

      {errorMsg && <p>{errorMsg}</p>}

      {/* output && 이 아니라 !== null인 이유: ''도 falsy라 &&를 쓰면 빈 응답이
          "아직 안 보냄"과 똑같이 그려진다. 위에서 null로 시작한 의미가 사라진다.

          pre를 쓰는 이유는 RCON 응답에 줄바꿈이 들어오기 때문이다(help가 대표적).
          p에 넣으면 HTML이 줄바꿈과 연속 공백을 한 칸으로 뭉갠다. */}
      {output !== null && (
        <pre className="terminal-output">
          {/* 문자열을 그대로 넣지 않고 조각마다 span으로 감싼다. 서버가 준 텍스트를
              마크업으로 바꾸는 일이라, dangerouslySetInnerHTML을 쓰면 플레이어 이름과
              채팅에 섞인 HTML이 그대로 실행된다. 엘리먼트로 만들면 React가 텍스트를
              텍스트로만 취급해 그 경로가 아예 없다.

              key에 인덱스를 쓰는 것은 Whitelist와 반대인데, 이 배열은 응답이 올 때마다
              통째로 새로 만들어지고 중간에서 하나만 빠지는 일이 없다. 인덱스가 곧
              그 조각의 고유한 자리다.

              color가 null이면 React가 그 속성을 아예 넣지 않아서 pre의 기본색을
              그대로 물려받는다. 조건을 따로 걸 필요가 없는 이유다. */}
          {toColoredChunks(output).map((chunk, index) => (
            <span key={index} style={{ color: chunk.color }}>
              {chunk.text}
            </span>
          ))}
        </pre>
      )}
    </section>
  );
}
