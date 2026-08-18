import express from 'express';
import authRouter from './routes/auth.js';
import playersRouter from './routes/players.js';
import stopRouter from './routes/stop.js';
import whitelistRouter from './routes/whitelist.js';
import consoleRouter from './routes/console.js';
import logsRouter from './routes/logs.js';

const app = express();
const port = process.env.PORT || 3001;

// 브라우저는 다른 출처로 보낸 요청의 응답을 기본적으로 못 읽게 막는다. 프론트(5173)와
// 이 백엔드(3001)는 포트가 달라 서로 다른 출처이므로, 허용한다는 헤더를 직접 싣는다.
// 맨 앞에 두는 이유는 404나 500 응답에도 이 헤더가 붙어야 하기 때문이다. 헤더가 없으면
// 브라우저가 응답을 막아서, 클라이언트는 에러 내용 대신 정체불명의 네트워크 실패를 본다.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 위 세 줄의 허가를 브라우저가 얼마나 재사용할지 정한다. 이 헤더가 없으면 Chrome은
  // 5초만 기억하는데, 대시보드 폴링이 10초 간격이라 매번 만료된다 — 조회 한 번에
  // 왕복이 두 번씩 든다는 뜻이다. 600초면 그 비용이 60번에 한 번으로 줄어든다.
  //
  // 더 크게 잡지 않는 이유는 둘이다. Chrome이 7200초를 상한으로 잘라내고, 위 헤더를
  // 고쳤을 때 브라우저가 옛 허가를 그만큼 오래 붙들고 있기 때문이다.
  res.header('Access-Control-Max-Age', '600');

  // Authorization 헤더가 붙거나 메서드가 DELETE면 브라우저는 진짜 요청 전에
  // OPTIONS로 먼저 물어본다(preflight). 여기서 끊지 않으면 라우터까지 내려가
  // 404가 되고, 브라우저는 허락을 못 받았다고 판단해 본 요청을 아예 안 보낸다.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// 요청 본문은 기본적으로 바이트 덩어리로 도착한다. 이 미들웨어가 JSON을 해석해
// req.body에 객체로 넣어준다. 라우터보다 먼저 등록해야 라우트에서 req.body를 쓸 수 있다.
app.use(express.json());

// 백엔드 자신이 살아 있는지만 답한다. 마인크래프트와 무관해서 인증도 걸지 않는다.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/login', authRouter);
app.use('/api/players', playersRouter);
app.use('/api/stop', stopRouter);
app.use('/api/whitelist', whitelistRouter);
app.use('/api/console', consoleRouter);
app.use('/api/logs', logsRouter);

// 여기까지 내려왔다는 건 위의 어느 라우트에도 걸리지 않았다는 뜻이다.
// 경로 조건이 없어서 무엇이든 걸리므로 반드시 라우트 등록 뒤에 와야 한다.
// 이게 없으면 Express가 HTML로 404를 뱉어서, 실패는 항상 JSON의 error 필드로
// 온다는 API의 약속이 깨진다.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 인자가 4개인 미들웨어를 Express는 에러 핸들러로 인식한다. next를 안 쓰더라도
// 빼면 평범한 미들웨어가 되어버리므로 그대로 둔다.
// 라우트를 전부 등록한 뒤에 와야 앞에서 발생한 에러가 여기로 흘러온다.
app.use((err, req, res, next) => {
  // 진단에 필요한 건 서버 콘솔에만 남긴다. 스택에는 파일 경로가 들어 있어서
  // 그대로 내보내면 서버 디렉터리 구조가 브라우저로 새어나간다.
  console.error(err);

  // express.json()이 파싱에 실패하면 status 400을 붙여서 던진다.
  // 그 값이 없다는 건 우리가 예상하지 못한 에러라는 뜻이므로 500으로 본다.
  const status = err.status || 500;

  // publicMessage가 붙어 있으면 "밖에 보여도 되는 문구"라고 services 계층이
  // 판단한 것이므로 그대로 쓴다. 없으면 우리가 예상하지 못한 에러이니,
  // 4xx는 보낸 쪽이 고칠 수 있게 알려주고 5xx는 내용을 흘리지 않는다.
  const message = err.publicMessage
    ?? (status < 500 ? 'Request body is not valid JSON.' : 'Something went wrong.');

  res.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
