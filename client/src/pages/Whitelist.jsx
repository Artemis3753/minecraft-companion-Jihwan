import { useEffect, useState } from 'react';

import { getWhitelist, addToWhitelist, removeFromWhitelist } from '../api.js';

export default function Whitelist() {
  // 배열로 시작하는 이유: 백엔드가 목록이 비어도 []를 주기로 계약돼 있어 모양이
  // 절대 바뀌지 않는다. 그래서 map을 그냥 돌릴 수 있고 null 체크가 필요 없다.
  // 조회·추가·삭제가 전부 갱신된 전체 목록을 주므로, 셋 다 여기에 결과를 넣는다.
  const [whitelistNames, setWhitelistNames] = useState([]);

  // []는 "비어 있다"와 "아직 모른다"를 구별하지 못한다. 로딩 중에 목록을 그리면
  // 화면이 잠깐 "아무도 없다"고 거짓말하므로, 이 값으로 먼저 걸러낸다.
  const [isLoading, setIsLoading] = useState(true);

  // status로 가르지 않는 이유: 이 화면은 서버 상태를 보고하지 않는다. 사용자가
  // 알아야 할 건 왜 실패했는지뿐이고, 그 문장은 api.js가 이미 만들어 넘긴다.
  const [loadErrorMsg, setLoadErrorMsg] = useState(null);

  // 입력창의 값. 친 그대로 담고 trim은 쓰는 자리에서 한다 — onChange에서 자르면
  // 타이핑 중에 공백을 못 치게 되어 입력창이 고장 난 것처럼 느껴진다.
  const [nameToAdd, setNameToAdd] = useState('');

  // 요청이 나가 있는 동안 폼을 잠근다. 추가는 RCON 명령을 두 번 보내므로
  // (add 후 list) 조회보다 느리고, 그 사이 연타가 나오기 쉽다.
  const [isAdding, setIsAdding] = useState(false);

  // 조회 실패와 따로 두는 이유: 조회 실패는 "보여줄 목록이 없다"이고 추가 실패는
  // "목록은 그대로인데 이번 시도만 실패했다"라, 화면이 해야 할 일이 다르다.
  const [addErrorMsg, setAddErrorMsg] = useState(null);

  // boolean이 아니라 이름을 담는다. 행이 여러 개라 "확인 단계다"만으로는 어느 행을
  // 다르게 그려야 할지 알 수 없다. null이면 어느 행도 확인 중이 아니다.
  const [nameToRemove, setNameToRemove] = useState(null);

  // 어느 행이 처리 중인지는 nameToRemove가 이미 알고 있으므로 boolean으로 충분하다.
  const [isRemoving, setIsRemoving] = useState(false);

  // 행의 이름은 백엔드가 준 것이라 404는 사실상 나지 않는다. 여기 담기는 건
  // 주로 503(마인크래프트가 죽음)과 401이다.
  const [removeErrorMsg, setRemoveErrorMsg] = useState(null);

  useEffect(() => {
    // useEffect의 반환값은 정리(cleanup) 함수로 취급되는데 async 함수는 Promise를
    // 반환하므로, 콜백을 직접 async로 만들지 않고 안에서 만들어 부른다.
    async function loadWhitelist() {
      try {
        // 구조분해로 바로 꺼내면 이름이 state 변수와 겹쳐 가려진다. 한 단계 두면
        // 백엔드 응답의 키와 화면의 state가 각각 무엇인지 눈에 남는다.
        const data = await getWhitelist();
        setWhitelistNames(data.whitelistNames);
      } catch (error) {
        setLoadErrorMsg(error.message);
      } finally {
        // 성공 쪽에만 두면 실패했을 때 화면이 "불러오는 중"에 영영 갇힌다.
        setIsLoading(false);
      }
    }

    loadWhitelist();
    // 빈 배열은 "다시 실행할 조건이 없다"는 뜻이라 마운트 시 한 번만 돈다.
  }, []);

  async function handleAddSubmit(event) {
    // form의 기본 동작은 페이지를 통째로 새로고침하는 것이다. 막지 않으면
    // 화면이 깜빡이며 state가 전부 초기값으로 돌아간다.
    event.preventDefault();

    setIsAdding(true);
    // 이전 시도의 문구가 남아 있으면 방금 누른 결과로 오해된다.
    setAddErrorMsg(null);

    try {
      // 앞뒤 공백을 붙여 보내면 Mojang 조회가 실패한다. 화면에 보이는 값은
      // 건드리지 않고, 보내는 값만 다듬는다.
      const data = await addToWhitelist(nameToAdd.trim());

      // 응답이 추가 후의 전체 목록이라 다시 조회할 필요가 없다. 대소문자 교정도
      // 여기서 따라온다 — 백엔드가 whitelist list로 정식 표기를 읽어 보내준다.
      setWhitelistNames(data.whitelistNames);

      // 성공했을 때만 비운다. 실패했는데 비우면 오타로 404가 났을 때 방금 친
      // 이름을 처음부터 다시 쳐야 한다. 고칠 대상은 눈앞에 남아 있어야 한다.
      setNameToAdd('');
    } catch (error) {
      // 409(이미 등록)·404(계정 없음)·503을 여기서 가르지 않는 이유는, 백엔드가
      // 셋 다 사람이 읽을 문장으로 보내주기 때문이다. 화면이 할 일은 옮기는 것뿐.
      setAddErrorMsg(error.message);
    } finally {
      setIsAdding(false);
    }
  }

  // 확인 영역을 여는 순간이 새 시도의 시작이라, 지난 실패 문구를 여기서 지운다.
  // 남겨두면 방금 연 확인 창 옆에 지난 실패가 붙어 있게 된다.
  function handleRemoveClick(playerName) {
    setNameToRemove(playerName);
    setRemoveErrorMsg(null);
  }

  async function handleConfirmRemove() {
    setIsRemoving(true);

    try {
      // 이 값은 확인 영역이 열릴 때 정해진 것이라, 요청이 나가 있는 동안 다른 행을
      // 눌러도 보내진 이름은 바뀌지 않는다.
      const data = await removeFromWhitelist(nameToRemove);
      setWhitelistNames(data.whitelistNames);
    } catch (error) {
      setRemoveErrorMsg(error.message);
    } finally {
      setIsRemoving(false);
      // 실패해도 확인 영역을 닫는다. 열어둔 채 두면 다음 클릭 한 번에 삭제가
      // 실행되므로, 다시 지우려면 확인을 처음부터 거치게 하는 편이 안전하다.
      // Dashboard의 Stop이 실패했을 때와 같은 판단이다.
      setNameToRemove(null);
    }
  }

  if (isLoading) {
    return <p>Loading the whitelist…</p>;
  }

  // 조회가 실패했으면 보여줄 목록도, 목록에 더할 자리도 없다. 추가 실패와 달리
  // 화면 전체를 대신하는 이유가 그것이다.
  if (loadErrorMsg) {
    return <p>{loadErrorMsg}</p>;
  }

  return (
    <section>
      <h1>Whitelist</h1>

      <form onSubmit={handleAddSubmit}>
        {/* placeholder는 값을 치기 시작하면 사라지므로 라벨을 대신하지 못한다.
            화면에 라벨을 두지 않는 대신 aria-label로 이름을 남긴다. */}
        <input
          type="text"
          value={nameToAdd}
          onChange={(event) => setNameToAdd(event.target.value)}
          placeholder="Player name"
          aria-label="Player name to add"
          disabled={isAdding}
        />

        {/* 공백만 친 경우도 trim 후 빈 문자열이 되므로 같은 검사에 걸린다. */}
        <button type="submit" disabled={isAdding || nameToAdd.trim() === ''}>
          Add
        </button>
      </form>

      {/* 목록과 나란히 둔다. 이 실패는 목록을 무효로 만들지 않는다. */}
      {addErrorMsg && <p>{addErrorMsg}</p>}

      {/* 확인을 행 안이 아니라 목록 밖에서 받는다. 행 안에서 Remove가 Yes로 바뀌면
          같은 자리라 더블클릭 한 번에 두 단계가 다 지나간다. 자리가 아예 다르면
          그 사고가 구조적으로 불가능하고, 지울 대상을 문장으로 밝힐 수도 있다. */}
      {nameToRemove && (
        <div>
          <p>Remove {nameToRemove} from the whitelist?</p>
          <button type="button" onClick={() => setNameToRemove(null)} disabled={isRemoving}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirmRemove} disabled={isRemoving}>
            Yes, remove
          </button>
        </div>
      )}

      {removeErrorMsg && <p>{removeErrorMsg}</p>}

      {/* 빈 배열이면 ul이 껍데기만 남아 아무 말도 하지 않는다.
          "아무도 없다"는 것도 알려줘야 할 정보라 문구로 대신한다. */}
      {whitelistNames.length === 0 ? (
        <p>No one is whitelisted.</p>
      ) : (
        <ul>
          {/* key에 인덱스 대신 이름을 쓰는 이유는 Dashboard와 같다. 항목이 지워지면
              인덱스가 밀려 엉뚱한 행에 붙는다. Minecraft 이름은 중복되지 않는다. */}
          {whitelistNames.map((playerName) => (
            <li key={playerName}>
              {playerName}{' '}
              {/* 행은 확인 단계를 몰라도 된다. 조건이 목록 밖에 한 번만 있으므로
                  여기는 언제나 버튼 하나만 그린다. */}
              <button
                type="button"
                onClick={() => handleRemoveClick(playerName)}
                disabled={isRemoving}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
