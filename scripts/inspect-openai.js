const OpenAI = require('openai');

(async () => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('SDK keys on root:', Object.keys(openai));
  console.log('Has beta:', !!openai.beta);
  if (openai.beta) {
    console.log('beta keys:', Object.keys(openai.beta));
    const vs = openai.beta.vectorStores;
    console.log('Has beta.vectorStores:', !!vs);
    if (vs) {
      console.log('vectorStores keys:', Object.keys(vs));
      console.log('typeof list:', typeof vs.list);
      console.log('typeof create:', typeof vs.create);
      console.log('typeof files:', typeof vs.files);
      if (vs.files) {
        console.log('vectorStores.files keys:', Object.keys(vs.files));
      }
      try {
        const list = await vs.list({ limit: 1 });
        console.log('vectorStores.list ok, count:', list.data.length, 'has_more:', list.has_more);
      } catch (e) {
        console.log('vectorStores.list error:', e.message);
      }
    }
  }
})();