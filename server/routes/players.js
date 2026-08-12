import express from 'express';
import { getPlayers } from '../services/minecraft.js';

const router = express.Router();

/**
 * 접속자 목록과 정원. 인증을 걸지 않는다 — 게임에 들어가면 어차피 보이는 정보라
 * 감출 실익이 없고, 파괴적이지도 않다.
 *
 * try/catch가 없는 이유: Express 5는 async 핸들러가 던진 에러를 자동으로
 * 에러 핸들러로 넘긴다. minecraft.js가 이미 status와 publicMessage를 붙여두므로
 * 여기서 할 일이 없다.
 */
router.get('/', async (req, res) => {
  res.json(await getPlayers());
});

export default router;
