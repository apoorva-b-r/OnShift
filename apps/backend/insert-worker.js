const { MongoClient } = require('mongodb');

async function main() {
  console.log('Connecting to Atlas...');
  const client = new MongoClient(ATLAS_URI);
  await client.connect();
  const db = client.db('onshift');
  const col = db.collection('workers');

  await col.updateOne(
    { id: 'OS-COMPASS-DEMO-001' },
    {
      $setOnInsert: {
        id: 'OS-COMPASS-DEMO-001',
        name: 'Rimi Test Worker',
        workerCategory: 'Delivery Partner',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    },
    { upsert: true }
  );

  const doc = await col.findOne({ id: 'OS-COMPASS-DEMO-001' });
  const total = await col.countDocuments();

  console.log('\n✅ Document written to Atlas (onshift > workers):');
  console.log(JSON.stringify(doc, null, 2));
  console.log('\nTotal documents in workers collection:', total);

  await client.close();
}

main().catch(console.error);
