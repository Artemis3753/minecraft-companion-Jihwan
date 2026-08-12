import express from 'express';
import { requireToken } from './auth.js';
import { stopServer } from '../services/minecraft.js';

const router = express.Router();

/**
 * 마인크래프트 서버를 종료한다.
 *
 * requireToken을 핸들러 앞에 끼워서, 토큰이 없거나 틀리면 여기까지 오지 못하게 한다.
 * 확인 절차(정말 끄시겠습니까)는 클라이언트 몫이다 — 토큰을 가진 쪽은 이미
 * 이 요청을 보낼 자격이 있으므로, 서버가 한 번 더 묻는 것은 경계가 아니라 절차다.
 *
 * 200이 아니라 202인 이유: 명령이 전달됐을 뿐 종료가 끝난 것은 아니다.
 * 본문이 {} 인 이유: 돌려줄 데이터가 없고, 그렇다고 본문을 비우면 JSON을 기대하는
 * 클라이언트가 파싱 단계에서 걸린다.
 */
router.post('/', requireToken, async (req, res) => {
  await stopServer();
  res.status(202).json({});
});

export default router;
