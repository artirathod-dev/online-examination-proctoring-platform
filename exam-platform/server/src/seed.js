import bcrypt from 'bcryptjs';
import { pool, q } from './db.js';

const users = [
  ['Admin', 'admin@exam.com', 'admin123', 'admin'],
  ['Demo Student', 'student@exam.com', 'student123', 'student'],
];
for (const [name, email, pw, role] of users) {
  await q(
    `INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
    [name, email, bcrypt.hashSync(pw, 10), role]
  );
}

const [{ count }] = await q('SELECT COUNT(*)::int AS count FROM questions');
if (count === 0) {
  const Q = [
    ['What is the output of 2 + "2" in JavaScript?', ['4', '"22"', 'NaN', 'Error'], 1, 'JavaScript'],
    ['Which hook manages state in a React function component?', ['useEffect', 'useState', 'useRef', 'useMemo'], 1, 'React'],
    ['Which HTTP method is idempotent?', ['POST', 'PATCH', 'PUT', 'CONNECT'], 2, 'Web'],
    ['Which SQL clause filters grouped rows?', ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], 1, 'SQL'],
    ['What does WebRTC primarily enable?', ['File hosting', 'Peer-to-peer real-time media', 'Database sync', 'Server rendering'], 1, 'Web'],
    ['Time complexity of binary search?', ['O(n)', 'O(n log n)', 'O(log n)', 'O(1)'], 2, 'Algorithms'],
    ['Which data structure uses LIFO?', ['Queue', 'Stack', 'Heap', 'Graph'], 1, 'Algorithms'],
    ['In Node.js, which module handles file paths?', ['fs', 'http', 'path', 'os'], 2, 'Node.js'],
    ['What does JWT stand for?', ['Java Web Token', 'JSON Web Token', 'JavaScript Web Tool', 'Joint Web Transfer'], 1, 'Web'],
    ['Which SQL command removes a table entirely?', ['DELETE', 'TRUNCATE', 'DROP', 'REMOVE'], 2, 'SQL'],
    ['Which is NOT a JavaScript primitive?', ['Symbol', 'BigInt', 'Object', 'Boolean'], 2, 'JavaScript'],
    ['STUN servers are used to…', ['Encrypt video', 'Discover public IP/port for NAT traversal', 'Store messages', 'Compress audio'], 1, 'Web'],
  ];
  const ids = [];
  for (const [text, options, correct, topic] of Q) {
    const [r] = await q(
      `INSERT INTO questions(text,options,correct_index,topic,marks) VALUES($1,$2,$3,$4,1) RETURNING id`,
      [text, JSON.stringify(options), correct, topic]
    );
    ids.push(r.id);
  }
  const [exam] = await q(
    `INSERT INTO exams(title,description,duration_min,pass_percent,shuffle) VALUES($1,$2,$3,$4,true) RETURNING id`,
    ['Full-Stack Fundamentals', 'A quick test of web development basics.', 10, 40]
  );
  for (const id of ids) await q('INSERT INTO exam_questions VALUES($1,$2)', [exam.id, id]);
}
console.log('✔ Seeded. Admin: admin@exam.com / admin123  |  Student: student@exam.com / student123');
await pool.end();
