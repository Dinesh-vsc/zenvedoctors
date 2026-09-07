import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());
const port = Number(process.env.PORT || 4000);
const actor = (request) => request.header('x-actor') || 'Arjun Mehta';
const productInclude = { location: true, inventory: true };
const positiveQty = (value) => Number.isInteger(value) && value > 0;

app.get('/api/locations', async (_request, response) => response.json(await prisma.location.findMany({ orderBy: { name: 'asc' } })));
app.get('/api/products', async (_request, response) => response.json(await prisma.product.findMany({ include: productInclude, orderBy: { id: 'asc' } })));
app.get('/api/products/:id', async (request, response) => {
  const product = await prisma.product.findUnique({ where: { id: Number(request.params.id) }, include: productInclude });
  if (!product) return response.status(404).json({ error: 'Product not found' });
  return response.json(product);
});
app.get('/api/products/:id/ledger', async (request, response) => response.json(await prisma.inventoryLedger.findMany({ where: { productId: Number(request.params.id) }, orderBy: { timestamp: 'desc' } })));
app.get('/api/summary', async (_request, response) => {
  const totals = await prisma.inventory.aggregate({ _sum: { physical: true, reserved: true, available: true, damaged: true, quarantined: true } });
  const sum = totals._sum;
  response.json({ physical: sum.physical || 0, reserved: sum.reserved || 0, available: sum.available || 0, blocked: (sum.damaged || 0) + (sum.quarantined || 0) });
});

const transitions = {
  receive: { actionType: 'RECEIVE', changes: (qty) => ({ physical: { increment: qty }, available: { increment: qty } }) },
  'mark-damaged': { actionType: 'MARK_DAMAGED', changes: (qty) => ({ available: { decrement: qty }, damaged: { increment: qty } }), requires: 'available' },
  quarantine: { actionType: 'QUARANTINE', changes: (qty) => ({ available: { decrement: qty }, quarantined: { increment: qty } }), requires: 'available' },
  'release-quarantine': { actionType: 'RELEASE_QUARANTINE', changes: (qty) => ({ quarantined: { decrement: qty }, available: { increment: qty } }), requires: 'quarantined' },
  'order-placed': { actionType: 'ORDER_PLACED', changes: (qty) => ({ available: { decrement: qty }, reserved: { increment: qty } }), requires: 'available' },
  shipped: { actionType: 'SHIPPED', changes: (qty) => ({ reserved: { decrement: qty }, inTransit: { increment: qty } }), requires: 'reserved' },
  delivered: { actionType: 'DELIVERED', changes: (qty) => ({ inTransit: { decrement: qty } }), requires: 'inTransit' },
  cancelled: { actionType: 'CANCELLED', changes: (qty) => ({ reserved: { decrement: qty }, available: { increment: qty } }), requires: 'reserved' },
  'return-received': { actionType: 'RETURN_RECEIVED', changes: (qty) => ({ returned: { increment: qty } }) },
  'return-passed': { actionType: 'RETURN_PASSED', changes: (qty) => ({ returned: { decrement: qty }, available: { increment: qty } }), requires: 'returned' },
  'return-failed': { actionType: 'RETURN_FAILED', changes: (qty) => ({ returned: { decrement: qty }, damaged: { increment: qty } }), requires: 'returned' }
};

async function mutate(request, response) {
  const id = Number(request.params.id); const qty = request.body?.qty; const transition = transitions[request.params.action];
  if (!transition) return response.status(404).json({ error: 'Unknown inventory action' });
  if (!positiveQty(qty)) return response.status(400).json({ error: 'qty must be a positive integer' });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.inventory.findUnique({ where: { productId: id } });
      if (!current) throw new Error('Product inventory not found');
      if (transition.requires && current[transition.requires] < qty) throw new Error(`Cannot ${request.params.action}: ${transition.requires} would go below zero`);
      await transaction.inventory.update({ where: { productId: id }, data: transition.changes(qty) });
      await transaction.inventoryLedger.create({ data: { productId: id, actionType: transition.actionType, quantity: qty, actor: actor(request) } });
      return transaction.product.findUnique({ where: { id }, include: productInclude });
    });
    return response.json(result);
  } catch (error) { return response.status(error.message.includes('below zero') ? 400 : 404).json({ error: error.message }); }
}
for (const action of Object.keys(transitions)) app.post(`/api/products/:id/${action}`, mutate);

app.patch('/api/products/:id/location', async (request, response) => {
  const locationId = Number(request.body?.locationId);
  if (!Number.isInteger(locationId)) return response.status(400).json({ error: 'locationId must be an integer' });
  try { const product = await prisma.product.update({ where: { id: Number(request.params.id) }, data: { locationId }, include: productInclude }); return response.json(product); }
  catch { return response.status(400).json({ error: 'Product or location not found' }); }
});

app.listen(port, () => console.log(`ZENVE API listening on http://localhost:${port}`));
