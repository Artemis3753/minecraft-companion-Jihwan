import express from 'express';
import { requireToken } from './auth.js';
import { readLogTail } from '../services/logReader.js';

const router = express.Router();

// 화면이 폴링으로 이 창구를 반복해서 부르고, 새 응답이 이전 응답을 대체한다.
// 누적이 없으므로 이 숫자가 곧 사용자가 볼 수 있는 전부다.
// 실측상 가장 긴 세션이 303줄이라 500이면 세션 전체에 사고 시 여유까지 덮는다.
const TAIL_LINE_COUNT = 500;

/**
 * 로그 파일의 끝부분을 문자열 하나로 돌려준다.
 *
 * 읽기지만 인증을 건다 - 서버에서 일어난 일이 전부 담겨 있어서, 접속자 목록처럼
 * 게임에 들어가면 어차피 보이는 정보와는 성격이 다르다.
 *
 * 마인크래프트가 꺼져 있어도 이 창구는 동작한다. 파일을 읽을 뿐 RCON을 타지 않기
 * 때문이고, 그래서 다른 창구와 달리 503이 없다.
 */
router.get('/', requireToken, async (req, res) => {
  res.json({ logText: await readLogTail(TAIL_LINE_COUNT) });
});

export default router;
