const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('onshift');
  const docs = await db.collection('workers').find({}).toArray();

  console.log('\n=== onshift.workers collection ===');
  console.log('Total documents:', docs.length);
  console.log('');
  docs.forEach((doc, i) => {
    console.log(`--- Document ${i + 1} ---`);
    console.log(JSON.stringify(doc, null, 2));
    console.log('');
  });
  console.log('=== end ===\n');

  await client.close();
}

main().catch(console.error);
