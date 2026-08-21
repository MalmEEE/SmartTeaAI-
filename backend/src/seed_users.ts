/**
 * SmartTeaAI — Demo user seed script
 * Run from the backend/ directory:  npm run seed
 *
 * Creates one account per role (idempotent — skips existing emails).
 * All accounts share the same demo password printed at the end.
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './users/user.entity';
import { RoleRequest } from './users/role-request.entity';

const ds = new DataSource({
  type:     'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [User, RoleRequest],
  synchronize: false,
});

const DEMO_PASSWORD = 'TeaDemo@2025';

const DEMO_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: 'Demo Farmer',   email: 'farmer@demo.test',   role: UserRole.FARMER   },
  { name: 'Demo Broker',   email: 'broker@demo.test',   role: UserRole.BROKER   },
  { name: 'Demo Exporter', email: 'exporter@demo.test', role: UserRole.EXPORTER },
  { name: 'Demo Buyer',    email: 'buyer@demo.test',    role: UserRole.BUYER    },
  { name: 'Demo Analyst',  email: 'analyst@demo.test',  role: UserRole.ANALYST  },
  { name: 'Demo Admin',    email: 'admin@demo.test',    role: UserRole.ADMIN    },
];

async function seed() {
  await ds.initialize();
  const repo = ds.getRepository(User);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log('\nSeeding SmartTeaAI demo accounts...\n');
  for (const u of DEMO_USERS) {
    const exists = await repo.findOne({ where: { email: u.email } });
    if (exists) {
      console.log(`  SKIP   ${u.email}  (already exists)`);
      continue;
    }
    await repo.save(repo.create({ ...u, password_hash: hash }));
    console.log(`  CREATE ${u.email}  (${u.role})`);
  }

  console.log('\n─────────────────────────────────────────');
  console.log('  Demo credentials');
  console.log('─────────────────────────────────────────');
  console.log(`  Shared password : ${DEMO_PASSWORD}`);
  console.log('');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(9)}  ${u.email}`);
  }
  console.log('─────────────────────────────────────────\n');

  await ds.destroy();
}

seed().catch(e => { console.error(e); process.exit(1); });
