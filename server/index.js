import express from 'express';

const app = express();
const port = process.env.PORT || 3001;

// 아직 routes/가 비어있어서 헬스체크 라우트만 직접 둠 — 다음 단계에서 routes/로 옮김
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
