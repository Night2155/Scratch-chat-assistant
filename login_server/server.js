const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./firebase-key.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'scratch_secret_key',
  resave: false,
  saveUninitialized: true
}));

// 登入處理
app.post('/login', async (req, res) => {
  // const { username, password } = req.body;
  const username = req.body.username ;
  const password = req.body.password ;
  try {
    const doc = await db.collection('students').doc(username).get();

    if (!doc.exists) {
      console.log("使用者不存在");
      return res.redirect('/login.html?error=1');
    }

    const student = doc.data();
    if (student.password === password) {
      req.session.user = username;

      // 登入紀錄
      await db.collection('logins').add({
        username,
        group: student.group,
        timestamp: new Date()
      });

      res.redirect(`/tasks.html?name=${encodeURIComponent(username)}&class=${encodeURIComponent(student.group)}`);
    } else {
      console.log("密碼錯誤");
      res.redirect('/login.html?error=1');
    }

  } catch (err) {
    console.error("登入錯誤", err);
    res.status(500).send("伺服器錯誤");
  }
});


// 限制只有登入過的人能看 tasks
app.get('/tasks.html', (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  next();
});

// ✅ 老師登入處理
app.post('/teacher-login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    const doc = await db.collection('teachers').doc(username).get();

    if (!doc.exists) {
      console.log("教師帳號不存在");
      return res.redirect('/teacher-login.html?error=1');
    }

    const teacher = doc.data();
    if (teacher.password === password) {
      req.session.teacher = {
        username: username,
        name: teacher.name
      };
      console.log(`✅ ${teacher.name} 登入成功`);
      return res.redirect(`/teacher.html?name=${encodeURIComponent(teacher.name)}`);
    } else {
      console.log("教師密碼錯誤");
      return res.redirect('/teacher-login.html?error=1');
    }
  } catch (err) {
    console.error("教師登入錯誤", err);
    res.status(500).send("伺服器錯誤");
  }
});

app.get('/userinfo', (req, res) => {
  if (req.session.teacher) {
    return res.json({
      role: 'teacher',
      name: req.session.teacher.name
    });
  }
  if (req.session.user) {
    return res.json({
      role: 'student',
      name: req.session.user
    });
  }
  return res.status(403).json({ error: '未登入' });
});


// 登出帳號
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

app.get('/', (req, res) => {
  if (req.session.teacher) {
    return res.redirect('/teacher.html');
  }
  if (req.session.user) {
    return res.redirect('/tasks.html');
  }
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`伺服器執行中： http://localhost:${PORT}`);
});

// 測試資料庫
app.get('/check-students', async (req, res) => {
  try {
    const snapshot = await db.collection('students').get();
    console.log(snapshot);
    if (snapshot.empty) {
      return res.send("⚠️ Firestore 中找不到任何學生資料！");
    }

    let output = "<h2>📋 資料庫中的學生帳號列表：</h2><ul>";

    snapshot.forEach(doc => {
      const data = doc.data();
      output += `<li><strong>${doc.id}</strong> → username: ${data.username}, password: ${data.password}, group: ${data.group}</li>`;
    });

    output += "</ul>";
    res.send(output);
  } catch (err) {
    console.error("❌ 查詢 Firestore 發生錯誤：", err);
    res.status(500).send("伺服器錯誤，無法讀取學生資料");
  }
});
