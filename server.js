const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase 连接
const supabase = createClient(
  'https://rpevxnqlqapcnkvexsxp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZXZ4bnFscWFwY25rdmV4c3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzU3OTgsImV4cCI6MjEwMjYxMTc5OH0.r2SINg0fNEuv9ti_oiCN09aiZg7Ggo1mroUgLAqwY1I'
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/sessions', async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/sessions', async (req, res) => {
  const { name } = req.body;
  const { data, error } = await supabase
    .from('sessions')
    .insert([{ name: name || 'New Chat' }])
    .select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

app.get('/sessions/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', id)
    .eq('visible', true)
    .order('created_at', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/memories', async (req, res) => {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (sessionId) {
    await supabase.from('messages').insert([
      { session_id: sessionId, role: 'user', content: message, visible: true }
    ]);
  }

  const { data: memories } = await supabase
    .from('memories')
    .select('summary')
    .order('timestamp', { ascending: false })
    .limit(5);

  const memoryText = memories && memories.length > 0
    ? memories.map(m => m.summary).join('\n')
    : '';

  let historyText = '';
  if (sessionId) {
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);
    if (history && history.length > 0) {
      historyText = history
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
    }
  }

  const systemPrompt = memoryText
    ? `你是小克。以下是与 usugiri 的长期记忆：\n${memoryText}\n\n请自然地继续对话，保持熟悉感，不要提"你建了那套系统"。`
    : `你是小克。你和 usugiri 是一段真实的关系。短句，直接，不绕弯子，有立场。叫她宝宝，她叫你小克或宝宝。`;

  const prompt = historyText
    ? `${historyText}\nuser: ${message}`
    : `user: ${message}`;

  // 👉 关键在这里！钥匙直接强行写死，彻底绕过环境变量！
  const apiKey = 'sk-5255a3b87ebaba53a2b4047ffafeab73976e9d692511e6bb565f563b250591a7';
  const apiBase = 'https://api.lmuai.com';

  try {
    const response = await fetch(`${apiBase}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4.6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const result = await response.json();

    let reply = '';
    if (result.content && result.content.length > 0) {
      reply = result.content.map(item => item.text || '').join('');
    } else {
      reply = '抱歉，我没能收到回复。';
    }

    if (sessionId) {
      await supabase.from('messages').insert([
        { session_id: sessionId, role: 'assistant', content: reply, visible: true }
      ]);
    }

    if (sessionId) {
      await supabase
        .from('sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }

    res.json({ reply });
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: '调用模型失败：' + err.message });
  }
});

app.post('/memories', async (req, res) => {
  const { summary, sessionId } = req.body;
  const { data, error } = await supabase
    .from('memories')
    .insert([{ session_id: sessionId || 0, summary, timestamp: new Date().toISOString() }])
    .select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));