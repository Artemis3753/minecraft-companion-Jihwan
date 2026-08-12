import express from 'express';
import authRouter from './routes/auth.js';
import playersRouter from './routes/players.js';
import stopRouter from './routes/stop.js';

const app = express();
const port = process.env.PORT || 3001;

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
