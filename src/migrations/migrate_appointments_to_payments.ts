import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'villahermosa backend data');

function readJson(file: string) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(file: string, data: any) {
  const p = path.join(DATA_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function backup(file: string) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return;
  const dest = path.join(DATA_DIR, file + '.bak.' + Date.now());
  fs.copyFileSync(p, dest);
  console.log('Backup created:', dest);
}

function migrate() {
  console.log('Starting migration: appointments -> payments');
  backup('appointments.json');
  backup('finance_records.json');
  backup('patients.json');

  const appointments = readJson('appointments.json');
  const payments = readJson('payments.json') || [];

  let created = 0;
  for (const apt of appointments) {
    if (Array.isArray(apt.transactions) && apt.transactions.length > 0) {
      for (const t of apt.transactions) {
        const exists = payments.find((p: any) => p.transactionId === t.transactionId || p.id === t.id);
        if (exists) continue;
        const pay = {
          id: t.id || `pay_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          appointmentId: apt.id,
          patientId: apt.patientId,
          amount: t.amount,
          method: t.method,
          date: t.date,
          transactionId: t.transactionId,
          notes: t.notes || '',
          status: t.status || 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
          deleted: false,
        };
        payments.push(pay);
        created++;
      }
      // clear embedded transactions
      apt.transactions = [];
      // recompute totals
      const totalPaid = payments.filter((p: any) => p.appointmentId === apt.id).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      apt.totalPaid = totalPaid;
      apt.balance = (apt.price || 0) - totalPaid;
      if (apt.balance <= 0) apt.paymentStatus = 'paid';
      else if (totalPaid === 0) apt.paymentStatus = 'unpaid';
      else apt.paymentStatus = 'half-paid';
    }
  }

  if (created > 0) {
    writeJson('payments.json', payments);
    console.log('Created payments:', created);
  }

  writeJson('appointments.json', appointments);
  console.log('Updated appointments written.');
  console.log('Migration complete.');
}

if (require.main === module) {
  migrate();
}
