// 백엔드 주소. Vite proxy 대신 CORS로 가기로 해서 클라이언트가 주소를 직접 안다.
// 배포 환경마다 달라지므로 .env로 뺐다. Vite는 VITE_ 접두사가 붙은 것만 노출한다.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 백엔드 응답 키(accessToken)와 같은 이름을 써서 둘의 대응을 눈에 보이게 뒀다.
const TOKEN_STORAGE_KEY = 'accessToken';

/**
 * 모든 요청이 거쳐가는 공통 처리.
 *
 * export하지 않는 이유: 화면이 URL과 payload 키를 직접 알게 되면 백엔드 계약이
 * 화면 코드로 새어나간다. 밖으로는 이름 붙은 함수만 내보낸다.
 */
async function request(path, options = {}) {
  const headers = { ...options.headers };

  // 본문이 있을 때만 붙인다. GET에는 알릴 본문이 없다.
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  // 토큰은 화면이 넘겨주지 않는다. sessionStorage를 아는 코드를 이 파일에만
  // 가둬야 저장 위치를 바꿀 때 여기 한 곳만 고치면 된다.
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // fetch는 401·503에도 예외를 던지지 않는다. 응답이 왔다는 것과 성공했다는 것은
  // 다른 사건이라, 성공 여부는 여기서 직접 판단해야 한다.
  if (!response.ok) {
    // 실패 응답은 어느 엔드포인트든 error 키 하나에 문구를 싣는다 (README의 API 계약).
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error ?? `Request failed (${response.status})`);

    // Dashboard가 상태를 초록/빨강/회색 세 가지로 나누려면 "백엔드가 503을 줬다"와
    // "백엔드가 아예 답을 못 했다"를 구분해야 한다. 후자는 fetch 자체가 던지므로
    // status가 없고, 전자만 이 값을 갖는다.
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function requestToken(password) {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function saveToken(token) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}
export function hasToken() {
  // 토큰이 있는지 없는지 유무만 체크.
  return !!sessionStorage.getItem(TOKEN_STORAGE_KEY);
}
export async function getPlayers() {
  return request('/api/players');
}

export async function stopServer() {
  return request('/api/stop', { method: 'POST' });
}

export async function getWhitelist() {
  return request('/api/whitelist');
}

export async function addToWhitelist(targetMojangName) {
  return request('/api/whitelist', {
    method: 'POST',
    body: JSON.stringify({ targetMojangName }),
  });
}

export async function removeFromWhitelist(playerName) {
  // 이름이 경로에 들어가므로 인코딩한다. Minecraft 이름은 영숫자와 _ 뿐이라
  // 실제로 바뀔 일은 없지만, 사용자 입력을 URL에 그대로 붙이지 않는다는 원칙을 지킨다.
  return request(`/api/whitelist/${encodeURIComponent(playerName)}`, {
    method: 'DELETE',
  });
}

export async function sendCommand(command) {
  return request('/api/console', {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

export async function getLogs() {
  return request('/api/logs');
}
