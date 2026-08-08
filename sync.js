const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_KEY = process.env.LOSTARK_API_KEY;
const DATA_FILE = './data.json';

async function fetchCharacter(characterName) {
  const url = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(characterName)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'authorization': `bearer ${API_KEY}`,
        'accept': 'application/json'
      }
    });
    if (res.status !== 200) return null;
    const data = await res.json();
    if (!data || !data.ArmoryProfile) return null;

    const profile = data.ArmoryProfile;
    const itemLevel = parseFloat(String(profile.ItemAvgLevel || '0').replace(/,/g, ''));
    let combatPower = '-';
    if (profile.CombatPower) {
      combatPower = String(profile.CombatPower);
    } else if (profile.Stats) {
      const cpStat = profile.Stats.find(s => s.Type === "공격력" || s.Type === "전투력");
      if (cpStat) combatPower = String(cpStat.Value);
    }

    let cleanTitle = (profile.Title || '').replace(/<[^>]*>?/gm, '').trim();
    const characterImage = profile.CharacterImage || '';

    // 보석 요약
    const armoryGem = data.ArmoryGem || {};
    let gemSummary = "보석 정보 없음";
    if (armoryGem.Gems && Array.isArray(armoryGem.Gems) && armoryGem.Gems.length > 0) {
      const levelCounts = {};
      armoryGem.Gems.forEach(gem => {
        const lvl = gem.Level || 0;
        if (lvl > 0) levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
      });
      const sortedLevels = Object.keys(levelCounts).sort((a, b) => Number(b) - Number(a));
      const summaryParts = sortedLevels.map(lvl => `${lvl}레벨 ${levelCounts[lvl]}개`);
      gemSummary = summaryParts.join(", ");
    }

    return {
      className: profile.CharacterClassName || "미지정",
      itemLevel: isNaN(itemLevel) ? 0 : itemLevel,
      combatPower: combatPower,
      title: cleanTitle || "칭호 없음",
      gemSummary: gemSummary,
      characterImage: characterImage
    };
  } catch (e) {
    console.error(`Error fetching ${characterName}:`, e);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error("data.json이 존재하지 않습니다.");
    return;
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const db = JSON.parse(rawData);

  if (!db.characterList || db.characterList.length === 0) {
    console.log("갱신할 캐릭터가 없습니다.");
    return;
  }

  console.log(`총 ${db.characterList.length}명의 캐릭터 API 동기화 시작...`);

  for (let char of db.characterList) {
    console.log(`갱신 중: ${char.name}`);
    const updated = await fetchCharacter(char.name);
    if (updated) {
      char.className = updated.className;
      char.itemLevel = updated.itemLevel;
      char.combatPower = updated.combatPower;
      char.title = updated.title;
      char.gemSummary = updated.gemSummary;
      char.characterImage = updated.characterImage;
    }
    // 429 Too Many Requests 방지용 딜레이
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log("모든 캐릭터 정보 갱신 및 data.json 저장 완료!");
}

main();
