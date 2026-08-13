import express from 'express';
import crypto from 'node:crypto';

const router = express.Router();

// 발급된 토큰 하나를 모듈 스코프에 들고 있는다.
// 이 파일 밖에서는 보이지 않아서, 토큰을 바꾸는 코드가 여기 말고는 없다는 게 보장된다.
// 서버를 재시작하면 사라지는 것도 의도다 — 관리 대상 서버 하나에 비밀번호 하나뿐이라
// 세션을 디스크에 남겨서 얻을 게 없다.
let currentToken = null;

/**
 * 대시보드 비밀번호를 토큰으로 교환한다. 토큰을 발급하는 유일한 창구.
 */
router.post('/', (req, res) => {
  // Express 5는 본문이 없으면 req.body를 undefined로 둔다. 그대로 구조 분해하면
  // TypeError가 나서 잘못된 요청이 500으로 보고된다. 본문이 없는 것과 빈 본문을
  // 같게 취급하면 아래 비교에서 자연스럽게 401로 떨어진다.
  const { password } = req.body ?? {};

  // 토큰이 아직 없는 단계라 requireToken의 문구를 쓰면 안 된다. 틀린 것은 비밀번호다.
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Password does not match.' });
  }

  // randomUUID는 암호학적으로 안전한 난수를 쓴다. Math.random()은 예측 가능해서
  // 토큰처럼 맞히면 안 되는 값에는 쓰면 안 된다.
  currentToken = crypto.randomUUID();

  res.json({ accessToken: currentToken });
});

/**
 * 토큰이 유효한 요청만 통과시키는 미들웨어.
 * 검사를 이 함수 하나로 모은 이유는, 라우트마다 복사해두면 규칙을 바꿀 때
 * 다섯 군데를 빠짐없이 고쳐야 하고 하나만 빠뜨려도 그 창구만 뚫리기 때문이다.
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
export function requireToken(req, res, next) {
  // "Bearer <토큰>" 형식이라 공백으로 잘라 뒤쪽만 쓴다.
  // 헤더가 아예 없으면 undefined라서 ?. 로 막는다.
  const token = req.headers.authorization?.split(' ')[1];

  // currentToken이 null인 경우(아직 아무도 로그인 안 함)를 따로 막지 않으면,
  // 토큰 없이 온 요청의 undefined와 null이 느슨하게 비교돼 통과할 여지가 생긴다.
  if (!currentToken || token !== currentToken) {
    return res.status(401).json({ error: 'Token is invalid' });
  }

  next();
}

export default router;
