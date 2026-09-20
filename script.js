// 1. Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyDoxFOAl51DAJ_1Rlj60wsX-N0XvndmHeI",
  authDomain: "mahjong-penalty-app.firebaseapp.com",
  projectId: "mahjong-penalty-app",
  storageBucket: "mahjong-penalty-app.firebasestorage.app",
  messagingSenderId: "283623895217",
  appId: "1:283623895217:web:81191eb2a6240bd226f290",
  measurementId: "G-L6WNBWQSD2",
  databaseURL: "https://mahjong-penalty-app-default-rtdb.firebaseio.com" 
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. 官方固定懲罰庫
const officialLibrary = {
  triggers: [
    "自己摸到條子","自己摸到萬字","自己摸到筒子","自己摸到大字", 
    "別人打出條子","別人打出萬字","別人打出筒子","別人打出大字",
    "自己打出條子","自己打出萬字","自己打出筒子","自己打出大字",
    "全場安靜三秒","全場安靜一秒",
    "有人打出條子","有人打出萬字","有人打出筒子","有人打出大字",
    "有人唱歌","有人拿手機","有人喝水/飲料","有人拿起牌尺","有人站起來","有人觸發到懲罰",
    "只要有人吃牌","只要有人碰牌","只要有人補花",
    "只要有人喊「補花」","只要有人喊「吃」","只要有人喊「碰/對」","只要有人喊「胡/到」","有人講到顏色","有人講到數字","有人講到「東西南北」","有人講到「發財」","有人講到「紅中」","有人講到「東西南北中發白」","有人講到「你我他」","有人摸臉","有人摸頭","別人用「右手」摸牌","別人用「左手」摸牌","有人笑","下家「吃牌」","下家「碰牌」","上家「吃牌」","上家「碰牌」","對家「吃牌」","對家「碰牌」","有人「槓」牌","有人蓋牌（1張2張都算）","有人罵髒話","有人說「等一下」","有人說疑問句","有人說「ㄟ」"
  ],
  actions: [
    "深蹲 5 下","深蹲 3 下","深蹲 1 下","深蹲 2 下","站起來喊「我是小狗汪汪汪」","跳一段舞","高壓腿", "站起來轉 1 圈","站起來轉 2 圈","模仿一拳超人",
    "拿牌尺戳上家或下家","大喊「我是豬」","站起來跳 5 下", 
    "喝一口水/飲料","把自己的牌往前推一步","站起來跳 1 下","站起來跳 2 下",
    "站起來跳 3 下","把自己手上的牌洗ㄧ洗","盯著上家 5 秒","盯著下家 5 秒",
    "拿麻將打高爾夫球","拿麻將打樂樂棒球","拿麻將打撞球","學雞叫「咕咕咕」","學大猩猩的動作","打自己臉","學青蛙叫「呱呱呱」","站起來「拍手」","說「哇真棒」","拍一張照片發到群組","拿場上已經打出去的牌","跳扭脖子舞","說成語"
  ]
};

let currentRoom = "";
let myName = "";
let myEmoji = "🀄️";
let isHost = false; 
let hasDrawnInThisRound = false;
let lastRoundSeen = 0;
let previousScores = null; // 用於計分復原

// --- 房間進入與管理 ---
function createRoom() {
  myName = document.getElementById('userName').value.trim();
  myEmoji = document.getElementById('userEmoji').value.trim() || "🀄️";
  if (!myName) return alert("請輸入暱稱");
  
  const initBase = parseInt(document.getElementById('initBaseInput').value) || 20;
  const initTai = parseInt(document.getElementById('initTaiInput').value) || 5;

  isHost = true;
  currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
  
  database.ref(`rooms/${currentRoom}/status`).set({ 
    round: 1, 
    state: "active", 
    revealed: false,
    mode: "official",
    baseScore: initBase,
    taiScore: initTai,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP 
  });
  
  cleanupExpiredRoomsIfNeeded();
  enterRoom();
}

function joinRoom() {
  myName = document.getElementById('userName').value.trim();
  myEmoji = document.getElementById('userEmoji').value.trim() || "🀄️";
  const inputRoomId = document.getElementById('joinRoomId').value.trim();
  if (!myName || !inputRoomId) return alert("請輸入暱稱與房號");
  currentRoom = inputRoomId;
  isHost = false; 
  enterRoom();
}

function enterRoom() {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('roomArea').style.display = 'block';
  document.getElementById('currentRoomDisplay').innerText = currentRoom;
  if (isHost) document.getElementById('hostControls').style.display = 'block';

  // 儲存包含 Emoji 的玩家物件
  const playerRef = database.ref(`rooms/${currentRoom}/players`).push();
  playerRef.set({ name: myName, emoji: myEmoji });
  playerRef.onDisconnect().remove();

  // 監聽玩家清單與更新計分下拉選單
  database.ref(`rooms/${currentRoom}/players`).on('value', (snapshot) => {
    const listDiv = document.getElementById('playerList');
    const winnerSelect = document.getElementById('winnerSelect');
    const loserSelect = document.getElementById('loserSelect');

    listDiv.innerHTML = "";
    winnerSelect.innerHTML = '<option value="">選擇胡牌/自摸者</option>';
    loserSelect.innerHTML = '<option value="">選擇放銃者</option>';

    if (snapshot.val()) {
      const playersObj = snapshot.val();
      Object.values(playersObj).forEach(player => {
        const pName = player.name;
        const pEmoji = player.emoji || "👤";
        listDiv.innerHTML += `<span class="player-tag">${pEmoji} ${pName}</span>`;
        winnerSelect.innerHTML += `<option value="${pName}">${pEmoji} ${pName}</option>`;
        loserSelect.innerHTML += `<option value="${pName}">${pEmoji} ${pName}</option>`;
      });
    }
  });

  // 監聽積分榜分數（結合 Emoji 顯示）
  database.ref(`rooms/${currentRoom}/scores`).on('value', (scoreSnap) => {
    const scores = scoreSnap.val() || {};
    
    database.ref(`rooms/${currentRoom}/players`).once('value', (playerSnap) => {
      const playersObj = playerSnap.val() || {};
      const emojiMap = {};
      Object.values(playersObj).forEach(p => {
        emojiMap[p.name] = p.emoji || "👤";
      });

      const scoreboardDiv = document.getElementById('scoreboardList');
      scoreboardDiv.innerHTML = "";
      
      if (Object.keys(scores).length === 0) {
        scoreboardDiv.innerHTML = "<div style='opacity:0.6; text-align:center;'>尚無戰績，大家目前皆為 0 分</div>";
      } else {
        Object.entries(scores).forEach(([name, score]) => {
          const emoji = emojiMap[name] || "👤";
          const colorStyle = score > 0 ? 'color: #81c784;' : (score < 0 ? 'color: #e57373;' : 'color: #ffd700;');
          scoreboardDiv.innerHTML += `
            <div class="score-row">
              <span>${emoji} ${name}</span>
              <span class="score-num" style="${colorStyle}">${score > 0 ? '+' + score : score} 分</span>
            </div>
          `;
        });
      }
    });
  });

  // 監聽房間狀態與規則
  database.ref(`rooms/${currentRoom}/status`).on('value', (snapshot) => {
    const status = snapshot.val();
    if (status) {
      document.getElementById('roundNumber').innerText = status.round;
      
      const base = status.baseScore || 20;
      const tai = status.taiScore || 5;
      document.getElementById('ruleDisplay').innerText = `底 ${base} / 台 ${tai}`;
      
      if (isHost) {
        if (document.getElementById('ruleBase')) document.getElementById('ruleBase').value = base;
        if (document.getElementById('ruleTai')) document.getElementById('ruleTai').value = tai;
      }

      if (document.getElementById('penaltyMode')) {
        document.getElementById('penaltyMode').value = status.mode || "official";
      }

      const drawBtn = document.getElementById('drawBtn');
      const display = document.getElementById('display');

      if (status.round > lastRoundSeen) {
        hasDrawnInThisRound = false;
        lastRoundSeen = status.round;
        display.innerText = "新局開始！請摸牌";
        document.getElementById('reRollControls').style.display = 'none';
      }

      if (status.state === "active" && !hasDrawnInThisRound) {
        drawBtn.disabled = false;
        drawBtn.innerText = "摸牌 (抽籤)";
      } else {
        drawBtn.disabled = true;
        drawBtn.innerText = hasDrawnInThisRound ? "已就緒" : "等待中";
      }

      if (status.revealed) {
        fetchResults();
        document.getElementById('reRollControls').style.display = 'none';
      } else {
        document.getElementById('roundResults').innerHTML = "<div style='opacity:0.5; text-align:center;'>等候房主揭曉結果...</div>";
      }
    }
  });

  database.ref(`rooms/${currentRoom}/content`).on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      document.getElementById('triggersInput').value = data.triggers;
      document.getElementById('actionsInput').value = data.actions;
    }
  });
}

// --- 計分相關函數 ---
function toggleWinType() {
  const winType = document.getElementById('winType').value;
  const loserSelect = document.getElementById('loserSelect');
  if (winType === 'zimo') {
    loserSelect.style.display = 'none';
  } else {
    loserSelect.style.display = 'block';
  }
}

function submitScore() {
  const winType = document.getElementById('winType').value;
  const winner = document.getElementById('winnerSelect').value;
  const loser = document.getElementById('loserSelect').value;
  
  if (!winner) return alert("請選擇胡牌/自摸者！");
  if (winType === 'fangchong' && !loser) return alert("請選擇放銃者！");
  if (winType === 'fangchong' && winner === loser) return alert("胡牌者與放銃者不能是同一人！");

  const tai = parseInt(document.getElementById('taishuInput').value) || 1;

  database.ref(`rooms/${currentRoom}/status`).once('value', (statusSnap) => {
    const status = statusSnap.val() || {};
    const base = status.baseScore || 20;
    const perTai = status.taiScore || 5;
    
    const totalWinScore = base + (tai * perTai);

    database.ref(`rooms/${currentRoom}/scores`).once('value', (snapshot) => {
      let currentScores = snapshot.val() || {};

      // 備份當前分數供「復原上一局」使用
      previousScores = JSON.parse(JSON.stringify(currentScores));

      database.ref(`rooms/${currentRoom}/players`).once('value', (playerSnap) => {
        if (playerSnap.val()) {
          // players 裡面存的是物件 { -Id: {name, emoji}, ... }
          const playersObj = playerSnap.val();
          Object.values(playersObj).forEach(p => {
            if (currentScores[p.name] === undefined) currentScores[p.name] = 0;
            if (previousScores[p.name] === undefined) previousScores[p.name] = 0;
          });

          if (winType === 'zimo') {
            let totalGained = 0;
            Object.keys(currentScores).forEach(pName => {
              if (pName !== winner) {
                currentScores[pName] -= totalWinScore;
                totalGained += totalWinScore;
              }
            });
            currentScores[winner] += totalGained;
          } else {
            currentScores[winner] += totalWinScore;
            currentScores[loser] -= totalWinScore;
          }

          database.ref(`rooms/${currentRoom}/scores`).set(currentScores).then(() => {
            database.ref(`rooms/${currentRoom}/status`).update({
              lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert(`結算完成！贏家獲得 ${totalWinScore} 分`);
            document.getElementById('winnerSelect').value = "";
            document.getElementById('loserSelect').value = "";
            document.getElementById('taishuInput').value = "1";
          });
        }
      });
    });
  });
}

// 🔄 復原上一局結算
function undoLastScore() {
  if (!previousScores) {
    return alert("目前沒有可復原的記錄（或已經復原過了）！");
  }

  if (confirm("確定要將積分復原回上一局結算前的狀態嗎？")) {
    database.ref(`rooms/${currentRoom}/scores`).set(previousScores).then(() => {
      alert("已成功復原上一局分數！");
      previousScores = null; 
    });
  }
}

function updateRules() {
  if (!isHost) return;
  const newBase = parseInt(document.getElementById('ruleBase').value) || 20;
  const newTai = parseInt(document.getElementById('ruleTai').value) || 5;
  
  database.ref(`rooms/${currentRoom}/status`).update({
    baseScore: newBase,
    taiScore: newTai,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP
  });
}

// --- 遊戲懲罰抽籤邏輯 ---
function fetchResults() {
  database.ref(`rooms/${currentRoom}/results`).once('value', (snapshot) => {
    const listDiv = document.getElementById('roundResults');
    listDiv.innerHTML = "";
    if (snapshot.val()) {
      database.ref(`rooms/${currentRoom}/players`).once('value', (playerSnap) => {
        const playersObj = playerSnap.val() || {};
        const emojiMap = {};
        Object.values(playersObj).forEach(p => {
          emojiMap[p.name] = p.emoji || "👤";
        });

        Object.entries(snapshot.val()).forEach(([name, data]) => {
          const emoji = emojiMap[name] || "👤";
          listDiv.innerHTML += `<div style="padding:5px 0; border-bottom:1px solid #eee;"><b>${emoji} ${name}</b>：<span class="trigger-text" style="font-size:1rem">${data.t}</span> → <span class="action-text" style="font-size:1rem">${data.a}</span></div>`;
        });
      });
    }
  });
}

function startNextRound() {
  database.ref(`rooms/${currentRoom}/results`).remove();
  const currentMode = document.getElementById('penaltyMode').value;
  database.ref(`rooms/${currentRoom}/status`).update({
    round: (lastRoundSeen || 1) + 1,
    state: "active",
    revealed: false,
    mode: currentMode,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP
  });
}

function revealResults() {
  database.ref(`rooms/${currentRoom}/status`).update({ 
    revealed: true,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP 
  });
}

function updateDisplayContent(t, a) {
  document.getElementById('display').innerHTML = `
    你摸到了：<br>
    <span class="trigger-text">${t}</span>
    <div class="arrow-text">要做</div>
    <span class="action-text">${a}</span>
  `;
}

function draw() {
  if (hasDrawnInThisRound) return;

  database.ref(`rooms/${currentRoom}/status/mode`).once('value', (snapshot) => {
    const mode = snapshot.val() || "official";
    let tList, aList;
    const regex = /[,，\s]+/;

    if (mode === "official") {
      tList = officialLibrary.triggers;
      aList = officialLibrary.actions;
    } else {
      tList = document.getElementById('triggersInput').value.split(regex).map(s => s.trim()).filter(s => s !== "");
      aList = document.getElementById('actionsInput').value.split(regex).map(s => s.trim()).filter(s => s !== "");
    }

    const finalT = tList[Math.floor(Math.random() * tList.length)];
    const finalA = aList[Math.floor(Math.random() * aList.length)];

    hasDrawnInThisRound = true;
    updateDisplayContent(finalT, finalA);
    database.ref(`rooms/${currentRoom}/results/${myName}`).set({ t: finalT, a: finalA });
    document.getElementById('reRollControls').style.display = 'flex';
  });
}

function reRoll(type) {
  database.ref(`rooms/${currentRoom}/status/mode`).once('value', (snapshot) => {
    const mode = snapshot.val() || "official";
    let list;
    const regex = /[,，\s]+/;
    
    if (type === 't') {
      list = (mode === "official") ? officialLibrary.triggers : 
             document.getElementById('triggersInput').value.split(regex).map(s => s.trim()).filter(s => s !== "");
    } else {
      list = (mode === "official") ? officialLibrary.actions : 
             document.getElementById('actionsInput').value.split(regex).map(s => s.trim()).filter(s => s !== "");
    }

    const newValue = list[Math.floor(Math.random() * list.length)];
    
    database.ref(`rooms/${currentRoom}/results/${myName}`).once('value', (snap) => {
      const data = snap.val() || { t: "", a: "" };
      if (type === 't') data.t = newValue;
      else data.a = newValue;
      
      database.ref(`rooms/${currentRoom}/results/${myName}`).set(data);
      updateDisplayContent(data.t, data.a);
    });
  });
}

function syncData() {
  const t = document.getElementById('triggersInput').value;
  const a = document.getElementById('actionsInput').value;
  database.ref(`rooms/${currentRoom}/content`).set({ triggers: t, actions: a });
  alert("內容已成功同步！");
}

function syncMode() {
  if (!isHost) return;
  const mode = document.getElementById('penaltyMode').value;
  database.ref(`rooms/${currentRoom}/status`).update({ mode: mode });
}

// 🧹 自動清理超過 14 天未使用的房間（包含無時間戳記的舊房）
function cleanupExpiredRoomsIfNeeded() {
  const roomsRef = database.ref("rooms");
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  roomsRef.once("value", (snapshot) => {
    const rooms = snapshot.val();
    if (!rooms) return;

    Object.entries(rooms).forEach(([roomId, roomData]) => {
      const status = roomData.status || {};
      const lastUpdated = status.lastUpdated;

      if (!lastUpdated || (now - lastUpdated > fourteenDays)) {
        roomsRef.child(roomId).remove();
      }
    });
  });
}