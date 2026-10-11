import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
const runDatabaseSuite = connectionString ? describe : describe.skip;

function assertE2eDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '').toLowerCase();
  if (!name.includes('e2e') && !name.includes('test')) {
    throw new Error(`Refusing integration tests against non-test database: ${name}`);
  }
}

runDatabaseSuite('PostgreSQL integrity and transaction boundaries', () => {
  let db: Client;
  const ids = {
    buyer: randomUUID(),
    seller: randomUUID(),
    category: randomUUID(),
    product: randomUUID(),
  };
  const suffix = randomUUID().replaceAll('-', '');

  beforeAll(async () => {
    assertE2eDatabase(connectionString!);
    db = new Client({ connectionString });
    await db.connect();
    await db.query(
      `INSERT INTO users (id,email,password_hash,name,role,status)
       VALUES ($1,$2,'test-hash','DB Buyer','BUYER','ACTIVE'),($3,$4,'test-hash','DB Seller','SELLER','ACTIVE')`,
      [ids.buyer, `test-buyer-${suffix}@example.invalid`, ids.seller, `test-seller-${suffix}@example.invalid`],
    );
    await db.query(
      `INSERT INTO seller_profiles (user_id,store_name,slug,status) VALUES ($1,'test Store',$2,'ACTIVE')`,
      [ids.seller, `test-store-${suffix}`],
    );
    await db.query(
      `INSERT INTO categories (id,name,slug) VALUES ($1,'test Category',$2)`,
      [ids.category, `test-category-${suffix}`],
    );
    await db.query(
      `INSERT INTO products (id,seller_id,category_id,name,slug,description,sku,price,currency,status)
       VALUES ($1,$2,$3,'test Product',$4,'Database integration test product description',$5,19.95,'USD','ACTIVE')`,
      [ids.product, ids.seller, ids.category, `test-product-${suffix}`, `test-${suffix}`],
    );
    await db.query(`INSERT INTO inventory (product_id,available_quantity,reserved_quantity) VALUES ($1,1,0)`, [ids.product]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.query(`DELETE FROM wishlist_items WHERE user_id=$1 OR product_id=$2`, [ids.buyer, ids.product]).catch(() => undefined);
    await db.query(`DELETE FROM inventory WHERE product_id=$1`, [ids.product]).catch(() => undefined);
    await db.query(`DELETE FROM products WHERE id=$1`, [ids.product]).catch(() => undefined);
    await db.query(`DELETE FROM categories WHERE id=$1`, [ids.category]).catch(() => undefined);
    await db.query(`DELETE FROM seller_profiles WHERE user_id=$1`, [ids.seller]).catch(() => undefined);
    await db.query(`DELETE FROM users WHERE id IN ($1,$2)`, [ids.buyer, ids.seller]).catch(() => undefined);
    await db.end().catch(() => undefined);
  });

  it('enforces uniqueness and foreign keys at the final integrity boundary', async () => {
    await db.query(`INSERT INTO wishlist_items (id,user_id,product_id) VALUES ($1,$2,$3)`, [randomUUID(), ids.buyer, ids.product]);
    await expect(db.query(`INSERT INTO wishlist_items (id,user_id,product_id) VALUES ($1,$2,$3)`, [randomUUID(), ids.buyer, ids.product]))
      .rejects.toMatchObject({ code: '23505' });
    await expect(db.query(`INSERT INTO wishlist_items (id,user_id,product_id) VALUES ($1,$2,$3)`, [randomUUID(), ids.buyer, randomUUID()]))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('serializes competing inventory reservations so stock cannot go negative', async () => {
    const a = new Client({ connectionString });
    const b = new Client({ connectionString });
    await Promise.all([a.connect(), b.connect()]);
    try {
      const reserve = (client: Client) => client.query(
        `UPDATE inventory
           SET available_quantity=available_quantity-1,
               reserved_quantity=reserved_quantity+1,
               updated_at=now()
         WHERE product_id=$1 AND available_quantity>=1
         RETURNING available_quantity,reserved_quantity`,
        [ids.product],
      );
      const [first, second] = await Promise.all([reserve(a), reserve(b)]);
      expect(first.rowCount! + second.rowCount!).toBe(1);
      const state = await db.query(`SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1`, [ids.product]);
      expect(state.rows[0]).toMatchObject({ available_quantity: 0, reserved_quantity: 1 });
    } finally {
      await Promise.all([a.end(), b.end()]);
    }
  });

  it('rolls back failed transaction work completely', async () => {
    const before = await db.query(`SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1`, [ids.product]);
    await db.query('BEGIN');
    try {
      await db.query(`UPDATE inventory SET available_quantity=999,reserved_quantity=0 WHERE product_id=$1`, [ids.product]);
      await db.query('ROLLBACK');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    const after = await db.query(`SELECT available_quantity,reserved_quantity FROM inventory WHERE product_id=$1`, [ids.product]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
