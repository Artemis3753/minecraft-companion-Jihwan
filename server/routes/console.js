import express from 'express';
import { requireToken } from './auth.js';
import { sendRaw } from '../services/minecraft.js';

const router = express.Router();

/**
 * 입력한 명령을 그대로 마인크래프트에 보내고, 서버가 답한 문장을 그대로 돌려준다.
 *
 * 다른 창구는 전부 RCON의 문장을 해석해서 구조로 바꾸는데 여기만 그러지 않는다.
 * 서버가 실제로 뭐라고 답했는지 보는 것이 이 화면의 존재 이유이고, 자유 입력이라
 * 응답의 종류가 닫혀 있지도 않아서 해석할 규칙을 세울 수도 없다.
 *
 * 명령을 거르지 않는다. RCON에 닿는다는 것 자체가 서버 전체 권한이고, 이 창구를
 * 여는 토큰은 이미 POST /api/stop도 열기 때문에 여기서만 막아봐야 없는 경계다.
 *
 * GET이 아니라 POST인 이유: 메서드는 요청 하나에 대한 설명이 아니라 창구가 하는
 * 약속인데, 이 창구는 넘겨받은 문자열이 list인지 stop인지 실행 전에는 모른다.
 */
router.post('/', requireToken, async (req, res) => {
  // 앞뒤 공백은 사용자가 의도한 명령의 일부가 아니므로 검사와 전송에 같은 값을 쓴다.
  // req.body는 본문이 없으면 undefined라 그대로 꺼내면 500이 된다.
  const { command } = req.body ?? {};
  const trimmed = command?.trim();

  // RCON은 빈 문자열도 받아서 빈 응답을 돌려준다. 이건 잡힌 에러가 아니라
  // 이 API가 스스로 세운 규칙이고, 400이 이 경우 하나만 담당하므로
  // 메시지 하나로 무엇을 고쳐야 하는지 정확히 말할 수 있다.
  if (!trimmed) {
    return res.status(400).json({ error: 'Command cannot be empty.' });
  }

  // 앞의 슬래시는 Paper가 알아서 떼므로 여기서 손대지 않는다.
  // 없는 명령이어도 RCON은 실패하지 않고 문장으로 답하므로 그 문장이 그대로 output에 담긴다.
  res.json({ output: await sendRaw(trimmed) });
});

export default router;
