import express from 'express';
import { requireToken } from './auth.js';
import { getWhitelist, addToWhitelist, removeFromWhitelist } from '../services/minecraft.js';

const router = express.Router();

// 세 창구가 전부 토큰을 요구하므로 라우터 전체에 한 번 건다.
// 라우트마다 적으면 새 창구를 추가할 때 빠뜨릴 수 있는데, 빠뜨려도 에러가 안 나고
// 조용히 뚫린다. 여기서는 라우터에 붙는 모든 것이 자동으로 검사를 거친다.
router.use(requireToken);

/**
 * 화이트리스트 조회.
 * 읽기지만 인증을 건다 — 접속자 목록과 달리 이건 접근 권한을 가진 계정 명단
 * 전체라, 노출되면 무엇을 노려야 하는지 알려주는 셈이 된다.
 */
router.get('/', async (req, res) => {
  res.json({ whitelistNames: await getWhitelist() });
});

/**
 * 화이트리스트에 추가.
 * 201인 이유: 목록에 없던 항목이 새로 생겼다.
 */
router.post('/', async (req, res) => {
  // 본문이 없으면 req.body가 undefined라 그대로 꺼내면 500이 된다.
  const { targetMojangName } = req.body ?? {};
  const trimmed = targetMojangName?.trim();

  // 이름을 안 보낸 것과 없는 계정을 보낸 것은 다른 문제다. 막지 않으면 undefined가
  // 문자열로 RCON까지 흘러가 "undefined"라는 계정을 조회하고, 결과적으로 404가
  // 나온다. 그러면 키 이름을 오타낸 클라이언트가 "그 플레이어가 없다"는 답을 받아
  // 엉뚱한 곳에서 원인을 찾게 된다.
  if (!trimmed) {
    return res.status(400).json({ error: 'Player name cannot be empty.' });
  }

  res.status(201).json({ whitelistNames: await addToWhitelist(trimmed) });
});

/**
 * 화이트리스트에서 제거. 이름이 본문이 아니라 경로에 실린다.
 *
 * 화면이 행별 삭제 버튼이라 사용자는 목록에 있는 사람만 지목할 수 있다.
 * 없는 사람에 대한 요청이 실제로 나오는 건 버튼을 두 번 눌렀거나 탭이 두 개
 * 열려 있을 때뿐인데, 둘 다 원하는 결과는 이미 이뤄진 경우다.
 */
router.delete('/:playerName', async (req, res) => {
  res.json({ whitelistNames: await removeFromWhitelist(req.params.playerName) });
});

export default router;
